import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { OsEventStore, osStore } from './store.js';

export function createApp(options?: { webhookSecret?: string; store?: OsEventStore }): Hono {
  const app = new Hono();
  const secret = options?.webhookSecret ?? process.env.HERA_WEBHOOK_SECRET;
  const store = options?.store ?? osStore;

  app.use(
    '*',
    cors({
      origin: (origin) => origin || '*',
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'X-Hera-Webhook-Secret', 'Authorization'],
    }),
  );

  app.get('/health', (c) => c.json({ ok: true, service: '@fie/api' }));

  app.post('/integrations/hera/events', async (c) => {
    if (secret) {
      const header =
        c.req.header('X-Hera-Webhook-Secret') ??
        c.req.header('Authorization')?.replace(/^Bearer\s+/i, '');
      if (header !== secret) {
        return c.json({ error: 'UNAUTHORIZED' }, 401);
      }
    }

    const body = await c.req.json();
    const result = await store.ingestHeraPayload(body);
    const dashboard = store.dashboard();

    return c.json({
      ok: true,
      accepted: result.accepted,
      duplicates: result.duplicates,
      eventTypes: result.events.map((e) => e.type),
      dashboard,
    });
  });

  app.get('/v1/projections/sales', (c) => {
    const asOf = c.req.query('asOf') ?? undefined;
    return c.json(store.dashboard(asOf));
  });

  app.get('/v1/events', (c) => {
    const limit = Math.min(Number(c.req.query('limit') ?? '50') || 50, 500);
    const all = store.getAll();
    return c.json({
      count: all.length,
      events: all.slice(-limit),
    });
  });

  return app;
}
