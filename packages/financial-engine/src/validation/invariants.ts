import type { DerivedState } from '../core/fold.js';
import { totalPrincipal, totalDue } from '../core/fold.js';
import { Money } from '../math/money.js';
import { FinancialEngineError } from '../shared/types.js';

export function assertNonNegativePrincipals(state: DerivedState): void {
  if (state.revolvingPrincipal.isNegative()) {
    throw new FinancialEngineError('INVARIANT', 'revolvingPrincipal must be >= 0');
  }
  for (const line of state.installments) {
    if (line.remainingPrincipal.isNegative()) {
      throw new FinancialEngineError('INVARIANT', 'installment remaining must be >= 0');
    }
  }
}

export function assertAllocationConserved(payment: Money, allocatedSum: Money): void {
  if (!payment.eq(allocatedSum) && payment.lt(allocatedSum)) {
    throw new FinancialEngineError('INVARIANT', 'allocated sum exceeds payment');
  }
}

export function validateDerivedState(state: DerivedState): string[] {
  const warnings: string[] = [];
  assertNonNegativePrincipals(state);
  if (state.opened && !state.config) {
    warnings.push('opened without config');
  }
  const due = totalDue(state);
  if (due.isNegative()) {
    warnings.push('totalDue negative');
  }
  void totalPrincipal;
  return warnings;
}
