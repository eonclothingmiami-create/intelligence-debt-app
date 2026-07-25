import { Money } from '../math/money.js';
import type { DerivedState } from '../core/fold.js';
import { totalPrincipal } from '../core/fold.js';

export type CashflowPeriod = {
  periodIndex: number;
  outflow: Money;
  inflow: Money;
  net: Money;
};

export function projectMonthlyCashflow(
  state: DerivedState,
  months: number,
  monthlyPayment: Money,
  monthlyIncome: Money,
): CashflowPeriod[] {
  const periods: CashflowPeriod[] = [];
  for (let i = 1; i <= months; i += 1) {
    const outflow = monthlyPayment;
    const inflow = monthlyIncome;
    periods.push({
      periodIndex: i,
      outflow,
      inflow,
      net: inflow.sub(outflow),
    });
  }
  void state;
  return periods;
}

export type ProjectionPoint = {
  month: number;
  principal: Money;
  interestPaidCumulative: Money;
};

/**
 * Simple linear payoff projection for revolving principal given fixed monthly payment
 * and approximate monthly rate (interest applied then payment). Deterministic.
 */
export function projectPaydown(
  startingPrincipal: Money,
  monthlyRate: string,
  monthlyPayment: Money,
  maxMonths: number,
): ProjectionPoint[] {
  const points: ProjectionPoint[] = [];
  let principal = startingPrincipal;
  let interestCum = Money.zero(startingPrincipal.currency);
  for (let month = 1; month <= maxMonths; month += 1) {
    if (!principal.isPositive()) {
      points.push({
        month,
        principal: Money.zero(startingPrincipal.currency),
        interestPaidCumulative: interestCum,
      });
      break;
    }
    const interest = principal.mul(monthlyRate).settle();
    interestCum = interestCum.add(interest);
    principal = principal.add(interest);
    const pay = monthlyPayment.min(principal);
    principal = principal.sub(pay);
    points.push({ month, principal, interestPaidCumulative: interestCum });
  }
  return points;
}

export function snapshotPrincipal(state: DerivedState): Money {
  return totalPrincipal(state);
}
