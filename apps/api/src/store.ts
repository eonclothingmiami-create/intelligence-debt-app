import {
  InProcessEventBus,
  VentasHeraPushIngress,
  projectSalesDashboard,
  type ErpDomainEvent,
  type SalesDashboardSnapshot,
} from '@fie/erp-integration';

/**
 * In-process event log for the Financial OS (NOT an ERP replica).
 * Append-only domain events from Hera ingress.
 */
export class OsEventStore {
  private readonly events: ErpDomainEvent[] = [];
  private readonly seenExternal = new Set<string>();
  readonly bus = new InProcessEventBus();
  readonly ingress = new VentasHeraPushIngress();

  getAll(): readonly ErpDomainEvent[] {
    return this.events;
  }

  dashboard(asOfIso?: string): SalesDashboardSnapshot {
    return projectSalesDashboard(this.events, asOfIso ?? new Date().toISOString(), 'COP');
  }

  /**
   * Ingest raw Hera webhook payload(s). Idempotent on providerId+externalId+type.
   */
  async ingestHeraPayload(
    raw: unknown,
  ): Promise<{ accepted: number; duplicates: number; events: ErpDomainEvent[] }> {
    const payloads = Array.isArray(raw) ? raw : [raw];
    const accepted: ErpDomainEvent[] = [];
    let duplicates = 0;

    for (const payload of payloads) {
      const mapped = await this.ingress.ingestPushPayload(payload);
      for (const event of mapped) {
        const key = `${event.providerId}:${event.type}:${event.externalId}`;
        if (this.seenExternal.has(key)) {
          duplicates += 1;
          continue;
        }
        this.seenExternal.add(key);
        this.events.push(event);
        accepted.push(event);
        await this.bus.publish(event);
      }
    }

    return { accepted: accepted.length, duplicates, events: accepted };
  }
}

export const osStore = new OsEventStore();
