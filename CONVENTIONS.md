# Conventions — Business Financial OS

## Zero hardcoded finance

See [docs/CONFIGURATION_PRINCIPLE.md](docs/CONFIGURATION_PRINCIPLE.md).

- Never bake in seasons, utility %, BEP, ad spend, or reserve months.
- Example datasets belong in `fixtures/` / tests only.
- Silent defaults for money or policy are bugs.

## Input vs output

| Editable by user            | Computed only             |
| --------------------------- | ------------------------- |
| Cost catalogs               | Break-even                |
| Products / prices           | Safety margin             |
| Projected sales             | Runway / max safe payment |
| Target profit / utility     | Business score            |
| Seasons, modules, dashboard | Recommendations           |
| Liquidity & risk policies   |                           |

## Commits

Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`.
