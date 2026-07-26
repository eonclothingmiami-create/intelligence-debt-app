import type { BreakEvenSnapshot } from '@fie/break-even-engine';
import type { ObligationSnapshot } from '@fie/debt-manager';

/**
 * Derives risk-engine inputs from already-computed board facts.
 * Does not invent scores when core facts are missing — returns null.
 */
export function deriveRiskInputsFromBoard(input: {
  breakEven: BreakEvenSnapshot;
  runwayMonths: string | null;
  debtSnapshots?: ObligationSnapshot[];
  inventory?: {
    units: string;
    skusBelowMin: number;
    skusWithStock: number;
  };
}): {
  components: Record<string, number>;
  weights: Record<string, string>;
  riskBands: { lowMin: number; mediumMin: number };
} {
  const runway = Number(input.runwayMonths ?? NaN);
  const safetyRate = Number(input.breakEven.safetyMarginRate ?? NaN);
  const margin = Number(input.breakEven.contributionMarginRate ?? NaN);
  const openDebt = (input.debtSnapshots ?? []).filter((s) => !s.state.closed);
  const totalDebt = openDebt.reduce((acc, s) => acc + (Number(s.balance) || 0), 0);

  let inventoryScore = 50;
  if (input.inventory && Number(input.inventory.units) > 0) {
    const withStock = Math.max(1, input.inventory.skusWithStock);
    const lowRatio = input.inventory.skusBelowMin / withStock;
    inventoryScore = lowRatio > 0.4 ? 45 : lowRatio > 0.2 ? 60 : 80;
  } else if (!input.inventory) {
    inventoryScore = 25;
  }

  return {
    components: {
      liquidity: Number.isFinite(runway) ? (runway >= 2 ? 75 : runway >= 1 ? 55 : 40) : 40,
      breakEven: Number.isFinite(safetyRate) ? (safetyRate > 0 ? 80 : 35) : 35,
      debtCoverage: totalDebt > 0 ? 55 : 80,
      margin: Number.isFinite(margin) ? Math.max(0, Math.min(100, margin * 100)) : 40,
      inventory: inventoryScore,
    },
    weights: {
      liquidity: '0.25',
      breakEven: '0.25',
      debtCoverage: '0.20',
      margin: '0.20',
      inventory: '0.10',
    },
    riskBands: { lowMin: 70, mediumMin: 45 },
  };
}

/** Declared execution order — documentation + BoardSnapshot.pipeline. */
export const BOARD_PIPELINE = [
  'validateBoardInputs',
  'deriveCapacity',
  'computeBreakEven',
  'computeLiquidity',
  'rankDebtsForExtraPayment',
  'recommendBusinessAction',
  'computeBusinessScore',
] as const;

export type BoardPipelineStep = (typeof BOARD_PIPELINE)[number];
