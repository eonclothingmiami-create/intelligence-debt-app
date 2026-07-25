export {
  snowballStrategy,
  avalancheStrategy,
  highestInterestStrategy,
  highestInstallmentStrategy,
  cashFlowFirstStrategy,
  roiDrivenStrategy,
  liquidityFirstStrategy,
  customStrategy,
  defaultStrategies,
  optimize,
  accountsFromLog,
} from './strategies.js';
export type {
  DebtAccountView,
  OptimizationContext,
  StrategyScore,
  OptimizationStrategy,
  OptimizationResult,
} from './strategies.js';
