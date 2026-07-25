import { describe, expect, it } from 'vitest';
import {
  computeBusinessScore,
  EXAMPLE_RISK_WEIGHTS_FOR_TESTS,
  EXAMPLE_RISK_BANDS_FOR_TESTS,
} from './score.js';

describe('computeBusinessScore', () => {
  it('uses caller weights only', () => {
    const weights = { ...EXAMPLE_RISK_WEIGHTS_FOR_TESTS };
    const perfect = computeBusinessScore({
      components: {
        liquidity: 100,
        breakEven: 100,
        debtCoverage: 100,
        margin: 100,
        ads: 100,
        inventory: 100,
        cash: 100,
      },
      weights,
      riskBands: EXAMPLE_RISK_BANDS_FOR_TESTS,
    });
    expect(perfect.score).toBe(100);
    expect(perfect.riskLevel).toBe('low');

    const weak = computeBusinessScore({
      components: {
        liquidity: 20,
        breakEven: 20,
        debtCoverage: 20,
        margin: 20,
        ads: 20,
        inventory: 20,
        cash: 20,
      },
      weights,
      riskBands: EXAMPLE_RISK_BANDS_FOR_TESTS,
    });
    expect(weak.score).toBe(20);
    expect(weak.riskLevel).toBe('high');
  });

  it('rejects missing weights', () => {
    expect(() =>
      computeBusinessScore({
        components: { liquidity: 50 },
        weights: {},
        riskBands: EXAMPLE_RISK_BANDS_FOR_TESTS,
      }),
    ).toThrow(/weights/);
  });
});
