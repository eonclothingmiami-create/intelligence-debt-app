import { describe, expect, it } from 'vitest';
import { recommendBusinessAction } from './holistic.js';

describe('recommendBusinessAction', () => {
  it('refuses unsafe extra payment that exceeds max safe liquidity', () => {
    const result = recommendBusinessAction({
      breakEvenSales: '30390000',
      projectedSales: '36200000',
      safetyMargin: '5810000',
      runwayMonths: '3',
      maxSafeExtraDebtPayment: '1000000',
      proposedExtraDebtPayment: '5000000',
      futureInterestSaved: '2000000',
    });

    expect(result.valid).toBe(false);
    expect(result.action).toBe('hold_extra_debt_payment');
    expect(result.rationale.some((r) => /liquidez|capacidad segura/i.test(r))).toBe(true);
  });

  it('refuses when safety margin is conceptually negative', () => {
    const result = recommendBusinessAction({
      breakEvenSales: '30390000',
      projectedSales: '25000000',
      safetyMargin: '-5390000',
      runwayMonths: '2',
      maxSafeExtraDebtPayment: '5000000',
      proposedExtraDebtPayment: '1000000',
      futureInterestSaved: '800000',
    });

    expect(result.valid).toBe(false);
    expect(result.rationale.some((r) => /punto de equilibrio|margen de seguridad/i.test(r))).toBe(
      true,
    );
  });

  it('accepts a safe extra payment and explains break-even and liquidity', () => {
    const result = recommendBusinessAction({
      breakEvenSales: '30390000',
      projectedSales: '36200000',
      safetyMargin: '5810000',
      runwayMonths: '4',
      maxSafeExtraDebtPayment: '5000000',
      proposedExtraDebtPayment: '2000000',
      futureInterestSaved: '900000',
    });

    expect(result.valid).toBe(true);
    expect(result.action).toBe('accelerate_debt_within_liquidity');
    expect(result.suggestedExtraDebtPayment).toBe('2000000');
    const joined = result.rationale.join(' ');
    expect(joined).toMatch(/punto de equilibrio/i);
    expect(joined).toMatch(/liquidez/i);
  });

  it('raises suggested abono when marketing underspend frees capacity', () => {
    const result = recommendBusinessAction({
      breakEvenSales: '30390000',
      projectedSales: '36200000',
      safetyMargin: '5810000',
      runwayMonths: '3',
      maxSafeExtraDebtPayment: '1000000',
      // no proposed — engine should auto-suggest base + freed
      futureInterestSaved: '400000',
      marketingFreedCapacity: '600000',
      marketingOverspend: '0',
    });

    expect(result.valid).toBe(true);
    expect(result.adjustedMaxSafeExtraDebtPayment).toBe('1600000');
    expect(result.suggestedExtraDebtPayment).toBe('1600000');
    expect(result.action).toBe('accelerate_debt_from_marketing_underspend');
    expect(result.rationale.some((r) => /publicidad|liber/i.test(r))).toBe(true);
  });

  it('reduces capacity when ads overspend', () => {
    const result = recommendBusinessAction({
      breakEvenSales: '30390000',
      projectedSales: '36200000',
      safetyMargin: '5810000',
      runwayMonths: '3',
      maxSafeExtraDebtPayment: '1000000',
      proposedExtraDebtPayment: '900000',
      futureInterestSaved: '100000',
      marketingFreedCapacity: '0',
      marketingOverspend: '400000',
    });

    expect(result.adjustedMaxSafeExtraDebtPayment).toBe('600000');
    expect(result.valid).toBe(false);
    expect(result.action).toBe('hold_extra_debt_payment');
  });
});
