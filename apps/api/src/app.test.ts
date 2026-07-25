import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { OsEventStore } from './store.js';

describe('Hera webhook API', () => {
  it('accepts sale.created and updates day/month projections', async () => {
    const store = new OsEventStore();
    const now = '2026-07-25T18:00:00.000Z';
    const result = await store.ingestHeraPayload({
      type: 'sale.created',
      id: 'h-1',
      occurredAt: now,
      cursor: '1',
      currency: 'COP',
      data: {
        orderId: 'O-1',
        grossAmount: '150000',
        netAmount: '150000',
        itemCount: '3',
        lines: [],
      },
    });
    expect(result.accepted).toBe(1);
    const dash = store.dashboard(now);
    expect(dash.day.netSales).toBe('150000');
    expect(dash.month.netSales).toBe('150000');
    expect(dash.accumulated.salesCount).toBe(1);
  });

  it('rejects bad secret when configured', async () => {
    const app = createApp({ webhookSecret: 'secreto', store: new OsEventStore() });
    const res = await app.request('/integrations/hera/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Hera-Webhook-Secret': 'wrong' },
      body: JSON.stringify({
        type: 'sale.created',
        id: 'x',
        occurredAt: '2026-07-25T00:00:00.000Z',
        cursor: '1',
        data: {},
      }),
    });
    expect(res.status).toBe(401);
  });

  it('exposes projections endpoint', async () => {
    const store = new OsEventStore();
    const app = createApp({ store });
    const post = await app.request('/integrations/hera/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'payment.received',
        id: 'p1',
        occurredAt: '2026-07-25T12:00:00.000Z',
        cursor: '2',
        data: { paymentId: 'P1', amount: '50000' },
      }),
    });
    expect(post.status).toBe(200);
    const get = await app.request('/v1/projections/sales');
    const body = (await get.json()) as { accumulated: { paymentsReceived: string } };
    expect(body.accumulated.paymentsReceived).toBe('50000');
  });
});
