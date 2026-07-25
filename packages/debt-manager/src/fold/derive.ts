import { Money, FinancialEngineError } from '@fie/financial-engine';
import type { DebtEventLog, DebtLifecycleEvent } from '../events/types.js';
import type { DebtObligation, RatePeriodicity } from '../types/obligation.js';

export type DerivedDebtState = {
  obligationId: string;
  currency: string;
  opened: boolean;
  closed: boolean;
  principal: Money;
  totalInterestCharged: Money;
  totalFeesCharged: Money;
  totalOrdinaryPaid: Money;
  totalExtraPaid: Money;
  ratePercent: string | null;
  ratePeriodicity: RatePeriodicity | null;
  installmentCount: number | null;
  fixedInstallmentAmount: string | null;
  maturityDate: string | null;
};

export function initialDebtState(obligationId: string, currency = 'COP'): DerivedDebtState {
  return {
    obligationId,
    currency,
    opened: false,
    closed: false,
    principal: Money.zero(currency),
    totalInterestCharged: Money.zero(currency),
    totalFeesCharged: Money.zero(currency),
    totalOrdinaryPaid: Money.zero(currency),
    totalExtraPaid: Money.zero(currency),
    ratePercent: null,
    ratePeriodicity: null,
    installmentCount: null,
    fixedInstallmentAmount: null,
    maturityDate: null,
  };
}

function requireOpen(state: DerivedDebtState): void {
  if (!state.opened || state.closed) {
    throw new FinancialEngineError(
      'DEBT_NOT_OPEN',
      `Obligation ${state.obligationId} is not open for this event`,
    );
  }
}

export function applyDebtEvent(
  state: DerivedDebtState,
  event: DebtLifecycleEvent,
): DerivedDebtState {
  if (event.obligationId !== state.obligationId) {
    throw new FinancialEngineError(
      'OBLIGATION_MISMATCH',
      'Event obligationId does not match state',
    );
  }

  switch (event.type) {
    case 'ObligationOpened': {
      const currency = event.payload.currency;
      return {
        ...initialDebtState(event.obligationId, currency),
        opened: true,
        closed: false,
        principal: Money.from(event.payload.openingPrincipal, currency),
      };
    }
    case 'DisbursementRecorded':
    case 'PurchaseCharged': {
      requireOpen(state);
      const amount = Money.from(event.payload.amount, state.currency);
      return { ...state, principal: state.principal.add(amount) };
    }
    case 'OrdinaryPaymentApplied': {
      requireOpen(state);
      const amount = Money.from(event.payload.amount, state.currency);
      return {
        ...state,
        principal: state.principal.sub(amount).max(Money.zero(state.currency)),
        totalOrdinaryPaid: state.totalOrdinaryPaid.add(amount),
      };
    }
    case 'ExtraPaymentApplied': {
      requireOpen(state);
      const amount = Money.from(event.payload.amount, state.currency);
      return {
        ...state,
        principal: state.principal.sub(amount).max(Money.zero(state.currency)),
        totalExtraPaid: state.totalExtraPaid.add(amount),
      };
    }
    case 'InterestCharged': {
      requireOpen(state);
      const amount = Money.from(event.payload.amount, state.currency);
      return {
        ...state,
        principal: state.principal.add(amount),
        totalInterestCharged: state.totalInterestCharged.add(amount),
      };
    }
    case 'FeeCharged':
    case 'CommissionCharged': {
      requireOpen(state);
      const amount = Money.from(event.payload.amount, state.currency);
      return {
        ...state,
        principal: state.principal.add(amount),
        totalFeesCharged: state.totalFeesCharged.add(amount),
      };
    }
    case 'RateChanged': {
      requireOpen(state);
      return {
        ...state,
        ratePercent: event.payload.ratePercent,
        ratePeriodicity: event.payload.ratePeriodicity as RatePeriodicity,
      };
    }
    case 'TermChanged': {
      requireOpen(state);
      return {
        ...state,
        installmentCount: event.payload.installmentCount ?? state.installmentCount,
        maturityDate: event.payload.maturityDate ?? state.maturityDate,
        fixedInstallmentAmount:
          event.payload.fixedInstallmentAmount ?? state.fixedInstallmentAmount,
      };
    }
    case 'Refinanced': {
      requireOpen(state);
      return {
        ...state,
        principal: Money.from(event.payload.newPrincipal, state.currency),
        ratePercent: event.payload.ratePercent ?? state.ratePercent,
        installmentCount: event.payload.installmentCount ?? state.installmentCount,
      };
    }
    case 'ObligationClosed': {
      requireOpen(state);
      return { ...state, closed: true, principal: Money.zero(state.currency) };
    }
    default: {
      const _e: never = event;
      return _e;
    }
  }
}

export function foldDebtEvents(
  obligationId: string,
  log: DebtEventLog,
  currency = 'COP',
): DerivedDebtState {
  const sorted = [...log]
    .filter((e) => e.obligationId === obligationId)
    .sort((a, b) => a.sequence - b.sequence);
  return sorted.reduce(
    (state, event) => applyDebtEvent(state, event),
    initialDebtState(obligationId, currency),
  );
}

/** Seed rate/term from obligation config after open (config is policy; events are history). */
export function mergeObligationConfig(
  state: DerivedDebtState,
  obligation: DebtObligation,
): DerivedDebtState {
  return {
    ...state,
    ratePercent: state.ratePercent ?? obligation.ratePercent ?? null,
    ratePeriodicity: state.ratePeriodicity ?? obligation.ratePeriodicity,
    installmentCount: state.installmentCount ?? obligation.installmentCount ?? null,
    fixedInstallmentAmount:
      state.fixedInstallmentAmount ?? obligation.fixedInstallmentAmount ?? null,
    maturityDate: state.maturityDate ?? obligation.maturityDate ?? null,
  };
}
