export const FORMULA_VERSION = '1.0.0' as const;

/**
 * Catalog line — fully user-defined.
 * `category` is free text (Arriendo, Nómina, Crédito Davivienda, …).
 * `kind` is an optional machine tag for bridges (e.g. credit_installment); never a business assumption.
 */
export type LineItem = {
  id: string;
  label: string;
  amount: string;
  category: string;
  active: boolean;
  sortOrder: number;
  kind?: string;
  notes?: string;
  /**
   * Day of month (1–31) when this budgeted fixed cost is expected to be paid.
   * User-owned schedule — used for daily confirmation, not invented by the engine.
   */
  dueDay?: number;
};

export type Product = {
  id: string;
  name: string;
  productCost: string;
  salePrice: string;
  /** Mix weight 0..1; if omitted and only one active product, treated as 1 at compute time from data shape — still caller-owned catalog. */
  mixWeight?: string;
  logisticsCost?: string;
  commissionRate?: string;
  active: boolean;
  sortOrder: number;
  notes?: string;
};

/**
 * INPUT model only. Break-even numbers are NOT fields here.
 * operatingDaysPerMonth is required (user preference for period scaling).
 */
export type BreakEvenModel = {
  currency: string;
  variableCosts: LineItem[];
  fixedCosts: LineItem[];
  products: Product[];
  /** Required — user chooses 26, 30, etc. No engine default. */
  operatingDaysPerMonth: number;
  targetProfit?: string;
  projectedSales?: string;
};

export type PeriodBreakdown = {
  units: string;
  money: string;
};

/** OUTPUT only — never persisted as authoritative business input. */
export type BreakEvenSnapshot = {
  formulaVersion: string;
  variableCostPerUnit: string;
  averageProductCost: string;
  averageFullUnitCost: string;
  averageSalePrice: string;
  contributionMarginPerUnit: string;
  contributionMarginRate: string;
  totalFixedCosts: string;
  targetProfit: string;
  breakEvenUnits: string;
  breakEvenSales: string;
  monthly: PeriodBreakdown;
  daily: PeriodBreakdown;
  weekly: PeriodBreakdown;
  annual: PeriodBreakdown;
  projectedSales: string | null;
  safetyMargin: string | null;
  safetyMarginRate: string | null;
  /** Echo of inputs used — transparency, not hidden defaults. */
  inputsUsed: {
    operatingDaysPerMonth: number;
    currency: string;
  };
};
