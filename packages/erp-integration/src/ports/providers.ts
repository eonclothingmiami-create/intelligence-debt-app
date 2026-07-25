import type { ErpDomainEvent, ErpProviderId } from '../events/types.js';

/**
 * Incremental page from an ERP provider.
 * Never exposes SQL / internal ERP tables — only normalized DTOs mapped to events.
 */
export type ProviderPage<T> = {
  items: T[];
  /** Opaque cursor for the next page; null when exhausted. */
  nextCursor: string | null;
};

export type SyncQuery = {
  /** Resume after this cursor (exclusive). Empty/null = initial bootstrap. */
  sinceCursor: string | null;
  limit: number;
};

/** ---- Normalized DTOs (ERP-agnostic shapes before domain events) ---- */

export type SaleDto = {
  externalId: string;
  orderId: string;
  occurredAt: string;
  currency: string;
  cursor: string;
  channel?: string;
  sellerId?: string;
  customerId?: string;
  paymentMethod?: string;
  grossAmount: string;
  netAmount: string;
  costAmount?: string;
  utilityAmount?: string;
  taxAmount?: string;
  discountAmount?: string;
  itemCount: string;
  lines: Array<{
    productId?: string;
    productName?: string;
    quantity: string;
    unitPrice: string;
    unitCost?: string;
    discountAmount?: string;
    taxAmount?: string;
  }>;
  cancelled?: boolean;
  cancelReason?: string;
  refundAmount?: string;
};

export type PaymentDto = {
  externalId: string;
  paymentId: string;
  occurredAt: string;
  currency: string;
  cursor: string;
  orderId?: string;
  method?: string;
  amount: string;
};

export type ExpenseDto = {
  externalId: string;
  expenseId: string;
  occurredAt: string;
  currency: string;
  cursor: string;
  category: string;
  label: string;
  amount: string;
  kind?: string;
};

export type InventoryPurchaseDto = {
  externalId: string;
  purchaseId: string;
  occurredAt: string;
  currency: string;
  cursor: string;
  productId?: string;
  quantity: string;
  unitCost: string;
  totalCost: string;
};

export type InventoryAdjustmentDto = {
  externalId: string;
  adjustmentId: string;
  occurredAt: string;
  currency: string;
  cursor: string;
  productId?: string;
  quantityDelta: string;
  reason?: string;
};

/**
 * Ports — Financial OS depends on these interfaces only.
 * Ventas Hera / Siigo / Odoo each get an adapter implementing them.
 * Engines never import adapters.
 */
export interface SalesProvider {
  readonly providerId: ErpProviderId;
  listSales(query: SyncQuery): Promise<ProviderPage<SaleDto>>;
}

export interface PaymentProvider {
  readonly providerId: ErpProviderId;
  listPayments(query: SyncQuery): Promise<ProviderPage<PaymentDto>>;
}

export interface ExpenseProvider {
  readonly providerId: ErpProviderId;
  listExpenses(query: SyncQuery): Promise<ProviderPage<ExpenseDto>>;
}

export interface InventoryProvider {
  readonly providerId: ErpProviderId;
  listPurchases(query: SyncQuery): Promise<ProviderPage<InventoryPurchaseDto>>;
  listAdjustments(query: SyncQuery): Promise<ProviderPage<InventoryAdjustmentDto>>;
}

export interface CustomerProvider {
  readonly providerId: ErpProviderId;
  /** Optional enrichment — OS may ignore if not needed for engines. */
  getCustomer?(externalCustomerId: string): Promise<{ id: string; name?: string } | null>;
}

/** Push ingress: ERP publishes; OS maps webhook body → domain events. */
export interface ErpEventIngress {
  readonly providerId: ErpProviderId;
  /**
   * Accept a provider-specific webhook/payload and return 0..n domain events.
   * Must NOT write back to the ERP.
   */
  ingestPushPayload(raw: unknown): Promise<ErpDomainEvent[]>;
}
