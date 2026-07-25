import { Money } from '@fie/financial-engine';
import {
  computeBreakEven,
  exampleUserDatasetLocal311,
  type BreakEvenModel,
  type BreakEvenSnapshot,
} from '@fie/break-even-engine';
import { computeLiquidity } from '@fie/liquidity-engine';
import { recommendBusinessAction } from '@fie/recommendation-engine';
import { computeBusinessScore } from '@fie/risk-engine';
import { compareMarketingPortfolio } from '@fie/cashflow-engine';
import type {
  MarketingActualEntry,
  MarketingBudgetEntry,
  MarketingChannel,
  MarketingPortfolioVsActual,
  MarketingVariancePolicy,
} from '@fie/shared';

export type LiquidityFormInput = {
  currency: string;
  cash: string;
  monthlyFixedBurn: string;
  monthlyFreeCashFlow: string;
  proposedExtraDebtPayment: string;
  reserveMonths: string;
};

export type LiquidityView = {
  runwayMonths: string | null;
  freeCash: string;
  maxSafeExtraDebtPayment: string;
  canAffordExtraPayment: boolean;
  reserveMonths: string;
  reserveAmount: string;
};

export function loadDemoModel(): BreakEvenModel {
  return exampleUserDatasetLocal311();
}

export function runBreakEven(model: BreakEvenModel): BreakEvenSnapshot {
  return computeBreakEven(model);
}

export function runLiquidity(input: LiquidityFormInput): LiquidityView {
  const currency = input.currency;
  const result = computeLiquidity({
    cash: Money.from(input.cash, currency),
    monthlyFixedBurn: Money.from(input.monthlyFixedBurn, currency),
    monthlyFreeCashFlow: Money.from(input.monthlyFreeCashFlow, currency),
    proposedExtraDebtPayment: Money.from(input.proposedExtraDebtPayment, currency),
    reserveMonths: input.reserveMonths,
  });

  return {
    runwayMonths: result.runwayMonths,
    freeCash: result.freeCash.toString(),
    maxSafeExtraDebtPayment: result.maxSafeExtraDebtPayment.toString(),
    canAffordExtraPayment: result.canAffordExtraPayment,
    reserveMonths: result.policyUsed.reserveMonths,
    reserveAmount: result.policyUsed.reserveAmount.toString(),
  };
}

export function runMarketingPortfolio(input: {
  currency: string;
  periodFrom: string;
  periodTo: string;
  channels: MarketingChannel[];
  budgets: MarketingBudgetEntry[];
  actuals: MarketingActualEntry[];
  policy: MarketingVariancePolicy;
}): MarketingPortfolioVsActual {
  return compareMarketingPortfolio(input);
}

export function runHealth(input: {
  breakEven: BreakEvenSnapshot;
  liquidity: LiquidityView;
  proposedExtraDebtPayment?: string;
  futureInterestSaved: string;
  currency: string;
  marketingFreedCapacity?: string;
  marketingOverspend?: string;
  riskComponents: Record<string, number>;
  riskWeights: Record<string, string>;
  riskBands: { lowMin: number; mediumMin: number };
}) {
  const recommendation = recommendBusinessAction({
    currency: input.currency,
    breakEvenSales: input.breakEven.breakEvenSales,
    projectedSales: input.breakEven.projectedSales ?? '0',
    safetyMargin: input.breakEven.safetyMargin ?? '0',
    runwayMonths: input.liquidity.runwayMonths,
    maxSafeExtraDebtPayment: input.liquidity.maxSafeExtraDebtPayment,
    proposedExtraDebtPayment: input.proposedExtraDebtPayment,
    futureInterestSaved: input.futureInterestSaved,
    marketingFreedCapacity: input.marketingFreedCapacity,
    marketingOverspend: input.marketingOverspend,
  });

  const score = computeBusinessScore({
    components: input.riskComponents,
    weights: input.riskWeights,
    riskBands: input.riskBands,
  });

  return { recommendation, score };
}
