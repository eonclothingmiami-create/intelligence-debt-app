# Architecture Decision Records

**Package:** `@fie/financial-engine`

---

## ADR-0001 — Event sourcing for balances

**Status:** Accepted  
**Date:** 2026-07-25

### Context

Mutating `balance -= payment` creates irreproducible state, hides allocation order, and breaks auditability.

### Decision

Balances and dues are **derived** by folding an append-only domain event log. Payments emit allocation events; they never assign balances.

### Consequences

- Full audit trail and deterministic replay
- Simulations = copy log + append hypothetical events  
  − Slightly more code than a mutable balance field  
  − Need compensating events for corrections

---

## ADR-0002 — Decimal.js for all money

**Status:** Accepted  
**Date:** 2026-07-25

### Context

IEEE-754 `number` cannot represent decimal currency exactly (e.g. `0.1 + 0.2`).

### Decision

Use `decimal.js` behind a `Money` value type. Ban `number` on monetary calculation paths. Serialize as strings.

### Consequences

- Exact decimal arithmetic
- Predictable rounding  
  − Slightly slower than float (acceptable)  
  − Must convert carefully at API boundaries

---

## ADR-0003 — Pure functions, no framework deps

**Status:** Accepted  
**Date:** 2026-07-25

### Context

The core must survive UI rewrites, NestJS upgrades, and offline use; it must be publishable as an npm package.

### Decision

`@fie/financial-engine` depends only on `decimal.js` and `@fie/shared`. No NestJS, React, Prisma, I/O.

### Consequences

- Testable in isolation
- Reusable from API, workers, CLI, AI tools  
  − Apps must adapt persistence/transport separately

---

## ADR-0004 — Strategy pattern for optimization

**Status:** Accepted  
**Date:** 2026-07-25

### Context

Debt payoff heuristics (Snowball, Avalanche, ROI-driven, etc.) must be interchangeable without rewriting simulation.

### Decision

`OptimizationStrategy` interface with pluggable strategies. Strategies only decide allocation of extra cash; **Interest Engine + fold** compute costs.

### Consequences

- Open/closed for new strategies
- No duplicated interest math  
  − Strategies need a clear shared context DTO

---

## ADR-0005 — Separate simulation vs optimization

**Status:** Accepted  
**Date:** 2026-07-25

### Context

“What if I pay 500,000 extra?” is a simulation. “Which strategy minimizes interest under cash-flow limits?” is optimization over many simulations.

### Decision

`simulation` runs one deterministic scenario. `optimization` generates scenarios, scores them, returns the best + explanation.

### Consequences

- Clear API for AI (`simulate` vs `recommend`)  
  − Optimization cost grows with scenario count (later: workers)

---

## ADR-0006 — Formula versioning

**Status:** Accepted  
**Date:** 2026-07-25

### Context

Changing an interest rule can change customer-facing numbers without a “feature” SemVer bump intent.

### Decision

Every result carries `formulaVersion` (e.g. `1.0.0`). Golden tests pin it. Mathematical Spec and Assumption set versions move with it. ADR required for breaking formula changes.

### Consequences

- Reproducibility across years
- Explicit migrations for cached read models

---

## ADR-0007 — Package name `@fie/financial-engine`

**Status:** Accepted  
**Date:** 2026-07-25

### Context

Need a stable npm name for the core.

### Decision

Scope `fie` = Financial Intelligence Engine. Package `@fie/financial-engine`. Related: `@fie/shared`.

### Consequences

- Clear branding inside monorepo  
  − Private/restricted publish until SaaS

---

## ADR-0008 — COP half-up, 0 decimal places

**Status:** Accepted  
**Date:** 2026-07-25

### Context

Colombian peso circulates without centavos in retail/card settlement for this product’s primary market.

### Decision

Default Money scale for COP = 0, rounding mode half-up. Credits may override.

### Consequences

- Matches common COP presentation  
  − Must still use Decimal internally before round

---

## ADR-0009 — Credit card module before general amortization implementation priority

**Status:** Accepted  
**Date:** 2026-07-25

### Context

Primary business case is revolving card + ads financing.

### Decision

Implement Money → Interest → Credit Card (+ ROI) before coding amortization schedules, while documenting French/German/American in the Math Spec first.

### Consequences

- Faster value on critical path  
  − Amortization code follows immediately after in Phase 1b order

---

## ADR-0010 — Recommendation layer does not calculate interest

**Status:** Accepted  
**Date:** 2026-07-25

### Context

AI and UX need explanations without forking math.

### Decision

`recommend` / `explain` only compose outputs of simulation and optimization. No parallel formulas.

### Consequences

- Single source of mathematical truth  
  − Explanation quality depends on rich result metadata
