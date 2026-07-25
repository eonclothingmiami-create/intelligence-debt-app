'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import type { BreakEvenModel, BreakEvenSnapshot } from '@fie/break-even-engine';
import type { SalesDashboardSnapshot } from '@fie/erp-integration';
import type { MarketingChannel, MarketingPortfolioVsActual } from '@fie/shared';
import { AiRecommendPanel } from '@/components/os/AiRecommendPanel';
import { DebtsPanel } from '@/components/os/DebtsPanel';
import { PoliciesPanel } from '@/components/os/PoliciesPanel';
import { PayrollColombiaPanel } from '@/components/os/PayrollColombiaPanel';
import { ScenariosPanel } from '@/components/os/ScenariosPanel';
import {
  actionBusinessHealth,
  actionComputeBreakEven,
  actionComputeLiquidity,
  actionLoadDemo,
  actionMarketingPortfolio,
} from '@/lib/actions';
import {
  createDemoDebtWorkspace,
  debtDashboard,
  optimizeExtraCash,
  type DebtWorkspace,
} from '@/lib/debtStore';
import type { LiquidityView } from '@/lib/engines';
import { assembleBoardFinancialContext, requestAiRecommendation } from '@/lib/aiRecommend';
import type { AiFinancialRecommendation, FinancialContext } from '@/lib/aiRecommend';
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
import type { ColombiaPayrollBreakdown } from '@fie/break-even-engine';
import { priceFromUtility, sumVariableCostsPerUnit } from '@fie/break-even-engine';
import { Money } from '@fie/financial-engine';
import type { LiquidityPolicy } from '@fie/shared';

type Tab =
  | 'overview'
  | 'costs'
  | 'sales'
  | 'debts'
  | 'marketing'
  | 'policies'
  | 'scenarios'
  | 'decision'
  | 'ai';

type ChannelBudgetRow = {
  channelId: string;
  label: string;
  budget: string;
  actual: string;
};

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Resumen' },
  { id: 'sales', label: 'Ventas ERP' },
  { id: 'debts', label: 'Deudas' },
  { id: 'costs', label: 'Costos' },
  { id: 'marketing', label: 'Publicidad' },
  { id: 'policies', label: 'Políticas' },
  { id: 'scenarios', label: 'Escenarios' },
  { id: 'decision', label: 'Decisión' },
  { id: 'ai', label: 'CFO AI' },
];

const DEFAULT_CHANNELS: MarketingChannel[] = [
  { id: 'tiktok', label: 'TikTok Ads', active: true, sortOrder: 0 },
  { id: 'meta', label: 'Meta Ads', active: true, sortOrder: 1 },
  { id: 'google', label: 'Google Ads', active: true, sortOrder: 2 },
];

const DEFAULT_ROWS: ChannelBudgetRow[] = [
  { channelId: 'tiktok', label: 'TikTok Ads', budget: '2100000', actual: '1800000' },
  { channelId: 'meta', label: 'Meta Ads', budget: '1500000', actual: '1200000' },
  { channelId: 'google', label: 'Google Ads', budget: '900000', actual: '900000' },
];

const PERIOD_FROM = '2026-07-01';
const PERIOD_TO = '2026-07-31';

export function OsShell() {
  const [tab, setTab] = useState<Tab>('overview');
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
  const [alertRate, setAlertRate] = useState('0.10');
  const [interestSaved, setInterestSaved] = useState('120000');
  const [channelRows, setChannelRows] = useState<ChannelBudgetRow[]>(DEFAULT_ROWS);
  const [newFixed, setNewFixed] = useState({ label: '', category: '', amount: '' });
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

  const reserveMonths = liquidityPolicy.reserveMonths;
  const minCashFloor = liquidityPolicy.minCashFloor ?? '';
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

  useEffect(() => {
    if (cashPlan.immediateFreeCash != null) {
      setFreeCash(cashPlan.immediateFreeCash);
    }
  }, [cashPlan.immediateFreeCash]);

  function persistCashField(nextCash: string) {
    setCash(nextCash);
    const next = saveCashSnapshot({ ...cashSnapshot, cashOnHand: nextCash });
    setCashSnapshot(next);
  }

  const fixedBurn = useMemo(() => breakEven?.totalFixedCosts ?? '0', [breakEven]);
  const debtDash = useMemo(() => debtDashboard(debtWs), [debtWs]);
  const debtOpt = useMemo(
    () => optimizeExtraCash(debtWs, proposedExtra.trim() || '1200000'),
    [debtWs, proposedExtra],
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
        setTab('overview');
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
    patch: Partial<{ label: string; category: string; amount: string }>,
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
        },
      ],
    });
    setNewFixed({ label: '', category: '', amount: '' });
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

  function buildBoardContext(): FinancialContext {
    const alerts: string[] = [];
    if (portfolio?.alert) {
      alerts.push('Hay desviación de publicidad vs presupuesto según la política configurada.');
    }
    if (!isLiquidityPolicyComplete(liquidityPolicy)) {
      alerts.push('Falta política de liquidez (reserva en meses).');
    }
    return assembleBoardFinancialContext({
      currency: model?.currency ?? 'COP',
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
        runwayMonths: liquidity?.runwayMonths ?? null,
        maxSafeExtraDebtPayment: liquidity?.maxSafeExtraDebtPayment ?? null,
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
      ].filter(Boolean),
    });
  }

  function runDecisionStack() {
    if (!breakEven) return;
    if (!isLiquidityPolicyComplete(liquidityPolicy)) {
      setError('Define primero la política de liquidez (pestaña Políticas).');
      setTab('policies');
      return;
    }
    if (!cash.trim()) {
      setError('Indica la caja disponible hoy.');
      setTab('decision');
      return;
    }
    if (!freeCash.trim()) {
      setError(
        'Falta capacidad inmediata. Espera a que carguen nómina/cuota o pulsa «Recalcular desde costos + deudas».',
      );
      setTab('decision');
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const mkt = await actionMarketingPortfolio({
          currency: 'COP',
          periodFrom: PERIOD_FROM,
          periodTo: PERIOD_TO,
          channels: DEFAULT_CHANNELS,
          budgets: channelRows.map((row) => ({
            id: `b-${row.channelId}`,
            channelId: row.channelId,
            periodFrom: PERIOD_FROM,
            periodTo: PERIOD_TO,
            budgetAmount: row.budget || '0',
            currency: 'COP',
            notes: row.label,
          })),
          actuals: channelRows.map((row) => ({
            id: `a-${row.channelId}`,
            channelId: row.channelId,
            occurredOn: '2026-07-15',
            actualAmount: row.actual || '0',
            currency: 'COP',
            notes: row.label,
          })),
          policy: { alertDeviationRate: alertRate },
        });
        setPortfolio(mkt);

        const proposed = proposedExtra.trim() || '0';
        const liq = await actionComputeLiquidity({
          currency: model?.currency ?? 'COP',
          cash,
          monthlyFixedBurn: fixedBurn,
          monthlyFreeCashFlow: freeCash,
          proposedExtraDebtPayment: proposed,
          reserveMonths,
          minCashFloor: minCashFloor || undefined,
        });
        setLiquidity(liq);

        const opt = optimizeExtraCash(debtWs, liq.maxSafeExtraDebtPayment);
        const proposedForHealth =
          proposedExtra.trim() || (opt.suggestedAmount !== '0' ? opt.suggestedAmount : undefined);
        let inventoryScore = 25;
        if (inventorySnap && Number(inventorySnap.units) > 0) {
          const withStock = Math.max(1, inventorySnap.skusWithStock);
          const lowRatio = inventorySnap.skusBelowMin / withStock;
          inventoryScore = lowRatio > 0.4 ? 45 : lowRatio > 0.2 ? 60 : 80;
        }
        const health = await actionBusinessHealth({
          breakEven,
          liquidity: liq,
          proposedExtraDebtPayment: proposedForHealth,
          futureInterestSaved: interestSaved,
          currency: model?.currency ?? 'COP',
          marketingFreedCapacity: mkt.freedCapacityAmount,
          marketingOverspend: mkt.overspendAmount,
          riskComponents: {
            liquidity: Number(liq.runwayMonths ?? 0) >= 2 ? 75 : 40,
            breakEven: Number(breakEven.safetyMarginRate ?? 0) > 0 ? 80 : 35,
            debtCoverage: Number(debtDash.totalBalance) > 0 ? 55 : 80,
            margin: Number(breakEven.contributionMarginRate) * 100,
            inventory: inventoryScore,
          },
          riskWeights: {
            liquidity: '0.25',
            breakEven: '0.25',
            debtCoverage: '0.20',
            margin: '0.20',
            inventory: '0.10',
          },
          riskBands: { lowMin: 70, mediumMin: 45 },
        });
        if (!proposedExtra.trim() && opt.suggestedAmount !== '0') {
          setProposedExtra(opt.suggestedAmount);
        }
        const enriched = {
          ...health.recommendation,
          rationale: [
            ...health.recommendation.rationale,
            ...opt.rationale,
            opt.suggestedTargetObligationId
              ? `Objetivo de abono sugerido por Debt Optimizer: ${opt.ranked.find((r) => r.obligationId === opt.suggestedTargetObligationId)?.label ?? opt.suggestedTargetObligationId} (${opt.suggestedAmount}).`
              : 'Debt Optimizer: sin candidato de abono extra.',
          ],
        };
        setRecommendation(enriched);
        setScore(health.score);
        setTab('decision');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error en decisión');
      }
    });
  }

  async function generateAiRecommendation() {
    if (!getStoredOpenAiKey()) {
      setError('Conecta tu API key de OpenAI en la pestaña CFO AI.');
      setTab('ai');
      return;
    }
    setError(null);
    setAiPending(true);
    try {
      const rec = await requestAiRecommendation(buildBoardContext());
      setAiRec(rec);
      setTab('ai');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error generando recomendación AI');
    } finally {
      setAiPending(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="brand-mark text-3xl text-forest md:text-4xl">Tablero operativo</h1>
          <p className="mt-1 text-sm text-muted">
            Demo Local 311 como dataset de ejemplo — no es un default del producto.
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
            onClick={() => setTab('ai')}
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
            onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap ${
              tab === t.id ? 'bg-forest text-mist' : 'bg-white/60 text-ink/80'
            }`}
          >
            {t.label}
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
          <div className="panel rounded-2xl p-4 md:p-6">
            <h2 className="brand-mark text-2xl text-forest">Costos fijos (inputs)</h2>
            <p className="mt-1 text-sm text-muted">
              Agrega o elimina líneas; el punto de equilibrio se recalcula solo. La publicidad fija
              es presupuesto de plan; el gasto real vive en Publicidad por canal.
            </p>
            <ul className="mt-6 divide-y divide-[var(--line)]">
              {model.fixedCosts.map((line) => (
                <li
                  key={line.id}
                  className="grid gap-2 py-4 md:grid-cols-[1.2fr_1fr_0.9fr_auto] md:items-end"
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
                      value={line.category}
                      onChange={(e) => updateFixedCost(line.id, { category: e.target.value })}
                    />
                  </label>
                  <label className="block text-xs text-muted">
                    Monto
                    <input
                      className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm text-ink"
                      inputMode="decimal"
                      value={line.amount}
                      onChange={(e) => updateFixedCost(line.id, { amount: e.target.value })}
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
          </div>

          <div className="panel rounded-2xl p-4 md:p-6">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">
              Nuevo costo fijo
            </h3>
            <div className="mt-4 grid gap-3 md:grid-cols-[1.2fr_1fr_0.9fr_auto] md:items-end">
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
                  placeholder="Ej. Local"
                  value={newFixed.category}
                  onChange={(e) => setNewFixed((s) => ({ ...s, category: e.target.value }))}
                />
              </label>
              <label className="block text-xs text-muted">
                Monto
                <input
                  className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
                  inputMode="decimal"
                  placeholder="0"
                  value={newFixed.amount}
                  onChange={(e) => setNewFixed((s) => ({ ...s, amount: e.target.value }))}
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

          <div className="panel rounded-2xl p-4 md:p-6">
            <h2 className="brand-mark text-2xl text-forest">Costos variables (por unidad)</h2>
            <p className="mt-1 text-sm text-muted">
              Empaque, insumos, logística unitaria, etc. Entran al costo completo de la prenda y al
              BEP.
            </p>
            <ul className="mt-6 divide-y divide-[var(--line)]">
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
          </div>

          <div className="panel rounded-2xl p-4 md:p-6">
            <h2 className="brand-mark text-2xl text-forest">Margen y canales</h2>
            <p className="mt-1 text-sm text-muted">
              Costo de prenda + utilidad sobre precio por canal (no todos venden igual). El BEP usa
              el mix ponderado. Partimos de ~50% en todos; ajústalo.
            </p>
            <label className="mt-4 block text-sm">
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
          </div>

          <PayrollColombiaPanel
            onApply={applyColombiaPayroll}
            onApplyHera={applyHeraEmployeesPayroll}
          />
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

      {tab === 'policies' ? (
        <PoliciesPanel
          policy={liquidityPolicy}
          onPolicyChange={setLiquidityPolicy}
          buildContext={buildBoardContext}
          fixedBurn={fixedBurn}
          openaiConnected={openaiConnected}
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
              <button type="button" className="underline" onClick={() => setTab('policies')}>
                Políticas
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
              onClick={() => setTab('ai')}
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
          disabledGenerate={!breakEven}
        />
      ) : null}

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
