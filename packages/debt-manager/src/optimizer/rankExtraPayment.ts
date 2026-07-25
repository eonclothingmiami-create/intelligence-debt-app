import { Money, Decimal } from '@fie/financial-engine';
import type { ObligationSnapshot } from '../portfolio/dashboard.js';

/**
 * Debt Optimizer — compare obligations for where to apply extra cash.
 * Does NOT decide alone: Recommendation Engine must still check liquidity / BEP / sales.
 *
 * Never: “pay largest balance first” as a hardcoded rule.
 * Scores by interest burden (rate × balance) among debts that allow extras.
 */
export type DebtAttackCandidate = {
  obligationId: string;
  label: string;
  balance: string;
  estimatedMonthlyInterest: string | null;
  /** Higher = more costly to leave unpaid (rate-aware). */
  interestBurdenScore: string;
  ratePercent: string;
  allowsExtraPayments: boolean;
};

export type DebtOptimizeExtraCashInput = {
  snapshots: ObligationSnapshot[];
  extraCashAvailable: string;
  currency?: string;
};

export type DebtOptimizeExtraCashResult = {
  ranked: DebtAttackCandidate[];
  suggestedTargetObligationId: string | null;
  suggestedAmount: string;
  rationale: string[];
};

export function rankDebtsForExtraPayment(
  input: DebtOptimizeExtraCashInput,
): DebtOptimizeExtraCashResult {
  const currency = input.currency ?? 'COP';
  const extra = Money.from(input.extraCashAvailable, currency);

  const candidates: DebtAttackCandidate[] = input.snapshots
    .filter((s) => s.obligation.active && !s.state.closed && s.state.principal.isPositive())
    .map((s) => {
      const ratePct = new Decimal(s.state.ratePercent ?? s.obligation.ratePercent ?? '0');
      const rate = ratePct.div(100);
      const burden = s.state.principal.mul(rate);
      return {
        obligationId: s.obligation.id,
        label: s.obligation.label,
        balance: s.balance,
        estimatedMonthlyInterest: s.estimatedMonthlyInterest,
        interestBurdenScore: burden.toString(),
        ratePercent: ratePct.toString(),
        allowsExtraPayments: s.obligation.allowsExtraPayments,
      };
    })
    .filter((c) => c.allowsExtraPayments)
    // Highest rate first (never “largest balance first”); burden as tie-breaker.
    .sort((a, b) => {
      const rateCmp = new Decimal(b.ratePercent).cmp(a.ratePercent);
      if (rateCmp !== 0) return rateCmp;
      return new Decimal(b.interestBurdenScore).cmp(a.interestBurdenScore);
    });

  const top = candidates[0] ?? null;
  const rationale: string[] = [];

  if (!extra.isPositive()) {
    rationale.push('No hay efectivo extra disponible para abonos; preservar caja.');
    return {
      ranked: candidates,
      suggestedTargetObligationId: null,
      suggestedAmount: '0',
      rationale,
    };
  }

  if (!top) {
    rationale.push(
      'Ninguna obligación activa permite abonos extraordinarios; no forzar prepago donde esté prohibido.',
    );
    return {
      ranked: candidates,
      suggestedTargetObligationId: null,
      suggestedAmount: '0',
      rationale,
    };
  }

  const targetBal = Money.from(top.balance, currency);
  const amount = extra.lt(targetBal) ? extra : targetBal;
  rationale.push(
    `Mejor candidato por mayor tasa (y carga de interés), no por saldo solo: ${top.label}.`,
  );
  rationale.push(
    `Abono sugerido ${amount.toString()} (limitado por efectivo extra y saldo). Debe validarse con liquidez, BEP y ventas antes de ejecutar.`,
  );

  return {
    ranked: candidates,
    suggestedTargetObligationId: top.obligationId,
    suggestedAmount: amount.toString(),
    rationale,
  };
}
