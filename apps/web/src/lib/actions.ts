import type { BreakEvenModel } from '@fie/break-even-engine';
import type {
  MarketingActualEntry,
  MarketingBudgetEntry,
  MarketingChannel,
  MarketingVariancePolicy,
} from '@fie/shared';
import type { BuildBoardInputArgs } from './board';
import {
  loadDemoModel,
  runBoardStack,
  runBreakEven,
  runHealth,
  runLiquidity,
  runMarketingPortfolio,
  type LiquidityFormInput,
} from './engines';

/** Client-safe wrappers (static GitHub Pages export — no server actions). */

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

/** Orchestrated board: capacity → BEP → liquidity → debt → recommend + score. */
export async function actionRunBoard(input: BuildBoardInputArgs) {
  return runBoardStack(input);
}
