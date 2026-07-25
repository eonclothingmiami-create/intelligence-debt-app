# Break-even Engine — Architecture

**Package:** `@fie/break-even-engine`  
**Status:** Binding for Business Financial OS

---

## 1. Role in the OS

This engine owns the **live break-even model** of the business:

- Editable variable costs (user-defined catalog)
- Editable fixed costs (including credit installments mapped as fixed)
- Products (cost, price, contribution margin)
- Target profit → required sales / units
- Period views: daily / weekly / monthly / annual
- Safety margin vs projected sales

It does **not** decide debt strategy alone. Consumers (recommendation-engine) must combine this output with liquidity, cash flow, and debt engines.

---

## 2. Domain map

```text
CostCatalog (variable + fixed line items)
ProductCatalog (unit economics)
TargetProfit (optional)
        │
        ▼
computeBreakEven(model) → BreakEvenSnapshot
        │
        ├── units / money (periodicity)
        ├── contribution margin
        ├── safety margin (given projected sales)
        └── required sales for target profit
```

---

## 3. Module layout

```text
src/
  math/          # Money/Decimal (independent copy; may later move to @fie/money)
  catalog/       # Line items, products, activation toggles
  compute/       # Break-even formulas
  periods/       # Daily/weekly/monthly/annual scaling
  simulate/      # What-if deltas on the model
  shared/        # Types, versions
```

---

## 4. Independence rules

| Allowed                     | Forbidden             |
| --------------------------- | --------------------- |
| `decimal.js`, `@fie/shared` | NestJS, React, Prisma |
| Pure functions              | Mutating global state |
| Deterministic snapshots     | Silent FX conversions |

---

## 5. Integration with credits

When a credit installment changes, the **app layer** updates the corresponding fixed-cost line (`kind: credit_installment`). This engine then recomputes BEP. It never imports `@fie/financial-engine` event logs directly (keeps packages independent). Bridging belongs in `recommendation-engine` / API.
