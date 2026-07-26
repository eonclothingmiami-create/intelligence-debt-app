import type { ConfigCatalogItem, LiquidityPolicy, WorkspaceCentralConfig } from '@fie/shared';
import { loadLiquidityPolicy, saveLiquidityPolicy } from '@/lib/policyStore';
import { WORKSPACE_CONFIRMED_LIQUIDITY_POLICY } from '@/lib/workspaceProfile';

const STORAGE_KEY = 'fie.os.centralConfig.v1';

function catalog(
  items: Array<{ id: string; label: string; direction?: 'inflow' | 'outflow' }>,
): ConfigCatalogItem[] {
  return items.map((item, i) => ({
    id: item.id,
    label: item.label,
    active: true,
    sortOrder: i,
    ...(item.direction ? { direction: item.direction } : {}),
  }));
}

/** Owner seed — not a silent engine default; editable in Configuración. */
export const WORKSPACE_CONFIRMED_CENTRAL_CONFIG: WorkspaceCentralConfig = {
  currency: 'COP',
  fiscalYearStartMonth: '1',
  closingDaysOfMonth: '',
  operatingDaysPerMonth: '26',
  targetProfitAmount: '',
  debtReductionTargetAmount: '',
  inventoryRestockCycleDays: '',
  salesChannels: catalog([
    { id: 'tiktok', label: 'TikTok Ads' },
    { id: 'meta', label: 'Meta Ads' },
    { id: 'google', label: 'Google Ads' },
    { id: 'pos', label: 'Venta POS / tienda' },
  ]),
  expenseCategories: catalog([
    { id: 'nomina', label: 'Nómina' },
    { id: 'arriendo', label: 'Arriendo' },
    { id: 'servicios', label: 'Servicios' },
    { id: 'marketing', label: 'Marketing' },
    { id: 'logistica', label: 'Logística' },
    { id: 'impuestos', label: 'Impuestos' },
    { id: 'general', label: 'General' },
  ]),
  extraordinaryMovementCategories: catalog([
    { id: 'aporte_capital', label: 'Aporte de capital', direction: 'inflow' },
    { id: 'retiro_utilidades', label: 'Retiro de utilidades', direction: 'outflow' },
    { id: 'compra_activo', label: 'Compra de activo', direction: 'outflow' },
    { id: 'venta_activo', label: 'Venta de activo', direction: 'inflow' },
    { id: 'prestamo_nuevo', label: 'Préstamo nuevo (caja)', direction: 'inflow' },
    { id: 'otro', label: 'Otro', direction: 'outflow' },
  ]),
  updatedAt: '2026-07-25T23:00:00.000Z',
};

export function emptyCentralConfig(): WorkspaceCentralConfig {
  return {
    currency: '',
    fiscalYearStartMonth: '',
    closingDaysOfMonth: '',
    operatingDaysPerMonth: '',
    targetProfitAmount: '',
    debtReductionTargetAmount: '',
    inventoryRestockCycleDays: '',
    salesChannels: [],
    expenseCategories: [],
    extraordinaryMovementCategories: [],
    updatedAt: undefined,
  };
}

function normalizeCatalog(raw: unknown): ConfigCatalogItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, i) => {
    const row = item as Partial<ConfigCatalogItem>;
    const direction =
      row.direction === 'inflow' || row.direction === 'outflow' ? row.direction : undefined;
    return {
      id: String(row.id ?? `cat_${i}`),
      label: String(row.label ?? ''),
      active: row.active !== false,
      sortOrder: typeof row.sortOrder === 'number' ? row.sortOrder : i,
      ...(direction ? { direction } : {}),
    };
  });
}

export function loadCentralConfig(): WorkspaceCentralConfig {
  if (typeof window === 'undefined') return emptyCentralConfig();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return saveCentralConfig(WORKSPACE_CONFIRMED_CENTRAL_CONFIG);
    }
    const parsed = JSON.parse(raw) as Partial<WorkspaceCentralConfig>;
    return {
      currency: String(parsed.currency ?? ''),
      fiscalYearStartMonth: String(parsed.fiscalYearStartMonth ?? ''),
      closingDaysOfMonth: String(parsed.closingDaysOfMonth ?? ''),
      operatingDaysPerMonth: String(parsed.operatingDaysPerMonth ?? ''),
      targetProfitAmount: String(parsed.targetProfitAmount ?? ''),
      debtReductionTargetAmount: String(parsed.debtReductionTargetAmount ?? ''),
      inventoryRestockCycleDays: String(parsed.inventoryRestockCycleDays ?? ''),
      salesChannels: normalizeCatalog(parsed.salesChannels),
      expenseCategories: normalizeCatalog(parsed.expenseCategories),
      extraordinaryMovementCategories: normalizeCatalog(parsed.extraordinaryMovementCategories),
      updatedAt: parsed.updatedAt != null ? String(parsed.updatedAt) : undefined,
    };
  } catch {
    return emptyCentralConfig();
  }
}

export function saveCentralConfig(config: WorkspaceCentralConfig): WorkspaceCentralConfig {
  const next: WorkspaceCentralConfig = {
    ...config,
    currency: config.currency.trim(),
    fiscalYearStartMonth: config.fiscalYearStartMonth.trim(),
    closingDaysOfMonth: config.closingDaysOfMonth.trim(),
    operatingDaysPerMonth: config.operatingDaysPerMonth.trim(),
    targetProfitAmount: config.targetProfitAmount.trim(),
    debtReductionTargetAmount: config.debtReductionTargetAmount.trim(),
    inventoryRestockCycleDays: config.inventoryRestockCycleDays.trim(),
    salesChannels: config.salesChannels.map((c, i) => ({
      ...c,
      label: c.label.trim(),
      sortOrder: i,
    })),
    expenseCategories: config.expenseCategories.map((c, i) => ({
      ...c,
      label: c.label.trim(),
      sortOrder: i,
    })),
    extraordinaryMovementCategories: config.extraordinaryMovementCategories.map((c, i) => ({
      ...c,
      label: c.label.trim(),
      sortOrder: i,
    })),
    updatedAt: new Date().toISOString(),
  };
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

export function isCentralConfigUsable(config: WorkspaceCentralConfig): boolean {
  return Boolean(config.currency.trim() && config.fiscalYearStartMonth.trim());
}

/** Persist liquidity + keep central config currency aligned. */
export function saveLiquidityAndSync(
  policy: LiquidityPolicy,
  config: WorkspaceCentralConfig,
): { policy: LiquidityPolicy; config: WorkspaceCentralConfig } {
  const savedPolicy = saveLiquidityPolicy(policy);
  const savedConfig = saveCentralConfig(config);
  return { policy: savedPolicy, config: savedConfig };
}

export function activeSalesChannels(config: WorkspaceCentralConfig): ConfigCatalogItem[] {
  return config.salesChannels.filter((c) => c.active && c.label.trim());
}

export function activeExpenseCategories(config: WorkspaceCentralConfig): ConfigCatalogItem[] {
  return config.expenseCategories.filter((c) => c.active && c.label.trim());
}

export function activeExtraordinaryCategories(config: WorkspaceCentralConfig): ConfigCatalogItem[] {
  return config.extraordinaryMovementCategories.filter((c) => c.active && c.label.trim());
}

/** Ensure liquidity seed exists when opening Config for the first time. */
export function ensureLiquiditySeed(): LiquidityPolicy {
  const current = loadLiquidityPolicy();
  if (current.reserveMonths.trim()) return current;
  return saveLiquidityPolicy(WORKSPACE_CONFIRMED_LIQUIDITY_POLICY);
}
