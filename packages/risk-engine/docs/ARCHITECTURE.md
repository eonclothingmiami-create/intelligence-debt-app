# Risk Engine — Architecture

**Package:** `@fie/risk-engine`  
**Status:** Minimal binding for Business Financial OS

---

## 1. Role in the OS

This engine owns the **Business Risk Score**: a weighted composite that is never debt-only. Debt coverage is one input (15%), not the whole story.

Recommendations never debt-only — risk output must reflect liquidity, break-even, margin, ads, inventory, and cash as well.

---

## 2. Weights (v0)

```text
liquidity 25% | break-even 20% | debt coverage 15% | margin 15%
ads 10% | inventory 10% | cash 5%
```

Score ∈ [0, 100]. Risk level: `low` (≥70), `medium` (≥40), `high` (<40).

---

## 3. Independence rules

| Allowed                                                          | Forbidden             |
| ---------------------------------------------------------------- | --------------------- |
| `@fie/shared`, `@fie/financial-engine`, `@fie/break-even-engine` | NestJS, React, Prisma |
| Pure functions                                                   | Mutating global state |
| Deterministic scores                                             | Silent side effects   |
