export const ENGINE_NAME = 'liquidity-engine' as const;

export { computeLiquidity } from './compute/runway.js';
export type { LiquidityInput, LiquidityResult, LiquidityAssumptions } from './compute/runway.js';
