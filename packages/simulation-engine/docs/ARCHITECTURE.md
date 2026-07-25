# Simulation Engine — Architecture

**Package:** `@fie/simulation-engine`  
**Status:** Scaffold for Business Financial OS

---

## 1. Role in the OS

This engine is the **what-if center**: apply coordinated patches, recompute dependent engines, and return comparable snapshots.

Recommendations never debt-only — simulations must surface break-even, liquidity, and operating impact alongside debt paydown.

---

## 2. Independence rules

| Allowed                                            | Forbidden             |
| -------------------------------------------------- | --------------------- |
| `@fie/shared`, pure orchestration of other engines | NestJS, React, Prisma |
| Pure functions                                     | Mutating global state |
| Deterministic scenario diffs                       | Silent side effects   |

---

## 3. Module layout (planned)

```text
src/
  scenarios/   # Scenario definitions & patches
  orchestrate/ # Cross-engine recompute
  compare/     # Diff / delta helpers
  shared/      # Types, versions
```
