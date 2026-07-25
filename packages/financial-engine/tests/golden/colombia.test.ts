import { describe, expect, it } from 'vitest';
import {
  openCreditCard,
  postPurchase,
  postPayment,
  appendAndFold,
} from '../../src/credit-card/engine.js';
import { totalPrincipal } from '../../src/core/fold.js';

/** Mirrors tests/fixtures/colombia/bancolombia-cycle-2026-03.json */
const EXPECTED = {
  revolvingPrincipal: '4000000',
  reportedBalance: '4000000',
} as const;

describe('Golden — Colombia Bancolombia cycle', () => {
  it('matches fixture expected balance', () => {
    let { log, state } = appendAndFold(
      [],
      openCreditCard({
        creditId: 'crd_col_1',
        occurredOn: '2026-03-01',
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
    ({ log, state } = appendAndFold(
      log,
      postPurchase({
        creditId: 'crd_col_1',
        occurredOn: '2026-03-01',
        purchaseId: 'ads_march',
        amount: '5000000',
        sequence: 2,
      }),
    ));
    ({ state } = appendAndFold(
      log,
      postPayment(state, {
        creditId: 'crd_col_1',
        occurredOn: '2026-03-15',
        paymentId: 'pay_march',
        amount: '1000000',
        sequence: 3,
      }),
    ));

    expect(totalPrincipal(state).toString()).toBe(EXPECTED.revolvingPrincipal);
    expect(totalPrincipal(state).toString()).toBe(EXPECTED.reportedBalance);
  });
});
