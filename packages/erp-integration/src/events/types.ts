/**
 * Canonical domain events produced by ERP integration.
 * Financial engines consume THESE — never ERP DTOs or tables.
 *
 * Money amounts are decimal strings (COP, etc.). Timestamps are ISO-8601 UTC.
 */

export type ErpProviderId = string; // e.g. "ventas-hera", "siigo", "odoo"

export type DomainEventBase = {
  eventId: string;
  type: string;
  occurredAt: string;
  /** External id in the source ERP (never an internal FIE id). */
  externalId: string;
  providerId: ErpProviderId;
  /** Monotonic cursor token from the provider for incremental sync. */
  cursor: string;
  currency: string;
};

export type SaleLine = {
  productId?: string;
  productName?: string;
  quantity: string;
  unitPrice: string;
  unitCost?: string;
  discountAmount?: string;
  taxAmount?: string;
};

export type SaleCreated = DomainEventBase & {
  type: 'SaleCreated';
  payload: {
    orderId: string;
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
    lines: SaleLine[];
  };
};

export type SaleCancelled = DomainEventBase & {
  type: 'SaleCancelled';
  payload: {
    orderId: string;
    reason?: string;
    refundAmount?: string;
  };
};

export type PaymentReceived = DomainEventBase & {
  type: 'PaymentReceived';
  payload: {
    paymentId: string;
    orderId?: string;
    method?: string;
    amount: string;
  };
};

export type ExpenseCreated = DomainEventBase & {
  type: 'ExpenseCreated';
  payload: {
    expenseId: string;
    category: string;
    label: string;
    amount: string;
    /** fixed | variable | marketing | other — caller-owned taxonomy */
    kind?: string;
  };
};

export type InventoryPurchased = DomainEventBase & {
  type: 'InventoryPurchased';
  payload: {
    purchaseId: string;
    productId?: string;
    quantity: string;
    unitCost: string;
    totalCost: string;
  };
};

export type InventoryAdjusted = DomainEventBase & {
  type: 'InventoryAdjusted';
  payload: {
    adjustmentId: string;
    productId?: string;
    quantityDelta: string;
    reason?: string;
  };
};

export type ErpDomainEvent =
  | SaleCreated
  | SaleCancelled
  | PaymentReceived
  | ExpenseCreated
  | InventoryPurchased
  | InventoryAdjusted;

export type ErpDomainEventType = ErpDomainEvent['type'];
