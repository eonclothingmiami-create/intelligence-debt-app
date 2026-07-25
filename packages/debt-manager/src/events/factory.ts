import type { DebtEventLog, DebtLifecycleEvent, DebtEventType, ObligationOpened } from './types.js';

let seq = 0;

export function createDebtEventId(prefix = 'debt'): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${seq.toString(36)}`;
}

export function resetDebtEventIdSequenceForTests(): void {
  seq = 0;
}

export function nextSequence(log: DebtEventLog): number {
  if (log.length === 0) return 1;
  return Math.max(...log.map((e) => e.sequence)) + 1;
}

function base(
  obligationId: string,
  type: DebtEventType,
  occurredOn: string,
  sequence: number,
  notes?: string,
): Pick<DebtLifecycleEvent, 'eventId' | 'type' | 'obligationId' | 'occurredOn' | 'sequence'> & {
  notes?: string;
} {
  return {
    eventId: createDebtEventId(type),
    type,
    obligationId,
    occurredOn,
    sequence,
    ...(notes !== undefined ? { notes } : {}),
  };
}

export function openObligation(input: {
  obligationId: string;
  occurredOn: string;
  sequence: number;
  openingPrincipal: string;
  currency: string;
  notes?: string;
}): ObligationOpened {
  return {
    ...base(input.obligationId, 'ObligationOpened', input.occurredOn, input.sequence, input.notes),
    type: 'ObligationOpened',
    payload: {
      openingPrincipal: input.openingPrincipal,
      currency: input.currency,
    },
  };
}

export function appendEvent<E extends DebtLifecycleEvent>(
  log: DebtEventLog,
  event: E,
): DebtEventLog {
  return [...log, event].sort((a, b) => a.sequence - b.sequence);
}
