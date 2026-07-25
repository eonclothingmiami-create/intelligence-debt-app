import type { LiquidityPolicy } from '@fie/shared';

/**
 * Owner-confirmed workspace answers (interview), not a product-wide engine default.
 * Editable anytime in Políticas / Decisión; localStorage overrides seed after first save.
 */
export const WORKSPACE_CONFIRMED_LIQUIDITY_POLICY: LiquidityPolicy = {
  reserveMonths: '1',
  minCashFloor: undefined,
  reserveIsHardFloor: false,
  notes:
    'Prioridad: salir de deudas sin perder liquidez operativa ni capacidad de recompra de mercancía; robustecer el negocio. Reserva blanda de 1 mes. Sin piso absoluto de caja. Situación: a tope (mercancía + deuda).',
  updatedAt: '2026-07-25T23:00:00.000Z',
};

export type MonthCashCommitments = {
  /** Nómina a pagar este mes (COP decimal string). */
  payroll?: string;
  /** Cuota tarjeta de crédito este mes. */
  creditCardInstallment?: string;
  /** Other forced pays (arriendo, proveedores, etc.). */
  otherForced?: string;
  notes?: string;
};

export type WorkspaceCashSnapshot = {
  /** Efectivo disponible hoy (bancos + caja). */
  cashOnHand: string;
  /**
   * Share of current cash earmarked for merchandise repurchase (0..1 decimal string).
   * Owner said ~70% of today's cash is recompra.
   */
  recompraShareOfCash: string;
  commitments: MonthCashCommitments;
  updatedAt?: string;
};

export const WORKSPACE_CONFIRMED_CASH_SNAPSHOT: WorkspaceCashSnapshot = {
  cashOnHand: '12500000',
  recompraShareOfCash: '0.70',
  commitments: {
    notes:
      'Debe pagar nómina y cuota de tarjeta este mes. Del efectivo actual, ~70% es recompra de mercancía. Montos exactos de nómina y cuota pendientes de confirmar.',
  },
  updatedAt: '2026-07-25T23:10:00.000Z',
};

export function recompraAmount(snapshot: WorkspaceCashSnapshot): string {
  const cash = Number(snapshot.cashOnHand);
  const share = Number(snapshot.recompraShareOfCash);
  if (!Number.isFinite(cash) || !Number.isFinite(share)) return '0';
  return String(Math.round(cash * share));
}

export function cashAfterRecompra(snapshot: WorkspaceCashSnapshot): string {
  const cash = Number(snapshot.cashOnHand);
  const rec = Number(recompraAmount(snapshot));
  if (!Number.isFinite(cash) || !Number.isFinite(rec)) return '0';
  return String(cash - rec);
}
