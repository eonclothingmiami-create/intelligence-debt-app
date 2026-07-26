import type { BreakEvenModel } from '@fie/break-even-engine';
import { remainingCalendarDaysInMonth } from '@fie/financial-orchestrator';
import type { DebtWorkspace } from '@/lib/debtStore';
import { deriveOsCapacity, findCreditCardInstallment, findPayrollMonthly } from '@/lib/board';
import { emptyLiquidityPolicy } from '@/lib/policyStore';
import type { WorkspaceCashSnapshot } from '@/lib/workspaceProfile';

export type NearTermCashPlan = {
  cashOnHand: string;
  recompraEarmark: string;
  cashAfterRecompra: string;
  /** Full monthly payroll from fixed costs (salary + prestaciones). */
  payrollMonthly: string | null;
  /** Next biweekly pay = monthly / 2 (Colombia quincena). */
  nextQuincena: string | null;
  /** Credit-card installment due (from debt module). */
  creditCardInstallment: string | null;
  /**
   * Immediate capacity after recompra + next quincena + CC cuota.
   * Floored at 0 — never invents surplus.
   */
  immediateFreeCash: string | null;
  remainingCalendarDaysInMonth: number;
  notes: string[];
  gaps: string[];
};

export { remainingCalendarDaysInMonth, findPayrollMonthly, findCreditCardInstallment };

/**
 * Derives near-term cash capacity via @fie/financial-orchestrator.
 * Does not invent missing lines — lists gaps instead.
 */
export function deriveNearTermCashPlan(input: {
  cash: WorkspaceCashSnapshot;
  model: BreakEvenModel | null;
  debts: DebtWorkspace;
  asOf?: Date;
}): NearTermCashPlan {
  const capacity = deriveOsCapacity({
    cash: input.cash,
    policy: emptyLiquidityPolicy(),
    currency: input.model?.currency ?? 'COP',
    model: input.model,
    debts: input.debts,
    monthlyFixedBurn: '0',
    ...(input.asOf ? { asOf: input.asOf } : {}),
  });

  return {
    cashOnHand: capacity.cashOnHand,
    recompraEarmark: capacity.recompraEarmark,
    cashAfterRecompra: capacity.cashAfterRecompra,
    payrollMonthly: capacity.payrollMonthly,
    nextQuincena: capacity.nextQuincena,
    creditCardInstallment: capacity.creditCardInstallment,
    immediateFreeCash: capacity.immediateFreeCash,
    remainingCalendarDaysInMonth: capacity.remainingCalendarDaysInMonth,
    notes: capacity.notes,
    gaps: capacity.gaps,
  };
}
