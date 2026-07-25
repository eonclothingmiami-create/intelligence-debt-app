import { Money, Decimal, FinancialEngineError } from '@fie/financial-engine';
import type {
  MarketingActualEntry,
  MarketingBudgetEntry,
  MarketingPlanVsActual,
  MarketingVariancePolicy,
} from '@fie/shared';

function sumAmounts(entries: Array<{ amount: string }>, currency: string): Money {
  return entries.reduce((acc, e) => acc.add(Money.from(e.amount, currency)), Money.zero(currency));
}

/**
 * Compare planned marketing budget vs actual platform charges.
 * Alerts use the user's deviation policy — never a hardcoded %.
 */
export function compareMarketingPlanVsActual(input: {
  currency: string;
  channelId: string;
  periodFrom: string;
  periodTo: string;
  budgets: MarketingBudgetEntry[];
  actuals: MarketingActualEntry[];
  policy: MarketingVariancePolicy;
}): MarketingPlanVsActual {
  const budgets = input.budgets.filter(
    (b) =>
      b.channelId === input.channelId &&
      b.currency === input.currency &&
      b.periodFrom === input.periodFrom &&
      b.periodTo === input.periodTo,
  );
  const actuals = input.actuals.filter(
    (a) =>
      a.channelId === input.channelId &&
      a.currency === input.currency &&
      a.occurredOn >= input.periodFrom &&
      a.occurredOn <= input.periodTo,
  );

  const budgetMoney = sumAmounts(
    budgets.map((b) => ({ amount: b.budgetAmount })),
    input.currency,
  );
  const actualMoney = sumAmounts(
    actuals.map((a) => ({ amount: a.actualAmount })),
    input.currency,
  );
  const variance = actualMoney.sub(budgetMoney);

  let varianceRate: string | null = null;
  let status: MarketingPlanVsActual['status'] = 'on_plan';
  let alert = false;

  const threshold = new Decimal(input.policy.alertDeviationRate);
  if (threshold.lt(0)) {
    throw new FinancialEngineError('INVALID_VARIANCE_POLICY', 'alertDeviationRate must be >= 0');
  }

  if (budgetMoney.isPositive()) {
    const rate = variance.decimal.div(budgetMoney.decimal);
    varianceRate = rate.toFixed();
    const absRate = rate.abs();
    if (absRate.lte(threshold)) {
      status = 'on_plan';
      alert = false;
    } else if (rate.gt(0)) {
      status = 'over_budget';
      alert = true;
    } else {
      status = 'under_budget';
      alert = true;
    }
  } else if (actualMoney.isPositive()) {
    status = 'over_budget';
    alert = true;
    varianceRate = null;
  }

  return {
    channelId: input.channelId,
    periodFrom: input.periodFrom,
    periodTo: input.periodTo,
    budgetAmount: budgetMoney.toString(),
    actualAmount: actualMoney.toString(),
    varianceAmount: variance.toString(),
    varianceRate,
    status,
    alert,
  };
}

/**
 * Total planned budget in period (for BEP / planning views).
 */
export function totalMarketingBudget(
  budgets: MarketingBudgetEntry[],
  currency: string,
  periodFrom?: string,
  periodTo?: string,
): Money {
  const filtered = budgets.filter((b) => {
    if (b.currency !== currency) return false;
    if (periodFrom && b.periodFrom !== periodFrom) return false;
    if (periodTo && b.periodTo !== periodTo) return false;
    return true;
  });
  return sumAmounts(
    filtered.map((b) => ({ amount: b.budgetAmount })),
    currency,
  );
}

/**
 * Total actual spend in period (for debt, cashflow, ROI).
 */
export function totalMarketingActual(
  actuals: MarketingActualEntry[],
  currency: string,
  periodFrom?: string,
  periodTo?: string,
): Money {
  const filtered = actuals.filter((a) => {
    if (a.currency !== currency) return false;
    if (periodFrom && a.occurredOn < periodFrom) return false;
    if (periodTo && a.occurredOn > periodTo) return false;
    return true;
  });
  return sumAmounts(
    filtered.map((a) => ({ amount: a.actualAmount })),
    currency,
  );
}
