import { EVENT_SCHEMA_VERSION, FORMULA_VERSION, type PaymentBucket } from '../shared/types.js';
import type {
  CurrencyCode,
  DayCountConvention,
  DeferredInterestMode,
  ExtraPaymentTarget,
  ProductType,
} from '../shared/types.js';

export type DomainEventType =
  | 'CreditOpened'
  | 'PurchaseCreated'
  | 'InstallmentGenerated'
  | 'PaymentReceived'
  | 'PaymentAllocated'
  | 'ExtraPaymentApplied'
  | 'InterestAccrued'
  | 'InterestCapitalized'
  | 'StatementClosed'
  | 'RateChanged'
  | 'TermChanged'
  | 'LateFeeApplied'
  | 'InsuranceCharged'
  | 'CommissionCharged'
  | 'Refinanced'
  | 'AdjustmentApplied'
  | 'ReversalIssued'
  | 'StatementImported'
  | 'BudgetProjectionSet'
  | 'AdSpendActualRecorded';

export type DomainEventBase = {
  eventId: string;
  type: DomainEventType;
  creditId: string;
  occurredOn: string;
  sequence: number;
  schemaVersion: typeof EVENT_SCHEMA_VERSION;
  formulaVersion: string;
  recordedAt?: string;
  meta?: Record<string, string>;
  hypothetical?: boolean;
};

export type CreditOpenedPayload = {
  currency: CurrencyCode;
  productType: ProductType;
  annualEffectiveRate: string;
  dayCountConvention: DayCountConvention;
  statementDay: number;
  paymentDueDay: number;
  minPaymentRate: string;
  minPaymentFloor: string;
  graceEnabled: boolean;
  extraPaymentTarget: ExtraPaymentTarget;
  lateDailyRate?: string;
  capitalizeInterest?: boolean;
};

export type PurchaseCreatedPayload = {
  purchaseId: string;
  amount: string;
  installments: number;
  category?: string;
  merchant?: string;
  graceEligible?: boolean;
  deferredInterestMode?: DeferredInterestMode;
};

export type InstallmentGeneratedPayload = {
  purchaseId: string;
  installmentId: string;
  installmentNumber: number;
  totalInstallments: number;
  principalAmount: string;
  dueOn: string;
};

export type PaymentReceivedPayload = {
  paymentId: string;
  amount: string;
  method?: string;
};

export type PaymentAllocatedPayload = {
  paymentId: string;
  bucket: PaymentBucket;
  amount: string;
  installmentId?: string;
};

export type ExtraPaymentAppliedPayload = {
  paymentId: string;
  amount: string;
  target: ExtraPaymentTarget;
};

export type InterestAccruedPayload = {
  amount: string;
  periodFrom: string;
  periodTo: string;
  rateUsed: string;
  method: 'adb' | 'daily' | 'simple';
  baseAmount: string;
};

export type InterestCapitalizedPayload = {
  amount: string;
  statementId: string;
};

export type StatementClosedPayload = {
  statementId: string;
  periodFrom: string;
  periodTo: string;
  cutOffOn: string;
  dueOn: string;
  minimumPayment: string;
  interestBilled: string;
  feesBilled: string;
  closingPrincipal: string;
  closingTotalDue: string;
};

export type RateChangedPayload = {
  annualEffectiveRate: string;
  effectiveOn: string;
  previousRate: string;
};

export type TermChangedPayload = {
  purchaseId: string;
  newTotalInstallments: number;
  remainingPrincipal: string;
};

export type LateFeeAppliedPayload = {
  amount: string;
  reason: string;
  daysLate: number;
};

export type InsuranceChargedPayload = {
  amount: string;
  insuranceId?: string;
};

export type CommissionChargedPayload = {
  amount: string;
  commissionType: string;
};

export type RefinancedPayload = {
  refinanceId: string;
  principalMoved: string;
  newTotalInstallments: number;
};

export type AdjustmentAppliedPayload = {
  amount: string;
  direction: 'debit' | 'credit';
  reason: string;
  bucket: PaymentBucket;
};

export type ReversalIssuedPayload = {
  reversesEventId: string;
  reason: string;
};

export type StatementImportedPayload = {
  externalStatementId: string;
  bank: string;
  periodFrom: string;
  periodTo: string;
  reportedBalance: string;
  rawHash: string;
};

export type BudgetProjectionSetPayload = {
  /** Planned daily ad budget (plan only — does not change revolving principal). */
  plannedDailyAdBudget: string;
  from: string;
  to: string;
  channelId?: string;
};

/** Actual platform charge — should be paired with PurchaseCreated for debt impact. */
export type AdSpendActualRecordedPayload = {
  channelId: string;
  actualAmount: string;
  linkedPurchaseId?: string;
  externalRef?: string;
};

type Ev<T extends DomainEventType, P> = DomainEventBase & { type: T; payload: P };

export type DomainEvent =
  | Ev<'CreditOpened', CreditOpenedPayload>
  | Ev<'PurchaseCreated', PurchaseCreatedPayload>
  | Ev<'InstallmentGenerated', InstallmentGeneratedPayload>
  | Ev<'PaymentReceived', PaymentReceivedPayload>
  | Ev<'PaymentAllocated', PaymentAllocatedPayload>
  | Ev<'ExtraPaymentApplied', ExtraPaymentAppliedPayload>
  | Ev<'InterestAccrued', InterestAccruedPayload>
  | Ev<'InterestCapitalized', InterestCapitalizedPayload>
  | Ev<'StatementClosed', StatementClosedPayload>
  | Ev<'RateChanged', RateChangedPayload>
  | Ev<'TermChanged', TermChangedPayload>
  | Ev<'LateFeeApplied', LateFeeAppliedPayload>
  | Ev<'InsuranceCharged', InsuranceChargedPayload>
  | Ev<'CommissionCharged', CommissionChargedPayload>
  | Ev<'Refinanced', RefinancedPayload>
  | Ev<'AdjustmentApplied', AdjustmentAppliedPayload>
  | Ev<'ReversalIssued', ReversalIssuedPayload>
  | Ev<'StatementImported', StatementImportedPayload>
  | Ev<'BudgetProjectionSet', BudgetProjectionSetPayload>
  | Ev<'AdSpendActualRecorded', AdSpendActualRecordedPayload>;

export type EventLog = readonly DomainEvent[];

let seqCounter = 0;

export function resetEventIdCounterForTests(): void {
  seqCounter = 0;
}

export function createEventId(prefix = 'evt'): string {
  seqCounter += 1;
  return `${prefix}_${seqCounter}`;
}

export function baseEventFields(
  creditId: string,
  occurredOn: string,
  sequence: number,
  partial?: { eventId?: string; hypothetical?: boolean },
): Omit<DomainEventBase, 'type'> {
  return {
    eventId: partial?.eventId ?? createEventId(),
    creditId,
    occurredOn,
    sequence,
    schemaVersion: EVENT_SCHEMA_VERSION,
    formulaVersion: FORMULA_VERSION,
    ...(partial?.hypothetical !== undefined ? { hypothetical: partial.hypothetical } : {}),
  };
}

export function sortEventLog(events: EventLog): DomainEvent[] {
  return [...events].sort((a, b) => {
    if (a.occurredOn !== b.occurredOn) {
      return a.occurredOn < b.occurredOn ? -1 : 1;
    }
    return a.sequence - b.sequence;
  });
}
