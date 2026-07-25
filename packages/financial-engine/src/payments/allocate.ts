import { Money } from '../math/money.js';
import type { PaymentBucket, ExtraPaymentTarget } from '../shared/types.js';
import type { DerivedState, InstallmentLine } from '../core/fold.js';

export type AllocationLine = {
  bucket: PaymentBucket;
  amount: Money;
  installmentId?: string;
};

const ORDER: PaymentBucket[] = [
  'LateFee',
  'Interest',
  'Insurance',
  'Commission',
  'RevolvingPrincipal',
  'InstallmentPrincipal',
];

function dueForBucket(state: DerivedState, bucket: PaymentBucket): Money {
  switch (bucket) {
    case 'LateFee':
      return state.lateFeeDue;
    case 'Interest':
      return state.interestDue;
    case 'Insurance':
      return state.insuranceDue;
    case 'Commission':
      return state.commissionDue;
    case 'RevolvingPrincipal':
      return state.revolvingPrincipal;
    case 'InstallmentPrincipal':
      return Money.zero(state.currency);
    default:
      return Money.zero(state.currency);
  }
}

/**
 * Allocate a payment across dues per A-PAY-2.
 * Pure: returns allocation lines; does not mutate state.
 */
export function allocatePayment(state: DerivedState, paymentAmount: Money): AllocationLine[] {
  let remaining = paymentAmount;
  const lines: AllocationLine[] = [];

  for (const bucket of ORDER) {
    if (remaining.isZero()) break;
    if (bucket === 'InstallmentPrincipal') {
      const unpaid = [...state.installments]
        .filter((l) => !l.paid && l.remainingPrincipal.isPositive())
        .sort((a, b) => (a.dueOn < b.dueOn ? -1 : a.dueOn > b.dueOn ? 1 : 0));
      for (const inst of unpaid) {
        if (remaining.isZero()) break;
        const pay = remaining.min(inst.remainingPrincipal);
        if (pay.isPositive()) {
          lines.push({ bucket, amount: pay, installmentId: inst.installmentId });
          remaining = remaining.sub(pay);
        }
      }
      continue;
    }
    const due = dueForBucket(state, bucket);
    const pay = remaining.min(due);
    if (pay.isPositive()) {
      lines.push({ bucket, amount: pay });
      remaining = remaining.sub(pay);
    }
  }

  return lines;
}

export function leftoverAfterAllocation(paymentAmount: Money, lines: AllocationLine[]): Money {
  const used = lines.reduce((acc, l) => acc.add(l.amount), Money.zero(paymentAmount.currency));
  return paymentAmount.sub(used);
}

export function computeMinimumPayment(state: DerivedState): Money {
  const config = state.config;
  if (!config) return Money.zero(state.currency);
  const installmentsDue = state.installments
    .filter((l) => !l.paid)
    .reduce((acc, l) => acc.add(l.principalAmount), Money.zero(state.currency));
  // For min pay, use current unpaid installment remaining as due component
  const installmentComponent = state.installments
    .filter((l) => !l.paid)
    .reduce((acc, l) => acc.add(l.remainingPrincipal), Money.zero(state.currency));
  void installmentsDue;
  const variable = state.revolvingPrincipal
    .mul(config.minPaymentRate.decimal)
    .add(state.interestDue)
    .add(state.lateFeeDue)
    .add(state.insuranceDue)
    .add(state.commissionDue)
    .add(installmentComponent);
  return variable.max(config.minPaymentFloor).settle();
}

export type ExtraPaymentTargetPolicy = ExtraPaymentTarget;

export function unpaidInstallments(state: DerivedState): InstallmentLine[] {
  return state.installments.filter((l) => !l.paid);
}
