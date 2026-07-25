import { Money } from '../math/money.js';
import { Rate } from '../math/rate.js';
import type {
  CurrencyCode,
  DayCountConvention,
  ExtraPaymentTarget,
  PaymentBucket,
  ProductType,
} from '../shared/types.js';
import { FinancialEngineError } from '../shared/types.js';
import type { DomainEvent, EventLog } from './events.js';
import { sortEventLog } from './events.js';

export type InstallmentLine = {
  installmentId: string;
  purchaseId: string;
  installmentNumber: number;
  totalInstallments: number;
  principalAmount: Money;
  remainingPrincipal: Money;
  dueOn: string;
  paid: boolean;
};

export type StatementSnapshot = {
  statementId: string;
  periodFrom: string;
  periodTo: string;
  cutOffOn: string;
  dueOn: string;
  minimumPayment: Money;
  interestBilled: Money;
  feesBilled: Money;
  closingPrincipal: Money;
  closingTotalDue: Money;
};

export type CreditConfig = {
  creditId: string;
  currency: CurrencyCode;
  productType: ProductType;
  annualEffectiveRate: Rate;
  dayCountConvention: DayCountConvention;
  statementDay: number;
  paymentDueDay: number;
  minPaymentRate: Rate;
  minPaymentFloor: Money;
  graceEnabled: boolean;
  extraPaymentTarget: ExtraPaymentTarget;
  lateDailyRate: Rate;
  capitalizeInterest: boolean;
};

export type DerivedState = {
  opened: boolean;
  config: CreditConfig | null;
  revolvingPrincipal: Money;
  interestDue: Money;
  lateFeeDue: Money;
  insuranceDue: Money;
  commissionDue: Money;
  installments: InstallmentLine[];
  statements: StatementSnapshot[];
  totalPaymentsReceived: Money;
  totalInterestAccrued: Money;
  totalPurchases: Money;
  lastRateEffectiveOn: string | null;
  dailyAdSpend: Money | null;
  /** Planned marketing budget rate (plan) — does not change principal. */
  plannedDailyAdBudget: Money | null;
  /** Cumulative actual ad charges recorded (execution). */
  actualAdSpendTotal: Money;
  importedReportedBalance: Money | null;
  currency: CurrencyCode;
};

function emptyMoney(currency: CurrencyCode): Money {
  return Money.zero(currency);
}

export function initialDerivedState(currency: CurrencyCode = 'COP'): DerivedState {
  return {
    opened: false,
    config: null,
    revolvingPrincipal: emptyMoney(currency),
    interestDue: emptyMoney(currency),
    lateFeeDue: emptyMoney(currency),
    insuranceDue: emptyMoney(currency),
    commissionDue: emptyMoney(currency),
    installments: [],
    statements: [],
    totalPaymentsReceived: emptyMoney(currency),
    totalInterestAccrued: emptyMoney(currency),
    totalPurchases: emptyMoney(currency),
    lastRateEffectiveOn: null,
    dailyAdSpend: null,
    plannedDailyAdBudget: null,
    actualAdSpendTotal: emptyMoney(currency),
    importedReportedBalance: null,
    currency,
  };
}

function requireConfig(state: DerivedState): CreditConfig {
  if (!state.config) {
    throw new FinancialEngineError('CREDIT_NOT_OPEN', 'CreditOpened event required first');
  }
  return state.config;
}

function applyAdjustment(
  state: DerivedState,
  bucket: PaymentBucket,
  amount: Money,
  direction: 'debit' | 'credit',
): DerivedState {
  const signed = direction === 'debit' ? amount : amount.neg();
  switch (bucket) {
    case 'LateFee':
      return { ...state, lateFeeDue: state.lateFeeDue.add(signed).max(Money.zero(state.currency)) };
    case 'Interest':
      return {
        ...state,
        interestDue: state.interestDue.add(signed).max(Money.zero(state.currency)),
      };
    case 'Insurance':
      return {
        ...state,
        insuranceDue: state.insuranceDue.add(signed).max(Money.zero(state.currency)),
      };
    case 'Commission':
      return {
        ...state,
        commissionDue: state.commissionDue.add(signed).max(Money.zero(state.currency)),
      };
    case 'RevolvingPrincipal':
      return {
        ...state,
        revolvingPrincipal: state.revolvingPrincipal.add(signed).max(Money.zero(state.currency)),
      };
    case 'InstallmentPrincipal':
      return state;
    default:
      return state;
  }
}

export function applyEvent(state: DerivedState, event: DomainEvent): DerivedState {
  switch (event.type) {
    case 'CreditOpened': {
      const p = event.payload;
      const currency = p.currency;
      const config: CreditConfig = {
        creditId: event.creditId,
        currency,
        productType: p.productType,
        annualEffectiveRate: Rate.fromDecimal(p.annualEffectiveRate),
        dayCountConvention: p.dayCountConvention,
        statementDay: p.statementDay,
        paymentDueDay: p.paymentDueDay,
        minPaymentRate: Rate.fromDecimal(p.minPaymentRate),
        minPaymentFloor: Money.from(p.minPaymentFloor, currency),
        graceEnabled: p.graceEnabled,
        extraPaymentTarget: p.extraPaymentTarget,
        lateDailyRate: Rate.fromDecimal(p.lateDailyRate ?? '0'),
        capitalizeInterest: p.capitalizeInterest ?? true,
      };
      return {
        ...initialDerivedState(currency),
        opened: true,
        config,
        currency,
      };
    }
    case 'PurchaseCreated': {
      requireConfig(state);
      const amount = Money.from(event.payload.amount, state.currency);
      if (event.payload.installments <= 1) {
        return {
          ...state,
          revolvingPrincipal: state.revolvingPrincipal.add(amount),
          totalPurchases: state.totalPurchases.add(amount),
        };
      }
      return {
        ...state,
        totalPurchases: state.totalPurchases.add(amount),
      };
    }
    case 'InstallmentGenerated': {
      requireConfig(state);
      const principalAmount = Money.from(event.payload.principalAmount, state.currency);
      const line: InstallmentLine = {
        installmentId: event.payload.installmentId,
        purchaseId: event.payload.purchaseId,
        installmentNumber: event.payload.installmentNumber,
        totalInstallments: event.payload.totalInstallments,
        principalAmount,
        remainingPrincipal: principalAmount,
        dueOn: event.payload.dueOn,
        paid: false,
      };
      return { ...state, installments: [...state.installments, line] };
    }
    case 'PaymentReceived': {
      requireConfig(state);
      const amount = Money.from(event.payload.amount, state.currency);
      return {
        ...state,
        totalPaymentsReceived: state.totalPaymentsReceived.add(amount),
      };
    }
    case 'PaymentAllocated': {
      requireConfig(state);
      const amount = Money.from(event.payload.amount, state.currency);
      switch (event.payload.bucket) {
        case 'LateFee':
          return {
            ...state,
            lateFeeDue: state.lateFeeDue.sub(amount).max(Money.zero(state.currency)),
          };
        case 'Interest':
          return {
            ...state,
            interestDue: state.interestDue.sub(amount).max(Money.zero(state.currency)),
          };
        case 'Insurance':
          return {
            ...state,
            insuranceDue: state.insuranceDue.sub(amount).max(Money.zero(state.currency)),
          };
        case 'Commission':
          return {
            ...state,
            commissionDue: state.commissionDue.sub(amount).max(Money.zero(state.currency)),
          };
        case 'RevolvingPrincipal':
          return {
            ...state,
            revolvingPrincipal: state.revolvingPrincipal
              .sub(amount)
              .max(Money.zero(state.currency)),
          };
        case 'InstallmentPrincipal': {
          const id = event.payload.installmentId;
          return {
            ...state,
            installments: state.installments.map((line) => {
              if (line.installmentId !== id) return line;
              const remaining = line.remainingPrincipal.sub(amount).max(Money.zero(state.currency));
              return {
                ...line,
                remainingPrincipal: remaining,
                paid: remaining.isZero(),
              };
            }),
          };
        }
        default:
          return state;
      }
    }
    case 'ExtraPaymentApplied': {
      requireConfig(state);
      const amount = Money.from(event.payload.amount, state.currency);
      const target = event.payload.target;
      if (target === 'installments_first') {
        let left = amount;
        const installments = state.installments.map((line) => {
          if (left.isZero() || line.paid) return line;
          const pay = left.min(line.remainingPrincipal);
          left = left.sub(pay);
          const remaining = line.remainingPrincipal.sub(pay);
          return { ...line, remainingPrincipal: remaining, paid: remaining.isZero() };
        });
        return {
          ...state,
          installments,
          revolvingPrincipal: state.revolvingPrincipal.sub(left).max(Money.zero(state.currency)),
        };
      }
      // revolving_first and pro_rata (simplified: revolving then installments)
      const toRevolving = amount.min(state.revolvingPrincipal);
      let left = amount.sub(toRevolving);
      const installments = state.installments.map((line) => {
        if (left.isZero() || line.paid) return line;
        const pay = left.min(line.remainingPrincipal);
        left = left.sub(pay);
        const remaining = line.remainingPrincipal.sub(pay);
        return { ...line, remainingPrincipal: remaining, paid: remaining.isZero() };
      });
      return {
        ...state,
        revolvingPrincipal: state.revolvingPrincipal.sub(toRevolving),
        installments,
      };
    }
    case 'InterestAccrued': {
      requireConfig(state);
      const amount = Money.from(event.payload.amount, state.currency);
      return {
        ...state,
        interestDue: state.interestDue.add(amount),
        totalInterestAccrued: state.totalInterestAccrued.add(amount),
      };
    }
    case 'InterestCapitalized': {
      requireConfig(state);
      const amount = Money.from(event.payload.amount, state.currency);
      return {
        ...state,
        interestDue: state.interestDue.sub(amount).max(Money.zero(state.currency)),
        revolvingPrincipal: state.revolvingPrincipal.add(amount),
      };
    }
    case 'StatementClosed': {
      requireConfig(state);
      const p = event.payload;
      const snap: StatementSnapshot = {
        statementId: p.statementId,
        periodFrom: p.periodFrom,
        periodTo: p.periodTo,
        cutOffOn: p.cutOffOn,
        dueOn: p.dueOn,
        minimumPayment: Money.from(p.minimumPayment, state.currency),
        interestBilled: Money.from(p.interestBilled, state.currency),
        feesBilled: Money.from(p.feesBilled, state.currency),
        closingPrincipal: Money.from(p.closingPrincipal, state.currency),
        closingTotalDue: Money.from(p.closingTotalDue, state.currency),
      };
      return { ...state, statements: [...state.statements, snap] };
    }
    case 'RateChanged': {
      const config = requireConfig(state);
      return {
        ...state,
        config: {
          ...config,
          annualEffectiveRate: Rate.fromDecimal(event.payload.annualEffectiveRate),
        },
        lastRateEffectiveOn: event.payload.effectiveOn,
      };
    }
    case 'TermChanged': {
      requireConfig(state);
      const remaining = Money.from(event.payload.remainingPrincipal, state.currency);
      const n = event.payload.newTotalInstallments;
      if (n <= 0) {
        throw new FinancialEngineError('INVALID_TERM', 'newTotalInstallments must be > 0');
      }
      const per = remaining.div(String(n)).settle();
      let allocated = Money.zero(state.currency);
      const newLines: InstallmentLine[] = [];
      for (let i = 1; i <= n; i += 1) {
        const principalAmount = i === n ? remaining.sub(allocated) : per;
        allocated = allocated.add(principalAmount);
        newLines.push({
          installmentId: `${event.payload.purchaseId}_refi_${i}`,
          purchaseId: event.payload.purchaseId,
          installmentNumber: i,
          totalInstallments: n,
          principalAmount,
          remainingPrincipal: principalAmount,
          dueOn: event.occurredOn,
          paid: false,
        });
      }
      return {
        ...state,
        installments: [
          ...state.installments.filter((l) => l.purchaseId !== event.payload.purchaseId || l.paid),
          ...newLines,
        ],
      };
    }
    case 'LateFeeApplied': {
      requireConfig(state);
      const amount = Money.from(event.payload.amount, state.currency);
      return { ...state, lateFeeDue: state.lateFeeDue.add(amount) };
    }
    case 'InsuranceCharged': {
      requireConfig(state);
      const amount = Money.from(event.payload.amount, state.currency);
      return { ...state, insuranceDue: state.insuranceDue.add(amount) };
    }
    case 'CommissionCharged': {
      requireConfig(state);
      const amount = Money.from(event.payload.amount, state.currency);
      return { ...state, commissionDue: state.commissionDue.add(amount) };
    }
    case 'Refinanced': {
      requireConfig(state);
      const moved = Money.from(event.payload.principalMoved, state.currency);
      return {
        ...state,
        revolvingPrincipal: moved,
        installments: state.installments.map((l) => ({
          ...l,
          remainingPrincipal: Money.zero(state.currency),
          paid: true,
        })),
      };
    }
    case 'AdjustmentApplied': {
      requireConfig(state);
      const amount = Money.from(event.payload.amount, state.currency);
      return applyAdjustment(state, event.payload.bucket, amount, event.payload.direction);
    }
    case 'ReversalIssued':
      // Economic reversal requires looking up reversed event in full log — handled by command layer.
      return state;
    case 'StatementImported': {
      requireConfig(state);
      return {
        ...state,
        importedReportedBalance: Money.from(event.payload.reportedBalance, state.currency),
      };
    }
    case 'BudgetProjectionSet': {
      requireConfig(state);
      const planned = Money.from(event.payload.plannedDailyAdBudget, state.currency);
      return {
        ...state,
        // Keep legacy alias for callers mid-migration
        dailyAdSpend: planned,
        plannedDailyAdBudget: planned,
      };
    }
    case 'AdSpendActualRecorded': {
      requireConfig(state);
      const actual = Money.from(event.payload.actualAmount, state.currency);
      return {
        ...state,
        actualAdSpendTotal: state.actualAdSpendTotal.add(actual),
      };
    }
    default: {
      const _e: never = event;
      return _e;
    }
  }
}

export function foldEvents(events: EventLog, currency: CurrencyCode = 'COP'): DerivedState {
  const sorted = sortEventLog(events);
  return sorted.reduce<DerivedState>(
    (state, event) => applyEvent(state, event),
    initialDerivedState(currency),
  );
}

export function totalPrincipal(state: DerivedState): Money {
  const installmentRemaining = state.installments.reduce(
    (acc, line) => acc.add(line.remainingPrincipal),
    Money.zero(state.currency),
  );
  return state.revolvingPrincipal.add(installmentRemaining);
}

export function totalDue(state: DerivedState): Money {
  const installmentDue = state.installments
    .filter((l) => !l.paid)
    .reduce((acc, line) => acc.add(line.remainingPrincipal), Money.zero(state.currency));
  return state.revolvingPrincipal
    .add(state.interestDue)
    .add(state.lateFeeDue)
    .add(state.insuranceDue)
    .add(state.commissionDue)
    .add(installmentDue);
}
