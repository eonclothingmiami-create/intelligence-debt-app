import { describe, expect, it } from 'vitest';
import { Money } from './math/money.js';
import { Rate } from './math/rate.js';
import {
  nominalToPeriodic,
  nominalToEffective,
  effectiveToNominal,
  dailyRateFromConvention,
} from './interest/rates.js';
import {
  frenchPayment,
  buildGermanSchedule,
  buildAmericanSchedule,
} from './amortization/schedules.js';
import { foldEvents, applyEvent } from './core/fold.js';
import { baseEventFields } from './core/events.js';
import { openCreditCard, appendAndFold, postPurchase } from './credit-card/engine.js';
import { unpaidInstallments } from './payments/allocate.js';
import { assertNonNegativePrincipals, validateDerivedState } from './validation/invariants.js';
import { applyStatementCloseForSim } from './simulation/simulate.js';
import { d } from './math/decimal.js';

describe('Coverage push — error paths', () => {
  it('rejects invalid rate/period inputs', () => {
    expect(() => nominalToPeriodic(Rate.fromDecimal('0.1'), 0)).toThrow(/periods/);
    expect(() => effectiveToNominal(Rate.fromDecimal('0.1'), 0)).toThrow(/periods/);
    expect(() => frenchPayment(Money.from('100', 'COP'), Rate.fromDecimal('0.01'), 0)).toThrow(
      /periods/,
    );
    expect(() =>
      buildGermanSchedule(Money.from('100', 'COP'), Rate.fromDecimal('0.01'), 0),
    ).toThrow(/periods/);
    expect(() =>
      buildAmericanSchedule(Money.from('100', 'COP'), Rate.fromDecimal('0.01'), 0),
    ).toThrow(/periods/);
    expect(frenchPayment(Money.from('100', 'COP'), Rate.fromDecimal('0'), 4).toString()).toBe('25');
    expect(() => dailyRateFromConvention(Rate.fromDecimal('0.1'), 'nope' as 'actual365')).toThrow(
      /UNKNOWN|nope/,
    );
  });

  it('term change invalid and installment adjustment', () => {
    const opened = openCreditCard({
      creditId: 'c',
      occurredOn: '2026-01-01',
      currency: 'COP',
      productType: 'credit_card',
      annualEffectiveRate: '0.3',
      dayCountConvention: 'actual365',
      statementDay: 1,
      paymentDueDay: 15,
      minPaymentRate: '0.05',
      minPaymentFloor: '10000',
      graceEnabled: false,
      extraPaymentTarget: 'pro_rata',
      sequence: 1,
    });
    let { log, state } = appendAndFold([], opened);
    ({ log, state } = appendAndFold(
      log,
      postPurchase({
        creditId: 'c',
        occurredOn: '2026-01-02',
        purchaseId: 'p',
        amount: '900',
        installments: 3,
        sequence: 2,
      }),
    ));
    expect(unpaidInstallments(state).length).toBe(3);
    expect(() =>
      applyEvent(state, {
        ...baseEventFields('c', '2026-01-03', 10),
        type: 'TermChanged',
        payload: {
          purchaseId: 'p',
          newTotalInstallments: 0,
          remainingPrincipal: '900',
        },
      }),
    ).toThrow(/newTotalInstallments/);

    state = applyEvent(state, {
      ...baseEventFields('c', '2026-01-03', 11),
      type: 'AdjustmentApplied',
      payload: {
        amount: '10',
        direction: 'debit',
        reason: 'x',
        bucket: 'Interest',
      },
    });
    state = applyEvent(state, {
      ...baseEventFields('c', '2026-01-03', 12),
      type: 'AdjustmentApplied',
      payload: {
        amount: '10',
        direction: 'credit',
        reason: 'x',
        bucket: 'Interest',
      },
    });
    state = applyEvent(state, {
      ...baseEventFields('c', '2026-01-03', 13),
      type: 'AdjustmentApplied',
      payload: {
        amount: '1',
        direction: 'debit',
        reason: 'x',
        bucket: 'Insurance',
      },
    });
    state = applyEvent(state, {
      ...baseEventFields('c', '2026-01-03', 14),
      type: 'AdjustmentApplied',
      payload: {
        amount: '1',
        direction: 'debit',
        reason: 'x',
        bucket: 'Commission',
      },
    });
    state = applyEvent(state, {
      ...baseEventFields('c', '2026-01-03', 15),
      type: 'AdjustmentApplied',
      payload: {
        amount: '1',
        direction: 'debit',
        reason: 'x',
        bucket: 'InstallmentPrincipal',
      },
    });
    expect(state.insuranceDue.toString()).toBe('1');

    const closed = applyStatementCloseForSim(log, {
      creditId: 'c',
      occurredOn: '2026-01-28',
      statementId: 'st',
      periodFrom: '2026-01-01',
      periodTo: '2026-01-28',
      averageDailyBalance: '0',
      daysInCycle: 28,
    });
    expect(closed.some((e) => e.type === 'StatementClosed')).toBe(true);

    expect(() =>
      assertNonNegativePrincipals({
        ...state,
        revolvingPrincipal: Money.from('-1', 'COP'),
      }),
    ).toThrow(/revolvingPrincipal/);
    expect(() =>
      assertNonNegativePrincipals({
        ...state,
        installments: [
          {
            ...state.installments[0]!,
            remainingPrincipal: Money.from('-1', 'COP'),
          },
        ],
      }),
    ).toThrow(/installment/);

    const warnings = validateDerivedState({
      ...foldEvents(opened),
      opened: true,
      config: null,
    });
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('rate and decimal helpers', () => {
    expect(() => Rate.fromDecimal(d('not-a-number' as unknown as string))).toThrow();
    expect(nominalToEffective(Rate.fromDecimal('0.12'), 12).decimal.gt(0)).toBe(true);
  });
});
