# @fie/liquidity-engine

Pure **liquidity** engine for Business Financial OS.

Answers: how long is runway, how much free cash exists, and how much extra debt payment can the business afford **without killing operations**.

## Minimal API

```ts
import { computeLiquidity } from '@fie/liquidity-engine';
import { Money } from '@fie/financial-engine';

const result = computeLiquidity({
  cash: Money.from('30000000', 'COP'),
  monthlyFixedBurn: Money.from('10000000', 'COP'),
  monthlyFreeCashFlow: Money.from('35000000', 'COP'),
  proposedExtraDebtPayment: Money.from('2000000', 'COP'),
});
// runwayMonths, freeCash, maxSafeExtraDebtPayment, canAffordExtraPayment
```

## Docs

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).
