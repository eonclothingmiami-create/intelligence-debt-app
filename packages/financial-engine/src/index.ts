/**
 * @fie/financial-engine
 *
 * Pure financial core. No NestJS, React, Prisma, or network I/O.
 * All monetary math uses Decimal. Balances are derived from events.
 */

export const ENGINE_NAME = '@fie/financial-engine' as const;
export const ENGINE_VERSION = '0.0.1' as const;

export { FORMULA_VERSION, EVENT_SCHEMA_VERSION, FinancialEngineError } from './shared/index.js';
export type {
  CurrencyCode,
  RoundingMode,
  DayCountConvention,
  ExtraPaymentTarget,
  ProductType,
  PaymentBucket,
} from './shared/index.js';

export { Money, Decimal, Rate, currencyScale } from './math/index.js';
export type { MoneyJSON, DecimalValue } from './math/index.js';

export {
  nominalToPeriodic,
  nominalToEffective,
  effectiveToNominal,
  effectiveToMonthly,
  effectiveToDaily,
  dailyRateFromConvention,
  simpleInterest,
  compoundFutureValue,
  interestFromAverageDailyBalance,
} from './interest/index.js';

export {
  foldEvents,
  applyEvent,
  totalPrincipal,
  totalDue,
  sortEventLog,
  baseEventFields,
} from './core/index.js';
export type { DomainEvent, EventLog, DerivedState, CreditConfig } from './core/index.js';

export {
  openCreditCard,
  postPurchase,
  postPayment,
  closeStatement,
  appendAndFold,
} from './credit-card/index.js';

export { allocatePayment, computeMinimumPayment } from './payments/index.js';

export {
  buildAmortizationSchedule,
  buildFrenchSchedule,
  buildGermanSchedule,
  buildAmericanSchedule,
  frenchPayment,
} from './amortization/index.js';
export type { AmortizationSystem, AmortizationSchedule } from './amortization/index.js';

export { computeAdsRoi, shouldAcceleratePayoff } from './roi/index.js';

export { simulate } from './simulation/index.js';
export type { SimulationScenario, SimulationResult } from './simulation/index.js';

export {
  optimize,
  snowballStrategy,
  avalancheStrategy,
  defaultStrategies,
  customStrategy,
} from './optimization/index.js';
export type {
  OptimizationStrategy,
  OptimizationResult,
  DebtAccountView,
} from './optimization/index.js';

export { projectPaydown, projectMonthlyCashflow } from './cashflow/index.js';

export { validateDerivedState } from './validation/index.js';

export { analyzePortfolio, simulateScenario, recommend, forecast, explain } from './api.js';
export type {
  PortfolioInput,
  Analysis,
  Recommendation,
  Forecast,
  Explanation,
  RecommendConstraints,
} from './api.js';
