# Cashflow Engine — Architecture

**Package:** `@fie/cashflow-engine`  
**Status:** Partial — marketing plan-vs-actual live; full horizon projection TODO

---

## 1. Role in the OS

This engine owns **cash flow projections**: inflows, outflows, and financing effects over time. It feeds liquidity, simulation, and recommendation layers.

Recommendations never debt-only — cash projections must stay visible when weighing extra debt payments against operations.

---

## 2. Marketing: budget ≠ actual

| Concept         | Field                               | Used for                                       |
| --------------- | ----------------------------------- | ---------------------------------------------- |
| **Presupuesto** | `MarketingBudgetEntry.budgetAmount` | Plan, BEP planning scenarios, variance alerts  |
| **Gasto real**  | `MarketingActualEntry.actualAmount` | Cash outflows, debt (via linked purchase), ROI |

`compareMarketingPlanVsActual` / `compareMarketingPortfolio` alert when `|actual − budget| / budget` exceeds the user's `alertDeviationRate` (no hardcoded %).

Portfolio underspend (`freedCapacityAmount`) feeds the recommendation engine so a quieter ads month can raise the suggested extra debt payment automatically.

Debt evolution still requires pairing actual spend with a card/purchase event in `@fie/financial-engine` (`AdSpendActualRecorded` + `PurchaseCreated`).

---

## 3. Independence rules

| Allowed                                     | Forbidden             |
| ------------------------------------------- | --------------------- |
| `@fie/shared`, `@fie/financial-engine` math | NestJS, React, Prisma |
| Pure functions                              | Mutating global state |
| Deterministic projections                   | Silent side effects   |

---

## 4. Module layout

```text
src/
  marketing/   # planVsActual (live)
  project/     # Horizon projections (TODO)
  periods/     # Daily / weekly / monthly / annual (TODO)
```
