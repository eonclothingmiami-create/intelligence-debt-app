import type { BreakEvenModel, BreakEvenSnapshot } from '@fie/break-even-engine';
import type { DebtOptimizeExtraCashResult, ObligationSnapshot } from '@fie/debt-manager';
import type { RecommendBusinessActionResult } from '@fie/recommendation-engine';
import type { BusinessScoreResult } from '@fie/risk-engine';

/** Owner cash facts — no invented balances. */
export type BoardCashInput = {
  cashOnHand: string;
  /** Share 0..1 of cash earmarked for inventory restock. */
  recompraShareOfCash: string;
};

export type BoardPolicyInput = {
  reserveMonths: string;
  minCashFloor?: string;
  reserveIsHardFloor?: boolean;
  currency: string;
};

export type BoardNearTermLines = {
  /** Monthly payroll from fixed-cost catalog (or null if missing). */
  payrollMonthly: string | null;
  /** Credit-card installment from debt module (or null). */
  creditCardInstallment: string | null;
};

/**
 * Full board input for orchestration.
 * Engines only see facts the caller already owns.
 */
export type BoardInput = {
  cash: BoardCashInput;
  policy: BoardPolicyInput;
  nearTerm: BoardNearTermLines;
  /** Monthly fixed burn (usually BEP totalFixedCosts). */
  monthlyFixedBurn: string;
  /** Optional break-even model — if present, runBoard computes snapshot. */
  breakEvenModel?: BreakEvenModel;
  /** Or pass a precomputed BEP snapshot. */
  breakEvenSnapshot?: BreakEvenSnapshot;
  /** Debt snapshots for optimizer (optional). */
  debtSnapshots?: ObligationSnapshot[];
  proposedExtraDebtPayment?: string;
  futureInterestSaved?: string;
  marketingFreedCapacity?: string;
  marketingOverspend?: string;
  /**
   * Optional explicit risk inputs. If omitted, runBoard derives them from
   * break-even + liquidity + debts + inventoryHint (no silent invention of missing cores).
   */
  riskComponents?: Record<string, number>;
  riskWeights?: Record<string, string>;
  riskBands?: { lowMin: number; mediumMin: number };
  /** Optional inventory facts for health score only. */
  inventoryHint?: {
    units: string;
    skusBelowMin: number;
    skusWithStock: number;
  };
  asOf?: Date;
};

export type CapacitySnapshot = {
  currency: string;
  cashOnHand: string;
  recompraEarmark: string;
  cashAfterRecompra: string;
  payrollMonthly: string | null;
  nextQuincena: string | null;
  creditCardInstallment: string | null;
  immediateFreeCash: string | null;
  remainingCalendarDaysInMonth: number;
  /** ¿Cuánto puedo gastar hoy? */
  canSpendToday: string | null;
  /** ¿Cuánto puedo invertir? */
  canInvest: string | null;
  /** ¿Cuánto puedo abonar a deuda? (post-liquidez) */
  canPayDebtExtra: string | null;
  /** ¿Cuánto inventario puedo recomprar? */
  canRestock: string | null;
  /** ¿Cuánto puedo retirar como utilidad? */
  canWithdrawProfit: string | null;
  /** ¿Cuánto puedo destinar a publicidad? */
  canSpendAds: string | null;
  reserveAmount: string | null;
  runwayMonths: string | null;
  notes: string[];
  gaps: string[];
};

export type BoardValidation = {
  ok: boolean;
  missingFields: string[];
};

export type BoardSnapshot = {
  validation: BoardValidation;
  /** Declared engine order for this run. */
  pipeline: string[];
  capacity: CapacitySnapshot;
  breakEven: BreakEvenSnapshot | null;
  liquidity: {
    runwayMonths: string | null;
    freeCash: string;
    maxSafeExtraDebtPayment: string;
    canAffordExtraPayment: boolean;
    reserveMonths: string;
    reserveAmount: string;
    minCashFloor: string | null;
  } | null;
  debtOptimizer: DebtOptimizeExtraCashResult | null;
  recommendation: RecommendBusinessActionResult | null;
  score: BusinessScoreResult | null;
  alertsLite: string[];
};
