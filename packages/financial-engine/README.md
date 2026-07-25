# @fie/financial-engine

Pure, offline-capable financial core for the Financial Intelligence Engine.

## Principles

- Framework-agnostic (no NestJS / React / Prisma)
- Event-sourced balances
- Decimal-only monetary arithmetic
- Deterministic simulations
- Bank-grade tests

## Docs

See [`docs/`](./docs/).

## Public API (planned)

```ts
analyzePortfolio(input) → Analysis
simulate(input, scenario) → SimulationResult
recommend(input, constraints) → Recommendation
forecast(input, horizon) → Forecast
explain(result) → Explanation
```
