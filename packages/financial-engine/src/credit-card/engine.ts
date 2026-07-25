import { Money } from '../math/money.js';
import { dailyRateFromConvention, interestFromAverageDailyBalance } from '../interest/rates.js';
import {
  baseEventFields,
  type DomainEvent,
  type CreditOpenedPayload,
  type EventLog,
} from '../core/events.js';
import { foldEvents, totalPrincipal, type DerivedState } from '../core/fold.js';
import {
  allocatePayment,
  computeMinimumPayment,
  leftoverAfterAllocation,
} from '../payments/allocate.js';
import { addDays, FinancialEngineError } from '../shared/types.js';
import { assertPositiveAmountString } from '../math/rate.js';

export type OpenCreditCardInput = CreditOpenedPayload & {
  creditId: string;
  occurredOn: string;
  sequence?: number;
};

export type PostPurchaseInput = {
  creditId: string;
  occurredOn: string;
  purchaseId: string;
  amount: string;
  installments?: number;
  category?: string;
  merchant?: string;
  sequence: number;
  firstDueOn?: string;
};

export type PostPaymentInput = {
  creditId: string;
  occurredOn: string;
  paymentId: string;
  amount: string;
  sequence: number;
  method?: string;
};

export type CloseStatementInput = {
  creditId: string;
  occurredOn: string;
  statementId: string;
  periodFrom: string;
  periodTo: string;
  sequence: number;
  /** Average daily revolving balance for the cycle (caller may compute from daily ledger). */
  averageDailyBalance: string;
  daysInCycle: number;
};

function nextSequences(start: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => start + i);
}

export function openCreditCard(input: OpenCreditCardInput): DomainEvent[] {
  return [
    {
      ...baseEventFields(input.creditId, input.occurredOn, input.sequence ?? 1),
      type: 'CreditOpened',
      payload: {
        currency: input.currency,
        productType: input.productType,
        annualEffectiveRate: input.annualEffectiveRate,
        dayCountConvention: input.dayCountConvention,
        statementDay: input.statementDay,
        paymentDueDay: input.paymentDueDay,
        minPaymentRate: input.minPaymentRate,
        minPaymentFloor: input.minPaymentFloor,
        graceEnabled: input.graceEnabled,
        extraPaymentTarget: input.extraPaymentTarget,
        ...(input.lateDailyRate !== undefined ? { lateDailyRate: input.lateDailyRate } : {}),
        ...(input.capitalizeInterest !== undefined
          ? { capitalizeInterest: input.capitalizeInterest }
          : {}),
      },
    },
  ];
}

export function postPurchase(input: PostPurchaseInput): DomainEvent[] {
  assertPositiveAmountString(input.amount, 'amount');
  const installments = input.installments ?? 1;
  const events: DomainEvent[] = [
    {
      ...baseEventFields(input.creditId, input.occurredOn, input.sequence),
      type: 'PurchaseCreated',
      payload: {
        purchaseId: input.purchaseId,
        amount: input.amount,
        installments,
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.merchant !== undefined ? { merchant: input.merchant } : {}),
      },
    },
  ];

  if (installments > 1) {
    const currency = 'COP'; // amount currency implied; schedule uses string amounts
    const total = Money.from(input.amount, currency);
    const per = total.div(String(installments)).settle();
    let allocated = Money.zero(currency);
    const seqs = nextSequences(input.sequence + 1, installments);
    for (let i = 1; i <= installments; i += 1) {
      const principalAmount = i === installments ? total.sub(allocated) : per;
      allocated = allocated.add(principalAmount);
      const dueOn = input.firstDueOn
        ? addDays(input.firstDueOn, (i - 1) * 30)
        : addDays(input.occurredOn, i * 30);
      events.push({
        ...baseEventFields(input.creditId, input.occurredOn, seqs[i - 1]!),
        type: 'InstallmentGenerated',
        payload: {
          purchaseId: input.purchaseId,
          installmentId: `${input.purchaseId}_${i}`,
          installmentNumber: i,
          totalInstallments: installments,
          principalAmount: principalAmount.toString(),
          dueOn,
        },
      });
    }
  }

  return events;
}

export function postPayment(state: DerivedState, input: PostPaymentInput): DomainEvent[] {
  assertPositiveAmountString(input.amount, 'amount');
  if (!state.config) {
    throw new FinancialEngineError('CREDIT_NOT_OPEN', 'Cannot pay before CreditOpened');
  }
  const amount = Money.from(input.amount, state.currency);
  const allocation = allocatePayment(state, amount);
  const leftover = leftoverAfterAllocation(amount, allocation);
  let seq = input.sequence;
  const events: DomainEvent[] = [
    {
      ...baseEventFields(input.creditId, input.occurredOn, seq),
      type: 'PaymentReceived',
      payload: {
        paymentId: input.paymentId,
        amount: input.amount,
        ...(input.method !== undefined ? { method: input.method } : {}),
      },
    },
  ];
  seq += 1;
  for (const line of allocation) {
    events.push({
      ...baseEventFields(input.creditId, input.occurredOn, seq),
      type: 'PaymentAllocated',
      payload: {
        paymentId: input.paymentId,
        bucket: line.bucket,
        amount: line.amount.toString(),
        ...(line.installmentId !== undefined ? { installmentId: line.installmentId } : {}),
      },
    });
    seq += 1;
  }
  if (leftover.isPositive()) {
    events.push({
      ...baseEventFields(input.creditId, input.occurredOn, seq),
      type: 'ExtraPaymentApplied',
      payload: {
        paymentId: input.paymentId,
        amount: leftover.toString(),
        target: state.config.extraPaymentTarget,
      },
    });
  }
  return events;
}

export function closeStatement(state: DerivedState, input: CloseStatementInput): DomainEvent[] {
  if (!state.config) {
    throw new FinancialEngineError('CREDIT_NOT_OPEN', 'Cannot close statement');
  }
  const daily = dailyRateFromConvention(
    state.config.annualEffectiveRate,
    state.config.dayCountConvention,
  );
  const adb = Money.from(input.averageDailyBalance, state.currency);
  const interest = interestFromAverageDailyBalance(adb, daily, input.daysInCycle);
  const dueOn = addDays(
    input.occurredOn,
    Math.max(0, state.config.paymentDueDay - state.config.statementDay),
  );
  // Build provisional state with interest for min payment
  const withInterest: DerivedState = {
    ...state,
    interestDue: state.interestDue.add(interest),
    totalInterestAccrued: state.totalInterestAccrued.add(interest),
  };
  const minimumPayment = computeMinimumPayment(withInterest);
  const closingPrincipal = totalPrincipal(state);
  const closingTotalDue = closingPrincipal
    .add(withInterest.interestDue)
    .add(state.lateFeeDue)
    .add(state.insuranceDue)
    .add(state.commissionDue);

  let seq = input.sequence;
  const events: DomainEvent[] = [
    {
      ...baseEventFields(input.creditId, input.occurredOn, seq),
      type: 'InterestAccrued',
      payload: {
        amount: interest.toString(),
        periodFrom: input.periodFrom,
        periodTo: input.periodTo,
        rateUsed: state.config.annualEffectiveRate.toString(),
        method: 'adb',
        baseAmount: adb.toString(),
      },
    },
  ];
  seq += 1;

  if (state.config.capitalizeInterest && interest.isPositive()) {
    events.push({
      ...baseEventFields(input.creditId, input.occurredOn, seq),
      type: 'InterestCapitalized',
      payload: { amount: interest.toString(), statementId: input.statementId },
    });
    seq += 1;
  }

  events.push({
    ...baseEventFields(input.creditId, input.occurredOn, seq),
    type: 'StatementClosed',
    payload: {
      statementId: input.statementId,
      periodFrom: input.periodFrom,
      periodTo: input.periodTo,
      cutOffOn: input.occurredOn,
      dueOn,
      minimumPayment: minimumPayment.toString(),
      interestBilled: interest.toString(),
      feesBilled: state.lateFeeDue.add(state.commissionDue).toString(),
      closingPrincipal: closingPrincipal.toString(),
      closingTotalDue: closingTotalDue.toString(),
    },
  });

  return events;
}

export function appendAndFold(
  log: EventLog,
  newEvents: DomainEvent[],
): {
  log: DomainEvent[];
  state: DerivedState;
} {
  const merged = [...log, ...newEvents];
  return { log: merged, state: foldEvents(merged) };
}

export { foldEvents, totalPrincipal };
