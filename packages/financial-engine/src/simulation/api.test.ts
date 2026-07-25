import { describe, expect, it, beforeEach } from 'vitest';
import { openCreditCard, postPurchase, appendAndFold } from '../credit-card/engine.js';
import { resetEventIdCounterForTests } from '../core/events.js';
import { simulate } from './simulate.js';
import { recommend, analyzePortfolio, forecast, explain } from '../api.js';
import { optimize, snowballStrategy, avalancheStrategy } from '../optimization/strategies.js';
import { Money } from '../math/money.js';
import { computeAdsRoi, shouldAcceleratePayoff } from '../roi/ads.js';

const CREDIT_ID = 'crd_sim';

function baseLog() {
  let { log } = appendAndFold(
    [],
    openCreditCard({
      creditId: CREDIT_ID,
      occurredOn: '2026-01-01',
      currency: 'COP',
      productType: 'credit_card',
      annualEffectiveRate: '0.425761',
      dayCountConvention: 'actual365',
      statementDay: 30,
      paymentDueDay: 15,
      minPaymentRate: '0.05',
      minPaymentFloor: '30000',
      graceEnabled: false,
      extraPaymentTarget: 'revolving_first',
      sequence: 1,
    }),
  );
  ({ log } = appendAndFold(
    log,
    postPurchase({
      creditId: CREDIT_ID,
      occurredOn: '2026-01-05',
      purchaseId: 'p1',
      amount: '3000000',
      sequence: 2,
    }),
  ));
  return log;
}

describe('Simulation & Optimization & API', () => {
  beforeEach(() => resetEventIdCounterForTests());

  it('simulates extra payment reducing principal', () => {
    const log = baseLog();
    const result = simulate(log, {
      type: 'extra_payment',
      amount: '500000',
      onDate: '2026-01-20',
      paymentId: 'sim_pay',
    });
    expect(result.projectedPrincipal).toBe('2500000');
    expect(result.hypotheticalEvents.length).toBeGreaterThan(0);
    expect(explain(result).bullets.length).toBeGreaterThan(0);
  });

  it('simulates ad spend increase', () => {
    const log = baseLog();
    const result = simulate(log, {
      type: 'ad_spend_change',
      plannedDailyAdBudget: '70000',
      from: '2026-02-01',
      to: '2026-02-28',
    });
    // 3M + 70k*30 = 5.1M
    expect(result.projectedPrincipal).toBe('5100000');
  });

  it('optimizes snowball vs avalanche', () => {
    const result = optimize({
      extraMonthlyBudget: Money.from('200000', 'COP'),
      logs: {},
      accounts: [
        {
          creditId: 'a',
          name: 'Small',
          principal: Money.from('500000', 'COP'),
          annualEffectiveRate: '0.2',
          minimumPayment: Money.from('50000', 'COP'),
          installmentPayment: Money.zero('COP'),
        },
        {
          creditId: 'b',
          name: 'Ads Card',
          principal: Money.from('5000000', 'COP'),
          annualEffectiveRate: '0.4',
          minimumPayment: Money.from('200000', 'COP'),
          installmentPayment: Money.zero('COP'),
        },
      ],
    });
    expect(result.scores.length).toBeGreaterThan(1);
    expect(result.best.strategyId).toBeTruthy();
    const accounts = [
      {
        creditId: 'a',
        name: 'Small',
        principal: Money.from('500000', 'COP'),
        annualEffectiveRate: '0.2',
        minimumPayment: Money.from('50000', 'COP'),
        installmentPayment: Money.zero('COP'),
      },
      {
        creditId: 'b',
        name: 'Ads Card',
        principal: Money.from('5000000', 'COP'),
        annualEffectiveRate: '0.4',
        minimumPayment: Money.from('200000', 'COP'),
        installmentPayment: Money.zero('COP'),
      },
    ];
    expect(snowballStrategy.prioritize(accounts)[0]!.creditId).toBe('a');
    expect(avalancheStrategy.prioritize(accounts)[0]!.creditId).toBe('b');
  });

  it('recommend / analyze / forecast API', () => {
    const log = baseLog();
    const analysis = analyzePortfolio({
      credits: [{ creditId: CREDIT_ID, name: 'Main', log }],
    });
    expect(analysis.totalDebt).toBe('3000000');

    const rec = recommend(
      { credits: [{ creditId: CREDIT_ID, name: 'Main', log }] },
      { extraMonthlyBudget: '300000' },
    );
    expect(rec.rationale.length).toBeGreaterThan(0);

    const fc = forecast(log, { months: 6, monthlyPayment: '400000', monthlyIncome: '2000000' });
    expect(fc.points.length).toBeGreaterThan(0);
    expect(fc.cashflow).toHaveLength(6);
  });

  it('ROI ads vs financing', () => {
    const roi = computeAdsRoi({
      actualAdSpend: Money.from('5000000', 'COP'),
      attributedRevenue: Money.from('7000000', 'COP'),
      financingCost: Money.from('180000', 'COP'),
    });
    expect(roi.spread.toString()).toBe('1820000');
    expect(shouldAcceleratePayoff(roi, false)).toBe(false);
    expect(shouldAcceleratePayoff(roi, true)).toBe(true);
  });
});
