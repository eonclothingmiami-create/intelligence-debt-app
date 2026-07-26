/**
 * Operational alerts — warnings from facts already on the board.
 * Not recommendations. Never invents missing balances or dues.
 */

export type AlertSeverity = 'critical' | 'warning' | 'info';

export type OperationalAlert = {
  id: string;
  severity: AlertSeverity;
  code: string;
  title: string;
  detail: string;
  /** Suggested OS tab to resolve. */
  relatedTab?:
    | 'capacidad'
    | 'config'
    | 'closings'
    | 'debts'
    | 'marketing'
    | 'costs'
    | 'sales'
    | 'decision'
    | 'calendar';
};

export type DeriveAlertsInput = {
  asOf?: Date;
  cashOnHand: string;
  immediateFreeCash: string | null;
  nextQuincena: string | null;
  creditCardInstallment: string | null;
  capacityGaps: string[];
  liquidityPolicyComplete: boolean;
  reserveMonths: string;
  runwayMonths: string | null;
  minCashFloor: string;
  safetyMargin: string | null;
  safetyMarginRate: string | null;
  marketingOverspend: string | null;
  marketingAlert: boolean;
  pendingClosingDays: string[];
  inventorySkusBelowMin: number | null;
  inventorySkusWithStock: number | null;
  /** Debts with paymentDueDay (1–31) still open. */
  debtDues: Array<{
    id: string;
    label: string;
    paymentDueDay: number | null | undefined;
    closed: boolean;
  }>;
  fixedCostDues: Array<{
    id: string;
    label: string;
    dueDay: number | null | undefined;
    active: boolean;
  }>;
};

function moneyNum(v: string | null | undefined): number {
  if (v == null || v === '') return NaN;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

function daysUntilDueDay(asOf: Date, dueDay: number): number | null {
  if (!Number.isFinite(dueDay) || dueDay < 1 || dueDay > 31) return null;
  const y = asOf.getFullYear();
  const m = asOf.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  const targetDay = Math.min(dueDay, last);
  const today = asOf.getDate();
  if (targetDay >= today) return targetDay - today;
  /* next month */
  const nextLast = new Date(y, m + 2, 0).getDate();
  const nextTarget = Math.min(dueDay, nextLast);
  const daysLeftThisMonth = last - today;
  return daysLeftThisMonth + nextTarget;
}

/**
 * Derives operational alerts from board facts only.
 */
export function deriveOperationalAlerts(input: DeriveAlertsInput): OperationalAlert[] {
  const asOf = input.asOf ?? new Date();
  const alerts: OperationalAlert[] = [];

  if (!input.liquidityPolicyComplete) {
    alerts.push({
      id: 'policy_missing',
      severity: 'critical',
      code: 'LIQUIDITY_POLICY_MISSING',
      title: 'Falta política de liquidez',
      detail:
        'Define reserva en meses en Configuración. Capacidad y abonos seguros no pueden calcularse.',
      relatedTab: 'config',
    });
  }

  if (input.pendingClosingDays.length > 0) {
    const n = input.pendingClosingDays.length;
    alerts.push({
      id: 'closings_pending',
      severity: n >= 3 ? 'critical' : 'warning',
      code: 'CLOSINGS_PENDING',
      title: `${n} día(s) sin registro de movimientos`,
      detail: `Pendientes: ${input.pendingClosingDays.join(', ')}. Completa o marca «sin movimientos» antes de confiar en recomendaciones.`,
      relatedTab: 'closings',
    });
  }

  const free = moneyNum(input.immediateFreeCash);
  const quincena = moneyNum(input.nextQuincena);
  const cash = moneyNum(input.cashOnHand);
  if (input.immediateFreeCash != null && Number.isFinite(free) && free <= 0) {
    alerts.push({
      id: 'cash_tight',
      severity: 'critical',
      code: 'CASH_TIGHT_AFTER_EARMARKS',
      title: 'Caja apretada tras earmarks',
      detail:
        quincena > 0
          ? `Capacidad inmediata ≈ 0 tras recompra, quincena (${input.nextQuincena}) y cuota TC. Prioriza operación.`
          : 'Capacidad inmediata ≈ 0 tras earmarks operativos. Prioriza operación.',
      relatedTab: 'capacidad',
    });
  } else if (
    Number.isFinite(cash) &&
    Number.isFinite(quincena) &&
    quincena > 0 &&
    cash < quincena
  ) {
    alerts.push({
      id: 'payroll_short',
      severity: 'critical',
      code: 'PAYROLL_CASH_SHORT',
      title: 'Caja insuficiente vs próxima quincena',
      detail: `Caja ${input.cashOnHand} < quincena ${input.nextQuincena}.`,
      relatedTab: 'capacidad',
    });
  }

  const floor = moneyNum(input.minCashFloor);
  if (Number.isFinite(floor) && floor > 0 && Number.isFinite(cash) && cash < floor) {
    alerts.push({
      id: 'below_floor',
      severity: 'critical',
      code: 'BELOW_CASH_FLOOR',
      title: 'Caja bajo el piso mínimo',
      detail: `Caja ${input.cashOnHand} < piso ${input.minCashFloor}.`,
      relatedTab: 'capacidad',
    });
  }

  const runway = moneyNum(input.runwayMonths);
  if (input.runwayMonths != null && Number.isFinite(runway) && runway < 1) {
    alerts.push({
      id: 'runway_low',
      severity: 'critical',
      code: 'RUNWAY_UNDER_ONE_MONTH',
      title: 'Runway bajo 1 mes',
      detail: `Runway estimado: ${input.runwayMonths} meses.`,
      relatedTab: 'capacidad',
    });
  } else if (input.runwayMonths != null && Number.isFinite(runway) && runway < 2) {
    alerts.push({
      id: 'runway_warn',
      severity: 'warning',
      code: 'RUNWAY_UNDER_TWO_MONTHS',
      title: 'Runway bajo 2 meses',
      detail: `Runway estimado: ${input.runwayMonths} meses.`,
      relatedTab: 'capacidad',
    });
  }

  const overspend = moneyNum(input.marketingOverspend);
  if (input.marketingAlert || (Number.isFinite(overspend) && overspend > 0)) {
    alerts.push({
      id: 'ads_over',
      severity: 'warning',
      code: 'ADS_OVER_BUDGET',
      title: 'Publicidad sobre presupuesto',
      detail:
        Number.isFinite(overspend) && overspend > 0
          ? `Sobrepresupuesto ≈ ${input.marketingOverspend}.`
          : 'Desviación vs plan según umbral de alerta configurado.',
      relatedTab: 'marketing',
    });
  }

  const margin = moneyNum(input.safetyMargin);
  const marginRate = moneyNum(input.safetyMarginRate);
  if (input.safetyMargin != null && Number.isFinite(margin) && margin < 0) {
    alerts.push({
      id: 'below_bep',
      severity: 'critical',
      code: 'BELOW_BREAK_EVEN',
      title: 'Por debajo del punto de equilibrio',
      detail: `Margen de seguridad negativo (${input.safetyMargin}).`,
      relatedTab: 'decision',
    });
  } else if (
    input.safetyMarginRate != null &&
    Number.isFinite(marginRate) &&
    marginRate >= 0 &&
    marginRate < 0.05
  ) {
    alerts.push({
      id: 'thin_margin',
      severity: 'warning',
      code: 'THIN_SAFETY_MARGIN',
      title: 'Margen de seguridad bajo',
      detail: `Safety margin rate ≈ ${(marginRate * 100).toFixed(1)}% (< 5%).`,
      relatedTab: 'decision',
    });
  }

  const belowMin = input.inventorySkusBelowMin;
  const withStock = input.inventorySkusWithStock;
  if (belowMin != null && belowMin > 0) {
    const ratio = withStock && withStock > 0 ? belowMin / withStock : null;
    alerts.push({
      id: 'inventory_low',
      severity: ratio != null && ratio > 0.4 ? 'critical' : 'warning',
      code: 'INVENTORY_BELOW_MIN',
      title: 'Inventario bajo mínimo',
      detail:
        ratio != null
          ? `${belowMin} SKU(s) bajo mínimo (${(ratio * 100).toFixed(0)}% de los con stock).`
          : `${belowMin} SKU(s) bajo mínimo.`,
      relatedTab: 'sales',
    });
  }

  for (const d of input.debtDues) {
    if (d.closed || d.paymentDueDay == null) continue;
    const days = daysUntilDueDay(asOf, d.paymentDueDay);
    if (days == null) continue;
    if (days === 0) {
      alerts.push({
        id: `debt_due_today_${d.id}`,
        severity: 'critical',
        code: 'DEBT_DUE_TODAY',
        title: `Cuota vence hoy: ${d.label}`,
        detail: `Día de pago programado: ${d.paymentDueDay}.`,
        relatedTab: 'calendar',
      });
    } else if (days === 1) {
      alerts.push({
        id: `debt_due_tomorrow_${d.id}`,
        severity: 'warning',
        code: 'DEBT_DUE_TOMORROW',
        title: `Cuota vence mañana: ${d.label}`,
        detail: `Día de pago programado: ${d.paymentDueDay}.`,
        relatedTab: 'calendar',
      });
    }
  }

  for (const f of input.fixedCostDues) {
    if (!f.active || f.dueDay == null) continue;
    const days = daysUntilDueDay(asOf, f.dueDay);
    if (days == null) continue;
    if (days === 0) {
      alerts.push({
        id: `fixed_due_today_${f.id}`,
        severity: 'warning',
        code: 'FIXED_COST_DUE_TODAY',
        title: `Costo fijo vence hoy: ${f.label}`,
        detail: `Día presupuestado: ${f.dueDay}. Confirma en registro de movimientos.`,
        relatedTab: 'calendar',
      });
    } else if (days === 1) {
      alerts.push({
        id: `fixed_due_tomorrow_${f.id}`,
        severity: 'info',
        code: 'FIXED_COST_DUE_TOMORROW',
        title: `Costo fijo mañana: ${f.label}`,
        detail: `Día presupuestado: ${f.dueDay}.`,
        relatedTab: 'calendar',
      });
    }
  }

  if (input.capacityGaps.includes('payrollMonthly')) {
    alerts.push({
      id: 'gap_payroll',
      severity: 'info',
      code: 'MISSING_PAYROLL',
      title: 'Nómina no encontrada en costos',
      detail: 'Sin línea de nómina activa, Capacidad no puede restar quincena.',
      relatedTab: 'costs',
    });
  }
  if (input.capacityGaps.includes('creditCardInstallment')) {
    alerts.push({
      id: 'gap_cc',
      severity: 'info',
      code: 'MISSING_CC_INSTALLMENT',
      title: 'Cuota TC no encontrada',
      detail: 'Sin cuota de tarjeta en deudas, Capacidad no completa earmarks.',
      relatedTab: 'debts',
    });
  }

  const order: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return alerts.sort(
    (a, b) => order[a.severity] - order[b.severity] || a.title.localeCompare(b.title),
  );
}

export function alertsToContextStrings(alerts: OperationalAlert[]): string[] {
  return alerts.map((a) => `[${a.severity}] ${a.title}: ${a.detail}`);
}
