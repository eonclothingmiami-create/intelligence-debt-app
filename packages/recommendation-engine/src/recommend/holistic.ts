import { Money } from '@fie/financial-engine';

export type RecommendBusinessActionInput = {
  currency?: string;
  breakEvenSales: string;
  projectedSales: string;
  /** Positive = above break-even; negative = conceptually unsafe for extra debt. */
  safetyMargin: string;
  runwayMonths: string | null;
  maxSafeExtraDebtPayment: string;
  /**
   * Optional user intent. If omitted or zero, the engine suggests
   * `adjustedMaxSafeExtraDebtPayment` (liquidity + marketing reality).
   */
  proposedExtraDebtPayment?: string;
  futureInterestSaved: string;
  /**
   * Ads budget − actual when positive (multi-channel portfolio underspend).
   * Increases debt amortization capacity automatically.
   */
  marketingFreedCapacity?: string;
  /** Ads actual − budget when positive. Reduces capacity. */
  marketingOverspend?: string;
};

export type RecommendBusinessActionResult = {
  action: string;
  rationale: string[];
  /** false when a debt-only heuristic would hurt operations. */
  valid: boolean;
  /** Liquidity max + marketing underspend − marketing overspend (floored at 0). */
  adjustedMaxSafeExtraDebtPayment: string;
  /** Engine-suggested extra debt payment after business reality. */
  suggestedExtraDebtPayment: string;
  marketingFreedCapacity: string;
  marketingOverspend: string;
};

function zero(currency: string): Money {
  return Money.zero(currency);
}

/**
 * Holistic recommendation: never debt-only.
 * Marketing plan-vs-actual adjusts capacity: underspend → recommend larger abono.
 */
export function recommendBusinessAction(
  input: RecommendBusinessActionInput,
): RecommendBusinessActionResult {
  const currency = input.currency ?? 'COP';
  const safetyMargin = Money.from(input.safetyMargin, currency);
  const baseMax = Money.from(input.maxSafeExtraDebtPayment, currency);
  const freed = Money.from(input.marketingFreedCapacity ?? '0', currency);
  const overspend = Money.from(input.marketingOverspend ?? '0', currency);
  const proposed = Money.from(input.proposedExtraDebtPayment ?? '0', currency);
  const interestSaved = Money.from(input.futureInterestSaved, currency);

  const adjustedMaxRaw = baseMax.add(freed).sub(overspend);
  const adjustedMax = adjustedMaxRaw.isPositive() ? adjustedMaxRaw : zero(currency);
  const negativeSafety = safetyMargin.isNegative();

  const baseFields = {
    adjustedMaxSafeExtraDebtPayment: adjustedMax.toString(),
    suggestedExtraDebtPayment: '0',
    marketingFreedCapacity: freed.toString(),
    marketingOverspend: overspend.toString(),
  };

  if (negativeSafety) {
    const rationale: string[] = [
      'No recomiendo acelerar el pago de deuda solo mirando el crédito: pondría en riesgo la operación.',
      `El margen de seguridad es negativo (${input.safetyMargin}); las ventas proyectadas están bajo el punto de equilibrio (${input.breakEvenSales}).`,
      `Runway: ${input.runwayMonths ?? 'n/a'} meses. Priorizar punto de equilibrio y liquidez antes de acelerar deuda.`,
    ];
    if (freed.isPositive()) {
      rationale.push(
        `Aunque publicidad liberó ${freed.toString()} vs presupuesto, el break-even sigue en rojo: no destinar ese sobrante a deuda todavía.`,
      );
    }
    return {
      action: 'hold_extra_debt_payment',
      rationale,
      valid: false,
      ...baseFields,
    };
  }

  if (proposed.isPositive() && proposed.gt(adjustedMax)) {
    const rationale: string[] = [
      'No recomiendo acelerar el pago de deuda solo mirando el crédito: pondría en riesgo la operación.',
      `El abono propuesto (${proposed.toString()}) supera la capacidad segura ajustada (${adjustedMax.toString()}) tras liquidez y publicidad.`,
    ];
    if (overspend.isPositive()) {
      rationale.push(
        `Publicidad gastó ${overspend.toString()} por encima del presupuesto; eso reduce capacidad de abono.`,
      );
    }
    rationale.push(
      `Runway: ${input.runwayMonths ?? 'n/a'} meses. Capacidad base de liquidez ${baseMax.toString()}; liberado por ads ${freed.toString()}.`,
    );
    return {
      action: 'hold_extra_debt_payment',
      rationale,
      valid: false,
      suggestedExtraDebtPayment: adjustedMax.toString(),
      adjustedMaxSafeExtraDebtPayment: adjustedMax.toString(),
      marketingFreedCapacity: freed.toString(),
      marketingOverspend: overspend.toString(),
    };
  }

  const suggested = proposed.isPositive() ? proposed : adjustedMax;

  const rationale: string[] = [
    `Punto de equilibrio ${input.breakEvenSales}; ventas proyectadas ${input.projectedSales}; margen de seguridad ${input.safetyMargin}.`,
    `Liquidez base permite hasta ${baseMax.toString()} de abono extra (runway ${input.runwayMonths ?? 'n/a'} meses).`,
  ];

  if (freed.isPositive()) {
    rationale.push(
      `Publicidad bajo presupuesto liberó ${freed.toString()}: capacidad ajustada de abono = ${adjustedMax.toString()}.`,
    );
  }
  if (overspend.isPositive()) {
    rationale.push(
      `Publicidad sobre presupuesto consumió ${overspend.toString()} de capacidad; abono máximo ajustado ${adjustedMax.toString()}.`,
    );
  }

  if (suggested.isPositive()) {
    if (freed.isPositive() && !proposed.isPositive()) {
      rationale.push(
        `Recomiendo abono extraordinario de ${suggested.toString()} (liquidez + sobrante de ads) para reducir intereses futuros (~${interestSaved.toString()}) sin caer bajo el punto de equilibrio.`,
      );
      return {
        action: 'accelerate_debt_from_marketing_underspend',
        rationale,
        valid: true,
        suggestedExtraDebtPayment: suggested.toString(),
        adjustedMaxSafeExtraDebtPayment: adjustedMax.toString(),
        marketingFreedCapacity: freed.toString(),
        marketingOverspend: overspend.toString(),
      };
    }

    rationale.push(
      `Recomiendo abono extraordinario de ${suggested.toString()}: conserva liquidez operativa y reduce intereses futuros (~${interestSaved.toString()}) sin caer bajo el punto de equilibrio.`,
    );
    return {
      action: 'accelerate_debt_within_liquidity',
      rationale,
      valid: true,
      suggestedExtraDebtPayment: suggested.toString(),
      adjustedMaxSafeExtraDebtPayment: adjustedMax.toString(),
      marketingFreedCapacity: freed.toString(),
      marketingOverspend: overspend.toString(),
    };
  }

  rationale.push(
    interestSaved.isPositive()
      ? 'Sin capacidad de abono extra este mes; monitorear ahorro de intereses vs. break-even, liquidez y ejecución de ads.'
      : 'Mantener operaciones sobre el punto de equilibrio con liquidez saludable.',
  );

  return {
    action: 'maintain_operations',
    rationale,
    valid: true,
    ...baseFields,
  };
}
