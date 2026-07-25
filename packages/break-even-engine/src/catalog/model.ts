import { Money, Decimal, FinancialEngineError } from '@fie/financial-engine';
import type { BreakEvenModel, LineItem, Product } from '../shared/types.js';

function activeSum(items: LineItem[], currency: string): Money {
  return [...items]
    .filter((i) => i.active)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .reduce((acc, i) => acc.add(Money.from(i.amount, currency)), Money.zero(currency));
}

export function sumVariableCostsPerUnit(model: BreakEvenModel): Money {
  return activeSum(model.variableCosts, model.currency);
}

export function sumFixedCosts(model: BreakEvenModel): Money {
  return activeSum(model.fixedCosts, model.currency);
}

export type UnitEconomics = {
  productCost: Money;
  variablePerUnit: Money;
  fullUnitCost: Money;
  salePrice: Money;
  contributionMargin: Money;
  marginRate: string;
};

export function averageUnitEconomics(model: BreakEvenModel): UnitEconomics {
  const currency = model.currency;
  const variablePerUnit = sumVariableCostsPerUnit(model);
  const activeProducts = [...model.products]
    .filter((p) => p.active)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  if (activeProducts.length === 0) {
    throw new FinancialEngineError('NO_PRODUCTS', 'At least one active product is required');
  }

  let weightSum = new Decimal(0);
  let weightedProductCost = new Decimal(0);
  let weightedPrice = new Decimal(0);

  for (const p of activeProducts) {
    const w = new Decimal(p.mixWeight ?? (activeProducts.length === 1 ? '1' : '0'));
    weightSum = weightSum.plus(w);
    const logistics = Money.from(p.logisticsCost ?? '0', currency);
    const productCost = Money.from(p.productCost, currency).add(logistics);
    weightedProductCost = weightedProductCost.plus(productCost.decimal.times(w));
    weightedPrice = weightedPrice.plus(Money.from(p.salePrice, currency).decimal.times(w));
  }

  if (weightSum.lte(0)) {
    throw new FinancialEngineError('INVALID_MIX', 'Product mix weights must sum to > 0');
  }

  const productCost = Money.from(weightedProductCost.div(weightSum).toFixed(), currency).settle();
  const salePrice = Money.from(weightedPrice.div(weightSum).toFixed(), currency).settle();
  const fullUnitCost = productCost.add(variablePerUnit).settle();
  const contributionMargin = salePrice.sub(fullUnitCost);
  if (!contributionMargin.isPositive()) {
    throw new FinancialEngineError(
      'NON_POSITIVE_MARGIN',
      'Contribution margin must be > 0 for a finite break-even',
    );
  }
  const marginRate = contributionMargin.decimal.div(salePrice.decimal).toFixed();

  return {
    productCost,
    variablePerUnit,
    fullUnitCost,
    salePrice,
    contributionMargin,
    marginRate,
  };
}

/**
 * Optional helper: derive a sale price from a user-chosen utility-on-price.
 * The utility % is an INPUT from the user — never an engine default.
 */
export function priceFromUtility(fullUnitCost: Money, utilityOnPrice: string): Money {
  const u = new Decimal(utilityOnPrice);
  if (u.gte(1) || u.lte(0)) {
    throw new FinancialEngineError('INVALID_UTILITY', 'utilityOnPrice must be in (0,1)');
  }
  return fullUnitCost.div(new Decimal(1).minus(u)).settle();
}

export function upsertLineItem(items: LineItem[], item: LineItem): LineItem[] {
  const idx = items.findIndex((i) => i.id === item.id);
  if (idx === -1) return [...items, item];
  const next = [...items];
  next[idx] = item;
  return next;
}

export function setLineActive(items: LineItem[], id: string, active: boolean): LineItem[] {
  return items.map((i) => (i.id === id ? { ...i, active } : i));
}

export function reorderLineItems(items: LineItem[], orderedIds: string[]): LineItem[] {
  const map = new Map(items.map((i) => [i.id, i]));
  const next: LineItem[] = [];
  let order = 0;
  for (const id of orderedIds) {
    const item = map.get(id);
    if (item) {
      next.push({ ...item, sortOrder: order });
      order += 1;
      map.delete(id);
    }
  }
  for (const item of map.values()) {
    next.push({ ...item, sortOrder: order });
    order += 1;
  }
  return next;
}

export function upsertProduct(products: Product[], product: Product): Product[] {
  const idx = products.findIndex((p) => p.id === product.id);
  if (idx === -1) return [...products, product];
  const next = [...products];
  next[idx] = product;
  return next;
}
