import { Decimal, FinancialEngineError } from '@fie/financial-engine';

export type BusinessScoreInput = {
  components: Record<string, number>;
  /** USER policy — required. Decimal strings summing to 1. */
  weights: Record<string, string>;
  /** USER policy — required risk band thresholds. */
  riskBands: { lowMin: number; mediumMin: number };
};

export type RiskLevel = 'low' | 'medium' | 'high';

export type BusinessScoreResult = {
  score: number;
  riskLevel: RiskLevel;
  weightsUsed: Record<string, string>;
  riskBandsUsed: { lowMin: number; mediumMin: number };
};

function clampScore(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

function riskLevelFromScore(
  score: number,
  bands: { lowMin: number; mediumMin: number },
): RiskLevel {
  if (score >= bands.lowMin) return 'low';
  if (score >= bands.mediumMin) return 'medium';
  return 'high';
}

export function computeBusinessScore(input: BusinessScoreInput): BusinessScoreResult {
  const entries = Object.entries(input.weights);
  if (entries.length === 0) {
    throw new FinancialEngineError(
      'MISSING_RISK_WEIGHTS',
      'weights are required user policy. The engine does not invent a default weight table.',
    );
  }

  let weightSum = new Decimal(0);
  let weighted = new Decimal(0);

  for (const [key, weightStr] of entries) {
    const w = new Decimal(weightStr);
    if (w.lt(0)) {
      throw new FinancialEngineError('INVALID_WEIGHT', `Weight for ${key} must be >= 0`);
    }
    weightSum = weightSum.plus(w);
    const component = clampScore(input.components[key] ?? 0);
    weighted = weighted.plus(new Decimal(component).times(w));
  }

  if (weightSum.minus(1).abs().gt(new Decimal('0.0001'))) {
    throw new FinancialEngineError(
      'WEIGHTS_MUST_SUM_TO_ONE',
      `Risk weights must sum to 1 (got ${weightSum.toFixed()})`,
    );
  }

  const score = Math.round(Number(weighted.toFixed(2)) * 100) / 100;

  return {
    score,
    riskLevel: riskLevelFromScore(score, input.riskBands),
    weightsUsed: { ...input.weights },
    riskBandsUsed: { ...input.riskBands },
  };
}

/** Example for tests/docs only — never auto-applied by the engine. */
export const EXAMPLE_RISK_WEIGHTS_FOR_TESTS = {
  liquidity: '0.25',
  breakEven: '0.20',
  debtCoverage: '0.15',
  margin: '0.15',
  ads: '0.10',
  inventory: '0.10',
  cash: '0.05',
} as const;

export const EXAMPLE_RISK_BANDS_FOR_TESTS = { lowMin: 70, mediumMin: 40 } as const;
