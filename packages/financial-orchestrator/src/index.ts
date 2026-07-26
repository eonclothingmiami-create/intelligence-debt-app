export const ENGINE_NAME = 'financial-orchestrator' as const;

export type {
  BoardCashInput,
  BoardPolicyInput,
  BoardNearTermLines,
  BoardInput,
  CapacitySnapshot,
  BoardValidation,
  BoardSnapshot,
} from './types.js';

export { validateBoardInputs } from './validate.js';
export {
  deriveCapacity,
  remainingCalendarDaysInMonth,
  recompraEarmark,
  cashAfterRecompra,
} from './capacity.js';
export { runBoard } from './runBoard.js';
