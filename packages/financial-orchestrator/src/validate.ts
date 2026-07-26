import type { BoardInput, BoardValidation } from './types.js';

/**
 * Lists missing facts — never invents defaults.
 * ok=true only when capacity + liquidity can be derived safely.
 */
export function validateBoardInputs(input: BoardInput): BoardValidation {
  const missing: string[] = [];

  if (!input.cash.cashOnHand.trim()) missing.push('cash.cashOnHand');
  if (!input.policy.reserveMonths.trim()) missing.push('policy.reserveMonths');
  if (!input.policy.currency.trim()) missing.push('policy.currency');
  if (!input.monthlyFixedBurn.trim()) missing.push('monthlyFixedBurn');

  const share = input.cash.recompraShareOfCash.trim();
  if (share === '') missing.push('cash.recompraShareOfCash');

  if (input.nearTerm.payrollMonthly == null || input.nearTerm.payrollMonthly === '') {
    missing.push('nearTerm.payrollMonthly');
  }
  if (input.nearTerm.creditCardInstallment == null || input.nearTerm.creditCardInstallment === '') {
    missing.push('nearTerm.creditCardInstallment');
  }

  return { ok: missing.length === 0, missingFields: [...new Set(missing)] };
}
