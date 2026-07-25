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

/** Quantified impact — required by PRODUCT_VISION recommendation contract. */
export type RecommendationExpectedImpact = {
  /** Suggested or refused payment amount under review. */
  cashDeployedToDebt: string;
  /** Interest reduction estimate supplied by caller / debt engine. */
  interestSavedEstimate: string;
  /** Runway after respecting reserve policy (echo; not a silent invent). */
  runwayMonthsPreserved: string | null;
  /** Safety margin used in the decision (real BEP context). */
  safetyMarginUsed: string;
  /** Max safe capacity after liquidity + ads variance. */
  capacityUsed: string;
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
  expectedImpact: RecommendationExpectedImpact;
};

function zero(currency: string): Money {
  return Money.zero(currency);
}

function impact(input: {
  cashDeployedToDebt: string;
  interestSavedEstimate: string;
  runwayMonthsPreserved: string | null;
  safetyMarginUsed: string;
  capacityUsed: string;
}): RecommendationExpectedImpact {
  return { ...input };
}

/**
 * Holistic CFO recommendation: never debt-only; never compromise operations.
 * See docs/PRODUCT_VISION.md recommendation contract.
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

  const meta = {
    adjustedMaxSafeExtraDebtPayment: adjustedMax.toString(),
    marketingFreedCapacity: freed.toString(),
    marketingOverspend: overspend.toString(),
  };

  if (negativeSafety) {
    const rationale: string[] = [
      'Prioridad: preservar la operación. No acelerar deuda con el margen de seguridad en rojo.',
      `Datos: ventas ${input.projectedSales} vs punto de equilibrio ${input.breakEvenSales} → margen de seguridad ${input.safetyMargin}.`,
      `Impacto si se forzara un abono: se debilitaría aún más la caja operativa (runway ${input.runwayMonths ?? 'n/a'} meses).`,
      'Acción: sostener liquidez y subir ventas/margen hasta superar el BEP; después reevaluar abono.',
    ];
    if (freed.isPositive()) {
      rationale.push(
        `Publicidad liberó ${freed.toString()} vs presupuesto, pero no se destina a deuda mientras el BEP no esté cubierto.`,
      );
    }
    return {
      action: 'hold_extra_debt_payment',
      rationale,
      valid: false,
      suggestedExtraDebtPayment: '0',
      ...meta,
      expectedImpact: impact({
        cashDeployedToDebt: '0',
        interestSavedEstimate: '0',
        runwayMonthsPreserved: input.runwayMonths,
        safetyMarginUsed: input.safetyMargin,
        capacityUsed: adjustedMax.toString(),
      }),
    };
  }

  if (proposed.isPositive() && proposed.gt(adjustedMax)) {
    const rationale: string[] = [
      `No recomiendo el abono propuesto de ${proposed.toString()}: supera la capacidad segura de ${adjustedMax.toString()}.`,
      `Datos: liquidez base ${baseMax.toString()}; ads liberados ${freed.toString()}; sobrepresupuesto ads ${overspend.toString()}.`,
      `Runway ${input.runwayMonths ?? 'n/a'} meses; margen de seguridad ${input.safetyMargin} (BEP ${input.breakEvenSales}).`,
      `Impacto de insistir: comprometería la reserva mínima / operación. Máximo defendible hoy: ${adjustedMax.toString()}.`,
    ];
    return {
      action: 'hold_extra_debt_payment',
      rationale,
      valid: false,
      suggestedExtraDebtPayment: adjustedMax.toString(),
      ...meta,
      expectedImpact: impact({
        cashDeployedToDebt: '0',
        interestSavedEstimate: '0',
        runwayMonthsPreserved: input.runwayMonths,
        safetyMarginUsed: input.safetyMargin,
        capacityUsed: adjustedMax.toString(),
      }),
    };
  }

  const suggested = proposed.isPositive() ? proposed : adjustedMax;

  if (suggested.isPositive()) {
    const rationale: string[] = [
      `Se recomienda un abono extraordinario de ${suggested.toString()} porque:`,
      `la empresa mantiene runway de ${input.runwayMonths ?? 'n/a'} meses bajo su política de reserva;`,
      `el punto de equilibrio (${input.breakEvenSales}) ya está cubierto por ventas ${input.projectedSales} (margen ${input.safetyMargin});`,
      `la capacidad segura (liquidez${freed.isPositive() ? ' + sobrante de publicidad' : ''}) alcanza ${adjustedMax.toString()};`,
      `el ahorro proyectado en intereses es ~${interestSaved.toString()};`,
      'el flujo libre, tras el abono sugerido, permanece dentro del máximo seguro (operación no comprometida).',
    ];
    if (freed.isPositive() && !proposed.isPositive()) {
      rationale.push(
        `Parte de la capacidad (${freed.toString()}) proviene de gastar menos en ads que el presupuesto planificado.`,
      );
    }

    return {
      action:
        freed.isPositive() && !proposed.isPositive()
          ? 'accelerate_debt_from_marketing_underspend'
          : 'accelerate_debt_within_liquidity',
      rationale,
      valid: true,
      suggestedExtraDebtPayment: suggested.toString(),
      ...meta,
      expectedImpact: impact({
        cashDeployedToDebt: suggested.toString(),
        interestSavedEstimate: interestSaved.toString(),
        runwayMonthsPreserved: input.runwayMonths,
        safetyMarginUsed: input.safetyMargin,
        capacityUsed: adjustedMax.toString(),
      }),
    };
  }

  return {
    action: 'maintain_operations',
    rationale: [
      'Se recomienda no forzar abono extra hoy.',
      `Datos: capacidad ajustada ${adjustedMax.toString()}; margen ${input.safetyMargin}; runway ${input.runwayMonths ?? 'n/a'}.`,
      'Impacto de no abonar: se prioriza liquidez y operación; reevaluar cuando ventas/caja liberén capacidad positiva.',
    ],
    valid: true,
    suggestedExtraDebtPayment: '0',
    ...meta,
    expectedImpact: impact({
      cashDeployedToDebt: '0',
      interestSavedEstimate: '0',
      runwayMonthsPreserved: input.runwayMonths,
      safetyMarginUsed: input.safetyMargin,
      capacityUsed: adjustedMax.toString(),
    }),
  };
}
