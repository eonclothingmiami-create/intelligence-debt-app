import type { BreakEvenModel } from '@fie/break-even-engine';
import {
  deriveCapacity,
  type BoardInput,
  type BoardSnapshot,
  type CapacitySnapshot,
  runBoard,
} from '@fie/financial-orchestrator';
import type { LiquidityPolicy } from '@fie/shared';
import type { DebtWorkspace } from '@/lib/debtStore';
import { debtDashboard } from '@/lib/debtStore';
import type { WorkspaceCashSnapshot } from '@/lib/workspaceProfile';

export function findPayrollMonthly(model: BreakEvenModel | null): string | null {
  if (!model) return null;
  const line =
    model.fixedCosts.find((l) => l.active && l.kind === 'payroll_with_provisions') ??
    model.fixedCosts.find((l) => l.active && l.id === 'f_nomina') ??
    model.fixedCosts.find((l) => l.active && /nomina|nómina/i.test(`${l.label} ${l.category}`));
  if (!line) return null;
  const n = Number(line.amount);
  return Number.isFinite(n) && n >= 0 ? line.amount : null;
}

export function findCreditCardInstallment(ws: DebtWorkspace): string | null {
  const dash = debtDashboard(ws);
  const card = dash.snapshots.find(
    (s) =>
      !s.state.closed &&
      (s.obligation.kindId === 'tarjeta' || /tarjeta|tc/i.test(s.obligation.kindLabel)),
  );
  if (!card) return null;
  const amount =
    card.obligation.targetPaymentAmount ??
    card.obligation.minimumPaymentAmount ??
    card.obligation.fixedInstallmentAmount;
  if (!amount) return null;
  const n = Number(amount);
  return Number.isFinite(n) && n >= 0 ? amount : null;
}

export type BuildBoardInputArgs = {
  cash: WorkspaceCashSnapshot;
  cashOnHandOverride?: string;
  policy: LiquidityPolicy;
  currency: string;
  model: BreakEvenModel | null;
  debts: DebtWorkspace;
  monthlyFixedBurn: string;
  proposedExtraDebtPayment?: string;
  futureInterestSaved?: string;
  marketingFreedCapacity?: string;
  marketingOverspend?: string;
  riskComponents?: Record<string, number>;
  riskWeights?: Record<string, string>;
  riskBands?: { lowMin: number; mediumMin: number };
  asOf?: Date;
};

/** Assembles BoardInput from OS workspace facts (no invention). */
export function buildBoardInput(args: BuildBoardInputArgs): BoardInput {
  const cashOnHand = (args.cashOnHandOverride ?? args.cash.cashOnHand).trim();
  const policyFloor = args.policy.minCashFloor?.trim();
  return {
    cash: {
      cashOnHand,
      recompraShareOfCash: args.cash.recompraShareOfCash.trim() || '0',
    },
    policy: {
      reserveMonths: args.policy.reserveMonths,
      currency: args.currency,
      reserveIsHardFloor: args.policy.reserveIsHardFloor,
      ...(policyFloor ? { minCashFloor: policyFloor } : {}),
    },
    nearTerm: {
      payrollMonthly: findPayrollMonthly(args.model),
      creditCardInstallment: findCreditCardInstallment(args.debts),
    },
    monthlyFixedBurn: args.monthlyFixedBurn,
    ...(args.model ? { breakEvenModel: args.model } : {}),
    debtSnapshots: debtDashboard(args.debts).snapshots,
    ...(args.proposedExtraDebtPayment
      ? { proposedExtraDebtPayment: args.proposedExtraDebtPayment }
      : {}),
    ...(args.futureInterestSaved ? { futureInterestSaved: args.futureInterestSaved } : {}),
    ...(args.marketingFreedCapacity ? { marketingFreedCapacity: args.marketingFreedCapacity } : {}),
    ...(args.marketingOverspend ? { marketingOverspend: args.marketingOverspend } : {}),
    ...(args.riskComponents ? { riskComponents: args.riskComponents } : {}),
    ...(args.riskWeights ? { riskWeights: args.riskWeights } : {}),
    ...(args.riskBands ? { riskBands: args.riskBands } : {}),
    ...(args.asOf ? { asOf: args.asOf } : {}),
  };
}

export function deriveOsCapacity(args: BuildBoardInputArgs): CapacitySnapshot {
  return deriveCapacity(buildBoardInput(args));
}

export function runOsBoard(args: BuildBoardInputArgs): BoardSnapshot {
  return runBoard(buildBoardInput(args));
}
