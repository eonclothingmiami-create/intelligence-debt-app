export const ENGINE_NAME = 'recommendation-engine' as const;

export { recommendBusinessAction } from './recommend/holistic.js';
export type {
  RecommendBusinessActionInput,
  RecommendBusinessActionResult,
} from './recommend/holistic.js';

/**
 * Compose engine snapshots into a holistic recommendation set.
 * TODO: pull break-even, liquidity, risk, and cashflow snapshots automatically.
 */
export function recommendHolistic(_input: unknown): never {
  throw new Error('TODO: implement recommendHolistic wrapper in @fie/recommendation-engine');
}
