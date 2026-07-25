import type { ErpDomainEvent } from '../events/types.js';
import {
  mapExpenseDtoToEvent,
  mapInventoryAdjustmentDtoToEvent,
  mapInventoryPurchaseDtoToEvent,
  mapPaymentDtoToEvent,
  mapSaleDtoToEvents,
} from '../mapping/dtoToEvents.js';
import type {
  ExpenseProvider,
  InventoryProvider,
  PaymentProvider,
  SalesProvider,
} from '../ports/providers.js';
import type { SyncCheckpointStore, SyncStream } from '../sync/checkpoint.js';

export type IncrementalSyncResult = {
  events: ErpDomainEvent[];
  /** True when a stream still has pages (caller should continue). */
  hasMore: boolean;
};

async function advanceCursor(
  store: SyncCheckpointStore,
  providerId: string,
  stream: SyncStream,
  lastCursor: string | null,
): Promise<void> {
  if (lastCursor == null) return;
  await store.save({
    providerId,
    stream,
    cursor: lastCursor,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Pull-only incremental sync. Never recalculates the whole ERP.
 * Prefer ERP push (webhooks) for near-real-time; use this for bootstrap + catch-up.
 */
export async function syncSalesIncremental(input: {
  provider: SalesProvider;
  store: SyncCheckpointStore;
  limit?: number;
}): Promise<IncrementalSyncResult> {
  const limit = input.limit ?? 100;
  const cp = await input.store.get(input.provider.providerId, 'sales');
  const page = await input.provider.listSales({
    sinceCursor: cp?.cursor ?? null,
    limit,
  });
  const events = page.items.flatMap((dto) => mapSaleDtoToEvents(input.provider.providerId, dto));
  const last = page.items.length > 0 ? page.items[page.items.length - 1]!.cursor : null;
  await advanceCursor(input.store, input.provider.providerId, 'sales', last);
  return { events, hasMore: page.nextCursor != null };
}

export async function syncPaymentsIncremental(input: {
  provider: PaymentProvider;
  store: SyncCheckpointStore;
  limit?: number;
}): Promise<IncrementalSyncResult> {
  const limit = input.limit ?? 100;
  const cp = await input.store.get(input.provider.providerId, 'payments');
  const page = await input.provider.listPayments({
    sinceCursor: cp?.cursor ?? null,
    limit,
  });
  const events = page.items.map((dto) => mapPaymentDtoToEvent(input.provider.providerId, dto));
  const last = page.items.length > 0 ? page.items[page.items.length - 1]!.cursor : null;
  await advanceCursor(input.store, input.provider.providerId, 'payments', last);
  return { events, hasMore: page.nextCursor != null };
}

export async function syncExpensesIncremental(input: {
  provider: ExpenseProvider;
  store: SyncCheckpointStore;
  limit?: number;
}): Promise<IncrementalSyncResult> {
  const limit = input.limit ?? 100;
  const cp = await input.store.get(input.provider.providerId, 'expenses');
  const page = await input.provider.listExpenses({
    sinceCursor: cp?.cursor ?? null,
    limit,
  });
  const events = page.items.map((dto) => mapExpenseDtoToEvent(input.provider.providerId, dto));
  const last = page.items.length > 0 ? page.items[page.items.length - 1]!.cursor : null;
  await advanceCursor(input.store, input.provider.providerId, 'expenses', last);
  return { events, hasMore: page.nextCursor != null };
}

export async function syncInventoryIncremental(input: {
  provider: InventoryProvider;
  store: SyncCheckpointStore;
  limit?: number;
}): Promise<IncrementalSyncResult> {
  const limit = input.limit ?? 100;
  const providerId = input.provider.providerId;

  const purchaseCp = await input.store.get(providerId, 'inventory_purchases');
  const purchases = await input.provider.listPurchases({
    sinceCursor: purchaseCp?.cursor ?? null,
    limit,
  });
  const purchaseEvents = purchases.items.map((dto) =>
    mapInventoryPurchaseDtoToEvent(providerId, dto),
  );
  const lastPurchase =
    purchases.items.length > 0 ? purchases.items[purchases.items.length - 1]!.cursor : null;
  await advanceCursor(input.store, providerId, 'inventory_purchases', lastPurchase);

  const adjCp = await input.store.get(providerId, 'inventory_adjustments');
  const adjustments = await input.provider.listAdjustments({
    sinceCursor: adjCp?.cursor ?? null,
    limit,
  });
  const adjEvents = adjustments.items.map((dto) =>
    mapInventoryAdjustmentDtoToEvent(providerId, dto),
  );
  const lastAdj =
    adjustments.items.length > 0 ? adjustments.items[adjustments.items.length - 1]!.cursor : null;
  await advanceCursor(input.store, providerId, 'inventory_adjustments', lastAdj);

  return {
    events: [...purchaseEvents, ...adjEvents],
    hasMore: purchases.nextCursor != null || adjustments.nextCursor != null,
  };
}
