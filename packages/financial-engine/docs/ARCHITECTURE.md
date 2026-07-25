# Architecture — Financial Core

**Package:** `@fie/financial-engine`  
**Audience:** engineers implementing or extending the financial domain  
**Status:** Phase 1 — binding design

---

## 1. Purpose

This package is the **Financial Core**: a pure, offline, framework-agnostic library that calculates interest, reconstructs balances from events, runs deterministic simulations, and produces optimizable recommendations.

Applications (Next.js, NestJS, Prisma, Supabase) **consume** this package. They never embed financial formulas.

---

## 2. Domain map

```text
Credit
  └── owns parameters (rate, currency, product type, billing cycle)
        │
        ├── Transaction          (intent / business fact entered by user or importer)
        │     └── emits DomainEvent(s)
        │
        ├── DomainEvent log      (append-only source of truth)
        │     └── fold → DerivedState
        │
        ├── Installment          (deferred purchase schedule lines — derived)
        ├── Interest             (accrual amounts — derived via Interest Engine)
        ├── Payment allocation   (how a payment was applied — events)
        ├── Statement            (billing-cycle snapshot — derived)
        │
        ├── Simulation           (replay + hypothetical events on a copy of the log)
        └── Recommendation       (explanation over simulation/optimization outputs)
```

### 2.1 Concept definitions

| Concept            | Kind               | Definition                                                                                     |
| ------------------ | ------------------ | ---------------------------------------------------------------------------------------------- |
| **Credit**         | Aggregate identity | A credit facility (card, loan, etc.). Holds configuration, not mutable balances.               |
| **Transaction**    | Command / fact     | User-facing or imported business fact (purchase, payment). Validated then converted to events. |
| **DomainEvent**    | Immutable fact     | Append-only record. Only events change derived state.                                          |
| **Installment**    | Derived            | One installment of a deferred purchase (`n` of `N`).                                           |
| **Interest**       | Derived            | Accrued amount for a period under a rate policy.                                               |
| **Payment**        | Process            | Applying funds emits allocation events; never mutates a stored balance field.                  |
| **Statement**      | Derived snapshot   | Closed billing cycle: balances, min payment, due date, interest charged.                       |
| **Simulation**     | Pure projection    | Deterministic what-if over an event log + scenario deltas.                                     |
| **Recommendation** | Explanation layer  | Chooses among simulation/optimization results; does **not** invent formulas.                   |

---

## 3. Module layout and dependency rules

```text
shared/          ← types, errors, brands (no money math)
   ↑
math/            ← Money, Decimal, rounding, currency
   ↑
interest/        ← rate conversions + accrual primitives
   ↑
core/            ← DomainEvent, EventLog, generic fold
   ↑
payments/        ← allocation order policies
credit-card/     ← revolving + deferred (product module)
amortization/    ← French / German / American schedules
   ↑
cashflow/ projections/ roi/
   ↑
simulation/
   ↑
optimization/    ← Strategy pattern
   ↑
validation/      ← invariants over state
   ↑
recommendation API (package root)
```

### Allowed dependencies

| Module                     | May import                                       |
| -------------------------- | ------------------------------------------------ |
| `math`                     | `shared`, `decimal.js`                           |
| `interest`                 | `math`, `shared`                                 |
| `core`                     | `math`, `shared`                                 |
| `payments`                 | `math`, `interest`, `core`, `shared`             |
| `credit-card`              | `math`, `interest`, `core`, `payments`, `shared` |
| `amortization`             | `math`, `interest`, `core`, `shared`             |
| `roi`                      | `math`, `shared`                                 |
| `cashflow` / `projections` | `math`, `core`, product modules                  |
| `simulation`               | all engines above                                |
| `optimization`             | `simulation`, strategies                         |
| Package public API         | `simulation`, `optimization`, product modules    |

### Forbidden

- Importing NestJS, React, Prisma, HTTP clients, filesystem, or clock randomness inside calculation paths.
- Product modules importing each other (credit-card ↛ amortization). Shared behavior goes to `core` / `interest` / `payments`.
- Storing “current balance” as authoritative state outside the event fold.

---

## 4. Event sourcing model (calculation)

1. Commands/transactions are validated.
2. They produce one or more **DomainEvents**.
3. Events are appended to an ordered **EventLog** (in-memory for the pure engine; persistence is an app concern).
4. `fold(events, initialConfig) → DerivedState` is a **pure** function.
5. Statements, dashboards, and simulations read **DerivedState** only.

```text
events[0..n] ──fold──► DerivedState ──► Statement / KPIs
                              │
                              └──► Simulation(scenario) ──► Recommendation
```

**Invariant:** deleting or rewriting past events is forbidden in production paths. Corrections are compensating events (`AdjustmentApplied`, `ReversalIssued`).

---

## 5. Money and rates

- All monetary values are `Money` (backed by `decimal.js`).
- Rates are `Rate` (Decimal fraction or percent with explicit unit — see Mathematical Spec).
- Native JavaScript `number` is banned on monetary calculation paths.

---

## 6. Product extensibility

New products (mortgage, leasing, factoring, inventory finance) are **new modules** under `src/` that:

1. Define product-specific events (or reuse shared ones).
2. Provide a `fold` reducer or contribute handlers to the registry.
3. Reuse `math`, `interest`, `payments`, `amortization` as needed.

They must **not** change:

- `Money` semantics
- Generic `EventLog` / fold contract
- Rate conversion formulas (unless versioned via ADR + formula version)

---

## 7. Public API surface (AI-ready)

The package root exposes:

| Method             | Role                                          |
| ------------------ | --------------------------------------------- |
| `analyzePortfolio` | Aggregate KPIs from folded states             |
| `simulate`         | Deterministic scenario runner                 |
| `recommend`        | Strategy + explanation                        |
| `forecast`         | Horizon projection                            |
| `explain`          | Human-readable rationale from a result object |

AI agents may call these methods only. AI must never compute interest or balances itself.

---

## 8. Testing architecture

- Unit tests next to modules (`*.test.ts`)
- Golden fixtures under `tests/golden/`
- Colombian credit-card extract fixtures under `tests/fixtures/colombia/`
- Coverage gate: ≥95% lines/statements on engine source

---

## 9. Versioning

- Package version follows Changesets / SemVer.
- **Formula version** (`formulaVersion` on results) increments when a mathematical rule changes, even if package SemVer is a patch — see ADR-0006.
