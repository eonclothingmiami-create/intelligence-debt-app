# Configuration Principle — Zero Hardcoded Finance

**Status:** Binding for the entire Business Financial OS  
**Audience:** every engine, API, UI, and AI consumer

---

## 1. The rule

**No financial value is hardcoded in the product.**

The system is a **calculation engine**. The user owns every business number and structure through **data**.

If tomorrow a company changes costs, products, margins, ads strategy, seasons, or profit goals, the software must adapt **without a developer writing a line of code**.

---

## 2. Forbidden

The engine must **never** assume or bake in:

| Forbidden assumption                            | Why                                      |
| ----------------------------------------------- | ---------------------------------------- |
| “July is a bad month”                           | Seasons are user-defined + history-based |
| “December is good”                              | Same                                     |
| “Ads cost 2M”                                   | Catalog line item                        |
| “Utility is 50%”                                | User target or derived from their prices |
| “Break-even is 30M”                             | **Output only** — never an input         |
| “Fixed costs never change”                      | Editable catalog                         |
| “Reserve is always 3 months”                    | User liquidity policy                    |
| “Risk weights are fixed”                        | User risk policy                         |
| “Every business has payroll / inventory / debt” | Module toggles                           |

---

## 3. Input vs output (non-negotiable)

### Inputs (user edits)

- Fixed costs (add / remove / edit / reorder / activate / categorize)
- Variable costs (same)
- Products (any industry)
- Prices & costs
- Target profit (amount or %)
- Expected sales volume / revenue
- Marketing **budget** (plan) vs **actual spend** (execution) — never a single blended “Publicidad”
- Credit installments (as cost lines or debt module)
- Seasons (name, dates, notes — no built-in calendar myths)
- Module visibility
- Dashboard widgets
- Liquidity reserve policy
- Risk score weights

### Outputs (engine computes — never edited as source of truth)

- Break-even (units & money)
- Safety margin
- Contribution margin (from prices − costs)
- Runway / free cash / max safe extra payment
- Business score
- Marketing plan-vs-actual variance / alerts

**The user never edits break-even directly.** They edit the variables that determine it; the engine recalculates.

```text
Inputs change  →  recompute outputs  →  refresh dashboard & recommendations
```

---

## 4. Evidence, not folklore

The system must not say:

> “July is a bad month.”

It may say (when history exists):

> “In your last five years of data, July averaged X; this July is 18% above that average.”

Always **data**. Never **stereotype**.

---

## 5. Engine contract

| Engine         | Must receive from caller                                      | Must not invent                      |
| -------------- | ------------------------------------------------------------- | ------------------------------------ |
| break-even     | costs, products, prices, days/month, targets, projected sales | BEP number, utility %, industry      |
| liquidity      | cash, burn, FCF, **reserveMonths**                            | default reserve                      |
| risk           | component scores + **weights**                                | default weight table as truth        |
| recommendation | BEP outputs + liquidity + debt context                        | “always pay debt” / “always cut ads” |

Silent defaults for money or policy are **bugs**.

Fixtures such as Local 311 are **example user datasets for tests**, not product defaults.

---

## 6. UI philosophy

Extremely simple surface:

- Lists with add / edit / disable
- Ask for projections (“¿Ventas esperadas este mes?”)
- User-built dashboard
- Toggle modules

Powerful underneath: pure recalculation of the whole business on every change.
