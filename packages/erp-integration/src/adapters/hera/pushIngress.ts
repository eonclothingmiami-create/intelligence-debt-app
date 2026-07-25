import {
  expenseCreated,
  inventoryAdjusted,
  paymentReceived,
  saleCancelled,
  saleCreated,
} from '../../events/factory.js';
import type { ErpDomainEvent } from '../../events/types.js';
import type { ErpEventIngress } from '../../ports/providers.js';

/**
 * Ventas Hera push ingress — ERP calls Financial OS webhook immediately on:
 * sale created, payment, expense, return, inventory adjust.
 *
 * Payload contract is owned by the integration module (versioned).
 * Never writes back to Hera. Never opens Hera DB.
 */
export const HERAS_PROVIDER_ID = 'ventas-hera' as const;

type HeraPushEnvelope = {
  type: string;
  id: string;
  occurredAt: string;
  cursor: string;
  currency?: string;
  data: Record<string, unknown>;
};

function str(v: unknown, fallback = ''): string {
  if (v == null) return fallback;
  return String(v);
}

export class VentasHeraPushIngress implements ErpEventIngress {
  readonly providerId = HERAS_PROVIDER_ID;

  async ingestPushPayload(raw: unknown): Promise<ErpDomainEvent[]> {
    if (!raw || typeof raw !== 'object') return [];
    const env = raw as HeraPushEnvelope;
    const currency = str(env.currency, 'COP');
    const base = {
      providerId: this.providerId,
      externalId: str(env.id),
      occurredAt: str(env.occurredAt),
      cursor: str(env.cursor),
      currency,
    };
    const data = env.data ?? {};

    switch (env.type) {
      case 'sale.created':
        return [
          saleCreated({
            ...base,
            payload: {
              orderId: str(data.orderId, base.externalId),
              ...(data.channel != null ? { channel: str(data.channel) } : {}),
              ...(data.sellerId != null ? { sellerId: str(data.sellerId) } : {}),
              ...(data.customerId != null ? { customerId: str(data.customerId) } : {}),
              ...(data.paymentMethod != null ? { paymentMethod: str(data.paymentMethod) } : {}),
              grossAmount: str(data.grossAmount, '0'),
              netAmount: str(data.netAmount, '0'),
              ...(data.costAmount != null ? { costAmount: str(data.costAmount) } : {}),
              ...(data.utilityAmount != null ? { utilityAmount: str(data.utilityAmount) } : {}),
              ...(data.taxAmount != null ? { taxAmount: str(data.taxAmount) } : {}),
              ...(data.discountAmount != null ? { discountAmount: str(data.discountAmount) } : {}),
              itemCount: str(data.itemCount, '0'),
              lines: Array.isArray(data.lines)
                ? data.lines.map((line) => {
                    const l = line as Record<string, unknown>;
                    return {
                      ...(l.productId != null ? { productId: str(l.productId) } : {}),
                      ...(l.productName != null ? { productName: str(l.productName) } : {}),
                      quantity: str(l.quantity, '0'),
                      unitPrice: str(l.unitPrice, '0'),
                      ...(l.unitCost != null ? { unitCost: str(l.unitCost) } : {}),
                    };
                  })
                : [],
            },
          }),
        ];
      case 'sale.cancelled':
        return [
          saleCancelled({
            ...base,
            payload: {
              orderId: str(data.orderId, base.externalId),
              ...(data.reason != null ? { reason: str(data.reason) } : {}),
              ...(data.refundAmount != null ? { refundAmount: str(data.refundAmount) } : {}),
            },
          }),
        ];
      case 'payment.received':
        return [
          paymentReceived({
            ...base,
            payload: {
              paymentId: str(data.paymentId, base.externalId),
              ...(data.orderId != null ? { orderId: str(data.orderId) } : {}),
              ...(data.method != null ? { method: str(data.method) } : {}),
              amount: str(data.amount, '0'),
            },
          }),
        ];
      case 'expense.created':
        return [
          expenseCreated({
            ...base,
            payload: {
              expenseId: str(data.expenseId, base.externalId),
              category: str(data.category, 'General'),
              label: str(data.label, 'Gasto'),
              amount: str(data.amount, '0'),
              ...(data.kind != null ? { kind: str(data.kind) } : {}),
            },
          }),
        ];
      case 'inventory.adjusted':
        return [
          inventoryAdjusted({
            ...base,
            payload: {
              adjustmentId: str(data.adjustmentId, base.externalId),
              ...(data.productId != null ? { productId: str(data.productId) } : {}),
              quantityDelta: str(data.quantityDelta, '0'),
              ...(data.reason != null ? { reason: str(data.reason) } : {}),
            },
          }),
        ];
      default:
        return [];
    }
  }
}
