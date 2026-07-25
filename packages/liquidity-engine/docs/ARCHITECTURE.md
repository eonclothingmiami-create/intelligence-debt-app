# Liquidity Engine — Architecture

**Package:** `@fie/liquidity-engine`  
**Status:** Minimal binding for Business Financial OS

---

## 1. Role in the OS

This engine owns **runway, free cash, and safe extra debt capacity** so debt acceleration never starves operations.

Recommendations never debt-only — max-safe payment is a hard input to recommendation-engine.

---

## 2. Core formula (v0)

```text
runwayMonths = cash / monthlyFixedBurn   (if burn > 0)
reserve      = monthlyFixedBurn × reserveMonths   (default 3)
maxSafeExtraDebtPayment = max(0, freeCash − reserve)
canAffordExtraPayment   = proposedExtraDebtPayment ≤ maxSafe
```

---

## 3. Independence rules

| Allowed                                                                  | Forbidden             |
| ------------------------------------------------------------------------ | --------------------- |
| `@fie/shared`, `@fie/financial-engine` (Money), `@fie/break-even-engine` | NestJS, React, Prisma |
| Pure functions                                                           | Mutating global state |
| Deterministic snapshots                                                  | Silent side effects   |
