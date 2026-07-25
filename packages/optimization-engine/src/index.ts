export const ENGINE_NAME = 'optimization-engine' as const;

/**
 * Multi-objective optimizer across liquidity, break-even, risk, and debt — never debt-only.
 * TODO: implement Pareto / weighted search over business objectives.
 */
export function optimizeBusinessObjectives(_input: unknown): never {
  throw new Error('TODO: implement optimizeBusinessObjectives in @fie/optimization-engine');
}
