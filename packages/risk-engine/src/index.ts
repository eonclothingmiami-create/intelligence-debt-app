export const ENGINE_NAME = 'risk-engine' as const;

export {
  computeBusinessScore,
  EXAMPLE_RISK_WEIGHTS_FOR_TESTS,
  EXAMPLE_RISK_BANDS_FOR_TESTS,
} from './compute/score.js';
export type { BusinessScoreInput, BusinessScoreResult, RiskLevel } from './compute/score.js';
