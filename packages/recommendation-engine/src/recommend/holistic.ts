import { Money } from '@fie/financial-engine';

export type RecommendBusinessActionInput = {
  currency?: string;
  breakEvenSales: string;
  projectedSales: string;
  /** Positive = above break-even; negative = conceptually unsafe for extra debt. */
  safetyMargin: string;
  runwayMonths: string | null;
  maxSafeExtraDebtPayment: string;
  proposedExtraDebtPayment: string;
  futureInterestSaved: string;
};

export type RecommendBusinessActionResult = {
  action: string;
  rationale: string[];
  /** false when a debt-only heuristic would hurt operations. */
  valid: boolean;
};

/**
 * Holistic recommendation: never debt-only.
 * Refuses extra debt payment when it exceeds max-safe liquidity capacity
 * or when safety margin is conceptually negative (below break-even).
 */
export function recommendBusinessAction(
  input: RecommendBusinessActionInput,
): RecommendBusinessActionResult {
  const currency = input.currency ?? 'COP';
  const safetyMargin = Money.from(input.safetyMargin, currency);
  const maxSafe = Money.from(input.maxSafeExtraDebtPayment, currency);
  const proposed = Money.from(input.proposedExtraDebtPayment, currency);
  const interestSaved = Money.from(input.futureInterestSaved, currency);

  const exceedsMaxSafe = proposed.gt(maxSafe);
  const negativeSafety = safetyMargin.isNegative();

  if (exceedsMaxSafe || negativeSafety) {
    const rationale: string[] = [
      'No recomiendo acelerar el pago de deuda solo mirando el crédito: pondría en riesgo la operación.',
    ];
    if (exceedsMaxSafe) {
      rationale.push(
        `El abono propuesto (${input.proposedExtraDebtPayment}) supera la capacidad segura de liquidez (${input.maxSafeExtraDebtPayment}).`,
      );
    }
    if (negativeSafety) {
      rationale.push(
        `El margen de seguridad es negativo (${input.safetyMargin}); las ventas proyectadas están bajo el punto de equilibrio (${input.breakEvenSales}).`,
      );
    }
    rationale.push(
      `Runway: ${input.runwayMonths ?? 'n/a'} meses. Priorizar punto de equilibrio y liquidez antes de acelerar deuda.`,
    );

    return {
      action: 'hold_extra_debt_payment',
      rationale,
      valid: false,
    };
  }

  const rationale: string[] = [
    `Punto de equilibrio ${input.breakEvenSales}; ventas proyectadas ${input.projectedSales}; margen de seguridad ${input.safetyMargin}.`,
    `Liquidez permite hasta ${input.maxSafeExtraDebtPayment} de abono extra (runway ${input.runwayMonths ?? 'n/a'} meses).`,
  ];

  if (proposed.isPositive()) {
    rationale.push(
      `Recomiendo abono extraordinario de ${input.proposedExtraDebtPayment}: conserva liquidez operativa y reduce intereses futuros (~${input.futureInterestSaved}) sin caer bajo el punto de equilibrio.`,
    );
    return {
      action: 'accelerate_debt_within_liquidity',
      rationale,
      valid: true,
    };
  }

  rationale.push(
    interestSaved.isPositive()
      ? 'Sin abono extra propuesto; monitorear oportunidad de ahorro de intereses vs. break-even y liquidez.'
      : 'Mantener operaciones sobre el punto de equilibrio con liquidez saludable.',
  );

  return {
    action: 'maintain_operations',
    rationale,
    valid: true,
  };
}
