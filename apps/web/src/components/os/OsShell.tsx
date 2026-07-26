'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import type {
  BreakEvenModel,
  BreakEvenSnapshot,
  ColombiaPayrollBreakdown,
} from '@fie/break-even-engine';
import { priceFromUtility, sumVariableCostsPerUnit } from '@fie/break-even-engine';
import type { SalesDashboardSnapshot } from '@fie/erp-integration';
import { Money } from '@fie/financial-engine';
import type {
  LiquidityPolicy,
  MarketingChannel,
  MarketingPortfolioVsActual,
  WorkspaceCentralConfig,
} from '@fie/shared';
import { AiRecommendPanel } from '@/components/os/AiRecommendPanel';
import { AlertsPanel } from '@/components/os/AlertsPanel';
import { AssumptionsPanel } from '@/components/os/AssumptionsPanel';
import { CalendarPanel } from '@/components/os/CalendarPanel';
import { CapacityPanel } from '@/components/os/CapacityPanel';
import { ClosingHistoryPanel } from '@/components/os/ClosingHistoryPanel';
import { ConfigPanel } from '@/components/os/ConfigPanel';
import { CostVersionsPanel } from '@/components/os/CostVersionsPanel';
import { DailyClosingGate } from '@/components/os/DailyClosingGate';
import { DebtsPanel } from '@/components/os/DebtsPanel';
import { GoalsPanel } from '@/components/os/GoalsPanel';
import { KpisPanel } from '@/components/os/KpisPanel';
import { PayrollColombiaPanel } from '@/components/os/PayrollColombiaPanel';
import { ReportsPanel } from '@/components/os/ReportsPanel';
import { ScenariosPanel } from '@/components/os/ScenariosPanel';
import { SectionAccordion } from '@/components/os/SectionAccordion';
import {
  actionComputeBreakEven,
  actionLoadDemo,
  actionMarketingPortfolio,
  actionRunBoard,
} from '@/lib/actions';
import { alertsToContextStrings, deriveOperationalAlerts } from '@/lib/alerts';
import {
  activeAssumptions,
  ASSUMPTION_META,
  formatAssumptionDisplay,
  loadAssumptionsWorkspace,
  type AssumptionsWorkspace,
} from '@/lib/assumptionsStore';
import { buildMonthEvents } from '@/lib/calendar';
import {
  createDemoDebtWorkspace,
  debtDashboard,
  optimizeExtraCash,
  type DebtWorkspace,
} from '@/lib/debtStore';
import type { LiquidityView } from '@/lib/engines';
import { assembleBoardFinancialContext, requestAiRecommendation } from '@/lib/aiRecommend';
import type { AiFinancialRecommendation, FinancialContext } from '@/lib/aiRecommend';
import { deriveOsCapacity } from '@/lib/board';
import {
  activeExtraordinaryCategories,
  activeExpenseCategories,
  activeSalesChannels,
  loadCentralConfig,
  saveCentralConfig,
} from '@/lib/configStore';
import {
  loadGoalsWorkspace,
  syncGoalsIntoConfigAmounts,
  type GoalsWorkspace,
} from '@/lib/goalsStore';
import { deriveKpis, kpisToContext } from '@/lib/kpis';
import { getStoredOpenAiKey } from '@/lib/openaiKey';
import { fetchSalesDashboard, pingApi, syncHeraInventory, syncHeraSalesMonth } from '@/lib/erpApi';
import type { HeraInventorySnapshot } from '@/lib/erpApi';
import { formatCop, formatNumber, formatPct } from '@/lib/format';
import { isLiquidityPolicyComplete, loadLiquidityPolicy } from '@/lib/policyStore';
import { loadCashSnapshot, saveCashSnapshot } from '@/lib/cashStore';
import { deriveNearTermCashPlan } from '@/lib/cashPlan';
import {
  cashAfterRecompra,
  recompraAmount,
  type WorkspaceCashSnapshot,
} from '@/lib/workspaceProfile';
import { applyHeraPayrollToModel } from '@/lib/heraPayroll';
import {
  applyMarginsToModel,
  loadMarginWorkspace,
  saveMarginWorkspace,
  type ChannelMarginRow,
  type MarginWorkspace,
} from '@/lib/marginStore';
import {
  evaluateScenarios,
  loadScenarioWorkspace,
  recommendScenario,
  saveScenarioWorkspace,
  type ScenarioRecommendation,
  type ScenarioWorkspace,
} from '@/lib/scenarioStore';
import { loadClosingBoardFacts, type ClosingBoardFacts } from '@/lib/closingFacts';
import type { ClosingStatus } from '@/lib/closingApi';
import {
  currentMonthStart,
  loadCostVersionsWorkspace,
  removeVersionsForLine,
  seedInitialVersion,
  type CostVersionsWorkspace,
} from '@/lib/costVersionsStore';
import { loadLastTab, persistLastTab } from '@/lib/uiLayoutStore';

type Tab =
  | 'overview'
  | 'costs'
  | 'sales'
  | 'debts'
  | 'marketing'
  | 'config'
  | 'goals'
  | 'kpis'
  | 'assumptions'
  | 'reports'
  | 'alerts'
  | 'calendar'
  | 'scenarios'
  | 'closings'
  | 'capacidad'
  | 'decision'
  | 'ai';

type ChannelBudgetRow = {
  channelId: string;
  label: string;
  budget: string;
  actual: string;
};

const TABS: { id: Tab; label: string }[] = [
  { id: 'capacidad', label: 'Capacidad' },
  { id: 'decision', label: 'Decisión' },
  { id: 'ai', label: 'CFO AI' },
  { id: 'overview', label: 'Resumen' },
  { id: 'sales', label: 'Ventas ERP' },
  { id: 'debts', label: 'Deudas' },
  { id: 'costs', label: 'Costos' },
  { id: 'marketing', label: 'Publicidad' },
  { id: 'config', label: 'Configuración' },
  { id: 'goals', label: 'Objetivos' },
  { id: 'kpis', label: 'KPIs' },
  { id: 'assumptions', label: 'Supuestos' },
  { id: 'reports', label: 'Reportes' },
  { id: 'alerts', label: 'Alertas' },
  { id: 'calendar', label: 'Calendario' },
  { id: 'scenarios', label: 'Escenarios' },
  { id: 'closings', label: 'Movimientos' },
];

const TAB_IDS = TABS.map((t) => t.id);

const PERIOD_FROM = '2026-07-01';
const PERIOD_TO = '2026-07-31';

function channelsToBudgetRows(
  config: WorkspaceCentralConfig,
  prev: ChannelBudgetRow[],
): ChannelBudgetRow[] {
  const active = activeSalesChannels(config);
  if (active.length === 0) return prev;
  return active.map((ch) => {
    const existing = prev.find((r) => r.channelId === ch.id);
    return {
      channelId: ch.id,
      label: ch.label,
      budget: existing?.budget ?? '0',
      actual: existing?.actual ?? '0',
    };
  });
}

export function OsShell() {
  const [tab, setTab] = useState<Tab>(() => loadLastTab(TAB_IDS, 'capacidad') as Tab);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<BreakEvenModel | null>(null);
  const [breakEven, setBreakEven] = useState<BreakEvenSnapshot | null>(null);
  const [liquidity, setLiquidity] = useState<LiquidityView | null>(null);
  const [portfolio, setPortfolio] = useState<MarketingPortfolioVsActual | null>(null);
  const [recommendation, setRecommendation] = useState<{
    action: string;
    rationale: string[];
    valid: boolean;
    suggestedExtraDebtPayment: string;
    adjustedMaxSafeExtraDebtPayment: string;
    marketingFreedCapacity: string;
    marketingOverspend: string;
    expectedImpact: {
      cashDeployedToDebt: string;
      interestSavedEstimate: string;
      runwayMonthsPreserved: string | null;
      safetyMarginUsed: string;
      capacityUsed: string;
    };
  } | null>(null);
  const [score, setScore] = useState<{ score: number; riskLevel: string } | null>(null);

  const [cashSnapshot, setCashSnapshot] = useState<WorkspaceCashSnapshot>(() => loadCashSnapshot());
  const [cash, setCash] = useState(() => loadCashSnapshot().cashOnHand || '');
  /** Free cash for extra debt — filled from near-term plan when derivable. */
  const [freeCash, setFreeCash] = useState('');
  const [proposedExtra, setProposedExtra] = useState('');
  const [liquidityPolicy, setLiquidityPolicy] = useState<LiquidityPolicy>(() =>
    loadLiquidityPolicy(),
  );
  const [centralConfig, setCentralConfig] = useState<WorkspaceCentralConfig>(() =>
    loadCentralConfig(),
  );
  const [goalsWs, setGoalsWs] = useState<GoalsWorkspace>(() => loadGoalsWorkspace());
  const [assumptionsWs, setAssumptionsWs] = useState<AssumptionsWorkspace>(() =>
    loadAssumptionsWorkspace(),
  );
  const [costVersionsWs, setCostVersionsWs] = useState<CostVersionsWorkspace>(() =>
    loadCostVersionsWorkspace(),
  );
  const [alertRate, setAlertRate] = useState('0.10');
  const [interestSaved, setInterestSaved] = useState('120000');
  const [channelRows, setChannelRows] = useState<ChannelBudgetRow[]>(() =>
    channelsToBudgetRows(loadCentralConfig(), [
      { channelId: 'tiktok', label: 'TikTok Ads', budget: '2100000', actual: '1800000' },
      { channelId: 'meta', label: 'Meta Ads', budget: '1500000', actual: '1200000' },
      { channelId: 'google', label: 'Google Ads', budget: '900000', actual: '900000' },
    ]),
  );
  const [newFixed, setNewFixed] = useState({ label: '', category: '', amount: '', dueDay: '' });
  const [newVariable, setNewVariable] = useState({ label: '', category: '', amount: '' });
  const [margins, setMargins] = useState<MarginWorkspace>(() => loadMarginWorkspace());
  const [scenarioWs, setScenarioWs] = useState<ScenarioWorkspace>(() => loadScenarioWorkspace());
  const [scenarioRec, setScenarioRec] = useState<ScenarioRecommendation | null>(null);
  const [salesDash, setSalesDash] = useState<SalesDashboardSnapshot | null>(null);
  const [inventorySnap, setInventorySnap] = useState<HeraInventorySnapshot | null>(null);
  const [apiOnline, setApiOnline] = useState(false);
  const [debtWs, setDebtWs] = useState<DebtWorkspace>(() => createDemoDebtWorkspace());
  const [aiRec, setAiRec] = useState<AiFinancialRecommendation | null>(null);
  const [aiPending, setAiPending] = useState(false);
  const [openaiConnected, setOpenaiConnected] = useState(false);
  const [closingStatus, setClosingStatus] = useState<ClosingStatus | null>(null);
  const [closingFacts, setClosingFacts] = useState<ClosingBoardFacts | null>(null);
  const [closingGateActive, setClosingGateActive] = useState(false);

  const reserveMonths = liquidityPolicy.reserveMonths;
  const minCashFloor = liquidityPolicy.minCashFloor ?? '';
  const workspaceCurrency = centralConfig.currency.trim() || model?.currency || 'COP';
  const marketingChannels: MarketingChannel[] = useMemo(
    () =>
      activeSalesChannels(centralConfig).map((c, i) => ({
        id: c.id,
        label: c.label,
        active: true,
        sortOrder: i,
      })),
    [centralConfig],
  );
  const expenseCategoryOptions = useMemo(
    () => activeExpenseCategories(centralConfig),
    [centralConfig],
  );
  const extraordinaryOptions = useMemo(
    () => activeExtraordinaryCategories(centralConfig),
    [centralConfig],
  );
  const earmarkedRecompra = useMemo(() => recompraAmount(cashSnapshot), [cashSnapshot]);
  const cashLeftAfterRecompra = useMemo(() => cashAfterRecompra(cashSnapshot), [cashSnapshot]);
  const cashPlan = useMemo(
    () =>
      deriveNearTermCashPlan({
        cash: { ...cashSnapshot, cashOnHand: cash || cashSnapshot.cashOnHand },
        model,
        debts: debtWs,
      }),
    [cashSnapshot, cash, model, debtWs],
  );

  const capacityLive = useMemo(
    () =>
      deriveOsCapacity({
        cash: { ...cashSnapshot, cashOnHand: cash || cashSnapshot.cashOnHand },
        policy: liquidityPolicy,
        currency: workspaceCurrency,
        model,
        debts: debtWs,
        monthlyFixedBurn: breakEven?.totalFixedCosts ?? '0',
        proposedExtraDebtPayment: proposedExtra.trim() || '0',
        marketingFreedCapacity: portfolio?.freedCapacityAmount,
        marketingOverspend: portfolio?.overspendAmount,
      }),
    [
      cashSnapshot,
      cash,
      liquidityPolicy,
      workspaceCurrency,
      model,
      debtWs,
      breakEven?.totalFixedCosts,
      proposedExtra,
      portfolio?.freedCapacityAmount,
      portfolio?.overspendAmount,
    ],
  );

  const operationalAlerts = useMemo(
    () =>
      deriveOperationalAlerts({
        cashOnHand: cash || cashSnapshot.cashOnHand,
        immediateFreeCash: capacityLive.immediateFreeCash,
        nextQuincena: capacityLive.nextQuincena,
        creditCardInstallment: capacityLive.creditCardInstallment,
        capacityGaps: capacityLive.gaps,
        liquidityPolicyComplete: isLiquidityPolicyComplete(liquidityPolicy),
        reserveMonths: reserveMonths,
        runwayMonths: liquidity?.runwayMonths ?? capacityLive.runwayMonths,
        minCashFloor: minCashFloor,
        safetyMargin: breakEven?.safetyMargin ?? null,
        safetyMarginRate: breakEven?.safetyMarginRate ?? null,
        marketingOverspend: portfolio?.overspendAmount ?? null,
        marketingAlert: Boolean(portfolio?.alert),
        pendingClosingDays: closingStatus?.pendingDays ?? [],
        inventorySkusBelowMin: inventorySnap?.skusBelowMin ?? null,
        inventorySkusWithStock: inventorySnap?.skusWithStock ?? null,
        debtDues: debtDashboard(debtWs).snapshots.map((s) => ({
          id: s.obligation.id,
          label: s.obligation.label,
          paymentDueDay: s.obligation.paymentDueDay,
          closed: Boolean(s.state.closed),
        })),
        fixedCostDues: (model?.fixedCosts ?? []).map((l) => ({
          id: l.id,
          label: l.label,
          dueDay: l.dueDay,
          active: l.active,
        })),
      }),
    [
      cash,
      cashSnapshot.cashOnHand,
      capacityLive,
      liquidityPolicy,
      reserveMonths,
      liquidity?.runwayMonths,
      minCashFloor,
      breakEven?.safetyMargin,
      breakEven?.safetyMarginRate,
      portfolio?.overspendAmount,
      portfolio?.alert,
      closingStatus?.pendingDays,
      inventorySnap?.skusBelowMin,
      inventorySnap?.skusWithStock,
      debtWs,
      model?.fixedCosts,
    ],
  );

  useEffect(() => {
    const next = cashPlan.immediateFreeCash;
    if (next != null) {
      setFreeCash((prev) => (prev === next ? prev : next));
    }
  }, [cashPlan.immediateFreeCash]);

  async function refreshClosingFacts(currentModel: BreakEvenModel | null = model): Promise<{
    status: ClosingStatus;
    facts: ClosingBoardFacts;
  } | null> {
    try {
      const { status, facts } = await loadClosingBoardFacts(currentModel, debtWs);
      setClosingStatus(status);
      setClosingFacts(facts);
      setClosingGateActive(status.pendingDays.length > 0);
      return { status, facts };
    } catch {
      /* closing API offline — do not invent status */
      return null;
    }
  }

  useEffect(() => {
    void refreshClosingFacts();
  }, []);

  function persistCashField(nextCash: string) {
    setCash(nextCash);
    const next = saveCashSnapshot({ ...cashSnapshot, cashOnHand: nextCash });
    setCashSnapshot(next);
  }

  function persistRecompraShare(share: string) {
    const next = saveCashSnapshot({ ...cashSnapshot, recompraShareOfCash: share });
    setCashSnapshot(next);
  }

  const fixedBurn = useMemo(() => breakEven?.totalFixedCosts ?? '0', [breakEven]);
  const debtDash = useMemo(() => debtDashboard(debtWs), [debtWs]);
  const debtOpt = useMemo(
    () => optimizeExtraCash(debtWs, proposedExtra.trim() || '1200000'),
    [debtWs, proposedExtra],
  );
  const boardKpis = useMemo(
    () =>
      deriveKpis({
        currency: workspaceCurrency,
        cashOnHand: cash || cashSnapshot.cashOnHand || null,
        immediateFreeCash: capacityLive.immediateFreeCash,
        runwayMonths: liquidity?.runwayMonths ?? capacityLive.runwayMonths,
        reserveMonths: reserveMonths || null,
        reserveAmount: liquidity?.reserveAmount ?? capacityLive.reserveAmount,
        maxSafeExtraDebtPayment: liquidity?.maxSafeExtraDebtPayment ?? capacityLive.canPayDebtExtra,
        breakEvenSales: breakEven?.breakEvenSales ?? null,
        projectedSales: breakEven?.projectedSales ?? null,
        safetyMargin: breakEven?.safetyMargin ?? null,
        safetyMarginRate: breakEven?.safetyMarginRate ?? null,
        contributionMarginRate: breakEven?.contributionMarginRate ?? null,
        totalFixedCosts: breakEven?.totalFixedCosts ?? null,
        monthSales: salesDash?.month.netSales ?? null,
        totalDebtBalance: debtDash.totalBalance,
        estimatedMonthlyInterest: debtDash.estimatedMonthlyInterest,
        monthlyInstallmentsDue: debtDash.monthlyInstallmentsDue,
        marketingBudget: portfolio?.totalBudgetAmount ?? null,
        marketingActual: portfolio?.totalActualAmount ?? null,
        inventoryUnits: inventorySnap?.units ?? null,
        inventoryValueAtCost: inventorySnap?.valueAtCost ?? null,
        skusBelowMin: inventorySnap?.skusBelowMin ?? null,
        skusWithStock: inventorySnap?.skusWithStock ?? null,
        healthScore: score?.score ?? null,
        riskLevel: score?.riskLevel ?? null,
      }),
    [
      workspaceCurrency,
      cash,
      cashSnapshot.cashOnHand,
      capacityLive,
      liquidity,
      reserveMonths,
      breakEven,
      salesDash?.month.netSales,
      debtDash,
      portfolio?.totalBudgetAmount,
      portfolio?.totalActualAmount,
      inventorySnap,
      score,
    ],
  );

  function loadDemo() {
    setError(null);
    startTransition(async () => {
      try {
        const { model: demo } = await actionLoadDemo();
        let next = demo;
        try {
          next = applyMarginsToModel(demo, loadMarginWorkspace());
        } catch {
          /* keep demo products if margins incomplete */
        }
        setModel(next);
        setBreakEven(await actionComputeBreakEven(next));
        goToTab('capacidad');
        void refreshClosingFacts(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error cargando demo');
      }
    });
  }

  function recomputeBreakEven(next: BreakEvenModel) {
    setModel(next);
    setError(null);
    startTransition(async () => {
      try {
        setBreakEven(await actionComputeBreakEven(next));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error en punto de equilibrio');
      }
    });
  }

  /** Keep channel sale prices in sync when unit costs or margin policy change. */
  function recomputeWithMargins(nextModel: BreakEvenModel, nextMargins = margins) {
    try {
      recomputeBreakEven(applyMarginsToModel(nextModel, nextMargins));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error aplicando márgenes');
      recomputeBreakEven(nextModel);
    }
  }

  useEffect(() => {
    loadDemo();
  }, []);

  async function refreshSalesFromErp() {
    const online = await pingApi();
    setApiOnline(online);
    if (!online) {
      setSalesDash(null);
      return;
    }
    try {
      const synced = await syncHeraSalesMonth();
      setSalesDash(synced.dashboard);
      if (model) {
        const next = { ...model, projectedSales: synced.dashboard.month.netSales };
        setModel(next);
        setBreakEven(await actionComputeBreakEven(next));
      }
    } catch (e) {
      try {
        const dash = await fetchSalesDashboard();
        setSalesDash(dash);
      } catch {
        setError(e instanceof Error ? e.message : 'No se pudo sincronizar ventas Hera');
      }
    }
  }

  async function refreshInventoryFromErp() {
    try {
      const result = await syncHeraInventory();
      setInventorySnap(result.snapshot);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo sincronizar inventario Hera');
    }
  }

  useEffect(() => {
    void refreshSalesFromErp();
    void refreshInventoryFromErp();
    const id = window.setInterval(() => {
      void refreshSalesFromErp();
      void refreshInventoryFromErp();
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  function updateFixedCost(
    id: string,
    patch: Partial<{ label: string; category: string; amount: string; dueDay: number | undefined }>,
  ) {
    if (!model) return;
    recomputeBreakEven({
      ...model,
      fixedCosts: model.fixedCosts.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    });
  }

  function removeFixedCost(id: string) {
    if (!model) return;
    const remaining = model.fixedCosts
      .filter((l) => l.id !== id)
      .map((l, idx) => ({ ...l, sortOrder: idx }));
    setCostVersionsWs(removeVersionsForLine(costVersionsWs, id));
    recomputeBreakEven({ ...model, fixedCosts: remaining });
  }

  function addFixedCost() {
    if (!model) return;
    const label = newFixed.label.trim();
    const category = newFixed.category.trim() || 'General';
    const amount = newFixed.amount.trim() || '0';
    if (!label) {
      setError('Escribe un nombre para el costo fijo nuevo.');
      return;
    }
    const id = `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const nextSort =
      model.fixedCosts.reduce((max, l) => (l.sortOrder > max ? l.sortOrder : max), -1) + 1;
    const dueDayNum = Number(newFixed.dueDay);
    const seeded = seedInitialVersion(costVersionsWs, {
      lineId: id,
      amount,
      effectiveFrom: currentMonthStart(),
      notes: 'Alta de costo fijo',
    });
    if (seeded.ok) setCostVersionsWs(seeded.workspace);
    recomputeBreakEven({
      ...model,
      fixedCosts: [
        ...model.fixedCosts,
        {
          id,
          label,
          category,
          amount,
          active: true,
          sortOrder: nextSort,
          ...(Number.isFinite(dueDayNum) && dueDayNum >= 1 && dueDayNum <= 31
            ? { dueDay: dueDayNum }
            : {}),
        },
      ],
    });
    setNewFixed({ label: '', category: '', amount: '', dueDay: '' });
    setError(null);
  }

  function updateVariableCost(
    id: string,
    patch: Partial<{ label: string; category: string; amount: string }>,
  ) {
    if (!model) return;
    recomputeWithMargins({
      ...model,
      variableCosts: model.variableCosts.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    });
  }

  function removeVariableCost(id: string) {
    if (!model) return;
    const remaining = model.variableCosts
      .filter((l) => l.id !== id)
      .map((l, idx) => ({ ...l, sortOrder: idx }));
    recomputeWithMargins({ ...model, variableCosts: remaining });
  }

  function addVariableCost() {
    if (!model) return;
    const label = newVariable.label.trim();
    const category = newVariable.category.trim() || 'Variable';
    const amount = newVariable.amount.trim() || '0';
    if (!label) {
      setError('Escribe un nombre para el costo variable.');
      return;
    }
    const id = `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const nextSort =
      model.variableCosts.reduce((max, l) => (l.sortOrder > max ? l.sortOrder : max), -1) + 1;
    recomputeWithMargins({
      ...model,
      variableCosts: [
        ...model.variableCosts,
        { id, label, category, amount, active: true, sortOrder: nextSort },
      ],
    });
    setNewVariable({ label: '', category: '', amount: '' });
    setError(null);
  }

  function updateChannelMargin(id: string, patch: Partial<ChannelMarginRow>) {
    const next: MarginWorkspace = {
      ...margins,
      channels: margins.channels.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    };
    setMargins(next);
  }

  function saveMarginsAndApply() {
    if (!model) return;
    const saved = saveMarginWorkspace(margins);
    setMargins(saved);
    recomputeWithMargins(model, saved);
  }

  function runScenarioEvaluation() {
    const capacity = freeCash.trim() || cashPlan.immediateFreeCash || '0';
    const evaluations = evaluateScenarios({
      definitions: scenarioWs.definitions,
      immediateCapacity: capacity,
    });
    const rec = recommendScenario({
      evaluations,
      immediateCapacity: capacity,
      cashTight: Number(cashSnapshot.recompraShareOfCash || 0) >= 0.6,
      safetyMarginRate: breakEven?.safetyMarginRate ?? null,
      reserveIsHardFloor: liquidityPolicy.reserveIsHardFloor,
    });
    const next = saveScenarioWorkspace({
      ...scenarioWs,
      lastEvaluations: evaluations,
      preferredScenarioId: rec?.recommendedId ?? scenarioWs.preferredScenarioId,
    });
    setScenarioWs(next);
    setScenarioRec(rec);
  }

  function applyColombiaPayroll(breakdown: ColombiaPayrollBreakdown) {
    if (!model) return;
    const existing = model.fixedCosts.find(
      (l) => l.id === 'f_nomina' || l.kind === 'payroll_with_provisions',
    );
    const notes = [
      `Auto SMMLV ${breakdown.year}: base ${breakdown.baseSalary}.`,
      `Total ${breakdown.totalMonthly}; quincena ${breakdown.quincenaTotal}.`,
      breakdown.source,
    ].join(' ');
    if (existing) {
      recomputeBreakEven({
        ...model,
        fixedCosts: model.fixedCosts.map((l) =>
          l.id === existing.id
            ? {
                ...l,
                label: 'NOMINA CON PROVISION',
                category: 'Nómina',
                kind: 'payroll_with_provisions',
                amount: breakdown.totalMonthly,
                notes,
                active: true,
              }
            : l,
        ),
      });
    } else {
      const nextSort =
        model.fixedCosts.reduce((max, l) => (l.sortOrder > max ? l.sortOrder : max), -1) + 1;
      recomputeBreakEven({
        ...model,
        fixedCosts: [
          ...model.fixedCosts,
          {
            id: 'f_nomina',
            label: 'NOMINA CON PROVISION',
            category: 'Nómina',
            kind: 'payroll_with_provisions',
            amount: breakdown.totalMonthly,
            notes,
            active: true,
            sortOrder: nextSort,
          },
        ],
      });
    }
    setError(null);
  }

  function applyHeraEmployeesPayroll(input: {
    totalMonthly: string;
    quincenaTotal: string;
    workerCount: number;
    year: number;
    notes: string;
  }) {
    if (!model) return;
    recomputeBreakEven(
      applyHeraPayrollToModel(model, {
        totalMonthly: input.totalMonthly,
        workerCount: input.workerCount,
        year: input.year,
        notes: `${input.notes} Quincena ≈ ${input.quincenaTotal}.`,
      }),
    );
    setError(null);
  }

  function buildBoardContext(overrideClosing?: ClosingBoardFacts | null): FinancialContext {
    const alerts: string[] = alertsToContextStrings(operationalAlerts);
    if (portfolio?.alert && !alerts.some((a) => a.includes('ADS_OVER'))) {
      alerts.push('Hay desviación de publicidad vs presupuesto según la política configurada.');
    }
    if (
      !isLiquidityPolicyComplete(liquidityPolicy) &&
      !alerts.some((a) => a.includes('LIQUIDITY_POLICY'))
    ) {
      alerts.push('Falta política de liquidez (reserva en meses).');
    }
    const closing = overrideClosing ?? closingFacts;
    return assembleBoardFinancialContext({
      currency: workspaceCurrency,
      sales: salesDash
        ? {
            dayNet: salesDash.day.netSales,
            dayCount: salesDash.day.salesCount,
            monthNet: salesDash.month.netSales,
            monthCount: salesDash.month.salesCount,
            accumulatedNet: salesDash.accumulated.netSales,
            accumulatedCount: salesDash.accumulated.salesCount,
            source: 'tes_movimientos.venta_pos',
          }
        : null,
      breakEven: breakEven
        ? {
            breakEvenSales: breakEven.breakEvenSales,
            projectedSales: breakEven.projectedSales,
            safetyMargin: breakEven.safetyMargin,
            safetyMarginRate: breakEven.safetyMarginRate,
            contributionMarginRate: breakEven.contributionMarginRate,
            totalFixedCosts: breakEven.totalFixedCosts,
          }
        : null,
      liquidity: {
        cash,
        monthlyFixedBurn: fixedBurn,
        monthlyFreeCashFlow: freeCash,
        reserveMonths: reserveMonths || null,
        runwayMonths: liquidity?.runwayMonths ?? capacityLive.runwayMonths ?? null,
        maxSafeExtraDebtPayment:
          liquidity?.maxSafeExtraDebtPayment ?? capacityLive.canPayDebtExtra ?? null,
      },
      capacity: {
        canSpendToday: capacityLive.canSpendToday,
        canInvest: capacityLive.canInvest,
        canPayDebtExtra: capacityLive.canPayDebtExtra,
        canRestock: capacityLive.canRestock,
        canWithdrawProfit: capacityLive.canWithdrawProfit,
        canSpendAds: capacityLive.canSpendAds,
        immediateFreeCash: capacityLive.immediateFreeCash,
        recompraEarmark: capacityLive.recompraEarmark,
        nextQuincena: capacityLive.nextQuincena,
        creditCardInstallment: capacityLive.creditCardInstallment,
        gaps: capacityLive.gaps,
      },
      workspaceConfig: {
        currency: workspaceCurrency,
        fiscalYearStartMonth: centralConfig.fiscalYearStartMonth || null,
        closingDaysOfMonth: centralConfig.closingDaysOfMonth || null,
        operatingDaysPerMonth: centralConfig.operatingDaysPerMonth || null,
        targetProfitAmount: centralConfig.targetProfitAmount || null,
        debtReductionTargetAmount: centralConfig.debtReductionTargetAmount || null,
        inventoryRestockCycleDays: centralConfig.inventoryRestockCycleDays || null,
        activeSalesChannelLabels: marketingChannels.map((c) => c.label),
        expenseCategoryLabels: expenseCategoryOptions.map((c) => c.label),
      },
      calendar: (() => {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth() + 1;
        const monthEvents = buildMonthEvents({
          year: y,
          month: m,
          source: {
            fixedCosts: (model?.fixedCosts ?? []).map((l) => ({
              id: l.id,
              label: l.label,
              amount: l.amount,
              category: l.category,
              active: l.active,
              dueDay: l.dueDay,
            })),
            obligations: debtWs.obligations.map((o) => ({
              id: o.id,
              label: o.label,
              active: o.active,
              paymentDueDay: o.paymentDueDay,
              targetPaymentAmount: o.targetPaymentAmount,
              fixedInstallmentAmount: o.fixedInstallmentAmount,
              minimumPaymentAmount: o.minimumPaymentAmount,
            })),
          },
          closingDaysOfMonth: centralConfig.closingDaysOfMonth,
          payrollMonthly: capacityLive.payrollMonthly,
          inventoryRestockCycleDays: centralConfig.inventoryRestockCycleDays,
          asOf: now,
        });
        const today = now.getDate();
        const upcoming = monthEvents
          .filter((e) => e.day >= today)
          .slice(0, 12)
          .map((e) => ({
            date: e.date,
            kind: e.kind,
            label: e.label,
            amount: e.amount,
            status: e.status,
          }));
        return {
          yearMonth: `${y}-${String(m).padStart(2, '0')}`,
          eventCount: monthEvents.length,
          upcoming,
        };
      })(),
      goals: {
        northStar: goalsWs.northStar || null,
        active: goalsWs.goals
          .filter((g) => g.status === 'active')
          .map((g) => ({
            id: g.id,
            kind: g.kind,
            title: g.title,
            targetAmount: g.targetAmount || null,
            targetDate: g.targetDate || null,
            relatedObligationId: g.relatedObligationId || null,
            notes: g.notes || null,
            status: g.status,
          })),
      },
      kpis: kpisToContext(boardKpis),
      assumptions: {
        setLabel: assumptionsWs.setLabel || null,
        fields: assumptionsWs.fields.map((f) => ({
          key: f.key,
          label: ASSUMPTION_META[f.key].label,
          value: f.value || null,
          display: f.value ? formatAssumptionDisplay(f) : null,
          notes: f.notes || null,
          active: f.active,
        })),
      },
      health: score ? { score: score.score, riskLevel: score.riskLevel } : null,
      engineRecommendation: recommendation
        ? {
            action: recommendation.action,
            suggestedExtraDebtPayment: recommendation.suggestedExtraDebtPayment,
            adjustedMaxSafeExtraDebtPayment: recommendation.adjustedMaxSafeExtraDebtPayment,
            valid: recommendation.valid,
            rationale: recommendation.rationale,
          }
        : null,
      debts: {
        totalBalance: debtDash.totalBalance,
        estimatedMonthlyInterest: debtDash.estimatedMonthlyInterest,
        monthlyInstallmentsDue: debtDash.monthlyInstallmentsDue,
        obligationCount: debtDash.obligationCount,
        allowsExtraPaymentCount: debtDash.allowsExtraPaymentCount,
        optimizerSuggestedTarget: debtOpt.suggestedTargetObligationId,
        optimizerSuggestedAmount: debtOpt.suggestedAmount,
        optimizerRationale: debtOpt.rationale,
        obligations: debtDash.snapshots.map((s) => ({
          label: s.obligation.label,
          kindLabel: s.obligation.kindLabel,
          balance: s.balance,
          estimatedMonthlyInterest: s.estimatedMonthlyInterest,
          allowsExtraPayments: s.obligation.allowsExtraPayments,
          interestOnlyPayments: Boolean(s.obligation.interestOnlyPayments),
          ratePercent: s.obligation.ratePercent ?? null,
          ratePeriodicity: s.obligation.ratePeriodicity,
          purpose: s.obligation.purpose ?? null,
        })),
      },
      marketing: {
        totalBudget: portfolio?.totalBudgetAmount ?? null,
        totalActual: portfolio?.totalActualAmount ?? null,
        freedCapacityAmount: portfolio?.freedCapacityAmount ?? null,
        overspendAmount: portfolio?.overspendAmount ?? null,
        channels: channelRows.map((r) => ({
          label: r.label,
          budget: r.budget,
          actual: r.actual,
        })),
      },
      costs: {
        fixedCostLines: (model?.fixedCosts ?? []).map((l) => ({
          label: l.label,
          category: l.category,
          amount: l.amount,
        })),
        amountVersions: costVersionsWs.versions.map((v) => {
          const line = model?.fixedCosts.find((l) => l.id === v.lineId);
          return {
            label: line?.label ?? v.lineId,
            amount: v.amount,
            effectiveFrom: v.effectiveFrom,
            notes: v.notes,
          };
        }),
      },
      inventory: inventorySnap
        ? {
            units: inventorySnap.units,
            valueAtCost: inventorySnap.valueAtCost,
            valueAtPrice: inventorySnap.valueAtPrice,
            skuCount: inventorySnap.skuCount,
            skusWithStock: inventorySnap.skusWithStock,
            skusBelowMin: inventorySnap.skusBelowMin,
            source: inventorySnap.source,
          }
        : null,
      scenarios: {
        immediateCapacity: freeCash.trim() || cashPlan.immediateFreeCash || null,
        preferredScenarioId: scenarioWs.preferredScenarioId ?? null,
        evaluations: scenarioWs.lastEvaluations.map((e) => ({
          id: e.id,
          label: e.label,
          kind: e.kind,
          extraDebtPayment: e.extraDebtPayment,
          restockAllocation: e.restockAllocation,
          capacityLeft: e.capacityLeft,
          notes: e.notes,
        })),
      },
      dailyClosing: closing ?? {
        seriesStart: closingStatus?.seriesStart ?? null,
        today: closingStatus?.today ?? null,
        pendingDays: closingStatus?.pendingDays ?? [],
        lastClosed: closingStatus?.lastClosed ?? null,
        canGenerateRecommendations: closingStatus?.canGenerateRecommendations ?? null,
        recentClosings: [],
        fixedCostsThisMonth: [],
        commitments: [],
      },
      alerts,
      notes: [
        'Motores del OS calcularon BEP, liquidez, risk score y debt optimizer.',
        'AI solo interpreta; no recalcula.',
        liquidityPolicy.reserveIsHardFloor
          ? 'Política: reserva intocable para abonos extra.'
          : 'Política: reserva blanda (no intocable) — priorizar operación y recompra.',
        liquidityPolicy.minCashFloor
          ? `Piso mínimo de caja: ${liquidityPolicy.minCashFloor}`
          : 'Sin piso absoluto de caja.',
        liquidityPolicy.notes ? `Notas política: ${liquidityPolicy.notes}` : '',
        'Objetivo declarado: salir de deudas sin perder liquidez operativa; robustecer el negocio.',
        goalsWs.northStar ? `Visión norte (Objetivos): ${goalsWs.northStar}` : '',
        ...goalsWs.goals
          .filter((g) => g.status === 'active')
          .map(
            (g) =>
              `Objetivo activo [${g.kind}]: ${g.title}${g.targetAmount ? ` · meta ${g.targetAmount}` : ''}${g.targetDate ? ` · hasta ${g.targetDate}` : ''}.`,
          ),
        assumptionsWs.setLabel ? `Set de supuestos: ${assumptionsWs.setLabel}.` : '',
        ...activeAssumptions(assumptionsWs).map(
          (f) =>
            `Supuesto ${ASSUMPTION_META[f.key].label}: ${formatAssumptionDisplay(f)}${f.notes ? ` (${f.notes})` : ''}.`,
        ),
        centralConfig.targetProfitAmount
          ? `Meta utilidad (config): ${centralConfig.targetProfitAmount}.`
          : 'Meta utilidad no definida en Configuración.',
        centralConfig.debtReductionTargetAmount
          ? `Meta reducción deuda (config): ${centralConfig.debtReductionTargetAmount}.`
          : 'Meta reducción deuda no definida en Configuración.',
        centralConfig.inventoryRestockCycleDays
          ? `Ciclo recompra inventario (días): ${centralConfig.inventoryRestockCycleDays}.`
          : '',
        `Año fiscal inicia mes ${centralConfig.fiscalYearStartMonth || '—'}. Días cierre: ${centralConfig.closingDaysOfMonth || 'solo registro diario'}.`,
        `Caja hoy: ${cash || '—'}; ~${Math.round(Number(cashSnapshot.recompraShareOfCash || 0) * 100)}% earmarked a recompra (≈ ${earmarkedRecompra}).`,
        `Tras recompra queda ≈ ${cashLeftAfterRecompra}.`,
        cashPlan.payrollMonthly
          ? `Nómina mensual (costos fijos + provisiones): ${cashPlan.payrollMonthly}; próxima quincena: ${cashPlan.nextQuincena}.`
          : 'Nómina no encontrada en costos fijos.',
        cashPlan.creditCardInstallment
          ? `Cuota TC: ${cashPlan.creditCardInstallment}.`
          : 'Cuota TC no encontrada en deudas.',
        `Días de calendario de ventas restantes en el mes (incluye hoy): ${cashPlan.remainingCalendarDaysInMonth}.`,
        freeCash.trim()
          ? `Capacidad inmediata (tras recompra + quincena + cuota TC): ${freeCash}`
          : 'Capacidad inmediata pendiente de datos.',
        ...cashPlan.notes,
        cashSnapshot.commitments.notes ?? '',
        `COGS prenda: ${margins.productCost || '—'}. Márgenes por canal: ${margins.channels
          .map((c) => `${c.label} utilidad ${c.utilityOnPrice} mix ${c.mixWeight}`)
          .join('; ')}.`,
        breakEven ? `Margen contribución blend: ${breakEven.contributionMarginRate}` : '',
        inventorySnap
          ? `Inventario Hera: ${inventorySnap.units} uds · ${inventorySnap.valueAtCost} a costo · ${inventorySnap.skusWithStock}/${inventorySnap.skuCount} SKUs · bajo mínimo ${inventorySnap.skusBelowMin}.`
          : 'Inventario aún no sincronizado desde Hera.',
        scenarioRec ? `OS recomienda escenario: ${scenarioRec.summary}` : '',
        closingStatus?.pendingDays.length
          ? `Registro de movimientos pendientes: ${closingStatus.pendingDays.join(', ')}.`
          : closingStatus
            ? 'Registro diario de movimientos al día — historial disponible para AI.'
            : 'Estado de registro de movimientos no disponible.',
        costVersionsWs.versions.length
          ? `Versiones de costos fijos: ${costVersionsWs.versions.length} segmento(s) con vigencia.`
          : 'Sin versiones de costos fijos — as-of histórico reportará gaps hasta versionar.',
      ].filter(Boolean),
    });
  }

  function runDecisionStack() {
    if (!breakEven) return;
    if (!isLiquidityPolicyComplete(liquidityPolicy)) {
      setError('Define primero la política de liquidez (pestaña Configuración).');
      goToTab('config');
      return;
    }
    if (!cash.trim()) {
      setError('Indica la caja disponible hoy.');
      goToTab('capacidad');
      return;
    }
    if (!freeCash.trim() && capacityLive.immediateFreeCash == null) {
      setError(
        'Falta capacidad inmediata. Completa nómina en costos y cuota TC en deudas, o revisa Capacidad.',
      );
      goToTab('capacidad');
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const mkt = await actionMarketingPortfolio({
          currency: workspaceCurrency,
          periodFrom: PERIOD_FROM,
          periodTo: PERIOD_TO,
          channels: marketingChannels.length
            ? marketingChannels
            : channelRows.map((row, i) => ({
                id: row.channelId,
                label: row.label,
                active: true,
                sortOrder: i,
              })),
          budgets: channelRows.map((row) => ({
            id: `b-${row.channelId}`,
            channelId: row.channelId,
            periodFrom: PERIOD_FROM,
            periodTo: PERIOD_TO,
            budgetAmount: row.budget || '0',
            currency: workspaceCurrency,
            notes: row.label,
          })),
          actuals: channelRows.map((row) => ({
            id: `a-${row.channelId}`,
            channelId: row.channelId,
            occurredOn: '2026-07-15',
            actualAmount: row.actual || '0',
            currency: workspaceCurrency,
            notes: row.label,
          })),
          policy: { alertDeviationRate: alertRate },
        });
        setPortfolio(mkt);

        // Single entry: orchestrator validates, orders engines, derives risk if omitted.
        const board = await actionRunBoard({
          cash: { ...cashSnapshot, cashOnHand: cash },
          policy: liquidityPolicy,
          currency: workspaceCurrency,
          model,
          debts: debtWs,
          monthlyFixedBurn: fixedBurn,
          proposedExtraDebtPayment: proposedExtra.trim() || undefined,
          futureInterestSaved: interestSaved,
          marketingFreedCapacity: mkt.freedCapacityAmount,
          marketingOverspend: mkt.overspendAmount,
          ...(inventorySnap
            ? {
                inventoryHint: {
                  units: inventorySnap.units,
                  skusBelowMin: inventorySnap.skusBelowMin,
                  skusWithStock: inventorySnap.skusWithStock,
                },
              }
            : {}),
        });

        if (board.liquidity) {
          setLiquidity(board.liquidity);
        }
        if (board.breakEven) {
          setBreakEven(board.breakEven);
        }

        const opt = board.debtOptimizer;
        if (opt && !proposedExtra.trim() && opt.suggestedAmount !== '0') {
          setProposedExtra(opt.suggestedAmount);
        }

        if (board.capacity.immediateFreeCash != null) {
          setFreeCash(board.capacity.immediateFreeCash);
        }

        if (board.recommendation) {
          const enriched = {
            ...board.recommendation,
            rationale: [
              ...board.recommendation.rationale,
              ...(opt?.rationale ?? []),
              opt?.suggestedTargetObligationId
                ? `Objetivo de abono sugerido por Debt Optimizer: ${opt.ranked.find((r) => r.obligationId === opt.suggestedTargetObligationId)?.label ?? opt.suggestedTargetObligationId} (${opt.suggestedAmount}).`
                : 'Debt Optimizer: sin candidato de abono extra (orquestador).',
              ...board.alertsLite.map((a) => `Orquestador: ${a}`),
              `Pipeline: ${board.pipeline.join(' → ')}`,
            ],
          };
          setRecommendation(enriched);
        }
        if (board.score) {
          setScore(board.score);
        }
        goToTab('decision');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error en decisión');
      }
    });
  }

  async function generateAiRecommendation() {
    if (!getStoredOpenAiKey()) {
      setError('Conecta tu API key de OpenAI en la pestaña CFO AI.');
      goToTab('ai');
      return;
    }
    if (closingStatus && closingStatus.pendingDays.length > 0) {
      setError(
        `Hay ${closingStatus.pendingDays.length} día(s) sin actualizar. Completa el registro de movimientos (o marca «sin movimientos») antes de generar recomendaciones.`,
      );
      setClosingGateActive(true);
      return;
    }
    setError(null);
    setAiPending(true);
    try {
      const refreshed = await refreshClosingFacts();
      if (refreshed && refreshed.status.pendingDays.length > 0) {
        setError(
          `Hay ${refreshed.status.pendingDays.length} día(s) sin actualizar. Completa el registro de movimientos antes de generar recomendaciones.`,
        );
        setClosingGateActive(true);
        return;
      }
      const rec = await requestAiRecommendation(buildBoardContext(refreshed?.facts ?? null));
      setAiRec(rec);
      goToTab('ai');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error generando recomendación AI');
    } finally {
      setAiPending(false);
    }
  }

  const hasPendingClosings = Boolean(closingStatus && closingStatus.pendingDays.length > 0);

  function goToTab(next: Tab) {
    setTab(next);
    persistLastTab(next);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
      {closingGateActive && hasPendingClosings ? (
        <DailyClosingGate
          model={model}
          debtWs={debtWs}
          onDebtWsChange={setDebtWs}
          onCashChange={(nextCash) => {
            persistCashField(nextCash);
          }}
          onStatusChange={(s) => {
            setClosingStatus(s);
            setClosingGateActive(s.pendingDays.length > 0);
          }}
          onClosed={() => {
            setClosingGateActive(false);
            void refreshClosingFacts();
          }}
          movementCategories={extraordinaryOptions}
          expenseCategories={expenseCategoryOptions}
        />
      ) : null}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="brand-mark text-3xl text-forest md:text-4xl">Capacidad Financiera</h1>
          <p className="mt-1 text-sm text-muted">
            Home del dueño: qué puedes hacer hoy con tu caja. Los demás módulos alimentan estas
            respuestas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadDemo}
            className="rounded-full border border-[var(--line)] bg-white/70 px-4 py-2 text-sm font-medium"
          >
            Recargar demo
          </button>
          <button
            type="button"
            onClick={runDecisionStack}
            className="rounded-full bg-forest px-4 py-2 text-sm font-semibold text-mist"
          >
            Calcular decisión
          </button>
          <button
            type="button"
            onClick={() => goToTab('ai')}
            className="rounded-full border border-forest bg-moss px-4 py-2 text-sm font-semibold text-mist"
          >
            CFO AI
          </button>
        </div>
      </div>

      <nav className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              goToTab(t.id);
            }}
            className={`rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap ${
              tab === t.id ? 'bg-forest text-mist' : 'bg-white/60 text-ink/80'
            }`}
          >
            {t.label}
            {t.id === 'alerts' && operationalAlerts.some((a) => a.severity === 'critical')
              ? ` (${operationalAlerts.filter((a) => a.severity === 'critical').length})`
              : t.id === 'alerts' && operationalAlerts.length > 0
                ? ` (${operationalAlerts.length})`
                : ''}
          </button>
        ))}
      </nav>

      {pending ? <p className="mb-4 text-sm text-muted">Calculando con los motores…</p> : null}
      {error ? (
        <p className="mb-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {tab === 'overview' && breakEven ? (
        <section className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Metric
              title="Punto de equilibrio"
              value={formatCop(breakEven.breakEvenSales)}
              hint={`${formatNumber(breakEven.breakEvenUnits)} und/mes`}
            />
            <Metric
              title="Margen de seguridad"
              value={formatCop(breakEven.safetyMargin)}
              hint={formatPct(breakEven.safetyMarginRate)}
            />
            <Metric
              title="Ventas mes (ERP)"
              value={formatCop(salesDash?.month.netSales ?? breakEven.projectedSales)}
              hint={
                apiOnline
                  ? `${salesDash?.month.salesCount ?? 0} pedidos · vivo`
                  : 'API offline — usa proyección demo'
              }
            />
            <Metric
              title="Ventas hoy (ERP)"
              value={formatCop(salesDash?.day.netSales ?? null)}
              hint={
                salesDash
                  ? `Ticket prom. ${formatCop(salesDash.day.averageTicket)}`
                  : 'Conecta @fie/api'
              }
            />
            <Metric
              title="Deuda total"
              value={formatCop(debtDash.totalBalance)}
              hint={`Interés mes ~${formatCop(debtDash.estimatedMonthlyInterest)} · ${debtDash.obligationCount} obl.`}
            />
            <Metric
              title="Inventario (costo)"
              value={formatCop(inventorySnap?.valueAtCost ?? null)}
              hint={
                inventorySnap
                  ? `${formatNumber(inventorySnap.units)} uds · ${inventorySnap.skusWithStock} SKUs`
                  : 'Sincroniza desde Hera'
              }
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-full border border-[var(--line)] bg-white/70 px-4 py-2 text-sm font-medium"
              onClick={() => void refreshInventoryFromErp()}
            >
              Actualizar inventario Hera
            </button>
          </div>
          <p className="text-xs text-muted">
            Fuente de ventas: Trazabilidad Hera vía eventos. Inventario: products.stock × cost (solo
            lectura). API: {apiOnline ? 'en línea' : 'fuera de línea'}.
          </p>
        </section>
      ) : null}

      {tab === 'sales' ? (
        <section className="space-y-4">
          <div className="panel rounded-2xl p-4 md:p-6">
            <h2 className="brand-mark text-2xl text-forest">Ventas desde Hera</h2>
            <p className="mt-1 text-sm text-muted">
              Fuente: Tesorería → Trazabilidad de dinero (<code className="text-xs">venta_pos</code>
              ). No usa la tabla de ventas del ERP.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Metric
                title="Hoy"
                value={formatCop(salesDash?.day.netSales ?? null)}
                hint={`${salesDash?.day.salesCount ?? 0} ventas`}
              />
              <Metric
                title="Mes"
                value={formatCop(salesDash?.month.netSales ?? null)}
                hint={`${salesDash?.month.salesCount ?? 0} ventas`}
              />
              <Metric
                title="Acumulado"
                value={formatCop(salesDash?.accumulated.netSales ?? null)}
                hint={`Pagos ${formatCop(salesDash?.accumulated.paymentsReceived ?? null)}`}
              />
            </div>
            <button
              type="button"
              className="mt-6 rounded-full bg-forest px-4 py-2 text-sm font-semibold text-mist"
              onClick={() => void refreshSalesFromErp()}
            >
              Actualizar ventas del mes
            </button>
            {!apiOnline ? (
              <p className="mt-4 text-sm text-danger">
                No se pudo contactar la API de ventas (Supabase Edge).
              </p>
            ) : (
              <p className="mt-4 text-xs text-muted">
                Sync: <code className="text-xs">tes_movimientos</code> →{' '}
                <code className="text-xs">fie_domain_events</code>. API en línea.
              </p>
            )}
          </div>
        </section>
      ) : null}

      {tab === 'debts' ? (
        <DebtsPanel
          workspace={debtWs}
          onChange={setDebtWs}
          extraCashHint={proposedExtra.trim() || debtOpt.suggestedAmount || '1200000'}
        />
      ) : null}

      {tab === 'costs' && model ? (
        <section className="space-y-4">
          {expenseCategoryOptions.length > 0 ? (
            <datalist id="fie-config-expense-categories">
              {expenseCategoryOptions.map((c) => (
                <option key={c.id} value={c.label} />
              ))}
            </datalist>
          ) : null}
          <header>
            <h2 className="brand-mark text-2xl text-forest">Costos</h2>
            <p className="mt-1 text-sm text-muted">
              Presupuesto para BEP. Secciones colapsables — el estado abierto se recuerda.
            </p>
          </header>
          <SectionAccordion
            id="costs.fixed"
            title="Costos fijos (presupuesto)"
            hint="Día de pago + monto mensual · versiones abajo"
            defaultOpen
          >
            <ul className="divide-y divide-[var(--line)]">
              {model.fixedCosts.map((line) => (
                <li
                  key={line.id}
                  className="grid gap-2 py-4 md:grid-cols-[1.1fr_0.9fr_0.8fr_0.55fr_auto] md:items-end"
                >
                  <label className="block text-xs text-muted">
                    Nombre
                    <input
                      className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm text-ink"
                      value={line.label}
                      onChange={(e) => updateFixedCost(line.id, { label: e.target.value })}
                    />
                  </label>
                  <label className="block text-xs text-muted">
                    Categoría
                    <input
                      className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm text-ink"
                      list="fie-config-expense-categories"
                      value={line.category}
                      onChange={(e) => updateFixedCost(line.id, { category: e.target.value })}
                    />
                  </label>
                  <label className="block text-xs text-muted">
                    Monto presupuesto
                    <input
                      className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm text-ink"
                      inputMode="decimal"
                      value={line.amount}
                      onChange={(e) => updateFixedCost(line.id, { amount: e.target.value })}
                    />
                  </label>
                  <label className="block text-xs text-muted">
                    Día pago
                    <input
                      className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm text-ink"
                      inputMode="numeric"
                      placeholder="1–31"
                      value={line.dueDay ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        if (!raw) {
                          updateFixedCost(line.id, { dueDay: undefined });
                          return;
                        }
                        const n = Number(raw);
                        if (Number.isFinite(n) && n >= 1 && n <= 31) {
                          updateFixedCost(line.id, { dueDay: n });
                        }
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeFixedCost(line.id)}
                    className="rounded-full border border-danger/30 px-3 py-2 text-sm font-medium text-danger hover:bg-danger/10"
                  >
                    Eliminar
                  </button>
                </li>
              ))}
            </ul>
            {model.fixedCosts.length === 0 ? (
              <p className="mt-4 text-sm text-muted">No hay costos fijos. Agrega al menos uno.</p>
            ) : null}
            <div className="mt-6 border-t border-[var(--line)] pt-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">
                Nuevo costo fijo
              </h3>
              <div className="mt-4 grid gap-3 md:grid-cols-[1.1fr_0.9fr_0.8fr_0.55fr_auto] md:items-end">
                <label className="block text-xs text-muted">
                  Nombre
                  <input
                    className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
                    placeholder="Ej. Seguro local"
                    value={newFixed.label}
                    onChange={(e) => setNewFixed((s) => ({ ...s, label: e.target.value }))}
                  />
                </label>
                <label className="block text-xs text-muted">
                  Categoría
                  <input
                    className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
                    list="fie-config-expense-categories"
                    placeholder="Ej. Local"
                    value={newFixed.category}
                    onChange={(e) => setNewFixed((s) => ({ ...s, category: e.target.value }))}
                  />
                </label>
                <label className="block text-xs text-muted">
                  Monto presupuesto
                  <input
                    className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
                    inputMode="decimal"
                    placeholder="0"
                    value={newFixed.amount}
                    onChange={(e) => setNewFixed((s) => ({ ...s, amount: e.target.value }))}
                  />
                </label>
                <label className="block text-xs text-muted">
                  Día pago
                  <input
                    className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
                    inputMode="numeric"
                    placeholder="5"
                    value={newFixed.dueDay}
                    onChange={(e) => setNewFixed((s) => ({ ...s, dueDay: e.target.value }))}
                  />
                </label>
                <button
                  type="button"
                  onClick={addFixedCost}
                  className="rounded-full bg-forest px-4 py-2 text-sm font-semibold text-mist"
                >
                  Agregar
                </button>
              </div>
            </div>
          </SectionAccordion>

          <SectionAccordion
            id="costs.versions"
            title="Versiones de costos"
            hint="Arriendo 2025 → 2026 sin perder historial"
            defaultOpen={false}
          >
            <CostVersionsPanel
              fixedCosts={model.fixedCosts.map((l) => ({
                id: l.id,
                label: l.label,
                amount: l.amount,
                category: l.category,
              }))}
              workspace={costVersionsWs}
              onWorkspaceChange={setCostVersionsWs}
              onApplyLiveAmount={(lineId, amount) => updateFixedCost(lineId, { amount })}
            />
          </SectionAccordion>

          <SectionAccordion
            id="costs.variable"
            title="Costos variables (por unidad)"
            hint="Empaque, insumos, logística unitaria"
            defaultOpen={false}
          >
            <ul className="divide-y divide-[var(--line)]">
              {model.variableCosts.map((line) => (
                <li
                  key={line.id}
                  className="grid gap-2 py-4 md:grid-cols-[1.2fr_1fr_0.9fr_auto] md:items-end"
                >
                  <label className="block text-xs text-muted">
                    Nombre
                    <input
                      className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm text-ink"
                      value={line.label}
                      onChange={(e) => updateVariableCost(line.id, { label: e.target.value })}
                    />
                  </label>
                  <label className="block text-xs text-muted">
                    Categoría
                    <input
                      className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm text-ink"
                      list="fie-config-expense-categories"
                      value={line.category}
                      onChange={(e) => updateVariableCost(line.id, { category: e.target.value })}
                    />
                  </label>
                  <label className="block text-xs text-muted">
                    Monto / unidad
                    <input
                      className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm text-ink"
                      inputMode="decimal"
                      value={line.amount}
                      onChange={(e) => updateVariableCost(line.id, { amount: e.target.value })}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeVariableCost(line.id)}
                    className="rounded-full border border-danger/30 px-3 py-2 text-sm font-medium text-danger hover:bg-danger/10"
                  >
                    Eliminar
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-4 grid gap-3 md:grid-cols-[1.2fr_1fr_0.9fr_auto] md:items-end">
              <label className="block text-xs text-muted">
                Nombre
                <input
                  className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
                  placeholder="Ej. Empaque extra"
                  value={newVariable.label}
                  onChange={(e) => setNewVariable((s) => ({ ...s, label: e.target.value }))}
                />
              </label>
              <label className="block text-xs text-muted">
                Categoría
                <input
                  className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
                  list="fie-config-expense-categories"
                  placeholder="Ej. Empaque"
                  value={newVariable.category}
                  onChange={(e) => setNewVariable((s) => ({ ...s, category: e.target.value }))}
                />
              </label>
              <label className="block text-xs text-muted">
                Monto
                <input
                  className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
                  inputMode="decimal"
                  value={newVariable.amount}
                  onChange={(e) => setNewVariable((s) => ({ ...s, amount: e.target.value }))}
                />
              </label>
              <button
                type="button"
                onClick={addVariableCost}
                className="rounded-full bg-forest px-4 py-2 text-sm font-semibold text-mist"
              >
                Agregar
              </button>
            </div>
          </SectionAccordion>

          <SectionAccordion
            id="costs.margins"
            title="Margen y canales"
            hint="COGS + utilidad por canal · mix ponderado al BEP"
            defaultOpen={false}
          >
            <label className="block text-sm">
              Costo de mercancía / prenda (COGS)
              <input
                className="metric mt-1 w-full max-w-xs rounded-lg border border-[var(--line)] bg-white px-3 py-2"
                value={margins.productCost}
                onChange={(e) => setMargins({ ...margins, productCost: e.target.value })}
              />
            </label>
            <ul className="mt-6 space-y-3">
              {margins.channels.map((ch) => {
                let previewPrice = '—';
                try {
                  if (margins.productCost.trim()) {
                    const vars = sumVariableCostsPerUnit(model);
                    const full = Money.from(margins.productCost, model.currency).add(vars);
                    previewPrice = formatCop(
                      priceFromUtility(full, ch.utilityOnPrice || '0.5').toString(),
                    );
                  }
                } catch {
                  previewPrice = '—';
                }
                return (
                  <li
                    key={ch.id}
                    className="rounded-xl border border-[var(--line)] bg-white/50 p-3 grid gap-2 sm:grid-cols-4 sm:items-end"
                  >
                    <label className="block text-xs text-muted sm:col-span-1">
                      Canal
                      <input
                        className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
                        value={ch.label}
                        onChange={(e) => updateChannelMargin(ch.id, { label: e.target.value })}
                      />
                    </label>
                    <label className="block text-xs text-muted">
                      Utilidad (0.50 = 50%)
                      <input
                        className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
                        value={ch.utilityOnPrice}
                        onChange={(e) =>
                          updateChannelMargin(ch.id, { utilityOnPrice: e.target.value })
                        }
                      />
                    </label>
                    <label className="block text-xs text-muted">
                      Mix ventas (0–1)
                      <input
                        className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
                        value={ch.mixWeight}
                        onChange={(e) => updateChannelMargin(ch.id, { mixWeight: e.target.value })}
                      />
                    </label>
                    <p className="text-xs text-muted pb-2">Precio implícito ≈ {previewPrice}</p>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              onClick={saveMarginsAndApply}
              className="mt-5 rounded-full bg-forest px-4 py-2 text-sm font-semibold text-mist"
            >
              Guardar márgenes y recalcular BEP
            </button>
            <p className="mt-2 text-xs text-muted">
              Margen de contribución actual (blend):{' '}
              {breakEven ? formatPct(breakEven.contributionMarginRate) : '—'}
            </p>
          </SectionAccordion>

          <SectionAccordion
            id="costs.payroll"
            title="Nómina Colombia"
            hint="Provisiones y SMMLV — aplica al catálogo de costos"
            defaultOpen={false}
          >
            <PayrollColombiaPanel
              onApply={applyColombiaPayroll}
              onApplyHera={applyHeraEmployeesPayroll}
            />
          </SectionAccordion>
        </section>
      ) : null}

      {tab === 'marketing' ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="panel rounded-2xl p-4 md:p-6">
            <h2 className="brand-mark text-2xl text-forest">Presupuesto por canal</h2>
            <p className="mt-1 text-sm text-muted">
              Define lo esperado (TikTok, Meta, Google…) y el cobro real del mes. El sobrante
              aumenta la capacidad de abono a deuda.
            </p>
            <ul className="mt-6 space-y-4">
              {channelRows.map((row) => (
                <li
                  key={row.channelId}
                  className="rounded-xl border border-[var(--line)] bg-white/50 p-3"
                >
                  <p className="font-medium text-forest">{row.label}</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <label className="block text-xs text-muted">
                      Presupuesto
                      <input
                        className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm text-ink"
                        value={row.budget}
                        onChange={(e) =>
                          setChannelRows((rows) =>
                            rows.map((r) =>
                              r.channelId === row.channelId ? { ...r, budget: e.target.value } : r,
                            ),
                          )
                        }
                      />
                    </label>
                    <label className="block text-xs text-muted">
                      Gasto real
                      <input
                        className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm text-ink"
                        value={row.actual}
                        onChange={(e) =>
                          setChannelRows((rows) =>
                            rows.map((r) =>
                              r.channelId === row.channelId ? { ...r, actual: e.target.value } : r,
                            ),
                          )
                        }
                      />
                    </label>
                  </div>
                </li>
              ))}
            </ul>
            <label className="mt-4 block text-sm">
              Umbral de alerta (ej. 0.10 = 10%)
              <input
                className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2"
                value={alertRate}
                onChange={(e) => setAlertRate(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="mt-6 rounded-full bg-moss px-4 py-2 text-sm font-semibold text-mist"
              onClick={runDecisionStack}
            >
              Comparar y recalcular abono
            </button>
          </div>
          <div className="panel rounded-2xl p-4 md:p-6">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">
              Plan vs ejecución
            </h3>
            {portfolio ? (
              <div className="mt-4 space-y-4">
                <div className="space-y-2 text-sm">
                  <p>Presupuesto total: {formatCop(portfolio.totalBudgetAmount)}</p>
                  <p>Gasto real total: {formatCop(portfolio.totalActualAmount)}</p>
                  <p className="font-semibold text-ok">
                    Capacidad liberada: {formatCop(portfolio.freedCapacityAmount)}
                  </p>
                  {Number(portfolio.overspendAmount) > 0 ? (
                    <p className="font-semibold text-danger">
                      Sobrepresupuesto: {formatCop(portfolio.overspendAmount)}
                    </p>
                  ) : null}
                </div>
                <ul className="divide-y divide-[var(--line)] text-sm">
                  {portfolio.channels.map((ch) => {
                    const label =
                      channelRows.find((r) => r.channelId === ch.channelId)?.label ?? ch.channelId;
                    return (
                      <li key={ch.channelId} className="py-2">
                        <p className="font-medium">{label}</p>
                        <p className="text-muted">
                          {formatCop(ch.budgetAmount)} → {formatCop(ch.actualAmount)} ·{' '}
                          {ch.status === 'under_budget'
                            ? 'bajo'
                            : ch.status === 'over_budget'
                              ? 'sobre'
                              : 'en plan'}
                          {ch.alert ? ' · alerta' : ''}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted">
                Compara canales para ver sobrante usable en deuda.
              </p>
            )}
          </div>
        </section>
      ) : null}

      {tab === 'config' ? (
        <ConfigPanel
          config={centralConfig}
          onConfigChange={(next) => {
            setCentralConfig(next);
            setChannelRows((prev) => channelsToBudgetRows(next, prev));
          }}
          policy={liquidityPolicy}
          onPolicyChange={setLiquidityPolicy}
          buildContext={buildBoardContext}
          fixedBurn={fixedBurn}
          openaiConnected={openaiConnected}
        />
      ) : null}

      {tab === 'goals' ? (
        <GoalsPanel
          workspace={goalsWs}
          onChange={(ws) => {
            setGoalsWs(ws);
            const synced = syncGoalsIntoConfigAmounts(ws);
            if (synced.targetProfitAmount || synced.debtReductionTargetAmount) {
              const next = saveCentralConfig({
                ...centralConfig,
                ...(synced.targetProfitAmount
                  ? { targetProfitAmount: synced.targetProfitAmount }
                  : {}),
                ...(synced.debtReductionTargetAmount
                  ? { debtReductionTargetAmount: synced.debtReductionTargetAmount }
                  : {}),
              });
              setCentralConfig(next);
            }
          }}
          facts={{
            totalDebtBalance: debtDash.totalBalance,
            reserveMonths: reserveMonths || null,
            runwayMonths: liquidity?.runwayMonths ?? capacityLive.runwayMonths,
            monthSales: salesDash?.month.netSales ?? null,
            marketingBudgetTotal: portfolio?.totalBudgetAmount ?? null,
            cashOnHand: cash || cashSnapshot.cashOnHand || null,
            currency: workspaceCurrency,
          }}
          debtOptions={debtWs.obligations
            .filter((o) => o.active)
            .map((o) => ({ id: o.id, label: o.label }))}
          onGoToConfig={() => goToTab('config')}
          onGoToDecision={() => goToTab('decision')}
        />
      ) : null}

      {tab === 'kpis' ? (
        <KpisPanel
          input={{
            currency: workspaceCurrency,
            cashOnHand: cash || cashSnapshot.cashOnHand || null,
            immediateFreeCash: capacityLive.immediateFreeCash,
            runwayMonths: liquidity?.runwayMonths ?? capacityLive.runwayMonths,
            reserveMonths: reserveMonths || null,
            reserveAmount: liquidity?.reserveAmount ?? capacityLive.reserveAmount,
            maxSafeExtraDebtPayment:
              liquidity?.maxSafeExtraDebtPayment ?? capacityLive.canPayDebtExtra,
            breakEvenSales: breakEven?.breakEvenSales ?? null,
            projectedSales: breakEven?.projectedSales ?? null,
            safetyMargin: breakEven?.safetyMargin ?? null,
            safetyMarginRate: breakEven?.safetyMarginRate ?? null,
            contributionMarginRate: breakEven?.contributionMarginRate ?? null,
            totalFixedCosts: breakEven?.totalFixedCosts ?? null,
            monthSales: salesDash?.month.netSales ?? null,
            totalDebtBalance: debtDash.totalBalance,
            estimatedMonthlyInterest: debtDash.estimatedMonthlyInterest,
            monthlyInstallmentsDue: debtDash.monthlyInstallmentsDue,
            marketingBudget: portfolio?.totalBudgetAmount ?? null,
            marketingActual: portfolio?.totalActualAmount ?? null,
            inventoryUnits: inventorySnap?.units ?? null,
            inventoryValueAtCost: inventorySnap?.valueAtCost ?? null,
            skusBelowMin: inventorySnap?.skusBelowMin ?? null,
            skusWithStock: inventorySnap?.skusWithStock ?? null,
            healthScore: score?.score ?? null,
            riskLevel: score?.riskLevel ?? null,
          }}
          onGoToCapacidad={() => goToTab('capacidad')}
          onGoToDecision={() => goToTab('decision')}
        />
      ) : null}

      {tab === 'assumptions' ? (
        <AssumptionsPanel
          workspace={assumptionsWs}
          onChange={setAssumptionsWs}
          onGoToScenarios={() => goToTab('scenarios')}
        />
      ) : null}

      {tab === 'reports' ? (
        <ReportsPanel
          input={{
            currency: workspaceCurrency,
            cashOnHand: cash || cashSnapshot.cashOnHand || null,
            immediateFreeCash: capacityLive.immediateFreeCash,
            runwayMonths: liquidity?.runwayMonths ?? capacityLive.runwayMonths,
            reserveMonths: reserveMonths || null,
            reserveAmount: liquidity?.reserveAmount ?? capacityLive.reserveAmount,
            minCashFloor: minCashFloor || null,
            maxSafeExtraDebt: liquidity?.maxSafeExtraDebtPayment ?? capacityLive.canPayDebtExtra,
            monthSales: salesDash?.month.netSales ?? null,
            breakEvenSales: breakEven?.breakEvenSales ?? null,
            safetyMargin: breakEven?.safetyMargin ?? null,
            contributionMarginRate: breakEven?.contributionMarginRate ?? null,
            totalFixedCosts: breakEven?.totalFixedCosts ?? null,
            totalDebtBalance: debtDash.totalBalance,
            estimatedMonthlyInterest: debtDash.estimatedMonthlyInterest,
            obligations: debtDash.snapshots.map((s) => ({
              label: s.obligation.label,
              kindLabel: s.obligation.kindLabel,
              balance: s.balance,
              installment:
                s.obligation.targetPaymentAmount ??
                s.obligation.fixedInstallmentAmount ??
                s.obligation.minimumPaymentAmount ??
                null,
              interest: s.estimatedMonthlyInterest,
            })),
            fixedCosts: (model?.fixedCosts ?? [])
              .filter((l) => l.active)
              .map((l) => ({
                label: l.label,
                category: l.category,
                amount: l.amount,
                dueDay: l.dueDay,
              })),
            variableCosts: (model?.variableCosts ?? [])
              .filter((l) => l.active)
              .map((l) => ({
                label: l.label,
                category: l.category,
                amount: l.amount,
              })),
            capacity: {
              canSpendToday: capacityLive.canSpendToday,
              canInvest: capacityLive.canInvest,
              canPayDebtExtra: capacityLive.canPayDebtExtra,
              canRestock: capacityLive.canRestock,
              canWithdrawProfit: capacityLive.canWithdrawProfit,
              canSpendAds: capacityLive.canSpendAds,
              recompraEarmark: capacityLive.recompraEarmark,
              nextQuincena: capacityLive.nextQuincena,
              creditCardInstallment: capacityLive.creditCardInstallment,
              gaps: capacityLive.gaps,
            },
            kpis: boardKpis.map((k) => ({
              label: k.label,
              value: k.value,
              status: k.status,
              detail: k.detail,
            })),
            goalsNorthStar: goalsWs.northStar || null,
            recommendationAction: recommendation?.action ?? null,
          }}
        />
      ) : null}

      {tab === 'alerts' ? (
        <AlertsPanel alerts={operationalAlerts} onGoToTab={(t) => goToTab(t)} />
      ) : null}

      {tab === 'calendar' ? (
        <CalendarPanel
          source={{
            fixedCosts: (model?.fixedCosts ?? []).map((l) => ({
              id: l.id,
              label: l.label,
              amount: l.amount,
              category: l.category,
              active: l.active,
              dueDay: l.dueDay,
            })),
            obligations: debtWs.obligations.map((o) => ({
              id: o.id,
              label: o.label,
              active: o.active,
              paymentDueDay: o.paymentDueDay,
              targetPaymentAmount: o.targetPaymentAmount,
              fixedInstallmentAmount: o.fixedInstallmentAmount,
              minimumPaymentAmount: o.minimumPaymentAmount,
            })),
          }}
          closingDaysOfMonth={centralConfig.closingDaysOfMonth}
          payrollMonthly={capacityLive.payrollMonthly}
          inventoryRestockCycleDays={centralConfig.inventoryRestockCycleDays}
          onGoToClosings={() => {
            goToTab('closings');
            setClosingGateActive(Boolean(closingStatus?.pendingDays.length));
          }}
          onGoToConfig={() => goToTab('config')}
        />
      ) : null}

      {tab === 'scenarios' ? (
        <ScenariosPanel
          workspace={scenarioWs}
          evaluations={scenarioWs.lastEvaluations}
          recommendation={scenarioRec}
          immediateCapacity={freeCash.trim() || cashPlan.immediateFreeCash || ''}
          onChange={(ws) => setScenarioWs(saveScenarioWorkspace(ws))}
          onRecommend={runScenarioEvaluation}
        />
      ) : null}

      {tab === 'capacidad' ? (
        <CapacityPanel
          capacity={capacityLive}
          currency={workspaceCurrency}
          cash={cash}
          recompraShare={cashSnapshot.recompraShareOfCash}
          reserveMonths={reserveMonths}
          minCashFloor={minCashFloor}
          policyComplete={isLiquidityPolicyComplete(liquidityPolicy)}
          hasPendingClosings={hasPendingClosings}
          pendingClosingCount={closingStatus?.pendingDays.length ?? 0}
          onCashChange={persistCashField}
          onRecompraShareChange={persistRecompraShare}
          onUseInDecision={() => {
            runDecisionStack();
          }}
          onGenerateAi={() => void generateAiRecommendation()}
          aiPending={aiPending}
        />
      ) : null}

      {tab === 'decision' ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="panel rounded-2xl p-4 md:p-6">
            <h2 className="brand-mark text-2xl text-forest">Liquidez (política tuya)</h2>
            <label className="mt-4 block text-sm">
              Caja disponible
              <input
                className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2"
                value={cash}
                onChange={(e) => persistCashField(e.target.value)}
              />
            </label>
            <p className="mt-1 text-xs text-muted">
              ~{Math.round(Number(cashSnapshot.recompraShareOfCash || 0) * 100)}% a recompra (≈{' '}
              {formatCop(earmarkedRecompra)}) · queda ≈ {formatCop(cashLeftAfterRecompra)}
            </p>
            <div className="mt-3 rounded-xl border border-[var(--line)] bg-white/40 px-3 py-2 text-xs text-muted space-y-1">
              <p>
                Nómina mensual (costos fijos):{' '}
                {cashPlan.payrollMonthly ? formatCop(cashPlan.payrollMonthly) : '—'} → quincena{' '}
                {cashPlan.nextQuincena ? formatCop(cashPlan.nextQuincena) : '—'}
              </p>
              <p>
                Cuota TC (deudas):{' '}
                {cashPlan.creditCardInstallment ? formatCop(cashPlan.creditCardInstallment) : '—'}
              </p>
              <p>
                Días de ventas restantes en el mes: {cashPlan.remainingCalendarDaysInMonth} (incluye
                hoy; las ventas futuras aún no están en caja)
              </p>
            </div>
            <label className="mt-3 block text-sm">
              Capacidad inmediata (auto: tras recompra + quincena + cuota TC)
              <input
                className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2"
                value={freeCash}
                placeholder="Se calcula al cargar nómina y cuota"
                onChange={(e) => setFreeCash(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="mt-2 text-xs underline text-muted"
              onClick={() => {
                if (cashPlan.immediateFreeCash != null) setFreeCash(cashPlan.immediateFreeCash);
              }}
            >
              Recalcular desde costos + deudas
            </button>
            <label className="mt-3 block text-sm">
              Reserva (meses de burn) — política guardada
              <input
                className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-mist/40 px-3 py-2"
                value={reserveMonths || '— sin definir —'}
                readOnly
              />
            </label>
            <p className="mt-1 text-xs text-muted">
              Se edita en{' '}
              <button type="button" className="underline" onClick={() => goToTab('config')}>
                Configuración
              </button>
              {minCashFloor ? ` · piso caja ${formatCop(minCashFloor)}` : ''}
              {liquidityPolicy.reserveIsHardFloor ? ' · reserva intocable' : ' · reserva blanda'}
            </p>
            <label className="mt-3 block text-sm">
              Abono extra propuesto (opcional — si lo dejas vacío, el motor sugiere)
              <input
                className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2"
                value={proposedExtra}
                placeholder="Auto"
                onChange={(e) => setProposedExtra(e.target.value)}
              />
            </label>
            <label className="mt-3 block text-sm">
              Intereses futuros estimados a ahorrar
              <input
                className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2"
                value={interestSaved}
                onChange={(e) => setInterestSaved(e.target.value)}
              />
            </label>
            <p className="mt-3 text-xs text-muted">
              Burn fijo tomado del BEP: {formatCop(fixedBurn)}
            </p>
            <button
              type="button"
              onClick={runDecisionStack}
              className="mt-5 rounded-full bg-forest px-4 py-2 text-sm font-semibold text-mist"
            >
              Recalcular recomendación
            </button>
          </div>
          <div className="panel rounded-2xl p-4 md:p-6">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">
              Salud y siguiente paso
            </h3>
            {liquidity ? (
              <div className="mt-4 space-y-2 text-sm">
                <p>Runway: {liquidity.runwayMonths ?? '—'} meses</p>
                <p>Máx. abono (solo liquidez): {formatCop(liquidity.maxSafeExtraDebtPayment)}</p>
              </div>
            ) : null}
            {recommendation ? (
              <div className="mt-4 space-y-2 text-sm">
                <p>Liberado por ads: {formatCop(recommendation.marketingFreedCapacity)}</p>
                <p>
                  Capacidad ajustada: {formatCop(recommendation.adjustedMaxSafeExtraDebtPayment)}
                </p>
                <p className="text-lg font-semibold text-forest">
                  Abono sugerido: {formatCop(recommendation.suggestedExtraDebtPayment)}
                </p>
                <p className="text-sm text-muted">
                  Impacto: intereses ~
                  {formatCop(recommendation.expectedImpact.interestSavedEstimate)} · runway{' '}
                  {recommendation.expectedImpact.runwayMonthsPreserved ?? '—'} meses · margen{' '}
                  {formatCop(recommendation.expectedImpact.safetyMarginUsed)}
                </p>
              </div>
            ) : null}
            {score ? (
              <p className="mt-4 text-lg">
                Score {score.score} · riesgo{' '}
                <span className="font-semibold">{score.riskLevel}</span>
              </p>
            ) : null}
            {recommendation ? (
              <div className="mt-4 space-y-2">
                <p className="font-semibold text-forest">{recommendation.action}</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-ink/90">
                  {recommendation.rationale.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted">
                Calcula para ver la recomendación holística de motores.
              </p>
            )}
            <button
              type="button"
              onClick={() => goToTab('ai')}
              className="mt-5 rounded-full border border-forest px-4 py-2 text-sm font-semibold text-forest"
            >
              Ir a CFO AI (OpenAI)
            </button>
          </div>
        </section>
      ) : null}

      {tab === 'ai' ? (
        <AiRecommendPanel
          recommendation={aiRec}
          pending={aiPending}
          connected={openaiConnected}
          onConnectedChange={setOpenaiConnected}
          onGenerate={() => void generateAiRecommendation()}
          disabledGenerate={!breakEven || hasPendingClosings}
          disabledReason={
            hasPendingClosings
              ? `Actualiza ${closingStatus?.pendingDays.length ?? 0} día(s) pendiente(s) (movimientos o «sin movimientos») antes de generar.`
              : undefined
          }
        />
      ) : null}

      {tab === 'closings' ? <ClosingHistoryPanel status={closingStatus} /> : null}

      {!breakEven && !pending ? <p className="text-sm text-muted">Cargando motores…</p> : null}
    </main>
  );
}

function Metric({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <article className="panel rounded-2xl p-4 md:p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{title}</p>
      <p className="metric mt-3 text-2xl font-semibold text-forest md:text-3xl">{value}</p>
      <p className="mt-1 text-sm text-muted">{hint}</p>
    </article>
  );
}
