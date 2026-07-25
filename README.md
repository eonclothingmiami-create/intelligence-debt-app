# Business Financial OS

**Financial Intelligence Engine** is a **Business Financial Operating System**.

Debt is one module. The goal is company-wide financial health.

## Fundamental principle

**No hardcoded financial values.** The user configures everything with data. The software recalculates.

Read: [docs/CONFIGURATION_PRINCIPLE.md](docs/CONFIGURATION_PRINCIPLE.md)

- **Inputs:** costs, prices, targets, seasons, modules, dashboard, policies
- **Outputs:** break-even, liquidity, scores, recommendations
- Break-even is **never** edited — only recalculated
- No “July is bad” — only history-based statements when data exists

## Packages

```text
packages/
  break-even-engine/
  financial-engine/
  liquidity-engine/
  risk-engine/
  cashflow-engine/
  simulation-engine/
  optimization-engine/
  recommendation-engine/
  shared/   # workspace config (modules, seasons, dashboard)
```

## Commands

```bash
npx pnpm@9.15.9 install
npx pnpm@9.15.9 test
npx pnpm@9.15.9 build
npx pnpm@9.15.9 --filter @fie/web dev
```

## Web app (MVP)

Local:

```bash
npx pnpm@9.15.9 --filter @fie/web dev
```

- Landing: http://localhost:3000
- Tablero OS: http://localhost:3000/app
- PWA instalable desde el navegador del celular

### Deploy (GitHub Pages — sin Vercel)

1. Repo → **Settings → Pages → Source: GitHub Actions**
2. Push a `main` (workflow `Deploy GitHub Pages`)
3. URL pública:

`https://eonclothingmiami-create.github.io/intelligence-debt-app/`
