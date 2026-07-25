import {
  expenseCreated,
  inventoryAdjusted,
  inventoryPurchased,
  paymentReceived,
  saleCancelled,
  saleCreated,
} from '../events/factory.js';
import type { ErpDomainEvent, ErpProviderId } from '../events/types.js';
import type {
  ExpenseDto,
  InventoryAdjustmentDto,
  InventoryPurchaseDto,
  PaymentDto,
  SaleDto,
} from '../ports/providers.js';

function base(
  providerId: ErpProviderId,
  dto: { externalId: string; occurredAt: string; currency: string; cursor: string },
) {
  return {
    providerId,
    externalId: dto.externalId,
    occurredAt: dto.occurredAt,
    currency: dto.currency,
    cursor: dto.cursor,
  };
}

export function mapSaleDtoToEvents(providerId: ErpProviderId, dto: SaleDto): ErpDomainEvent[] {
  if (dto.cancelled) {
    const cancelled: ReturnType<typeof saleCancelled> = saleCancelled({
      ...base(providerId, dto),
      payload: {
        orderId: dto.orderId,
        ...(dto.cancelReason !== undefined ? { reason: dto.cancelReason } : {}),
        ...(dto.refundAmount !== undefined ? { refundAmount: dto.refundAmount } : {}),
      },
    });
    return [cancelled];
  }

  return [
    saleCreated({
      ...base(providerId, dto),
      payload: {
        orderId: dto.orderId,
        ...(dto.channel !== undefined ? { channel: dto.channel } : {}),
        ...(dto.sellerId !== undefined ? { sellerId: dto.sellerId } : {}),
        ...(dto.customerId !== undefined ? { customerId: dto.customerId } : {}),
        ...(dto.paymentMethod !== undefined ? { paymentMethod: dto.paymentMethod } : {}),
        grossAmount: dto.grossAmount,
        netAmount: dto.netAmount,
        ...(dto.costAmount !== undefined ? { costAmount: dto.costAmount } : {}),
        ...(dto.utilityAmount !== undefined ? { utilityAmount: dto.utilityAmount } : {}),
        ...(dto.taxAmount !== undefined ? { taxAmount: dto.taxAmount } : {}),
        ...(dto.discountAmount !== undefined ? { discountAmount: dto.discountAmount } : {}),
        itemCount: dto.itemCount,
        lines: dto.lines.map((l) => ({
          ...(l.productId !== undefined ? { productId: l.productId } : {}),
          ...(l.productName !== undefined ? { productName: l.productName } : {}),
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          ...(l.unitCost !== undefined ? { unitCost: l.unitCost } : {}),
          ...(l.discountAmount !== undefined ? { discountAmount: l.discountAmount } : {}),
          ...(l.taxAmount !== undefined ? { taxAmount: l.taxAmount } : {}),
        })),
      },
    }),
  ];
}

export function mapPaymentDtoToEvent(providerId: ErpProviderId, dto: PaymentDto): ErpDomainEvent {
  return paymentReceived({
    ...base(providerId, dto),
    payload: {
      paymentId: dto.paymentId,
      ...(dto.orderId !== undefined ? { orderId: dto.orderId } : {}),
      ...(dto.method !== undefined ? { method: dto.method } : {}),
      amount: dto.amount,
    },
  });
}

export function mapExpenseDtoToEvent(providerId: ErpProviderId, dto: ExpenseDto): ErpDomainEvent {
  return expenseCreated({
    ...base(providerId, dto),
    payload: {
      expenseId: dto.expenseId,
      category: dto.category,
      label: dto.label,
      amount: dto.amount,
      ...(dto.kind !== undefined ? { kind: dto.kind } : {}),
    },
  });
}

export function mapInventoryPurchaseDtoToEvent(
  providerId: ErpProviderId,
  dto: InventoryPurchaseDto,
): ErpDomainEvent {
  return inventoryPurchased({
    ...base(providerId, dto),
    payload: {
      purchaseId: dto.purchaseId,
      ...(dto.productId !== undefined ? { productId: dto.productId } : {}),
      quantity: dto.quantity,
      unitCost: dto.unitCost,
      totalCost: dto.totalCost,
    },
  });
}

export function mapInventoryAdjustmentDtoToEvent(
  providerId: ErpProviderId,
  dto: InventoryAdjustmentDto,
): ErpDomainEvent {
  return inventoryAdjusted({
    ...base(providerId, dto),
    payload: {
      adjustmentId: dto.adjustmentId,
      ...(dto.productId !== undefined ? { productId: dto.productId } : {}),
      quantityDelta: dto.quantityDelta,
      ...(dto.reason !== undefined ? { reason: dto.reason } : {}),
    },
  });
}
