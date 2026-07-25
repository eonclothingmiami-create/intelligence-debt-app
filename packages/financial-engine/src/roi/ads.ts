import { Money } from '../math/money.js';
import { FinancialEngineError } from '../shared/types.js';

/**
 * ROI uses ACTUAL ad spend only (what TikTok/Meta charged).
 * Never pass budget/plan amounts here — those belong to plan-vs-actual variance.
 */
export type AdsRoiInput = {
  /** Actual charged spend — drives ROI and financing analysis. */
  actualAdSpend: Money;
  attributedRevenue: Money;
  financingCost: Money;
};

export type AdsRoiResult = {
  actualSpend: Money;
  revenue: Money;
  financingCost: Money;
  spread: Money;
  netRoi: string;
  formulaVersion: string;
};

/**
 * ROI_net = (R - S_actual - F) / S_actual
 */
export function computeAdsRoi(input: AdsRoiInput): AdsRoiResult {
  if (!input.actualAdSpend.isPositive()) {
    throw new FinancialEngineError('INVALID_SPEND', 'actualAdSpend must be > 0');
  }
  const spread = input.attributedRevenue.sub(input.actualAdSpend).sub(input.financingCost);
  const netRoi = spread.decimal.div(input.actualAdSpend.decimal);
  return {
    actualSpend: input.actualAdSpend,
    revenue: input.attributedRevenue,
    financingCost: input.financingCost,
    spread,
    netRoi: netRoi.toFixed(),
    formulaVersion: '1.0.0',
  };
}

export function shouldAcceleratePayoff(roi: AdsRoiResult, liquidityStress: boolean): boolean {
  if (liquidityStress) return true;
  return roi.spread.isNegative() || roi.spread.isZero();
}
