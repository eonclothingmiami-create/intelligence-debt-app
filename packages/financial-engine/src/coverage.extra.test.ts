import { describe, expect, it, beforeEach } from 'vitest';
import { Money } from './math/money.js';
import { Rate } from './math/rate.js';
import {
  dailyRateFromConvention,
  compoundFutureValue,
  monthlyEquivalentFromDaily,
  effectiveToDaily,
  nominalToDailyLinear,
} from './interest/rates.js';
import { foldEvents, applyEvent, initialDerivedState, totalDue } from './core/fold.js';
import {
  baseEventFields,
  sortEventLog,
  createEventId,
  resetEventIdCounterForTests,
  type DomainEvent,
} from './core/events.js';
import {
  openCreditCard,
  postPurchase,
  postPayment,
  closeStatement,
  appendAndFold,
} from './credit-card/engine.js';
import { allocatePayment, leftoverAfterAllocation } from './payments/allocate.js';
import { buildAmortizationSchedule } from './amortization/schedules.js';
import { computeAdsRoi } from './roi/ads.js';
import { simulate } from './simulation/simulate.js';
import {
  optimize,
  customStrategy,
  highestInstallmentStrategy,
  cashFlowFirstStrategy,
  roiDrivenStrategy,
  liquidityFirstStrategy,
  accountsFromLog,
} from './optimization/strategies.js';
import {
  assertNonNegativePrincipals,
  assertAllocationConserved,
  validateDerivedState,
} from './validation/invariants.js';
import { analyzePortfolio, recommend, forecast, explain, simulateScenario } from './api.js';
import { projectMonthlyCashflow, snapshotPrincipal } from './cashflow/project.js';
import {
  addDays,
  compareIsoDates,
  daysBetween,
  parseIsoDate,
  FinancialEngineError,
} from './shared/types.js';
import { isoDate } from './shared/types.js';

const CREDIT_ID = 'crd_cov';

function openLog() {
  return openCreditCard({
    creditId: CREDIT_ID,
    occurredOn: '2026-01-01',
    currency: 'COP',
    productType: 'credit_card',
    annualEffectiveRate: '0.36',
    dayCountConvention: 'actual365',
    statementDay: 28,
    paymentDueDay: 15,
    minPaymentRate: '0.05',
    minPaymentFloor: '30000',
    graceEnabled: true,
    extraPaymentTarget: 'installments_first',
    lateDailyRate: '0.001',
    capitalizeInterest: false,
    sequence: 1,
  });
}

describe('Coverage — shared dates', () => {
  it('parses and compares ISO dates', () => {
    expect(parseIsoDate('2026-07-25')).toEqual({ year: 2026, month: 7, day: 25 });
    expect(() => parseIsoDate('bad')).toThrow(FinancialEngineError);
    expect(daysBetween('2026-01-01', '2026-01-31')).toBe(30);
    expect(addDays('2026-01-01', 10)).toBe('2026-01-11');
    expect(compareIsoDates('2026-01-01', '2026-01-02')).toBe(-1);
    expect(compareIsoDates('2026-01-02', '2026-01-01')).toBe(1);
    expect(compareIsoDates('2026-01-01', '2026-01-01')).toBe(0);
    expect(isoDate(2026, 1, 5)).toBe('2026-01-05');
  });
});

describe('Coverage — interest conventions', () => {
  const ea = Rate.fromDecimal('0.4');
  it('supports all day count conventions', () => {
    expect(dailyRateFromConvention(ea, 'actual365').decimal.gt(0)).toBe(true);
    expect(dailyRateFromConvention(ea, 'actual360').decimal.gt(0)).toBe(true);
    expect(dailyRateFromConvention(ea, 'nominal365').decimal.gt(0)).toBe(true);
  });
  it('compound FV and monthly from daily', () => {
    const fv = compoundFutureValue(Money.from('1000000', 'COP'), Rate.fromDecimal('0.03'), 2);
    expect(fv.isPositive()).toBe(true);
    const daily = effectiveToDaily(ea);
    expect(monthlyEquivalentFromDaily(daily, 30).decimal.gt(0)).toBe(true);
    expect(nominalToDailyLinear(Rate.fromDecimal('0.36')).decimal.gt(0)).toBe(true);
  });
});

describe('Coverage — fold edge events', () => {
  beforeEach(() => resetEventIdCounterForTests());

  it('applies fees, insurance, commission, adjustment, refinance, extra installments_first', () => {
    let { log, state } = appendAndFold([], openLog());
    ({ log, state } = appendAndFold(
      log,
      postPurchase({
        creditId: CREDIT_ID,
        occurredOn: '2026-01-02',
        purchaseId: 'def',
        amount: '1200000',
        installments: 3,
        sequence: 2,
        firstDueOn: '2026-02-01',
      }),
    ));
    ({ log, state } = appendAndFold(
      log,
      postPurchase({
        creditId: CREDIT_ID,
        occurredOn: '2026-01-03',
        purchaseId: 'rev',
        amount: '500000',
        sequence: 10,
      }),
    ));

    const extras: DomainEvent[] = [
      {
        ...baseEventFields(CREDIT_ID, '2026-01-04', 11),
        type: 'LateFeeApplied',
        payload: { amount: '10000', reason: 'late', daysLate: 5 },
      },
      {
        ...baseEventFields(CREDIT_ID, '2026-01-04', 12),
        type: 'InsuranceCharged',
        payload: { amount: '5000', insuranceId: 'ins1' },
      },
      {
        ...baseEventFields(CREDIT_ID, '2026-01-04', 13),
        type: 'CommissionCharged',
        payload: { amount: '2000', commissionType: 'admin' },
      },
      {
        ...baseEventFields(CREDIT_ID, '2026-01-04', 14),
        type: 'InterestAccrued',
        payload: {
          amount: '8000',
          periodFrom: '2026-01-01',
          periodTo: '2026-01-04',
          rateUsed: '0.36',
          method: 'simple',
          baseAmount: '500000',
        },
      },
    ];
    ({ log, state } = appendAndFold(log, extras));
    expect(state.lateFeeDue.toString()).toBe('10000');
    expect(state.insuranceDue.toString()).toBe('5000');
    expect(state.commissionDue.toString()).toBe('2000');

    const pay = postPayment(state, {
      creditId: CREDIT_ID,
      occurredOn: '2026-01-05',
      paymentId: 'big',
      amount: '2000000',
      sequence: 20,
      method: 'transfer',
    });
    ({ log, state } = appendAndFold(log, pay));
    expect(state.totalPaymentsReceived.isPositive()).toBe(true);

    ({ state } = appendAndFold(log, [
      {
        ...baseEventFields(CREDIT_ID, '2026-01-06', 40),
        type: 'AdjustmentApplied',
        payload: {
          amount: '1000',
          direction: 'debit',
          reason: 'bank adjust',
          bucket: 'RevolvingPrincipal',
        },
      },
      {
        ...baseEventFields(CREDIT_ID, '2026-01-07', 41),
        type: 'Refinanced',
        payload: {
          refinanceId: 'rf1',
          principalMoved: '100000',
          newTotalInstallments: 6,
        },
      },
      {
        ...baseEventFields(CREDIT_ID, '2026-01-08', 42),
        type: 'ReversalIssued',
        payload: { reversesEventId: 'x', reason: 'test' },
      },
      {
        ...baseEventFields(CREDIT_ID, '2026-01-08', 43),
        type: 'BudgetProjectionSet',
        payload: {
          plannedDailyAdBudget: '50000',
          from: '2026-01-08',
          to: '2026-01-31',
        },
      },
      {
        ...baseEventFields(CREDIT_ID, '2026-01-08', 44),
        type: 'AdSpendActualRecorded',
        payload: { channelId: 'tiktok', actualAmount: '45000' },
      },
    ]));
    expect(state.revolvingPrincipal.toString()).toBe('100000');
    expect(state.plannedDailyAdBudget!.toString()).toBe('50000');
    expect(state.actualAdSpendTotal.toString()).toBe('45000');
    expect(totalDue(state).isPositive()).toBe(true);
    expect(validateDerivedState(state)).toEqual([]);
    assertNonNegativePrincipals(state);
  });

  it('sorts events and creates ids', () => {
    const a = createEventId('t');
    const b = createEventId('t');
    expect(a).not.toBe(b);
    const sorted = sortEventLog([
      {
        ...baseEventFields('c', '2026-01-02', 1),
        type: 'ReversalIssued',
        payload: { reversesEventId: '1', reason: 'r' },
      },
      {
        ...baseEventFields('c', '2026-01-01', 2),
        type: 'ReversalIssued',
        payload: { reversesEventId: '2', reason: 'r' },
      },
    ]);
    expect(sorted[0]!.occurredOn).toBe('2026-01-01');
  });

  it('closes statement without capitalization', () => {
    let { log, state } = appendAndFold([], openLog());
    ({ log, state } = appendAndFold(
      log,
      postPurchase({
        creditId: CREDIT_ID,
        occurredOn: '2026-01-05',
        purchaseId: 'p',
        amount: '1000000',
        sequence: 2,
      }),
    ));
    const stmt = closeStatement(state, {
      creditId: CREDIT_ID,
      occurredOn: '2026-01-28',
      statementId: 's1',
      periodFrom: '2026-01-01',
      periodTo: '2026-01-28',
      sequence: 3,
      averageDailyBalance: '1000000',
      daysInCycle: 28,
    });
    ({ state } = appendAndFold(log, stmt));
    expect(state.interestDue.isPositive()).toBe(true);
    expect(state.statements).toHaveLength(1);
  });

  it('allocation leftover and zero payment path', () => {
    const state = foldEvents([
      ...openLog(),
      ...postPurchase({
        creditId: CREDIT_ID,
        occurredOn: '2026-01-05',
        purchaseId: 'p',
        amount: '100000',
        sequence: 2,
      }),
    ]);
    const lines = allocatePayment(state, Money.from('50000', 'COP'));
    const left = leftoverAfterAllocation(Money.from('50000', 'COP'), lines);
    expect(left.isZero()).toBe(true);
    assertAllocationConserved(Money.from('50', 'COP'), Money.from('40', 'COP'));
    expect(() =>
      assertAllocationConserved(Money.from('40', 'COP'), Money.from('50', 'COP')),
    ).toThrow(/allocated/);
  });

  it('adjustment credit buckets and initial state', () => {
    let state = foldEvents(openLog());
    state = applyEvent(state, {
      ...baseEventFields(CREDIT_ID, '2026-01-02', 2),
      type: 'LateFeeApplied',
      payload: { amount: '5000', reason: 'x', daysLate: 1 },
    });
    state = applyEvent(state, {
      ...baseEventFields(CREDIT_ID, '2026-01-03', 3),
      type: 'AdjustmentApplied',
      payload: { amount: '2000', direction: 'credit', reason: 'waive', bucket: 'LateFee' },
    });
    expect(state.lateFeeDue.toString()).toBe('3000');
    expect(initialDerivedState('USD').currency).toBe('USD');
  });
});

describe('Coverage — amortization router', () => {
  it('buildAmortizationSchedule dispatches systems', () => {
    const P = Money.from('1000000', 'COP');
    const i = Rate.fromDecimal('0.02');
    expect(buildAmortizationSchedule('french', P, i, 6).system).toBe('french');
    expect(buildAmortizationSchedule('german', P, i, 6).system).toBe('german');
    expect(buildAmortizationSchedule('american', P, i, 6).system).toBe('american');
  });
});

describe('Coverage — simulation scenarios', () => {
  beforeEach(() => resetEventIdCounterForTests());

  it('rate change, refinance, monthly increase, statement helper', () => {
    let { log } = appendAndFold([], openLog());
    ({ log } = appendAndFold(
      log,
      postPurchase({
        creditId: CREDIT_ID,
        occurredOn: '2026-01-05',
        purchaseId: 'phone',
        amount: '1200000',
        installments: 12,
        sequence: 2,
        firstDueOn: '2026-02-01',
      }),
    ));
    const rateSim = simulate(log, {
      type: 'rate_change',
      annualEffectiveRate: '0.5',
      onDate: '2026-01-10',
    });
    expect(rateSim.finalState.config!.annualEffectiveRate.toString()).toBe('0.5');

    const refi = simulate(log, {
      type: 'refinance',
      newTotalInstallments: 6,
      onDate: '2026-01-15',
      purchaseId: 'phone',
    });
    expect(refi.hypotheticalEvents.some((e) => e.type === 'TermChanged')).toBe(true);

    const monthly = simulate(log, {
      type: 'increase_monthly_payment',
      monthlyPayment: '200000',
      months: 24,
    });
    expect(monthly.monthsToPayoff !== undefined).toBe(true);
    expect(explain(monthly).summary).toContain('Simulation');

    const viaApi = simulateScenario(log, {
      type: 'extra_payment',
      amount: '10000',
      onDate: '2026-01-20',
      paymentId: 'x',
    });
    expect(viaApi.projectedPrincipal).toBeTruthy();
  });
});

describe('Coverage — optimization strategies & API', () => {
  beforeEach(() => resetEventIdCounterForTests());

  it('runs all strategies and recommendation explain paths', () => {
    let { log } = appendAndFold([], openLog());
    ({ log } = appendAndFold(
      log,
      postPurchase({
        creditId: CREDIT_ID,
        occurredOn: '2026-01-05',
        purchaseId: 'p',
        amount: '2000000',
        sequence: 2,
      }),
    ));
    const view = accountsFromLog(
      CREDIT_ID,
      'Ads Card',
      log,
      Money.from('100000', 'COP'),
      Money.from('50000', 'COP'),
    );
    const other = {
      creditId: 'other',
      name: 'Small loan',
      principal: Money.from('300000', 'COP'),
      annualEffectiveRate: '0.2',
      minimumPayment: Money.from('40000', 'COP'),
      installmentPayment: Money.from('40000', 'COP'),
    };
    const accounts = [view, other];
    expect(highestInstallmentStrategy.prioritize(accounts)[0]!.creditId).toBe(CREDIT_ID);
    expect(cashFlowFirstStrategy.prioritize(accounts)[0]!.creditId).toBe(CREDIT_ID);
    expect(roiDrivenStrategy.prioritize(accounts)[0]!.name).toBe('Small loan');
    expect(liquidityFirstStrategy.prioritize(accounts)[0]!.creditId).toBe('other');
    const custom = customStrategy('c1', 'Custom', ['other', CREDIT_ID]);
    expect(custom.prioritize(accounts)[0]!.creditId).toBe('other');

    const opt = optimize({
      accounts,
      extraMonthlyBudget: Money.from('150000', 'COP'),
      logs: { [CREDIT_ID]: log },
    });
    expect(explain(opt).summary).toContain('Optimal');

    const analysis = analyzePortfolio({
      credits: [{ creditId: CREDIT_ID, name: 'Main', log }],
    });
    expect(explain(analysis).summary).toContain('Portfolio');

    const rec = recommend(
      { credits: [{ creditId: CREDIT_ID, name: 'Main', log }] },
      { extraMonthlyBudget: '100000', currency: 'COP' },
    );
    expect(explain(rec).summary).toBe('Recommendation');

    const fc = forecast(log, {
      months: 3,
      monthlyPayment: '500000',
      monthlyIncome: '3000000',
      creditId: CREDIT_ID,
    });
    expect(fc.points.length).toBeGreaterThan(0);
    expect(
      projectMonthlyCashflow(foldEvents(log), 2, Money.from('1', 'COP'), Money.from('2', 'COP')),
    ).toHaveLength(2);
    expect(snapshotPrincipal(foldEvents(log)).isPositive()).toBe(true);

    const roi = computeAdsRoi({
      actualAdSpend: Money.from('1000', 'COP'),
      attributedRevenue: Money.from('500', 'COP'),
      financingCost: Money.from('100', 'COP'),
    });
    expect(explain(roi).summary).toContain('ROI');
    expect(() =>
      computeAdsRoi({
        actualAdSpend: Money.zero('COP'),
        attributedRevenue: Money.from('1', 'COP'),
        financingCost: Money.zero('COP'),
      }),
    ).toThrow(/actualAdSpend/);
  });
});

describe('Coverage — money edge ops', () => {
  it('neg abs div zero and json', () => {
    const m = Money.from('100', 'COP');
    expect(m.neg().toString()).toBe('-100');
    expect(m.neg().abs().toString()).toBe('100');
    expect(m.toJSON()).toEqual({ amount: '100', currency: 'COP' });
    expect(() => m.div('0')).toThrow(/zero/);
    expect(Money.from('1.4', 'COP').round(0, 'down').toString()).toBe('1');
    expect(Money.from('1.5', 'COP').round(0, 'up').toString()).toBe('2');
    expect(Money.from('1.5', 'COP').round(0, 'half-even').toString()).toBe('2');
  });
});
