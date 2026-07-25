# Optimization Engine — Architecture

**Package:** `@fie/optimization-engine`  
**Status:** Scaffold for Business Financial OS

---

## 1. Role in the OS

This engine owns **multi-objective** search: liquidity runway, break-even margin, risk score, growth (ads), inventory, and debt cost — never debt-only.

Recommendations never debt-only — any ranking that ignores operating safety is invalid by design.

---

## 2. Independence rules

| Allowed                           | Forbidden             |
| --------------------------------- | --------------------- |
| `@fie/shared`, pure math / search | NestJS, React, Prisma |
| Pure functions                    | Mutating global state |
| Deterministic rankings            | Silent side effects   |

---

## 3. Module layout (planned)

```text
src/
  objectives/  # Objective definitions & weights
  search/      # Candidate generation & ranking
  constraints/ # Hard safety constraints (runway, BEP)
  shared/      # Types, versions
```
