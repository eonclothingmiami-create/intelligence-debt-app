# @fie/cashflow-engine

Pure **cash flow projections** for Business Financial OS.

Owns period-by-period operating and financing cash flows so other engines can reason about liquidity, runway, and what-if scenarios without coupling to UI, NestJS, or databases.

## Role in the OS

| Consumer              | Uses this for                  |
| --------------------- | ------------------------------ |
| liquidity-engine      | Free cash and burn inputs      |
| simulation-engine     | Scenario cash timelines        |
| recommendation-engine | Holistic affordability context |

## Docs

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).
