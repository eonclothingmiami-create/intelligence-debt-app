# Recommendation Engine — Architecture

**Package:** `@fie/recommendation-engine`  
**Status:** Minimal binding for Business Financial OS

---

## 1. Role in the OS

This engine owns **holistic recommendations**: break-even safety + liquidity runway + debt interest trade-offs.

Recommendations never debt-only. If a debt-acceleration heuristic would hurt operations (exceeds max-safe payment or negative safety margin), `valid` is `false` and the action is to hold.

---

## 2. Hard refusal rules (v0)

```text
refuse if proposedExtraDebtPayment > maxSafeExtraDebtPayment
refuse if safetyMargin < 0   (conceptually below break-even)
```

---

## 3. Independence rules

| Allowed                                                          | Forbidden             |
| ---------------------------------------------------------------- | --------------------- |
| `@fie/shared`, `@fie/financial-engine`, `@fie/break-even-engine` | NestJS, React, Prisma |
| Pure functions                                                   | Mutating global state |
| Deterministic advice                                             | Silent side effects   |
