import { computeBreakEven } from '@fie/break-even-engine';
import { rankDebtsForExtraPayment } from '@fie/debt-manager';
import { Money } from '@fie/financial-engine';
import { computeLiquidity } from '@fie/liquidity-engine';
import { recommendBusinessAction } from '@fie/recommendation-engine';
import { computeBusinessScore } from '@fie/risk-engine';
import { deriveCapacity } from './capacity.js';
import { BOARD_PIPELINE, deriveRiskInputsFromBoard } from './riskDefaults.js';
import type { BoardInput, BoardSnapshot } from './types.js';
import { validateBoardInputs } from './validate.js';

/**
 * Single coordination entry for Financial OS engines.
 * Does not invent financial formulas — only validates, orders, and packages.
 *
 * Pipeline: validate → capacity → BEP → liquidity → debt optimizer → recommend → score
 */
export function runBoard(input: BoardInput): BoardSnapshot {
  const validation = validateBoardInputs(input);
  const capacity = deriveCapacity(input);
  const alertsLite: string[] = capacity.gaps.map((g) => `Falta dato: ${g}`);
  for (const f of validation.missingFields) {
    if (!alertsLite.some((a) => a.includes(f))) {
      alertsLite.push(`Falta dato: ${f}`);
    }
  }

  let breakEven = input.breakEvenSnapshot ?? null;
  if (!breakEven && input.breakEvenModel) {
    breakEven = computeBreakEven(input.breakEvenModel);
  }

  const currency = input.policy.currency || 'COP';
  let liquidity: BoardSnapshot['liquidity'] = null;

  if (
    capacity.immediateFreeCash != null &&
    input.monthlyFixedBurn.trim() &&
    input.policy.reserveMonths.trim() &&
    input.cash.cashOnHand.trim()
  ) {
    try {
      const liq = computeLiquidity({
        cash: Money.from(input.cash.cashOnHand, currency),
        monthlyFixedBurn: Money.from(input.monthlyFixedBurn, currency),
        monthlyFreeCashFlow: Money.from(capacity.immediateFreeCash, currency),
        proposedExtraDebtPayment: Money.from(
          input.proposedExtraDebtPayment?.trim() || '0',
          currency,
        ),
        reserveMonths: input.policy.reserveMonths,
        ...(input.policy.minCashFloor?.trim()
          ? { minCashFloor: Money.from(input.policy.minCashFloor, currency) }
          : {}),
      });
      liquidity = {
        runwayMonths: liq.runwayMonths,
        freeCash: liq.freeCash.toString(),
        maxSafeExtraDebtPayment: liq.maxSafeExtraDebtPayment.toString(),
        canAffordExtraPayment: liq.canAffordExtraPayment,
        reserveMonths: liq.policyUsed.reserveMonths,
        reserveAmount: liq.policyUsed.reserveAmount.toString(),
        minCashFloor: liq.policyUsed.minCashFloor?.toString() ?? null,
      };
    } catch (e) {
      alertsLite.push(e instanceof Error ? e.message : 'Error liquidez');
    }
  }

  let debtOptimizer: BoardSnapshot['debtOptimizer'] = null;
  if (input.debtSnapshots?.length && liquidity) {
    debtOptimizer = rankDebtsForExtraPayment({
      snapshots: input.debtSnapshots,
      extraCashAvailable: liquidity.maxSafeExtraDebtPayment,
      currency,
    });
  }

  let recommendation: BoardSnapshot['recommendation'] = null;
  let score: BoardSnapshot['score'] = null;

  if (breakEven && liquidity) {
    const proposed =
      input.proposedExtraDebtPayment?.trim() ||
      (debtOptimizer && debtOptimizer.suggestedAmount !== '0'
        ? debtOptimizer.suggestedAmount
        : undefined);

    recommendation = recommendBusinessAction({
      currency,
      breakEvenSales: breakEven.breakEvenSales,
      projectedSales: breakEven.projectedSales ?? '0',
      safetyMargin: breakEven.safetyMargin ?? '0',
      runwayMonths: liquidity.runwayMonths,
      maxSafeExtraDebtPayment: liquidity.maxSafeExtraDebtPayment,
      futureInterestSaved: input.futureInterestSaved ?? '0',
      ...(proposed ? { proposedExtraDebtPayment: proposed } : {}),
      ...(input.marketingFreedCapacity
        ? { marketingFreedCapacity: input.marketingFreedCapacity }
        : {}),
      ...(input.marketingOverspend ? { marketingOverspend: input.marketingOverspend } : {}),
    });

    const risk =
      input.riskComponents && input.riskWeights && input.riskBands
        ? {
            components: input.riskComponents,
            weights: input.riskWeights,
            riskBands: input.riskBands,
          }
        : deriveRiskInputsFromBoard({
            breakEven,
            runwayMonths: liquidity.runwayMonths,
            ...(input.debtSnapshots ? { debtSnapshots: input.debtSnapshots } : {}),
            ...(input.inventoryHint ? { inventory: input.inventoryHint } : {}),
          });

    score = computeBusinessScore({
      components: risk.components,
      weights: risk.weights,
      riskBands: risk.riskBands,
    });
  } else {
    if (!breakEven) alertsLite.push('Falta dato: breakEven');
    if (!liquidity) alertsLite.push('Falta dato: liquidity');
  }

  return {
    validation,
    pipeline: [...BOARD_PIPELINE],
    capacity,
    breakEven,
    liquidity,
    debtOptimizer,
    recommendation,
    score,
    alertsLite: [...new Set(alertsLite)],
  };
}
