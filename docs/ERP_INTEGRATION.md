# ERP ↔ Financial OS

Ventas Hera remains the **only Source of Truth** for sales and related operational facts.

The Business Financial OS is a **client** of the ERP:

- Consumes via **API (incremental pull)** and **push events/webhooks**
- Never reads ERP tables
- Never modifies ERP sales
- Transforms facts into **domain events** inside `@fie/erp-integration`
- Engines (`break-even`, `liquidity`, `cashflow`, `recommendation`, …) only see those events / OS projections

## Runtime

| Piece          | Path                                                                           |
| -------------- | ------------------------------------------------------------------------------ |
| Ports / events | [`packages/erp-integration`](../packages/erp-integration/docs/ARCHITECTURE.md) |
| HTTP ingress   | [`apps/api`](../apps/api/README.md) — `POST /integrations/hera/events`         |
| Dashboard      | [`apps/web`](../apps/web) tab **Ventas ERP**                                   |

```bash
npx pnpm@9.15.9 --filter @fie/api dev   # :4000
npx pnpm@9.15.9 --filter @fie/web dev   # :3000
```
