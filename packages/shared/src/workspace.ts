/**
 * Business workspace configuration — all user-owned data.
 * Engines never invent financial values; they only compute from this data.
 */

/** Freeform catalog line (fixed or variable cost). */
export type ConfigurableLineItem = {
  id: string;
  label: string;
  /** Decimal string — currency decided by workspace. */
  amount: string;
  /** User-defined category label (e.g. "Nómina", "Marketing"). */
  category: string;
  active: boolean;
  /** Display order; user can reorder. */
  sortOrder: number;
  notes?: string;
};

/** User-defined product — no assumed industry. */
export type ConfigurableProduct = {
  id: string;
  name: string;
  productCost: string;
  salePrice: string;
  mixWeight?: string;
  logisticsCost?: string;
  commissionRate?: string;
  active: boolean;
  sortOrder: number;
  notes?: string;
};

/**
 * User-defined season. Never pre-seeded as "July is bad".
 * Overlaps allowed; interpretation is data-driven from history later.
 */
export type Season = {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  /** Free text / tags the user attaches — not engine rules. */
  expectedBehaviorNotes?: string;
  active: boolean;
};

/** Modules the user can show/hide without code changes. */
export type ModuleId =
  | 'break_even'
  | 'liquidity'
  | 'cashflow'
  | 'debts'
  | 'payroll'
  | 'inventory'
  | 'marketing'
  | 'roi'
  | 'seasons'
  | 'risk'
  | string;

export type ModuleToggle = {
  moduleId: ModuleId;
  enabled: boolean;
  label: string;
};

/** User-composed dashboard — no fixed KPI set. */
export type DashboardWidgetId =
  | 'break_even'
  | 'safety_margin'
  | 'liquidity'
  | 'cash'
  | 'free_cash_flow'
  | 'debts'
  | 'future_interest'
  | 'marketing_budget'
  | 'marketing_actual'
  | 'marketing_variance'
  | 'roi'
  | 'inventory'
  | 'payroll'
  | 'profit'
  | 'business_score'
  | 'runway_months'
  | string;

export type DashboardWidget = {
  id: string;
  widgetId: DashboardWidgetId;
  label: string;
  visible: boolean;
  sortOrder: number;
};

/**
 * Preference for liquidity reserve — USER policy, not engine truth.
 * Must be supplied explicitly; engines must not invent "3 months".
 */
export type LiquidityPolicy = {
  reserveMonths: string; // decimal string e.g. "3" or "4.5"
};

/**
 * Risk score weights — USER preference. Must sum to 1.
 * Engines must not assume a built-in weight table as truth.
 */
export type RiskWeightPolicy = Record<string, string>;

export type BusinessWorkspaceConfig = {
  workspaceId: string;
  currency: string;
  /** Required for period scaling (daily/weekly). User chooses (e.g. 26, 30). */
  operatingDaysPerMonth: number;
  variableCosts: ConfigurableLineItem[];
  fixedCosts: ConfigurableLineItem[];
  products: ConfigurableProduct[];
  seasons: Season[];
  modules: ModuleToggle[];
  dashboard: DashboardWidget[];
  liquidityPolicy: LiquidityPolicy;
  riskWeightPolicy: RiskWeightPolicy;
  /** Optional target profit amount (input). */
  targetProfitAmount?: string;
  /** Optional target margin on price 0..1 (input) — does not set BEP. */
  targetUtilityOnPrice?: string;
  /** Expected sales for the period (input) — never break-even itself. */
  projectedSales?: string;
  /** Marketing channels + plan vs actual (optional module). */
  marketingChannels?: import('./marketing.js').MarketingChannel[];
  marketingBudgets?: import('./marketing.js').MarketingBudgetEntry[];
  marketingActuals?: import('./marketing.js').MarketingActualEntry[];
  marketingVariancePolicy?: import('./marketing.js').MarketingVariancePolicy;
};

/**
 * INPUT vs OUTPUT separation (non-negotiable).
 *
 * INPUTS (user edits): costs, prices, volumes, targets, seasons, modules, dashboard, policies.
 * OUTPUTS (engine computes only): break-even, safety margin, runway, scores, recommendations.
 */
export type MetricKind = 'input' | 'output';

export const METRIC_KIND = {
  fixedCost: 'input',
  variableCost: 'input',
  productPrice: 'input',
  productCost: 'input',
  projectedSales: 'input',
  targetProfit: 'input',
  targetUtility: 'input',
  season: 'input',
  moduleToggle: 'input',
  dashboardLayout: 'input',
  liquidityReserveMonths: 'input',
  riskWeights: 'input',
  marketingBudget: 'input',
  marketingActualSpend: 'input',
  breakEvenUnits: 'output',
  breakEvenSales: 'output',
  safetyMargin: 'output',
  runwayMonths: 'output',
  businessScore: 'output',
  recommendation: 'output',
  marketingPlanVariance: 'output',
} as const satisfies Record<string, MetricKind>;
