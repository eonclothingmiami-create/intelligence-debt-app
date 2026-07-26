/**
 * Named KPIs derived from board facts only.
 * Missing inputs → status "unknown" (never invent ratios).
 */

export type KpiStatus = 'ok' | 'watch' | 'critical' | 'unknown';

export type KpiItem = {
  id: string;
  label: string;
  /** Display value already formatted for UI, or null if unknown. */
  value: string | null;
  /** Raw numeric string when available (for AI). */
  raw: string | null;
  unit: string;
  status: KpiStatus;
  detail: string;
  group: 'liquidity' | 'debt' | 'margin' | 'sales' | 'ops' | 'health';
};

export type DeriveKpisInput = {
  currency: string;
  cashOnHand: string | null;
  immediateFreeCash: string | null;
  runwayMonths: string | null;
  reserveMonths: string | null;
  reserveAmount: string | null;
  maxSafeExtraDebtPayment: string | null;
  breakEvenSales: string | null;
  projectedSales: string | null;
  safetyMargin: string | null;
  safetyMarginRate: string | null;
  contributionMarginRate: string | null;
  totalFixedCosts: string | null;
  monthSales: string | null;
  totalDebtBalance: string | null;
  estimatedMonthlyInterest: string | null;
  monthlyInstallmentsDue: string | null;
  marketingBudget: string | null;
  marketingActual: string | null;
  inventoryUnits: string | null;
  inventoryValueAtCost: string | null;
  skusBelowMin: number | null;
  skusWithStock: number | null;
  healthScore: number | null;
  riskLevel: string | null;
};

function num(v: string | null | undefined): number | null {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function money(v: number, currency: string): string {
  return `${Math.round(v).toLocaleString('es-CO')} ${currency}`;
}

function pct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function monthsLabel(m: number): string {
  return `${m.toFixed(2)} meses`;
}

/**
 * Builds the named KPI set. Gaps stay unknown — no invented denominators.
 */
export function deriveKpis(input: DeriveKpisInput): KpiItem[] {
  const ccy = input.currency || 'COP';
  const items: KpiItem[] = [];

  const runway = num(input.runwayMonths);
  items.push({
    id: 'runway_months',
    label: 'Runway (liquidez)',
    value: runway != null ? monthsLabel(runway) : null,
    raw: runway != null ? String(runway) : null,
    unit: 'meses',
    status: runway == null ? 'unknown' : runway < 1 ? 'critical' : runway < 2 ? 'watch' : 'ok',
    detail:
      runway == null
        ? 'Falta capacidad/liquidez para calcular runway.'
        : 'Meses de operación estimados con caja y burn.',
    group: 'liquidity',
  });

  const cash = num(input.cashOnHand);
  items.push({
    id: 'cash_on_hand',
    label: 'Caja disponible',
    value: cash != null ? money(cash, ccy) : null,
    raw: cash != null ? String(Math.round(cash)) : null,
    unit: ccy,
    status: cash == null ? 'unknown' : cash <= 0 ? 'critical' : 'ok',
    detail: 'Efectivo reportado por el dueño.',
    group: 'liquidity',
  });

  const free = num(input.immediateFreeCash);
  items.push({
    id: 'immediate_free_cash',
    label: 'Capacidad inmediata',
    value: free != null ? money(free, ccy) : null,
    raw: free != null ? String(Math.round(free)) : null,
    unit: ccy,
    status: free == null ? 'unknown' : free <= 0 ? 'critical' : 'ok',
    detail: 'Tras recompra, quincena y cuota TC (orquestador).',
    group: 'liquidity',
  });

  const maxExtra = num(input.maxSafeExtraDebtPayment);
  items.push({
    id: 'max_safe_extra_debt',
    label: 'Máx. abono seguro a deuda',
    value: maxExtra != null ? money(maxExtra, ccy) : null,
    raw: maxExtra != null ? String(Math.round(maxExtra)) : null,
    unit: ccy,
    status: maxExtra == null ? 'unknown' : 'ok',
    detail: 'Respeta reserva / piso de liquidez.',
    group: 'liquidity',
  });

  const debt = num(input.totalDebtBalance);
  const monthSales = num(input.monthSales);
  if (debt != null && monthSales != null && monthSales > 0) {
    const ratio = debt / monthSales;
    items.push({
      id: 'debt_to_month_sales',
      label: 'Endeudamiento (deuda / ventas mes)',
      value: `${ratio.toFixed(2)}×`,
      raw: String(ratio),
      unit: 'x',
      status: ratio > 6 ? 'critical' : ratio > 3 ? 'watch' : 'ok',
      detail: 'Saldo de deuda ÷ ventas netas del mes (ERP).',
      group: 'debt',
    });
  } else {
    items.push({
      id: 'debt_to_month_sales',
      label: 'Endeudamiento (deuda / ventas mes)',
      value: null,
      raw: null,
      unit: 'x',
      status: 'unknown',
      detail: 'Falta saldo de deuda o ventas del mes.',
      group: 'debt',
    });
  }

  items.push({
    id: 'total_debt',
    label: 'Saldo total de deudas',
    value: debt != null ? money(debt, ccy) : null,
    raw: debt != null ? String(Math.round(debt)) : null,
    unit: ccy,
    status: debt == null ? 'unknown' : debt > 0 ? 'watch' : 'ok',
    detail: 'Suma de obligaciones abiertas.',
    group: 'debt',
  });

  const interest = num(input.estimatedMonthlyInterest);
  items.push({
    id: 'monthly_interest',
    label: 'Interés mensual estimado',
    value: interest != null ? money(interest, ccy) : null,
    raw: interest != null ? String(Math.round(interest)) : null,
    unit: ccy,
    status: interest == null ? 'unknown' : interest > 0 ? 'watch' : 'ok',
    detail: 'Estimación del módulo de deudas.',
    group: 'debt',
  });

  const installments = num(input.monthlyInstallmentsDue);
  if (free != null && interest != null && interest > 0) {
    const coverage = free / interest;
    items.push({
      id: 'interest_coverage',
      label: 'Cobertura de interés',
      value: `${coverage.toFixed(2)}×`,
      raw: String(coverage),
      unit: 'x',
      status: coverage < 1 ? 'critical' : coverage < 2 ? 'watch' : 'ok',
      detail: 'Capacidad inmediata ÷ interés mensual estimado.',
      group: 'debt',
    });
  } else {
    items.push({
      id: 'interest_coverage',
      label: 'Cobertura de interés',
      value: null,
      raw: null,
      unit: 'x',
      status: 'unknown',
      detail: 'Falta capacidad inmediata o interés mensual.',
      group: 'debt',
    });
  }

  if (installments != null && free != null && installments > 0) {
    const cov = free / installments;
    items.push({
      id: 'installment_coverage',
      label: 'Cobertura de cuotas',
      value: `${cov.toFixed(2)}×`,
      raw: String(cov),
      unit: 'x',
      status: cov < 1 ? 'critical' : cov < 1.5 ? 'watch' : 'ok',
      detail: 'Capacidad inmediata ÷ cuotas mensuales programadas.',
      group: 'debt',
    });
  }

  const cm = num(input.contributionMarginRate);
  items.push({
    id: 'contribution_margin',
    label: 'Margen de contribución',
    value: cm != null ? pct(cm) : null,
    raw: cm != null ? String(cm) : null,
    unit: '%',
    status: cm == null ? 'unknown' : cm < 0.2 ? 'watch' : 'ok',
    detail: 'Desde BEP (precios − costos variables).',
    group: 'margin',
  });

  const smr = num(input.safetyMarginRate);
  const sm = num(input.safetyMargin);
  items.push({
    id: 'safety_margin',
    label: 'Margen de seguridad',
    value:
      sm != null
        ? `${money(sm, ccy)}${smr != null ? ` (${pct(smr)})` : ''}`
        : smr != null
          ? pct(smr)
          : null,
    raw: sm != null ? String(Math.round(sm)) : smr != null ? String(smr) : null,
    unit: ccy,
    status:
      sm == null && smr == null
        ? 'unknown'
        : (sm != null && sm < 0) || (smr != null && smr < 0)
          ? 'critical'
          : smr != null && smr < 0.05
            ? 'watch'
            : 'ok',
    detail: 'Ventas proyectadas − punto de equilibrio.',
    group: 'margin',
  });

  const bep = num(input.breakEvenSales);
  items.push({
    id: 'break_even_sales',
    label: 'Punto de equilibrio (ventas)',
    value: bep != null ? money(bep, ccy) : null,
    raw: bep != null ? String(Math.round(bep)) : null,
    unit: ccy,
    status: bep == null ? 'unknown' : 'ok',
    detail: 'Salida del break-even engine.',
    group: 'margin',
  });

  items.push({
    id: 'month_sales',
    label: 'Ventas del mes (ERP)',
    value: monthSales != null ? money(monthSales, ccy) : null,
    raw: monthSales != null ? String(Math.round(monthSales)) : null,
    unit: ccy,
    status: monthSales == null ? 'unknown' : 'ok',
    detail: 'Neto desde Hera / tesorería.',
    group: 'sales',
  });

  const mBudget = num(input.marketingBudget);
  const mActual = num(input.marketingActual);
  if (mBudget != null && mBudget > 0 && mActual != null) {
    const varRate = (mActual - mBudget) / mBudget;
    items.push({
      id: 'ads_variance',
      label: 'Desviación publicidad (real vs plan)',
      value: pct(varRate),
      raw: String(varRate),
      unit: '%',
      status: varRate > 0.1 ? 'critical' : varRate > 0 ? 'watch' : 'ok',
      detail: 'Actual ÷ presupuesto − 1.',
      group: 'sales',
    });
  } else {
    items.push({
      id: 'ads_variance',
      label: 'Desviación publicidad (real vs plan)',
      value: null,
      raw: null,
      unit: '%',
      status: 'unknown',
      detail: 'Falta presupuesto o gasto real de ads.',
      group: 'sales',
    });
  }

  const invCost = num(input.inventoryValueAtCost);
  const units = num(input.inventoryUnits);
  items.push({
    id: 'inventory_at_cost',
    label: 'Inventario a costo',
    value: invCost != null ? money(invCost, ccy) : null,
    raw: invCost != null ? String(Math.round(invCost)) : null,
    unit: ccy,
    status: invCost == null ? 'unknown' : 'ok',
    detail: units != null ? `${units} unidades (Hera).` : 'Valor a costo desde Hera.',
    group: 'ops',
  });

  const below = input.skusBelowMin;
  const withStock = input.skusWithStock;
  if (below != null && withStock != null && withStock > 0) {
    const ratio = below / withStock;
    items.push({
      id: 'inventory_below_min_ratio',
      label: 'SKUs bajo mínimo',
      value: `${below} (${pct(ratio)})`,
      raw: String(ratio),
      unit: '%',
      status: ratio > 0.4 ? 'critical' : ratio > 0.2 ? 'watch' : 'ok',
      detail: 'Proporción de SKUs con stock bajo el mínimo.',
      group: 'ops',
    });
  } else {
    items.push({
      id: 'inventory_below_min_ratio',
      label: 'SKUs bajo mínimo',
      value: null,
      raw: null,
      unit: '%',
      status: 'unknown',
      detail: 'Inventario aún no sincronizado.',
      group: 'ops',
    });
  }

  items.push({
    id: 'business_health_score',
    label: 'Business Health Score',
    value:
      input.healthScore != null
        ? `${input.healthScore}${input.riskLevel ? ` · ${input.riskLevel}` : ''}`
        : null,
    raw: input.healthScore != null ? String(input.healthScore) : null,
    unit: 'score',
    status:
      input.healthScore == null
        ? 'unknown'
        : input.healthScore < 45
          ? 'critical'
          : input.healthScore < 70
            ? 'watch'
            : 'ok',
    detail: 'Score del risk-engine (pesos del tablero).',
    group: 'health',
  });

  return items;
}

export function kpisToContext(items: KpiItem[]): Array<{
  id: string;
  label: string;
  value: string | null;
  raw: string | null;
  unit: string;
  status: KpiStatus;
  detail: string;
  group: string;
}> {
  return items.map((k) => ({
    id: k.id,
    label: k.label,
    value: k.value,
    raw: k.raw,
    unit: k.unit,
    status: k.status,
    detail: k.detail,
    group: k.group,
  }));
}

export const KPI_GROUP_LABEL: Record<KpiItem['group'], string> = {
  liquidity: 'Liquidez',
  debt: 'Deuda',
  margin: 'Margen / BEP',
  sales: 'Ventas / Ads',
  ops: 'Operación',
  health: 'Salud',
};
