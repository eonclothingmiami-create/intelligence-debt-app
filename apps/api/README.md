# @fie/api

Ingress HTTP for **Ventas Hera → Financial OS**.

## Run

```bash
npx pnpm@9.15.9 --filter @fie/api dev
```

- Health: `GET http://localhost:4000/health`
- Webhook: `POST http://localhost:4000/integrations/hera/events`
- Sales board: `GET http://localhost:4000/v1/projections/sales`

Optional: `HERA_WEBHOOK_SECRET=...` + header `X-Hera-Webhook-Secret`.

## Hera config

Point Hera webhooks (sale created, payment, expense, cancel, inventory) to:

`POST {API_URL}/integrations/hera/events`

Body example:

```json
{
  "type": "sale.created",
  "id": "external-id",
  "occurredAt": "2026-07-25T18:00:00.000Z",
  "cursor": "opaque-cursor",
  "currency": "COP",
  "data": {
    "orderId": "O-1",
    "netAmount": "150000",
    "grossAmount": "150000",
    "itemCount": "2",
    "lines": []
  }
}
```

Never opens Hera DB. Never writes sales back to Hera.
