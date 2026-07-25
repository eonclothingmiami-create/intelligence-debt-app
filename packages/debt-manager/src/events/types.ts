/**
 * Lifecycle events — reconstruct how the debt got to today.
 * Balance is derived by fold; never “balance -= payment” as authority.
 */

export type DebtEventType =
  | 'ObligationOpened'
  | 'DisbursementRecorded'
  | 'PurchaseCharged'
  | 'OrdinaryPaymentApplied'
  | 'ExtraPaymentApplied'
  | 'InterestCharged'
  | 'FeeCharged'
  | 'CommissionCharged'
  | 'RateChanged'
  | 'TermChanged'
  | 'Refinanced'
  | 'ObligationClosed';

export type DebtEventBase = {
  eventId: string;
  type: DebtEventType;
  obligationId: string;
  occurredOn: string; // YYYY-MM-DD
  sequence: number;
  notes?: string;
};

export type ObligationOpened = DebtEventBase & {
  type: 'ObligationOpened';
  payload: {
    openingPrincipal: string;
    currency: string;
  };
};

export type DisbursementRecorded = DebtEventBase & {
  type: 'DisbursementRecorded';
  payload: { amount: string };
};

export type PurchaseCharged = DebtEventBase & {
  type: 'PurchaseCharged';
  payload: { amount: string; merchant?: string; category?: string };
};

export type OrdinaryPaymentApplied = DebtEventBase & {
  type: 'OrdinaryPaymentApplied';
  payload: { amount: string };
};

export type ExtraPaymentApplied = DebtEventBase & {
  type: 'ExtraPaymentApplied';
  payload: { amount: string };
};

export type InterestCharged = DebtEventBase & {
  type: 'InterestCharged';
  payload: { amount: string };
};

export type FeeCharged = DebtEventBase & {
  type: 'FeeCharged';
  payload: { amount: string; label?: string };
};

export type CommissionCharged = DebtEventBase & {
  type: 'CommissionCharged';
  payload: { amount: string };
};

export type RateChanged = DebtEventBase & {
  type: 'RateChanged';
  payload: { ratePercent: string; ratePeriodicity: string };
};

export type TermChanged = DebtEventBase & {
  type: 'TermChanged';
  payload: { installmentCount?: number; maturityDate?: string; fixedInstallmentAmount?: string };
};

export type Refinanced = DebtEventBase & {
  type: 'Refinanced';
  payload: {
    newPrincipal: string;
    ratePercent?: string;
    installmentCount?: number;
    reason?: string;
  };
};

export type ObligationClosed = DebtEventBase & {
  type: 'ObligationClosed';
  payload: { reason?: string };
};

export type DebtLifecycleEvent =
  | ObligationOpened
  | DisbursementRecorded
  | PurchaseCharged
  | OrdinaryPaymentApplied
  | ExtraPaymentApplied
  | InterestCharged
  | FeeCharged
  | CommissionCharged
  | RateChanged
  | TermChanged
  | Refinanced
  | ObligationClosed;

export type DebtEventLog = DebtLifecycleEvent[];
