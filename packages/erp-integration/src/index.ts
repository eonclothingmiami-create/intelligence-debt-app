export type {
  ErpProviderId,
  DomainEventBase,
  SaleLine,
  SaleCreated,
  SaleCancelled,
  PaymentReceived,
  ExpenseCreated,
  InventoryPurchased,
  InventoryAdjusted,
  ErpDomainEvent,
  ErpDomainEventType,
} from './events/types.js';

export {
  createEventId,
  resetEventIdSequenceForTests,
  saleCreated,
  saleCancelled,
  paymentReceived,
  expenseCreated,
  inventoryPurchased,
  inventoryAdjusted,
} from './events/factory.js';

export type {
  ProviderPage,
  SyncQuery,
  SaleDto,
  PaymentDto,
  ExpenseDto,
  InventoryPurchaseDto,
  InventoryAdjustmentDto,
  SalesProvider,
  PaymentProvider,
  ExpenseProvider,
  InventoryProvider,
  CustomerProvider,
  ErpEventIngress,
} from './ports/providers.js';

export type { SyncCheckpoint, SyncStream, SyncCheckpointStore } from './sync/checkpoint.js';
export { InMemorySyncCheckpointStore } from './sync/checkpoint.js';

export {
  syncSalesIncremental,
  syncPaymentsIncremental,
  syncExpensesIncremental,
  syncInventoryIncremental,
} from './sync/incremental.js';
export type { IncrementalSyncResult } from './sync/incremental.js';

export {
  mapSaleDtoToEvents,
  mapPaymentDtoToEvent,
  mapExpenseDtoToEvent,
  mapInventoryPurchaseDtoToEvent,
  mapInventoryAdjustmentDtoToEvent,
} from './mapping/dtoToEvents.js';

export type {
  SalesProjection,
  SalesDashboardSnapshot,
  DomainEventHandler,
} from './pipeline/projection.js';
export {
  emptySalesProjection,
  projectSalesFromEvents,
  projectSalesDashboard,
  InProcessEventBus,
} from './pipeline/projection.js';

export { HERAS_PROVIDER_ID, VentasHeraPushIngress } from './adapters/hera/pushIngress.js';
export type { VentasHeraClientConfig } from './adapters/hera/apiProviders.js';
export {
  VentasHeraSalesProvider,
  VentasHeraPaymentProvider,
  VentasHeraExpenseProvider,
  VentasHeraInventoryProvider,
} from './adapters/hera/apiProviders.js';
export { InMemorySalesProvider } from './adapters/memory/inMemorySales.js';
