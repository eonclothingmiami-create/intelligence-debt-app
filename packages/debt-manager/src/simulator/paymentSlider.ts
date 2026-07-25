import { Money, Decimal, FinancialEngineError, type DecimalValue } from '@fie/financial-engine';
import type { DebtObligation } from '../types/obligation.js';
import type { DerivedDebtState } from '../fold/derive.js';

/**
 * Debt Simulator — project payoff under an alternate payment.
 * Full card amortization stays in @fie/financial-engine; this covers fixed-rate installment style.
 */
export type DebtPaymentSimulationInput = {
  obligation: DebtObligation;
  state: DerivedDebtState;
  /** Current planned payment per period. */
  currentPayment: string;
  /** Slider / alternate payment. */
  proposedPayment: string;
  /** Max periods to project (safety). */
  maxPeriods?: number;
};

export type DebtPaymentSimulationResult = {
  obligationId: string;
  currentPayment: string;
  proposedPayment: string;
  periodsAtCurrent: number | null;
  periodsAtProposed: number | null;
  interestAtCurrent: string | null;
  interestAtProposed: string | null;
  interestSaved: string | null;
  /** false if obligation forbids extras and proposed > current minimum path */
  allowed: boolean;
  rationale: string[];
};

function projectPayoff(
  principal: Money,
  monthlyRate: DecimalValue,
  payment: Money,
  maxPeriods: number,
): { periods: number | null; interest: Money } {
  let bal = principal;
  let interestTotal = Money.zero(principal.currency);
  if (!payment.isPositive()) {
    return { periods: null, interest: interestTotal };
  }
  for (let i = 1; i <= maxPeriods; i += 1) {
    if (!bal.isPositive()) {
      return { periods: i - 1, interest: interestTotal };
    }
    const interest = bal.mul(monthlyRate).settle();
    interestTotal = interestTotal.add(interest);
    bal = bal.add(interest).sub(payment);
    if (bal.isNegative()) bal = Money.zero(principal.currency);
    if (!bal.isPositive()) {
      return { periods: i, interest: interestTotal };
    }
  }
  return { periods: null, interest: interestTotal };
}

function monthlyRateFromObligation(
  obligation: DebtObligation,
  state: DerivedDebtState,
): DecimalValue {
  const rate = state.ratePercent ?? obligation.ratePercent;
  const periodicity = state.ratePeriodicity ?? obligation.ratePeriodicity;
  if (!rate || periodicity === 'none') return new Decimal(0);
  const r = new Decimal(rate).div(100);
  if (periodicity === 'monthly') return r;
  if (periodicity === 'annual') return r.div(12);
  if (periodicity === 'daily') return r.times(30);
  return new Decimal(0);
}

export function simulateDebtPaymentChange(
  input: DebtPaymentSimulationInput,
): DebtPaymentSimulationResult {
  const { obligation, state } = input;
  if (state.closed || !state.opened) {
    throw new FinancialEngineError('DEBT_CLOSED', 'Cannot simulate a closed obligation');
  }

  const current = Money.from(input.currentPayment, obligation.currency);
  const proposed = Money.from(input.proposedPayment, obligation.currency);
  const maxPeriods = input.maxPeriods ?? 600;
  const rate = monthlyRateFromObligation(obligation, state);

  const allowed = obligation.allowsExtraPayments || !proposed.gt(current) || proposed.eq(current);

  const rationale: string[] = [];
  if (!allowed) {
    rationale.push(
      `Esta obligación (${obligation.label}) no permite abonos extraordinarios por encima del pago planificado.`,
    );
  }
  if (obligation.prepaymentPenalty) {
    rationale.push(
      `Advertencia: hay costo de prepago configurado${obligation.prepaymentPenaltyNote ? `: ${obligation.prepaymentPenaltyNote}` : ''}.`,
    );
  }
  if (obligation.interestOnlyPayments) {
    rationale.push(
      'Modalidad solo intereses: el pago ordinario no abona a capital; el saldo solo baja con abonos extraordinarios (si están permitidos).',
    );
  }

  const atCurrent = projectPayoff(state.principal, rate, current, maxPeriods);
  const atProposed = allowed
    ? projectPayoff(state.principal, rate, proposed, maxPeriods)
    : { periods: null, interest: Money.zero(obligation.currency) };

  if (obligation.interestOnlyPayments && atCurrent.periods === null) {
    rationale.push(
      'Con el pago planificado actual el capital no se cancela (solo intereses / cuota insuficiente para amortizar).',
    );
  }

  let interestSaved: string | null = null;
  if (allowed && atCurrent.interest && atProposed.interest) {
    interestSaved = atCurrent.interest.sub(atProposed.interest).toString();
  }

  if (allowed) {
    rationale.push(
      `Pago ${proposed.toString()} vs ${current.toString()}: plazos ${atProposed.periods ?? 'n/a'} vs ${atCurrent.periods ?? 'n/a'}; interés estimado ahorrado ${interestSaved ?? 'n/a'}.`,
    );
    rationale.push(
      'El impacto en liquidez / BEP / health score lo compone el Recommendation Engine con el resto del OS — esta simulación es solo de la obligación.',
    );
  }

  return {
    obligationId: obligation.id,
    currentPayment: current.toString(),
    proposedPayment: proposed.toString(),
    periodsAtCurrent: atCurrent.periods,
    periodsAtProposed: atProposed.periods,
    interestAtCurrent: atCurrent.interest.toString(),
    interestAtProposed: allowed ? atProposed.interest.toString() : null,
    interestSaved,
    allowed,
    rationale,
  };
}
