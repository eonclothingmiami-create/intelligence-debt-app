export type { DomainEvent, DomainEventType, EventLog, CreditOpenedPayload } from './events.js';
export {
  sortEventLog,
  baseEventFields,
  createEventId,
  resetEventIdCounterForTests,
} from './events.js';
export { foldEvents, applyEvent, initialDerivedState, totalPrincipal, totalDue } from './fold.js';
export type { DerivedState, CreditConfig, InstallmentLine, StatementSnapshot } from './fold.js';
