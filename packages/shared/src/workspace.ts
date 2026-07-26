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
  /** Day of month (1–31) when budgeted fixed cost is expected to be paid. */
  dueDay?: number;
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
 * Editable anytime in the OS; never a silent product default.
 */
export type LiquidityPolicy = {
  /** Months of fixed burn to keep as reserve (e.g. "2" or "3.5"). */
  reserveMonths: string;
  /**
   * Optional absolute cash floor in workspace currency (decimal string).
   * Extra debt payments must not push cash below this when set.
   */
  minCashFloor?: string;
  /**
   * If true, reserve must not be used for extra debt payments (hard floor).
   * If false, AI/engines may warn but user can override consciously.
   */
  reserveIsHardFloor: boolean;
  /** Free-text rationale / notes from the user (or confirmed AI draft). */
  notes?: string;
  updatedAt?: string;
};

/**
 * Risk score weights — USER preference. Must sum to 1.
 * Engines must not assume a built-in weight table as truth.
 */
export type RiskWeightPolicy = Record<string, string>;

/** User-defined catalog label (expense / movement categories). */
export type ConfigCatalogItem = {
  id: string;
  label: string;
  active: boolean;
  sortOrder: number;
  /** For extraordinary movements: cash direction hint. */
  direction?: 'inflow' | 'outflow';
};

/**
 * Centro de Configuración — rules the whole OS reads.
 * No silent product defaults for financial values; empty string = user has not set.
 */
export type WorkspaceCentralConfig = {
  currency: string;
  /** Fiscal year start month 1–12 (string). */
  fiscalYearStartMonth: string;
  /**
   * Days of month when formal close is expected (e.g. "15,30").
   * Empty = daily register only (no monthly close day declared).
   */
  closingDaysOfMonth: string;
  /** Operating / sales days per month for period scaling (e.g. "26"). */
  operatingDaysPerMonth: string;
  /** Target profit amount in workspace currency. */
  targetProfitAmount: string;
  /** Debt reduction goal amount for the planning horizon. */
  debtReductionTargetAmount: string;
  /** Average inventory restock cycle in days. */
  inventoryRestockCycleDays: string;
  /** Active sales / ads channels (feeds marketing module). */
  salesChannels: ConfigCatalogItem[];
  /** Expense category catalog (feeds costs + closing extras). */
  expenseCategories: ConfigCatalogItem[];
  /** Extraordinary movement kinds (feeds daily register). */
  extraordinaryMovementCategories: ConfigCatalogItem[];
  updatedAt?: string;
};

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
