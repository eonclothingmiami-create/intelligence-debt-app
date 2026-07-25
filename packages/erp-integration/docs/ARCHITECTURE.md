# ERP Integration — Architecture

**Package:** `@fie/erp-integration`  
**Role:** Boundary between **Ventas Hera ERP** (Source of Truth) and **Business Financial OS**.

---

## 1. Non‑negotiables

| Rule                                   | Meaning                                              |
| -------------------------------------- | ---------------------------------------------------- |
| Hera = SoT                             | Sales, payments, inventory, expenses live in the ERP |
| OS never mutates ERP sales             | Read/consume only                                    |
| No ERP table access                    | No shared DB, no Prisma models of Hera, no SQL       |
| No Excel / manual sync as primary path | APIs + domain events                                 |
| Engines see domain events only         | Never Hera DTOs                                      |

```text
Ventas Hera ERP
      │  API (pull)  +  webhooks/events (push)
      ▼
@fie/erp-integration   ← ports + mapping + checkpoints
      │  ErpDomainEvent
      ▼
Financial engines / dashboard projections
```

---

## 2. Ports (ERP‑agnostic)

```ts
SalesProvider;
PaymentProvider;
ExpenseProvider;
InventoryProvider;
CustomerProvider;
ErpEventIngress; // push
```

Adapters:

- `adapters/hera/*` — Ventas Hera HTTP + push ingress
- Future: Siigo, Odoo, Alegra — new adapters, **same ports**

Financial engines **must not** import `adapters/hera`.

---

## 3. Domain events

| ERP fact                 | Domain event         |
| ------------------------ | -------------------- |
| Venta                    | `SaleCreated`        |
| Pago                     | `PaymentReceived`    |
| Cancelación / devolución | `SaleCancelled`      |
| Gasto                    | `ExpenseCreated`     |
| Compra inventario        | `InventoryPurchased` |
| Ajuste inventario        | `InventoryAdjusted`  |

---

## 4. Sync strategy

1. **Push (preferred):** Hera publishes immediately → `VentasHeraPushIngress` → event bus → engines recalculate in seconds.
2. **Pull (bootstrap + catch‑up):** `sync*Incremental` + `SyncCheckpointStore` cursor — only new changes, never full recompute of ERP.

Checkpoints are stored **in the Financial OS**, not in Hera.

---

## 5. What this module does NOT do

- Break-even / liquidity / debt math → `@fie/*-engine`
- Persist a second sales ledger as SoT
- Bidirectional sync that writes orders back to Hera

---

## 6. Next wiring steps (app layer)

1. `apps/api` webhook `POST /integrations/hera/events` → `VentasHeraPushIngress` → bus
2. Subscribe bus → update `projectedSales` / cash inputs → `computeBreakEven` / `computeLiquidity` / `recommendBusinessAction`
3. Configure Hera to POST on sale/payment/expense/return/inventory
