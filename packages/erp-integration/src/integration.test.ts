import { describe, expect, it, beforeEach } from 'vitest';
import {
  InMemorySalesProvider,
  InMemorySyncCheckpointStore,
  VentasHeraPushIngress,
  mapSaleDtoToEvents,
  projectSalesFromEvents,
  projectSalesDashboard,
  resetEventIdSequenceForTests,
  syncSalesIncremental,
  InProcessEventBus,
  type SaleDto,
} from './index.js';

beforeEach(() => {
  resetEventIdSequenceForTests();
});

const sampleSale = (cursor: string, net: string): SaleDto => ({
  externalId: `ext-${cursor}`,
  orderId: `ord-${cursor}`,
  occurredAt: '2026-07-25T15:00:00.000Z',
  currency: 'COP',
  cursor,
  channel: 'tienda',
  grossAmount: net,
  netAmount: net,
  costAmount: '5000',
  utilityAmount: '5000',
  itemCount: '2',
  lines: [{ quantity: '2', unitPrice: '5000' }],
});

describe('mapSaleDtoToEvents', () => {
  it('maps active sale to SaleCreated', () => {
    const events = mapSaleDtoToEvents('ventas-hera', sampleSale('c1', '10000'));
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('SaleCreated');
    if (events[0]!.type === 'SaleCreated') {
      expect(events[0]!.payload.netAmount).toBe('10000');
    }
  });

  it('maps cancelled sale to SaleCancelled', () => {
    const events = mapSaleDtoToEvents('ventas-hera', {
      ...sampleSale('c2', '10000'),
      cancelled: true,
      cancelReason: 'cliente',
      refundAmount: '10000',
    });
    expect(events[0]!.type).toBe('SaleCancelled');
  });
});

describe('incremental sync', () => {
  it('bootstraps then only pulls new cursors', async () => {
    const provider = new InMemorySalesProvider([
      sampleSale('1', '10000'),
      sampleSale('2', '20000'),
      sampleSale('3', '30000'),
    ]);
    const store = new InMemorySyncCheckpointStore();

    const first = await syncSalesIncremental({ provider, store, limit: 2 });
    expect(first.events).toHaveLength(2);
    expect(first.hasMore).toBe(true);

    const second = await syncSalesIncremental({ provider, store, limit: 10 });
    expect(second.events).toHaveLength(1);
    if (second.events[0]!.type === 'SaleCreated') {
      expect(second.events[0]!.payload.netAmount).toBe('30000');
    }

    const third = await syncSalesIncremental({ provider, store, limit: 10 });
    expect(third.events).toHaveLength(0);
    expect(third.hasMore).toBe(false);
  });
});

describe('VentasHeraPushIngress', () => {
  it('turns immediate ERP webhook into SaleCreated', async () => {
    const ingress = new VentasHeraPushIngress();
    const events = await ingress.ingestPushPayload({
      type: 'sale.created',
      id: 'h-99',
      occurredAt: '2026-07-25T16:00:00.000Z',
      cursor: '99',
      currency: 'COP',
      data: {
        orderId: 'O-99',
        grossAmount: '50000',
        netAmount: '45000',
        itemCount: '3',
        lines: [{ quantity: '3', unitPrice: '15000' }],
      },
    });
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('SaleCreated');
  });
});

describe('projectSalesFromEvents + bus', () => {
  it('projects dashboard sales metrics without ERP coupling', async () => {
    const ingress = new VentasHeraPushIngress();
    const created = await ingress.ingestPushPayload({
      type: 'sale.created',
      id: '1',
      occurredAt: '2026-07-25T10:00:00.000Z',
      cursor: '1',
      data: { orderId: 'A', grossAmount: '20000', netAmount: '20000', itemCount: '1', lines: [] },
    });
    const paid = await ingress.ingestPushPayload({
      type: 'payment.received',
      id: '2',
      occurredAt: '2026-07-25T10:05:00.000Z',
      cursor: '2',
      data: { paymentId: 'P1', amount: '20000' },
    });

    const bus = new InProcessEventBus();
    const log: string[] = [];
    bus.on('*', (e) => {
      log.push(e.type);
    });
    await bus.publishAll([...created, ...paid]);

    const proj = projectSalesFromEvents([...created, ...paid]);
    expect(proj.salesCount).toBe(1);
    expect(proj.netSales).toBe('20000');
    expect(proj.paymentsReceived).toBe('20000');
    expect(proj.averageTicket).toBe('20000');
    expect(log).toEqual(['SaleCreated', 'PaymentReceived']);
  });

  it('projects day vs month windows', async () => {
    const ingress = new VentasHeraPushIngress();
    const day = await ingress.ingestPushPayload({
      type: 'sale.created',
      id: 'd1',
      occurredAt: '2026-07-25T10:00:00.000Z',
      cursor: 'd1',
      data: { orderId: 'D', grossAmount: '10000', netAmount: '10000', itemCount: '1', lines: [] },
    });
    const earlier = await ingress.ingestPushPayload({
      type: 'sale.created',
      id: 'm1',
      occurredAt: '2026-07-01T10:00:00.000Z',
      cursor: 'm1',
      data: { orderId: 'M', grossAmount: '5000', netAmount: '5000', itemCount: '1', lines: [] },
    });
    const snap = projectSalesDashboard([...earlier, ...day], '2026-07-25T12:00:00.000Z');
    expect(snap.day.netSales).toBe('10000');
    expect(snap.month.netSales).toBe('15000');
    expect(snap.accumulated.netSales).toBe('15000');
  });
});
