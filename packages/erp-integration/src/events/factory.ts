import type {
  ExpenseCreated,
  InventoryAdjusted,
  InventoryPurchased,
  PaymentReceived,
  SaleCancelled,
  SaleCreated,
} from './types.js';

let seq = 0;

export function createEventId(prefix = 'erp'): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${seq.toString(36)}`;
}

/** Reset only in tests. */
export function resetEventIdSequenceForTests(): void {
  seq = 0;
}

export function saleCreated(
  partial: Omit<SaleCreated, 'type' | 'eventId'> & { eventId?: string },
): SaleCreated {
  return {
    type: 'SaleCreated',
    eventId: partial.eventId ?? createEventId('sale'),
    occurredAt: partial.occurredAt,
    externalId: partial.externalId,
    providerId: partial.providerId,
    cursor: partial.cursor,
    currency: partial.currency,
    payload: partial.payload,
  };
}

export function saleCancelled(
  partial: Omit<SaleCancelled, 'type' | 'eventId'> & { eventId?: string },
): SaleCancelled {
  return {
    type: 'SaleCancelled',
    eventId: partial.eventId ?? createEventId('sale_cancel'),
    occurredAt: partial.occurredAt,
    externalId: partial.externalId,
    providerId: partial.providerId,
    cursor: partial.cursor,
    currency: partial.currency,
    payload: partial.payload,
  };
}

export function paymentReceived(
  partial: Omit<PaymentReceived, 'type' | 'eventId'> & { eventId?: string },
): PaymentReceived {
  return {
    type: 'PaymentReceived',
    eventId: partial.eventId ?? createEventId('pay'),
    occurredAt: partial.occurredAt,
    externalId: partial.externalId,
    providerId: partial.providerId,
    cursor: partial.cursor,
    currency: partial.currency,
    payload: partial.payload,
  };
}

export function expenseCreated(
  partial: Omit<ExpenseCreated, 'type' | 'eventId'> & { eventId?: string },
): ExpenseCreated {
  return {
    type: 'ExpenseCreated',
    eventId: partial.eventId ?? createEventId('exp'),
    occurredAt: partial.occurredAt,
    externalId: partial.externalId,
    providerId: partial.providerId,
    cursor: partial.cursor,
    currency: partial.currency,
    payload: partial.payload,
  };
}

export function inventoryPurchased(
  partial: Omit<InventoryPurchased, 'type' | 'eventId'> & { eventId?: string },
): InventoryPurchased {
  return {
    type: 'InventoryPurchased',
    eventId: partial.eventId ?? createEventId('inv_buy'),
    occurredAt: partial.occurredAt,
    externalId: partial.externalId,
    providerId: partial.providerId,
    cursor: partial.cursor,
    currency: partial.currency,
    payload: partial.payload,
  };
}

export function inventoryAdjusted(
  partial: Omit<InventoryAdjusted, 'type' | 'eventId'> & { eventId?: string },
): InventoryAdjusted {
  return {
    type: 'InventoryAdjusted',
    eventId: partial.eventId ?? createEventId('inv_adj'),
    occurredAt: partial.occurredAt,
    externalId: partial.externalId,
    providerId: partial.providerId,
    cursor: partial.cursor,
    currency: partial.currency,
    payload: partial.payload,
  };
}
