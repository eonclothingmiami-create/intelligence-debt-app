import { Money, Decimal } from '@fie/financial-engine';
import type { DebtObligation } from '../types/obligation.js';
import type { DebtEventLog } from '../events/types.js';
import { foldDebtEvents, mergeObligationConfig, type DerivedDebtState } from '../fold/derive.js';

export type ObligationSnapshot = {
  obligation: DebtObligation;
  state: DerivedDebtState;
  balance: string;
  /** Rough monthly interest if ratePeriodicity=monthly and ratePercent set. */
  estimatedMonthlyInterest: string | null;
};

export type DebtPortfolioDashboard = {
  currency: string;
  obligationCount: number;
  totalBalance: string;
  estimatedMonthlyInterest: string;
  monthlyInstallmentsDue: string;
  allowsExtraPaymentCount: number;
  snapshots: ObligationSnapshot[];
};

function monthlyInterest(state: DerivedDebtState, obligation: DebtObligation): Money | null {
  const rate = state.ratePercent ?? obligation.ratePercent;
  const periodicity = state.ratePeriodicity ?? obligation.ratePeriodicity;
  if (!rate || periodicity === 'none' || !state.principal.isPositive()) return null;
  const r = new Decimal(rate).div(100);
  if (periodicity === 'monthly') {
    return state.principal.mul(r).settle();
  }
  if (periodicity === 'annual') {
    return state.principal.mul(r.div(12)).settle();
  }
  if (periodicity === 'daily') {
    return state.principal.mul(r.times(30)).settle();
  }
  return null;
}

export function snapshotObligation(
  obligation: DebtObligation,
  log: DebtEventLog,
): ObligationSnapshot {
  const folded = foldDebtEvents(obligation.id, log, obligation.currency);
  const state = mergeObligationConfig(folded, obligation);
  const interest = monthlyInterest(state, obligation);
  return {
    obligation,
    state,
    balance: state.principal.toString(),
    estimatedMonthlyInterest: interest ? interest.toString() : null,
  };
}

/**
 * Debt dashboard aggregates — feeds cashflow, liquidity, BEP cost lines, health score.
 */
export function buildDebtPortfolioDashboard(
  obligations: DebtObligation[],
  logsByObligationId: Record<string, DebtEventLog>,
  currency = 'COP',
): DebtPortfolioDashboard {
  const active = obligations.filter((o) => o.active);
  const snapshots = active.map((o) => snapshotObligation(o, logsByObligationId[o.id] ?? []));

  let total = Money.zero(currency);
  let monthlyInterest = Money.zero(currency);
  let installments = Money.zero(currency);
  let extraOk = 0;

  for (const snap of snapshots) {
    if (snap.state.closed) continue;
    total = total.add(Money.from(snap.balance, currency));
    if (snap.estimatedMonthlyInterest) {
      monthlyInterest = monthlyInterest.add(Money.from(snap.estimatedMonthlyInterest, currency));
    }
    const cuota =
      snap.obligation.interestOnlyPayments && snap.estimatedMonthlyInterest
        ? (snap.state.fixedInstallmentAmount ??
          snap.obligation.fixedInstallmentAmount ??
          snap.obligation.minimumPaymentAmount ??
          snap.estimatedMonthlyInterest)
        : (snap.state.fixedInstallmentAmount ??
          snap.obligation.fixedInstallmentAmount ??
          snap.obligation.minimumPaymentAmount ??
          snap.obligation.targetPaymentAmount);
    if (cuota) {
      installments = installments.add(Money.from(cuota, currency));
    }
    if (snap.obligation.allowsExtraPayments) extraOk += 1;
  }

  return {
    currency,
    obligationCount: snapshots.filter((s) => !s.state.closed).length,
    totalBalance: total.toString(),
    estimatedMonthlyInterest: monthlyInterest.toString(),
    monthlyInstallmentsDue: installments.toString(),
    allowsExtraPaymentCount: extraOk,
    snapshots,
  };
}
