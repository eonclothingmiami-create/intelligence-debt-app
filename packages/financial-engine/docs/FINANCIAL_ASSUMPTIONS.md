# Financial Assumptions

**Package:** `@fie/financial-engine`  
**Assumption set version:** `1.0.0`

These rules bind the engine. Changing one requires an ADR, formula/assumption version bump, and golden-test updates.

---

## A-CORE — Source of truth

| ID       | Rule                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------- |
| A-CORE-1 | The append-only **event log** is the only source of truth for financial history.                  |
| A-CORE-2 | **Balances are never assigned** (`balance = x` or `balance -= pay` are forbidden).                |
| A-CORE-3 | Balances, dues, and KPIs are always **derived** by pure `fold(events, config)`.                   |
| A-CORE-4 | Corrections use **compensating events**, never silent mutation of past events.                    |
| A-CORE-5 | Persistence of a “cached balance” in a database (future apps) is a **read model**, not authority. |

---

## A-MONEY — Precision

| ID        | Rule                                                                                                                                            |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| A-MONEY-1 | All money uses `decimal.js` via `Money`. Native `number` is forbidden on money paths.                                                           |
| A-MONEY-2 | Default internal precision: 20 significant digits (Decimal).                                                                                    |
| A-MONEY-3 | Default rounding for COP settlement: **half-up** to **0** decimal places.                                                                       |
| A-MONEY-4 | USD/EUR settlement: half-up to **2** decimal places unless Credit overrides.                                                                    |
| A-MONEY-5 | Intermediate rate math may use full precision; money results round at published boundaries (per period interest, installment, allocation line). |
| A-MONEY-6 | Currency mismatch throws; no silent FX.                                                                                                         |

---

## A-RATE — Rates and day count

| ID       | Rule                                                                             |
| -------- | -------------------------------------------------------------------------------- |
| A-RATE-1 | Rates stored as Decimal fractions (0.36 = 36%) with explicit `RateUnit`.         |
| A-RATE-2 | Default day-count for revolving accrual: **actual/365** effective daily from EA. |
| A-RATE-3 | Alternative conventions (`nominal365`, `actual360`) are opt-in per Credit.       |
| A-RATE-4 | Variable/indexed rates apply via `RateChanged` events with effective date.       |

---

## A-CC — Credit cards

| ID     | Rule                                                                                                                                                                       |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-CC-1 | Revolving principal and deferred installment principal are tracked **separately** in derived state.                                                                        |
| A-CC-2 | Purchase with `installments = 1` (or omitted) → revolving.                                                                                                                 |
| A-CC-3 | Purchase with `installments > 1` → generates installment schedule; full amount not added to revolving principal.                                                           |
| A-CC-4 | Grace: if `graceEnabled` and previous statement paid in full by due date, new revolving purchases in current cycle accrue 0 interest until statement close (configurable). |
| A-CC-5 | Default deferred interest mode: `revolving` residual after installment capital — document per Credit.                                                                      |
| A-CC-6 | Statement close emits interest accrual event(s) then `StatementClosed`.                                                                                                    |
| A-CC-7 | Minimum payment computed at statement close per Mathematical Spec §4.                                                                                                      |

---

## A-PAY — Payments

| ID      | Rule                                                                                                                                      |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| A-PAY-1 | Payments never set balances; they emit `PaymentReceived` + allocation events.                                                             |
| A-PAY-2 | Default allocation order: **LateFee → Interest → Insurance → Commission → RevolvingPrincipal → InstallmentPrincipal (FIFO by due date)**. |
| A-PAY-3 | Payment **below** minimum: allowed; flags `belowMinimum` on statement/derived state; may trigger late path after due date.                |
| A-PAY-4 | Payment **equal** to minimum: clears required dues components per allocation until amount exhausted.                                      |
| A-PAY-5 | Payment **above** minimum / dues: remainder is `ExtraPaymentApplied` per `extraPaymentTarget`.                                            |
| A-PAY-6 | Partial payments allocate in order until amount is zero.                                                                                  |

---

## A-TIME — Calendar

| ID       | Rule                                                                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A-TIME-1 | Engine uses explicit ISO dates (`YYYY-MM-DD`) passed in; no `new Date()` for business logic defaults inside pure functions (clock injected by caller). |
| A-TIME-2 | Billing cycle defined by `statementDay` / `cutOffDate` and `paymentDueDay` on Credit.                                                                  |
| A-TIME-3 | Paying **before** cut-off vs **after** cut-off changes which statement the payment applies to — determined by event `occurredOn` vs cycle bounds.      |

---

## A-SIM — Simulation

| ID      | Rule                                                                              |
| ------- | --------------------------------------------------------------------------------- |
| A-SIM-1 | Simulations copy the event log; they never mutate the original log object.        |
| A-SIM-2 | Same inputs → same outputs (determinism).                                         |
| A-SIM-3 | Hypothetical future events are tagged `hypothetical: true` in simulation results. |

---

## A-OPT — Optimization

| ID      | Rule                                                                                                                  |
| ------- | --------------------------------------------------------------------------------------------------------------------- |
| A-OPT-1 | Strategies only reorder/allocate **extra** payment capacity; they call simulation — they do not reimplement interest. |
| A-OPT-2 | Objective scores are explicit: total interest, time-to-debt-free, cash-flow stress, ROI spread.                       |
| A-OPT-3 | “Optimal” means best score under stated constraints; engine always returns hypotheses used.                           |

---

## A-ROI — Advertising finance

| ID      | Rule                                                                         |
| ------- | ---------------------------------------------------------------------------- |
| A-ROI-1 | Ad revenue/ROI inputs are **external**; engine computes financing cost only. |
| A-ROI-2 | Comparing ROI to financing cost uses Mathematical Spec §6.                   |

---

## A-VAL — Validation

| ID      | Rule                                                                                                                                 |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| A-VAL-1 | Negative payment/purchase amounts rejected.                                                                                          |
| A-VAL-2 | Events must be folded in non-decreasing `occurredOn` order (stable sort by sequence).                                                |
| A-VAL-3 | Invariants after fold: non-negative principals (unless overpay credit balance policy enabled); allocation sums equal payment amount. |
