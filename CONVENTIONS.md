# Conventions — Business Financial OS

Canon: [docs/PRODUCT_VISION.md](docs/PRODUCT_VISION.md).

## Identity

This is a **CFO digital**, not an ERP, not accounting software, not debt-only tooling.

Success = answers to “what should I do with money **today**?” with real data — not report count.

## Zero hardcoded finance

See [docs/CONFIGURATION_PRINCIPLE.md](docs/CONFIGURATION_PRINCIPLE.md).

- Never bake in seasons, utility %, BEP, ad spend, or reserve months.
- Example datasets belong in `fixtures/` / tests only.
- Silent defaults for money or policy are bugs.
- No intuition / calendar heuristics / generic averages without business history.

## Input vs output

| Editable by user            | Computed only             |
| --------------------------- | ------------------------- |
| Cost catalogs               | Break-even                |
| Products / prices           | Safety margin             |
| Projected sales / ERP sync  | Runway / max safe payment |
| Target profit / utility     | Business health score     |
| Seasons, modules, dashboard | Recommendations + impact  |
| Liquidity & risk policies   |                           |

## Recommendation contract

Every recommendation MUST:

1. Use real inputs (ERP events and/or user data).
2. Show mathematical justification.
3. Explain **why**.
4. State **expected financial impact**.
5. Preserve user-configured **minimum liquidity** / operation.

Never emit bare “pay this debt” without the above.

Never optimize one lever (debt, ads, inventory) by sacrificing liquidity or going below break-even without an explicit hold.

## Debt Manager

User-owned living obligations (not ERP). Event history required. See [docs/PRODUCT_VISION.md](docs/PRODUCT_VISION.md) and `@fie/debt-manager`.

Never recommend “pay largest balance first” as a fixed rule.

Hera = Source of Truth for sales. OS consumes via `@fie/erp-integration` only.  
Never read ERP tables. Never mutate ERP sales.  
See [docs/ERP_INTEGRATION.md](docs/ERP_INTEGRATION.md).

## Commits

Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`.
