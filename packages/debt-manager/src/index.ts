export type {
  DebtKindId,
  RatePeriodicity,
  DebtObligation,
  DebtKindCatalogEntry,
} from './types/obligation.js';
export { SUGGESTED_DEBT_KIND_LABELS } from './types/obligation.js';

export type {
  DebtEventType,
  DebtEventBase,
  DebtLifecycleEvent,
  DebtEventLog,
  ObligationOpened,
  DisbursementRecorded,
  PurchaseCharged,
  OrdinaryPaymentApplied,
  ExtraPaymentApplied,
  InterestCharged,
  FeeCharged,
  CommissionCharged,
  RateChanged,
  TermChanged,
  Refinanced,
  ObligationClosed,
} from './events/types.js';

export {
  createDebtEventId,
  resetDebtEventIdSequenceForTests,
  nextSequence,
  openObligation,
  appendEvent,
} from './events/factory.js';

export type { DerivedDebtState } from './fold/derive.js';
export {
  initialDebtState,
  applyDebtEvent,
  foldDebtEvents,
  mergeObligationConfig,
} from './fold/derive.js';

export type { ObligationSnapshot, DebtPortfolioDashboard } from './portfolio/dashboard.js';
export { snapshotObligation, buildDebtPortfolioDashboard } from './portfolio/dashboard.js';

export type {
  DebtPaymentSimulationInput,
  DebtPaymentSimulationResult,
} from './simulator/paymentSlider.js';
export { simulateDebtPaymentChange } from './simulator/paymentSlider.js';

export type {
  DebtAttackCandidate,
  DebtOptimizeExtraCashInput,
  DebtOptimizeExtraCashResult,
} from './optimizer/rankExtraPayment.js';
export { rankDebtsForExtraPayment } from './optimizer/rankExtraPayment.js';
