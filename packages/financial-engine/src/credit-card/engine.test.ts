import { describe, expect, it, beforeEach } from 'vitest';
import {
  openCreditCard,
  postPurchase,
  postPayment,
  closeStatement,
  appendAndFold,
} from './engine.js';
import { foldEvents, totalPrincipal } from '../core/fold.js';
import { resetEventIdCounterForTests } from '../core/events.js';
import { computeMinimumPayment } from '../payments/allocate.js';
import { Money } from '../math/money.js';
import { validateDerivedState } from '../validation/invariants.js';

const CREDIT_ID = 'crd_col_1';

function openEvents() {
  return openCreditCard({
    creditId: CREDIT_ID,
    occurredOn: '2026-01-01',
    currency: 'COP',
    productType: 'credit_card',
    annualEffectiveRate: '0.425761', // ~36% nominal monthly
    dayCountConvention: 'actual365',
    statementDay: 30,
    paymentDueDay: 15,
    minPaymentRate: '0.05',
    minPaymentFloor: '30000',
    graceEnabled: false,
    extraPaymentTarget: 'revolving_first',
    capitalizeInterest: true,
    sequence: 1,
  });
}

describe('Credit Card Engine — bank cases', () => {
  beforeEach(() => {
    resetEventIdCounterForTests();
  });

  it('Case 1: purchase → min path interest accrual → capital increases', () => {
    let { log, state } = appendAndFold([], openEvents());
    const purchase = postPurchase({
      creditId: CREDIT_ID,
      occurredOn: '2026-01-05',
      purchaseId: 'p1',
      amount: '2000000',
      installments: 1,
      sequence: 2,
      merchant: 'TikTok Ads',
      category: 'ads',
    });
    ({ log, state } = appendAndFold(log, purchase));
    expect(state.revolvingPrincipal.toString()).toBe('2000000');

    const stmt = closeStatement(state, {
      creditId: CREDIT_ID,
      occurredOn: '2026-01-30',
      statementId: 'st1',
      periodFrom: '2026-01-01',
      periodTo: '2026-01-30',
      sequence: 3,
      averageDailyBalance: '2000000',
      daysInCycle: 30,
    });
    ({ log, state } = appendAndFold(log, stmt));

    expect(state.totalInterestAccrued.isPositive()).toBe(true);
    expect(state.revolvingPrincipal.gt(Money.from('2000000', 'COP'))).toBe(true);
    expect(state.statements).toHaveLength(1);
    expect(validateDerivedState(state)).toEqual([]);

    const minPay = computeMinimumPayment(state);
    const pay = postPayment(state, {
      creditId: CREDIT_ID,
      occurredOn: '2026-02-10',
      paymentId: 'pay1',
      amount: minPay.toString(),
      sequence: 100,
    });
    ({ state } = appendAndFold(log, pay));
    expect(state.totalPaymentsReceived.eq(minPay)).toBe(true);
  });

  it('Case 2: purchase → extra payment → rate change', () => {
    let { log, state } = appendAndFold([], openEvents());
    ({ log, state } = appendAndFold(
      log,
      postPurchase({
        creditId: CREDIT_ID,
        occurredOn: '2026-01-05',
        purchaseId: 'p1',
        amount: '1000000',
        sequence: 2,
      }),
    ));
    ({ log, state } = appendAndFold(
      log,
      postPayment(state, {
        creditId: CREDIT_ID,
        occurredOn: '2026-01-10',
        paymentId: 'pay_extra',
        amount: '400000',
        sequence: 3,
      }),
    ));
    expect(state.revolvingPrincipal.toString()).toBe('600000');

    ({ log, state } = appendAndFold(log, [
      {
        eventId: 'evt_rate',
        type: 'RateChanged',
        creditId: CREDIT_ID,
        occurredOn: '2026-01-15',
        sequence: 10,
        schemaVersion: 1,
        formulaVersion: '1.0.0',
        payload: {
          annualEffectiveRate: '0.5',
          effectiveOn: '2026-01-15',
          previousRate: state.config!.annualEffectiveRate.toString(),
        },
      },
    ]));
    expect(state.config!.annualEffectiveRate.toString()).toBe('0.5');
  });

  it('Case 3: multi-purchase → partial payment', () => {
    let { log, state } = appendAndFold([], openEvents());
    for (const [id, amount, seq] of [
      ['a', '500000', 2],
      ['b', '300000', 3],
      ['c', '200000', 4],
    ] as const) {
      ({ log, state } = appendAndFold(
        log,
        postPurchase({
          creditId: CREDIT_ID,
          occurredOn: '2026-01-05',
          purchaseId: id,
          amount,
          sequence: seq,
        }),
      ));
    }
    expect(state.revolvingPrincipal.toString()).toBe('1000000');
    ({ state } = appendAndFold(
      log,
      postPayment(state, {
        creditId: CREDIT_ID,
        occurredOn: '2026-01-20',
        paymentId: 'partial',
        amount: '250000',
        sequence: 5,
      }),
    ));
    expect(state.revolvingPrincipal.toString()).toBe('750000');
  });

  it('Case 4: 36 installments then refinance (term change)', () => {
    let { log, state } = appendAndFold([], openEvents());
    ({ log, state } = appendAndFold(
      log,
      postPurchase({
        creditId: CREDIT_ID,
        occurredOn: '2026-01-05',
        purchaseId: 'phone',
        amount: '3600000',
        installments: 36,
        sequence: 2,
        firstDueOn: '2026-02-05',
      }),
    ));
    expect(state.installments).toHaveLength(36);
    expect(state.revolvingPrincipal.isZero()).toBe(true);
    expect(totalPrincipal(state).toString()).toBe('3600000');

    // Pay first installment fully
    const first = state.installments[0]!;
    ({ log, state } = appendAndFold(
      log,
      postPayment(state, {
        creditId: CREDIT_ID,
        occurredOn: '2026-02-05',
        paymentId: 'inst1',
        amount: first.remainingPrincipal.toString(),
        sequence: 50,
      }),
    ));

    const remaining = state.installments
      .filter((l) => !l.paid)
      .reduce((acc, l) => acc.add(l.remainingPrincipal), Money.zero('COP'));

    ({ state } = appendAndFold(log, [
      {
        eventId: 'refi',
        type: 'TermChanged',
        creditId: CREDIT_ID,
        occurredOn: '2026-02-06',
        sequence: 60,
        schemaVersion: 1,
        formulaVersion: '1.0.0',
        payload: {
          purchaseId: 'phone',
          newTotalInstallments: 24,
          remainingPrincipal: remaining.toString(),
        },
      },
    ]));

    const unpaid = state.installments.filter((l) => !l.paid && l.purchaseId === 'phone');
    expect(unpaid.length).toBe(24);
    const sum = unpaid.reduce((a, l) => a.add(l.remainingPrincipal), Money.zero('COP'));
    expect(sum.toString()).toBe(remaining.toString());
  });

  it('Case 5: Colombian statement import golden — reported balance matches fold after alignment', () => {
    let { log, state } = appendAndFold([], openEvents());
    ({ log, state } = appendAndFold(
      log,
      postPurchase({
        creditId: CREDIT_ID,
        occurredOn: '2026-03-01',
        purchaseId: 'ads_march',
        amount: '5000000',
        sequence: 2,
        merchant: 'Meta Ads',
        category: 'ads',
      }),
    ));
    ({ log, state } = appendAndFold(
      log,
      postPayment(state, {
        creditId: CREDIT_ID,
        occurredOn: '2026-03-15',
        paymentId: 'pay_march',
        amount: '1000000',
        sequence: 3,
      }),
    ));

    const engineBalance = totalPrincipal(state).toString();
    expect(engineBalance).toBe('4000000');

    ({ log, state } = appendAndFold(log, [
      {
        eventId: 'import1',
        type: 'StatementImported',
        creditId: CREDIT_ID,
        occurredOn: '2026-03-31',
        sequence: 4,
        schemaVersion: 1,
        formulaVersion: '1.0.0',
        payload: {
          externalStatementId: 'BANCOLOMBIA-2026-03',
          bank: 'Bancolombia',
          periodFrom: '2026-03-01',
          periodTo: '2026-03-31',
          reportedBalance: '4000000',
          rawHash: 'golden_fixture_v1',
        },
      },
    ]));

    expect(state.importedReportedBalance!.toString()).toBe(engineBalance);
    expect(state.importedReportedBalance!.eq(totalPrincipal(state))).toBe(true);
    expect(totalPrincipal(foldEvents(log)).toString()).toBe(engineBalance);
  });

  it('never mutates balance via assignment — fold is deterministic', () => {
    const events = [
      ...openEvents(),
      ...postPurchase({
        creditId: CREDIT_ID,
        occurredOn: '2026-01-05',
        purchaseId: 'p1',
        amount: '750000',
        sequence: 2,
      }),
    ];
    const a = foldEvents(events);
    const b = foldEvents(events);
    expect(a.revolvingPrincipal.toString()).toBe(b.revolvingPrincipal.toString());
    expect(a.revolvingPrincipal.toString()).toBe('750000');
  });
});
