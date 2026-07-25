import { Money, Decimal } from '@fie/financial-engine';
import type { BreakEvenModel, LineItem, Product, BreakEvenSnapshot } from '../shared/types.js';
import {
  upsertLineItem,
  upsertProduct,
  setLineActive,
  reorderLineItems,
} from '../catalog/model.js';
import { computeBreakEven } from '../compute/breakEven.js';

export type ModelPatch =
  | { type: 'upsert_variable'; item: LineItem }
  | { type: 'upsert_fixed'; item: LineItem }
  | { type: 'set_variable_active'; id: string; active: boolean }
  | { type: 'set_fixed_active'; id: string; active: boolean }
  | { type: 'upsert_product'; product: Product }
  | { type: 'set_target_profit'; amount: string }
  | { type: 'set_projected_sales'; amount: string }
  | { type: 'set_operating_days'; days: number }
  | { type: 'reorder_fixed'; orderedIds: string[] }
  | { type: 'reorder_variable'; orderedIds: string[] };

/**
 * Immutable patch → new model + recomputed snapshot (live model).
 */
export function applyPatch(
  model: BreakEvenModel,
  patch: ModelPatch,
): { model: BreakEvenModel; snapshot: BreakEvenSnapshot } {
  let next: BreakEvenModel = { ...model };
  switch (patch.type) {
    case 'upsert_variable':
      next = { ...next, variableCosts: upsertLineItem(next.variableCosts, patch.item) };
      break;
    case 'upsert_fixed':
      next = { ...next, fixedCosts: upsertLineItem(next.fixedCosts, patch.item) };
      break;
    case 'set_variable_active':
      next = {
        ...next,
        variableCosts: setLineActive(next.variableCosts, patch.id, patch.active),
      };
      break;
    case 'set_fixed_active':
      next = {
        ...next,
        fixedCosts: setLineActive(next.fixedCosts, patch.id, patch.active),
      };
      break;
    case 'upsert_product':
      next = { ...next, products: upsertProduct(next.products, patch.product) };
      break;
    case 'set_target_profit':
      next = { ...next, targetProfit: patch.amount };
      break;
    case 'set_projected_sales':
      next = { ...next, projectedSales: patch.amount };
      break;
    case 'set_operating_days':
      next = { ...next, operatingDaysPerMonth: patch.days };
      break;
    case 'reorder_fixed':
      next = { ...next, fixedCosts: reorderLineItems(next.fixedCosts, patch.orderedIds) };
      break;
    case 'reorder_variable':
      next = { ...next, variableCosts: reorderLineItems(next.variableCosts, patch.orderedIds) };
      break;
    default: {
      const _e: never = patch;
      throw new Error(String(_e));
    }
  }
  return { model: next, snapshot: computeBreakEven(next) };
}

export type WhatIfScenario =
  | { type: 'change_fixed'; id: string; amount: string }
  | { type: 'change_variable'; id: string; amount: string }
  | { type: 'change_price'; productId: string; salePrice: string }
  | { type: 'change_product_cost'; productId: string; productCost: string }
  | { type: 'change_target_profit'; amount: string }
  | { type: 'sales_delta_percent'; percent: string };

export function simulateWhatIf(
  model: BreakEvenModel,
  scenario: WhatIfScenario,
): { model: BreakEvenModel; snapshot: BreakEvenSnapshot; label: string } {
  switch (scenario.type) {
    case 'change_fixed': {
      const item = model.fixedCosts.find((i) => i.id === scenario.id);
      if (!item) throw new Error(`Fixed cost not found: ${scenario.id}`);
      const result = applyPatch(model, {
        type: 'upsert_fixed',
        item: { ...item, amount: scenario.amount },
      });
      return { ...result, label: `Fixed ${item.label} → ${scenario.amount}` };
    }
    case 'change_variable': {
      const item = model.variableCosts.find((i) => i.id === scenario.id);
      if (!item) throw new Error(`Variable cost not found: ${scenario.id}`);
      const result = applyPatch(model, {
        type: 'upsert_variable',
        item: { ...item, amount: scenario.amount },
      });
      return { ...result, label: `Variable ${item.label} → ${scenario.amount}` };
    }
    case 'change_price': {
      const product = model.products.find((p) => p.id === scenario.productId);
      if (!product) throw new Error(`Product not found: ${scenario.productId}`);
      const result = applyPatch(model, {
        type: 'upsert_product',
        product: { ...product, salePrice: scenario.salePrice },
      });
      return { ...result, label: `Price ${product.name} → ${scenario.salePrice}` };
    }
    case 'change_product_cost': {
      const product = model.products.find((p) => p.id === scenario.productId);
      if (!product) throw new Error(`Product not found: ${scenario.productId}`);
      const result = applyPatch(model, {
        type: 'upsert_product',
        product: { ...product, productCost: scenario.productCost },
      });
      return { ...result, label: `Cost ${product.name} → ${scenario.productCost}` };
    }
    case 'change_target_profit': {
      const result = applyPatch(model, {
        type: 'set_target_profit',
        amount: scenario.amount,
      });
      return { ...result, label: `Target profit → ${scenario.amount}` };
    }
    case 'sales_delta_percent': {
      const base = model.projectedSales ?? computeBreakEven(model).breakEvenSales;
      const current = Money.from(base, model.currency);
      const factor = new Decimal(1).plus(new Decimal(scenario.percent).div(100));
      const nextSales = current.mul(factor).settle().toString();
      const result = applyPatch(model, {
        type: 'set_projected_sales',
        amount: nextSales,
      });
      return {
        ...result,
        label: `Projected sales ${scenario.percent}% → ${nextSales}`,
      };
    }
    default: {
      const _e: never = scenario;
      throw new Error(String(_e));
    }
  }
}
