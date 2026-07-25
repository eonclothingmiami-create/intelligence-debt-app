import type { ErpDomainEvent } from '../events/types.js';

/**
 * Read-model projection for dashboards — derived ONLY from domain events.
 * Not an ERP replica. No sales mutation APIs.
 */
export type SalesProjection = {
  currency: string;
  salesCount: number;
  unitsSold: string;
  grossSales: string;
  netSales: string;
  totalCost: string;
  totalUtility: string;
  totalDiscounts: string;
  totalTaxes: string;
  averageTicket: string | null;
  cancelledCount: number;
  paymentsReceived: string;
  lastEventAt: string | null;
};

function d(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function money(n: number): string {
  return n.toFixed(0);
}

export function emptySalesProjection(currency = 'COP'): SalesProjection {
  return {
    currency,
    salesCount: 0,
    unitsSold: '0',
    grossSales: '0',
    netSales: '0',
    totalCost: '0',
    totalUtility: '0',
    totalDiscounts: '0',
    totalTaxes: '0',
    averageTicket: null,
    cancelledCount: 0,
    paymentsReceived: '0',
    lastEventAt: null,
  };
}

/**
 * Fold ERP domain events into a sales/cash summary for the OS dashboard.
 * Engines receive numbers from here (or from their own folds) — never from Hera tables.
 */
export function projectSalesFromEvents(
  events: readonly ErpDomainEvent[],
  currency = 'COP',
): SalesProjection {
  let state = emptySalesProjection(currency);
  let gross = 0;
  let net = 0;
  let cost = 0;
  let utility = 0;
  let discounts = 0;
  let taxes = 0;
  let units = 0;
  let payments = 0;
  let salesCount = 0;
  let cancelled = 0;
  let lastEventAt: string | null = null;

  for (const e of events) {
    lastEventAt = e.occurredAt;
    switch (e.type) {
      case 'SaleCreated': {
        salesCount += 1;
        gross += d(e.payload.grossAmount);
        net += d(e.payload.netAmount);
        cost += d(e.payload.costAmount ?? '0');
        utility += d(e.payload.utilityAmount ?? '0');
        discounts += d(e.payload.discountAmount ?? '0');
        taxes += d(e.payload.taxAmount ?? '0');
        units += d(e.payload.itemCount);
        break;
      }
      case 'SaleCancelled': {
        cancelled += 1;
        if (e.payload.refundAmount) {
          net -= d(e.payload.refundAmount);
          gross -= d(e.payload.refundAmount);
        }
        break;
      }
      case 'PaymentReceived': {
        payments += d(e.payload.amount);
        break;
      }
      default:
        break;
    }
  }

  state = {
    currency,
    salesCount,
    unitsSold: money(units),
    grossSales: money(gross),
    netSales: money(net),
    totalCost: money(cost),
    totalUtility: money(utility),
    totalDiscounts: money(discounts),
    totalTaxes: money(taxes),
    averageTicket: salesCount > 0 ? money(net / salesCount) : null,
    cancelledCount: cancelled,
    paymentsReceived: money(payments),
    lastEventAt,
  };
  return state;
}

export type SalesDashboardSnapshot = {
  asOf: string;
  day: SalesProjection;
  month: SalesProjection;
  accumulated: SalesProjection;
};

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

/**
 * Day / month / all-time sales windows for the OS dashboard.
 * `asOf` is an ISO timestamp; windows use calendar UTC date of each event.
 */
export function projectSalesDashboard(
  events: readonly ErpDomainEvent[],
  asOfIso: string = new Date().toISOString(),
  currency = 'COP',
): SalesDashboardSnapshot {
  const today = dayKey(asOfIso);
  const month = monthKey(asOfIso);
  const dayEvents = events.filter((e) => dayKey(e.occurredAt) === today);
  const monthEvents = events.filter((e) => monthKey(e.occurredAt) === month);
  return {
    asOf: asOfIso,
    day: projectSalesFromEvents(dayEvents, currency),
    month: projectSalesFromEvents(monthEvents, currency),
    accumulated: projectSalesFromEvents(events, currency),
  };
}

export type DomainEventHandler = (event: ErpDomainEvent) => void | Promise<void>;

/** Simple in-process bus — swap for queue later without touching engines. */
export class InProcessEventBus {
  private readonly handlers = new Map<string, Set<DomainEventHandler>>();
  private readonly anyHandlers = new Set<DomainEventHandler>();

  on(type: ErpDomainEvent['type'] | '*', handler: DomainEventHandler): () => void {
    if (type === '*') {
      this.anyHandlers.add(handler);
      return () => this.anyHandlers.delete(handler);
    }
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler);
    return () => set!.delete(handler);
  }

  async publish(event: ErpDomainEvent): Promise<void> {
    const typed = this.handlers.get(event.type);
    const list = [...(typed ?? []), ...this.anyHandlers];
    for (const h of list) {
      await h(event);
    }
  }

  async publishAll(events: readonly ErpDomainEvent[]): Promise<void> {
    for (const e of events) {
      await this.publish(e);
    }
  }
}
