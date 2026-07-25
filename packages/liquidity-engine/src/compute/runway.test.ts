import { describe, expect, it } from 'vitest';
import { Money } from '@fie/financial-engine';
import { computeLiquidity } from './runway.js';

describe('computeLiquidity', () => {
  it('uses caller reserve policy — never invents months', () => {
    const result = computeLiquidity({
      cash: Money.from('30000000', 'COP'),
      monthlyFixedBurn: Money.from('10000000', 'COP'),
      monthlyFreeCashFlow: Money.from('35000000', 'COP'),
      proposedExtraDebtPayment: Money.from('2000000', 'COP'),
      reserveMonths: '3', // user policy for this test scenario
    });

    expect(result.runwayMonths).toBe('3');
    expect(result.maxSafeExtraDebtPayment.toString()).toBe('5000000');
    expect(result.canAffordExtraPayment).toBe(true);
    expect(result.policyUsed.reserveMonths).toBe('3');
  });

  it('refuses proposed payment above max safe under user policy', () => {
    const result = computeLiquidity({
      cash: Money.from('10000000', 'COP'),
      monthlyFixedBurn: Money.from('5000000', 'COP'),
      monthlyFreeCashFlow: Money.from('16000000', 'COP'),
      proposedExtraDebtPayment: Money.from('2000000', 'COP'),
      reserveMonths: '3',
    });
    expect(result.maxSafeExtraDebtPayment.toString()).toBe('1000000');
    expect(result.canAffordExtraPayment).toBe(false);
  });

  it('requires reserveMonths', () => {
    expect(() =>
      computeLiquidity({
        cash: Money.from('1', 'COP'),
        monthlyFixedBurn: Money.from('1', 'COP'),
        monthlyFreeCashFlow: Money.from('1', 'COP'),
        proposedExtraDebtPayment: Money.zero('COP'),
        reserveMonths: '-1',
      }),
    ).toThrow(/reserveMonths/);
  });

  it('caps max safe by optional min cash floor', () => {
    const result = computeLiquidity({
      cash: Money.from('12000000', 'COP'),
      monthlyFixedBurn: Money.from('10000000', 'COP'),
      monthlyFreeCashFlow: Money.from('40000000', 'COP'),
      proposedExtraDebtPayment: Money.from('0', 'COP'),
      reserveMonths: '2',
      minCashFloor: Money.from('10000000', 'COP'),
    });
    // Flow surplus = 40M - 20M = 20M, but cash headroom = 12M - 10M = 2M
    expect(result.maxSafeExtraDebtPayment.toString()).toBe('2000000');
    expect(result.policyUsed.minCashFloor?.toString()).toBe('10000000');
  });
});
