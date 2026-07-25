import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { OpenAIRecommendationProvider } from '@fie/recommendation-ai';
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

  /**
   * AI recommendation — OpenAI only via RecommendationProvider.
   * Body: { context: FinancialContext } (facts pre-computed by OS).
   */
  app.post('/v1/recommendations/generate', async (c) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return c.json(
        {
          error: 'OPENAI_API_KEY_MISSING',
          message: 'Set OPENAI_API_KEY in the API environment.',
        },
        503,
      );
    }
    const body = await c.req.json();
    if (!body?.context || typeof body.context !== 'object') {
      return c.json({ error: 'CONTEXT_REQUIRED' }, 400);
    }
    const provider = new OpenAIRecommendationProvider({
      apiKey,
      ...(process.env.OPENAI_MODEL ? { model: process.env.OPENAI_MODEL } : {}),
    });
    const recommendation = await provider.generate({ context: body.context });
    return c.json({ ok: true, provider: provider.name, recommendation });
  });

  return app;
}
