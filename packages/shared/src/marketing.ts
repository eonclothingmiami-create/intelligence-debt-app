/**
 * Marketing: budget (plan) vs actual (execution) — never a single blended "Publicidad" amount.
 *
 * - budgetAmount → planning, BEP scenarios, plan-vs-actual alerts
 * - actualAmount → debt evolution, cash flow, ROI, financing cost
 */

export type MarketingChannel = {
  id: string;
  label: string; // e.g. TikTok Ads, Meta, Google
  active: boolean;
  sortOrder: number;
  notes?: string;
};

/** Planned investment for a period (input). */
export type MarketingBudgetEntry = {
  id: string;
  channelId: string;
  periodFrom: string; // YYYY-MM-DD
  periodTo: string;
  /** Planned amount — NOT used for debt balance evolution. */
  budgetAmount: string;
  currency: string;
  notes?: string;
};

/** What the platform actually charged (input / from import). */
export type MarketingActualEntry = {
  id: string;
  channelId: string;
  occurredOn: string;
  /** Actual charged amount — drives purchases/debt/cashflow. */
  actualAmount: string;
  currency: string;
  /** Optional link to card purchase / movement id. */
  linkedPurchaseId?: string;
  externalRef?: string;
  notes?: string;
};

/**
 * User policy: when |varianceRate| exceeds this, raise an alert.
 * e.g. "0.15" = 15% deviation. Required — no engine default.
 */
export type MarketingVariancePolicy = {
  alertDeviationRate: string;
};

export type MarketingPlanVsActual = {
  channelId: string;
  periodFrom: string;
  periodTo: string;
  budgetAmount: string;
  actualAmount: string;
  /** actual − budget */
  varianceAmount: string;
  /** (actual − budget) / budget ; null if budget is 0 */
  varianceRate: string | null;
  status: 'under_budget' | 'on_plan' | 'over_budget';
  alert: boolean;
};

/**
 * Multi-channel plan vs execution for a period.
 * Underspend (budget − actual > 0) frees capacity that can fund extra debt amortization.
 */
export type MarketingPortfolioVsActual = {
  periodFrom: string;
  periodTo: string;
  currency: string;
  channels: MarketingPlanVsActual[];
  totalBudgetAmount: string;
  totalActualAmount: string;
  /** max(0, totalBudget − totalActual) — planned ads money not spent */
  freedCapacityAmount: string;
  /** max(0, totalActual − totalBudget) — ads overspend pressure */
  overspendAmount: string;
  /** true if any channel raised an alert under the user policy */
  alert: boolean;
};
