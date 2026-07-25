import { Money, Decimal, type DecimalValue, FinancialEngineError } from '@fie/financial-engine';
import {
  FORMULA_VERSION,
  type BreakEvenModel,
  type BreakEvenSnapshot,
  type PeriodBreakdown,
} from '../shared/types.js';
import { averageUnitEconomics, sumFixedCosts } from '../catalog/model.js';

function period(
  units: DecimalValue,
  price: Money,
  scaleNumerator: number,
  scaleDenominator: number,
): PeriodBreakdown {
  const factor = new Decimal(scaleNumerator).div(scaleDenominator);
  const u = units.times(factor);
  const money = price.mul(u).settle();
  return {
    units: u.toDecimalPlaces(2).toFixed(2),
    money: money.toString(),
  };
}

function requireOperatingDays(model: BreakEvenModel): number {
  const days = model.operatingDaysPerMonth;
  if (!Number.isFinite(days) || days <= 0) {
    throw new FinancialEngineError(
      'MISSING_OPERATING_DAYS',
      'operatingDaysPerMonth is required user input (> 0). The engine does not assume 26 or 30.',
    );
  }
  return days;
}

/**
 * Pure break-even computation from user inputs only.
 * Break-even is always calculated — never read from the model as an input.
 */
export function computeBreakEven(model: BreakEvenModel): BreakEvenSnapshot {
  const days = requireOperatingDays(model);
  const economics = averageUnitEconomics(model);
  const fixed = sumFixedCosts(model);
  const target = Money.from(model.targetProfit ?? '0', model.currency);
  const numerator = fixed.add(target);
  const units = numerator.decimal.div(economics.contributionMargin.decimal);
  const sales = economics.salePrice.mul(units).settle();

  const monthly: PeriodBreakdown = {
    units: units.toDecimalPlaces(2).toFixed(2),
    money: sales.toString(),
  };
  const daily = period(units, economics.salePrice, 1, days);
  const weekly = period(units, economics.salePrice, 7, days);
  const annual = period(units, economics.salePrice, 12, 1);

  let projectedSales: string | null = null;
  let safetyMargin: string | null = null;
  let safetyMarginRate: string | null = null;

  if (model.projectedSales !== undefined) {
    const proj = Money.from(model.projectedSales, model.currency);
    projectedSales = proj.toString();
    const sm = proj.sub(sales);
    safetyMargin = sm.toString();
    safetyMarginRate = proj.isZero() ? '0' : sm.decimal.div(proj.decimal).toFixed();
  }

  return {
    formulaVersion: FORMULA_VERSION,
    variableCostPerUnit: economics.variablePerUnit.toString(),
    averageProductCost: economics.productCost.toString(),
    averageFullUnitCost: economics.fullUnitCost.toString(),
    averageSalePrice: economics.salePrice.toString(),
    contributionMarginPerUnit: economics.contributionMargin.toString(),
    contributionMarginRate: economics.marginRate,
    totalFixedCosts: fixed.toString(),
    targetProfit: target.toString(),
    breakEvenUnits: monthly.units,
    breakEvenSales: monthly.money,
    monthly,
    daily,
    weekly,
    annual,
    projectedSales,
    safetyMargin,
    safetyMarginRate,
    inputsUsed: {
      operatingDaysPerMonth: days,
      currency: model.currency,
    },
  };
}
