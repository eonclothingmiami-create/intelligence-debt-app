/**
 * Non-financial shared helpers and workspace configuration contracts.
 * Monetary math lives in @fie/financial-engine / domain engines.
 */

export type Result<T, E = Error> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function assertNever(value: never, message = 'Unexpected value'): never {
  throw new Error(`${message}: ${String(value)}`);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export type {
  ConfigurableLineItem,
  ConfigurableProduct,
  Season,
  ModuleId,
  ModuleToggle,
  DashboardWidgetId,
  DashboardWidget,
  LiquidityPolicy,
  RiskWeightPolicy,
  ConfigCatalogItem,
  WorkspaceCentralConfig,
  BusinessWorkspaceConfig,
  MetricKind,
} from './workspace.js';

export { METRIC_KIND } from './workspace.js';

export type {
  MarketingChannel,
  MarketingBudgetEntry,
  MarketingActualEntry,
  MarketingVariancePolicy,
  MarketingPlanVsActual,
  MarketingPortfolioVsActual,
} from './marketing.js';
