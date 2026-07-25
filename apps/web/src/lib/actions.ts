'use server';

import type { BreakEvenModel } from '@fie/break-even-engine';
import type {
  MarketingActualEntry,
  MarketingBudgetEntry,
  MarketingChannel,
  MarketingVariancePolicy,
} from '@fie/shared';
import {
  loadDemoModel,
  runBreakEven,
  runHealth,
  runLiquidity,
  runMarketingPortfolio,
  type LiquidityFormInput,
} from './engines';

export async function actionLoadDemo() {
  const model = loadDemoModel();
  const breakEven = runBreakEven(model);
  return { model, breakEven };
}

export async function actionComputeBreakEven(model: BreakEvenModel) {
  return runBreakEven(model);
}

export async function actionComputeLiquidity(input: LiquidityFormInput) {
  return runLiquidity(input);
}

export async function actionMarketingPortfolio(input: {
  currency: string;
  periodFrom: string;
  periodTo: string;
  channels: MarketingChannel[];
  budgets: MarketingBudgetEntry[];
  actuals: MarketingActualEntry[];
  policy: MarketingVariancePolicy;
}) {
  return runMarketingPortfolio(input);
}

export async function actionBusinessHealth(input: Parameters<typeof runHealth>[0]) {
  return runHealth(input);
}
