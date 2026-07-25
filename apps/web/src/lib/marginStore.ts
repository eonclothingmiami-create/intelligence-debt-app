import { priceFromUtility, sumVariableCostsPerUnit } from '@fie/break-even-engine';
import type { BreakEvenModel, Product } from '@fie/break-even-engine';
import { Money } from '@fie/financial-engine';

export type ChannelMarginRow = {
  id: string;
  label: string;
  /** Utility on price 0..1 (e.g. "0.5" = 50% margen bruto sobre precio). */
  utilityOnPrice: string;
  /** Mix weight for BEP blend (should sum ~1). */
  mixWeight: string;
};

export type MarginWorkspace = {
  /** Merchandise / garment cost (COGS unit), shared across channels before channel price. */
  productCost: string;
  channels: ChannelMarginRow[];
  updatedAt?: string;
};

const STORAGE_KEY = 'fie.os.marginWorkspace.v1';

/** Owner interview: ~50% utility on price; channels differ — start equal, user edits. */
export const WORKSPACE_CONFIRMED_MARGINS: MarginWorkspace = {
  productCost: '14000',
  channels: [
    { id: 'local', label: 'Local / POS', utilityOnPrice: '0.50', mixWeight: '0.60' },
    { id: 'catalogo', label: 'Catálogo', utilityOnPrice: '0.50', mixWeight: '0.25' },
    { id: 'otros', label: 'Otros canales', utilityOnPrice: '0.50', mixWeight: '0.15' },
  ],
  updatedAt: '2026-07-25T23:30:00.000Z',
};

export function emptyMarginWorkspace(): MarginWorkspace {
  return { productCost: '', channels: [], updatedAt: undefined };
}

export function loadMarginWorkspace(): MarginWorkspace {
  if (typeof window === 'undefined') return emptyMarginWorkspace();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return saveMarginWorkspace(WORKSPACE_CONFIRMED_MARGINS);
    const parsed = JSON.parse(raw) as Partial<MarginWorkspace>;
    return {
      productCost: String(parsed.productCost ?? ''),
      channels: Array.isArray(parsed.channels)
        ? parsed.channels.map((c) => ({
            id: String(c.id),
            label: String(c.label),
            utilityOnPrice: String(c.utilityOnPrice),
            mixWeight: String(c.mixWeight),
          }))
        : [],
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return emptyMarginWorkspace();
  }
}

export function saveMarginWorkspace(ws: MarginWorkspace): MarginWorkspace {
  const next: MarginWorkspace = {
    ...ws,
    productCost: ws.productCost.trim(),
    updatedAt: new Date().toISOString(),
  };
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

/**
 * Rebuild BreakEvenModel.products from channel utilities + shared product cost + variable costs/unit.
 */
export function applyMarginsToModel(
  model: BreakEvenModel,
  margins: MarginWorkspace,
): BreakEvenModel {
  const currency = model.currency;
  const productCost = Money.from(margins.productCost || '0', currency);
  const variablePerUnit = sumVariableCostsPerUnit(model);
  const fullUnitCost = productCost.add(variablePerUnit);

  const active = margins.channels.filter((c) => Number(c.mixWeight) > 0);
  if (active.length === 0) {
    throw new Error('Define al menos un canal con mixWeight > 0');
  }

  const products: Product[] = active.map((c, idx) => {
    const salePrice = priceFromUtility(fullUnitCost, c.utilityOnPrice);
    return {
      id: `ch_${c.id}`,
      name: c.label,
      productCost: productCost.toString(),
      salePrice: salePrice.toString(),
      mixWeight: c.mixWeight,
      active: true,
      sortOrder: idx,
      notes: `Utilidad sobre precio ${c.utilityOnPrice} (canal). Costo prenda + variables → precio.`,
    };
  });

  return { ...model, products };
}
