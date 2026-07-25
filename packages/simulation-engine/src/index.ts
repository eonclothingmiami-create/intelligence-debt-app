export const ENGINE_NAME = 'simulation-engine' as const;

/**
 * Run a cross-engine what-if scenario (break-even, liquidity, debt, risk).
 * TODO: orchestrate patches across engines and return a comparable snapshot set.
 */
export function simulateWhatIfScenario(_input: unknown): never {
  throw new Error('TODO: implement simulateWhatIfScenario in @fie/simulation-engine');
}
