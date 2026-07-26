import type { FinancialContext } from './types.js';

/** Loose inputs from the OS board — all optional; missing ones are listed, never invented. */
export type FinancialContextBoardInput = {
  currency?: string;
  sales?: Partial<FinancialContext['sales']> | null;
  breakEven?: Partial<FinancialContext['breakEven']> | null;
  liquidity?: Partial<FinancialContext['liquidity']> | null;
  capacity?: Partial<FinancialContext['capacity']> | null;
  workspaceConfig?: Partial<FinancialContext['workspaceConfig']> | null;
  health?: Partial<FinancialContext['health']> | null;
  engineRecommendation?: Partial<FinancialContext['engineRecommendation']> | null;
  debts?: Partial<FinancialContext['debts']> | null;
  marketing?: Partial<FinancialContext['marketing']> | null;
  costs?: Partial<FinancialContext['costs']> | null;
  inventory?: Partial<FinancialContext['inventory']> | null;
  scenarios?: Partial<FinancialContext['scenarios']> | null;
  dailyClosing?: Partial<FinancialContext['dailyClosing']> | null;
  alerts?: string[];
  notes?: string[];
};

/**
 * Assembles a FinancialContext from OS board state.
 * Does not invent values — records gaps in missingFields.
 */
export function buildFinancialContext(input: FinancialContextBoardInput): FinancialContext {
  const missing: string[] = [];
  const currency = input.currency ?? 'COP';

  const sales = {
    dayNet: input.sales?.dayNet ?? null,
    dayCount: input.sales?.dayCount ?? null,
    monthNet: input.sales?.monthNet ?? null,
    monthCount: input.sales?.monthCount ?? null,
    accumulatedNet: input.sales?.accumulatedNet ?? null,
    accumulatedCount: input.sales?.accumulatedCount ?? null,
    source: input.sales?.source ?? 'unknown',
  };
  if (sales.dayNet == null) missing.push('sales.dayNet');
  if (sales.monthNet == null) missing.push('sales.monthNet');

  const breakEven = {
    breakEvenSales: input.breakEven?.breakEvenSales ?? null,
    projectedSales: input.breakEven?.projectedSales ?? null,
    safetyMargin: input.breakEven?.safetyMargin ?? null,
    safetyMarginRate: input.breakEven?.safetyMarginRate ?? null,
    contributionMarginRate: input.breakEven?.contributionMarginRate ?? null,
    totalFixedCosts: input.breakEven?.totalFixedCosts ?? null,
  };
  if (breakEven.breakEvenSales == null) missing.push('breakEven.breakEvenSales');
  if (breakEven.safetyMargin == null) missing.push('breakEven.safetyMargin');

  const liquidity = {
    cash: input.liquidity?.cash ?? null,
    monthlyFixedBurn: input.liquidity?.monthlyFixedBurn ?? null,
    monthlyFreeCashFlow: input.liquidity?.monthlyFreeCashFlow ?? null,
    reserveMonths: input.liquidity?.reserveMonths ?? null,
    runwayMonths: input.liquidity?.runwayMonths ?? null,
    maxSafeExtraDebtPayment: input.liquidity?.maxSafeExtraDebtPayment ?? null,
  };
  if (liquidity.cash == null) missing.push('liquidity.cash');
  if (liquidity.runwayMonths == null) missing.push('liquidity.runwayMonths');
  if (liquidity.maxSafeExtraDebtPayment == null) missing.push('liquidity.maxSafeExtraDebtPayment');

  const capacity = {
    canSpendToday: input.capacity?.canSpendToday ?? null,
    canInvest: input.capacity?.canInvest ?? null,
    canPayDebtExtra: input.capacity?.canPayDebtExtra ?? null,
    canRestock: input.capacity?.canRestock ?? null,
    canWithdrawProfit: input.capacity?.canWithdrawProfit ?? null,
    canSpendAds: input.capacity?.canSpendAds ?? null,
    immediateFreeCash: input.capacity?.immediateFreeCash ?? null,
    recompraEarmark: input.capacity?.recompraEarmark ?? null,
    nextQuincena: input.capacity?.nextQuincena ?? null,
    creditCardInstallment: input.capacity?.creditCardInstallment ?? null,
    gaps: input.capacity?.gaps ?? [],
  };
  if (capacity.immediateFreeCash == null) missing.push('capacity.immediateFreeCash');
  if (capacity.canPayDebtExtra == null) missing.push('capacity.canPayDebtExtra');
  for (const g of capacity.gaps) {
    missing.push(`capacity.gap.${g}`);
  }

  const workspaceConfig = {
    currency: input.workspaceConfig?.currency ?? null,
    fiscalYearStartMonth: input.workspaceConfig?.fiscalYearStartMonth ?? null,
    closingDaysOfMonth: input.workspaceConfig?.closingDaysOfMonth ?? null,
    operatingDaysPerMonth: input.workspaceConfig?.operatingDaysPerMonth ?? null,
    targetProfitAmount: input.workspaceConfig?.targetProfitAmount ?? null,
    debtReductionTargetAmount: input.workspaceConfig?.debtReductionTargetAmount ?? null,
    inventoryRestockCycleDays: input.workspaceConfig?.inventoryRestockCycleDays ?? null,
    activeSalesChannelLabels: input.workspaceConfig?.activeSalesChannelLabels ?? [],
    expenseCategoryLabels: input.workspaceConfig?.expenseCategoryLabels ?? [],
  };
  if (workspaceConfig.currency == null || workspaceConfig.currency === '') {
    missing.push('workspaceConfig.currency');
  }
  if (workspaceConfig.targetProfitAmount == null || workspaceConfig.targetProfitAmount === '') {
    missing.push('workspaceConfig.targetProfitAmount');
  }

  const health = {
    score: input.health?.score ?? null,
    riskLevel: input.health?.riskLevel ?? null,
  };
  if (health.score == null) missing.push('health.score');

  const engineRecommendation = {
    action: input.engineRecommendation?.action ?? null,
    suggestedExtraDebtPayment: input.engineRecommendation?.suggestedExtraDebtPayment ?? null,
    adjustedMaxSafeExtraDebtPayment:
      input.engineRecommendation?.adjustedMaxSafeExtraDebtPayment ?? null,
    valid: input.engineRecommendation?.valid ?? null,
    rationale: input.engineRecommendation?.rationale ?? [],
  };

  const debts = {
    totalBalance: input.debts?.totalBalance ?? null,
    estimatedMonthlyInterest: input.debts?.estimatedMonthlyInterest ?? null,
    monthlyInstallmentsDue: input.debts?.monthlyInstallmentsDue ?? null,
    obligationCount: input.debts?.obligationCount ?? null,
    allowsExtraPaymentCount: input.debts?.allowsExtraPaymentCount ?? null,
    optimizerSuggestedTarget: input.debts?.optimizerSuggestedTarget ?? null,
    optimizerSuggestedAmount: input.debts?.optimizerSuggestedAmount ?? null,
    optimizerRationale: input.debts?.optimizerRationale ?? [],
    obligations: input.debts?.obligations ?? [],
  };
  if (debts.totalBalance == null) missing.push('debts.totalBalance');
  if (!debts.obligations.length) missing.push('debts.obligations');

  const marketing = {
    totalBudget: input.marketing?.totalBudget ?? null,
    totalActual: input.marketing?.totalActual ?? null,
    freedCapacityAmount: input.marketing?.freedCapacityAmount ?? null,
    overspendAmount: input.marketing?.overspendAmount ?? null,
    channels: input.marketing?.channels ?? [],
  };

  const costs = {
    fixedCostLines: input.costs?.fixedCostLines ?? [],
  };
  if (!costs.fixedCostLines.length) missing.push('costs.fixedCostLines');

  const dailyClosing = {
    seriesStart: input.dailyClosing?.seriesStart ?? null,
    today: input.dailyClosing?.today ?? null,
    pendingDays: input.dailyClosing?.pendingDays ?? [],
    lastClosed: input.dailyClosing?.lastClosed ?? null,
    canGenerateRecommendations: input.dailyClosing?.canGenerateRecommendations ?? null,
    recentClosings: input.dailyClosing?.recentClosings ?? [],
    fixedCostsThisMonth: input.dailyClosing?.fixedCostsThisMonth ?? [],
    commitments: input.dailyClosing?.commitments ?? [],
  };
  if (dailyClosing.pendingDays.length > 0) {
    missing.push('dailyClosing.pendingDays');
  }
  if (!dailyClosing.recentClosings.length) missing.push('dailyClosing.recentClosings');

  const inventory = {
    units: input.inventory?.units ?? null,
    valueAtCost: input.inventory?.valueAtCost ?? null,
    valueAtPrice: input.inventory?.valueAtPrice ?? null,
    skuCount: input.inventory?.skuCount ?? null,
    skusWithStock: input.inventory?.skusWithStock ?? null,
    skusBelowMin: input.inventory?.skusBelowMin ?? null,
    source: input.inventory?.source ?? 'unknown',
  };
  if (inventory.valueAtCost == null) missing.push('inventory');

  const scenarios = {
    immediateCapacity: input.scenarios?.immediateCapacity ?? null,
    preferredScenarioId: input.scenarios?.preferredScenarioId ?? null,
    evaluations: input.scenarios?.evaluations ?? [],
  };
  if (!scenarios.evaluations.length) missing.push('scenarios');

  return {
    generatedAt: new Date().toISOString(),
    currency,
    sales,
    breakEven,
    liquidity,
    capacity,
    workspaceConfig,
    health,
    engineRecommendation,
    debts,
    marketing,
    costs,
    dailyClosing,
    inventory,
    scenarios,
    missingFields: [...new Set(missing)],
    alerts: input.alerts ?? [],
    notes: [
      ...(input.notes ?? []),
      'OpenAI must not invent missing fields listed in missingFields.',
      'All monetary figures are pre-computed by Financial OS engines.',
      'capacity.* answers the six owner questions; do not recalculate them.',
    ],
  };
}
