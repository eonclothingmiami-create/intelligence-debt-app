# Recommendation Engine — Architecture

**Package:** `@fie/recommendation-engine`  
**Canon:** [docs/PRODUCT_VISION.md](../../../docs/PRODUCT_VISION.md)

---

## 1. Role

Compose **holistic** advice for the CFO digital: liquidity, break-even, debt capacity, marketing plan-vs-actual, and (increasingly) cash allocation alternatives.

Recommendations are **not** debt-only. Operation survival > aggressive payoff.

---

## 2. Contract (non‑negotiable)

Every `RecommendBusinessActionResult` must include:

| Field                       | Meaning                                               |
| --------------------------- | ----------------------------------------------------- |
| `action`                    | Machine id of the advice                              |
| `rationale`                 | Human bullets: **why**, with real figures             |
| `valid`                     | `false` if action would harm operations               |
| `suggestedExtraDebtPayment` | Concrete amount when relevant                         |
| `expectedImpact`            | Quantified effects (interest, liquidity, BEP context) |

Forbidden: a one-liner “pague esta deuda” without justification and impact.

---

## 3. Hard refusal (v0+)

```text
refuse if safetyMargin < 0
refuse if suggested/proposed payment > adjustedMaxSafe (liquidity + ads variance)
refuse if action would breach user reserve / min liquidity policy
```

When refusing, still explain with numbers (runway, BEP, ads overspend, etc.).

---

## 4. Capital allocation (roadmap)

Compare destinations for free cash: debt vs inventory vs ads vs reserve vs hold.  
Only recommend debt acceleration when it wins **under** the multi-objective balance in PRODUCT_VISION.

---

## 5. Independence

| Allowed                                                          | Forbidden                            |
| ---------------------------------------------------------------- | ------------------------------------ |
| `@fie/shared`, `@fie/financial-engine`, `@fie/break-even-engine` | NestJS, React, Prisma, ERP adapters  |
| Pure functions                                                   | Mutating global state / calling Hera |
