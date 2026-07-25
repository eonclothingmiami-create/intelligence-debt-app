import { serve } from '@hono/node-server';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? '4000');
const app = createApp();

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`@fie/api listening on http://localhost:${info.port}`);
  console.log(`Hera webhook: POST http://localhost:${info.port}/integrations/hera/events`);
  console.log(`Sales board:  GET  http://localhost:${info.port}/v1/projections/sales`);
});
