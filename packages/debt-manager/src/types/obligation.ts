/**
 * Debt Manager — each obligation is a living financial object, not a bare balance.
 * User-owned Source of Truth (not ERP). Types are free-text extensible.
 */

/** Suggested labels only — never an exhaustive enum that blocks new kinds. */
export const SUGGESTED_DEBT_KIND_LABELS = [
  'Tarjeta de crédito',
  'Leasing',
  'Hipoteca',
  'Proveedor',
  'Préstamo familiar',
  'Crédito libre inversión',
  'Factoring',
  'Crédito empresarial',
  'Anticipo',
  'Vehículo',
  'Otro',
] as const;

export type DebtKindId = string; // user-defined, e.g. "tarjeta", "proveedor_tela"

export type RatePeriodicity = 'daily' | 'monthly' | 'annual' | 'none';

/**
 * Static configuration / identity of an obligation.
 * Current balance is NEVER stored here as authority — fold the event log.
 */
export type DebtObligation = {
  id: string;
  label: string; // e.g. "Davivienda TC"
  kindId: DebtKindId;
  kindLabel: string; // display; user can invent
  institution?: string; // banco / proveedor
  currency: string;
  /** Optional link into @fie/financial-engine creditId for card math. */
  engineCreditId?: string;
  allowsExtraPayments: boolean;
  prepaymentPenalty: boolean;
  prepaymentPenaltyNote?: string;
  ratePercent?: string; // e.g. "2.1085" monthly nominal — semantics in ratePeriodicity
  ratePeriodicity: RatePeriodicity;
  installmentCount?: number;
  fixedInstallmentAmount?: string;
  minimumPaymentAmount?: string;
  targetPaymentAmount?: string;
  statementDay?: number;
  paymentDueDay?: number;
  maturityDate?: string; // YYYY-MM-DD
  purpose?: string; // e.g. "Publicidad TikTok"
  notes?: string;
  active: boolean;
  createdAt: string;
};

export type DebtKindCatalogEntry = {
  id: DebtKindId;
  label: string;
  active: boolean;
  sortOrder: number;
};
