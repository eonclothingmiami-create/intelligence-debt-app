# @fie/recommendation-engine

Pure **holistic recommendations** for Business Financial OS.

Combines break-even, liquidity, and debt context. **Never debt-only** — refuses extra payments that exceed max-safe liquidity or that would push operations below break-even safety.

## Minimal API

```ts
import { recommendBusinessAction } from '@fie/recommendation-engine';

const result = recommendBusinessAction({
  breakEvenSales: '30390000',
  projectedSales: '36200000',
  safetyMargin: '5810000',
  runwayMonths: '4',
  maxSafeExtraDebtPayment: '5000000',
  proposedExtraDebtPayment: '2000000',
  futureInterestSaved: '900000',
});
// { action, rationale[], valid }
```

## Docs

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).
