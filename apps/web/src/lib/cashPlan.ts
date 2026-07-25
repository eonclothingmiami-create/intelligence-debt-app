import type { BreakEvenModel } from '@fie/break-even-engine';
import type { DebtWorkspace } from '@/lib/debtStore';
import { debtDashboard } from '@/lib/debtStore';
import {
  cashAfterRecompra,
  recompraAmount,
  type WorkspaceCashSnapshot,
} from '@/lib/workspaceProfile';

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

function findPayrollMonthly(model: BreakEvenModel | null): string | null {
  if (!model) return null;
  const line =
    model.fixedCosts.find((l) => l.active && l.kind === 'payroll_with_provisions') ??
    model.fixedCosts.find((l) => l.active && l.id === 'f_nomina') ??
    model.fixedCosts.find((l) => l.active && /nomina|nómina/i.test(`${l.label} ${l.category}`));
  if (!line) return null;
  const n = Number(line.amount);
  return Number.isFinite(n) && n >= 0 ? line.amount : null;
}

function findCreditCardInstallment(ws: DebtWorkspace): string | null {
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

/** Inclusive of asOf day (sales still possible today). */
export function remainingCalendarDaysInMonth(asOf: Date = new Date()): number {
  const last = new Date(asOf.getFullYear(), asOf.getMonth() + 1, 0).getDate();
  return Math.max(0, last - asOf.getDate() + 1);
}

/**
 * Derives near-term cash capacity from owner cash snapshot + BEP payroll + debt TC.
 * Does not invent missing lines — lists gaps instead.
 */
export function deriveNearTermCashPlan(input: {
  cash: WorkspaceCashSnapshot;
  model: BreakEvenModel | null;
  debts: DebtWorkspace;
  asOf?: Date;
}): NearTermCashPlan {
  const notes: string[] = [];
  const gaps: string[] = [];
  const payrollMonthly = findPayrollMonthly(input.model);
  const nextQuincena =
    payrollMonthly != null ? String(Math.round(Number(payrollMonthly) / 2)) : null;
  const creditCardInstallment = findCreditCardInstallment(input.debts);
  const rec = recompraAmount(input.cash);
  const afterRec = cashAfterRecompra(input.cash);
  const days = remainingCalendarDaysInMonth(input.asOf);

  if (payrollMonthly != null) {
    notes.push(
      `Nómina mensual (costos fijos, incluye provisiones/prestaciones): ${payrollMonthly}. Quincena = mitad: ${nextQuincena}.`,
    );
  } else {
    gaps.push('payrollMonthly');
  }
  if (creditCardInstallment != null) {
    notes.push(`Cuota tarjeta (módulo deudas): ${creditCardInstallment}.`);
  } else {
    gaps.push('creditCardInstallment');
  }
  notes.push(`Quedan ${days} día(s) de calendario de ventas en el mes (incluye hoy).`);

  let immediateFreeCash: string | null = null;
  if (nextQuincena != null && creditCardInstallment != null && afterRec) {
    const free = Number(afterRec) - Number(nextQuincena) - Number(creditCardInstallment);
    immediateFreeCash = String(Math.max(0, Math.round(free)));
    if (free < 0) {
      notes.push(
        `Tras recompra + quincena + cuota TC faltan ≈ ${String(Math.round(-free))} (caja apretada).`,
      );
    } else {
      notes.push(
        `Capacidad inmediata estimada (tras recompra, quincena y cuota TC): ${immediateFreeCash}.`,
      );
    }
  } else {
    gaps.push('immediateFreeCash');
  }

  return {
    cashOnHand: input.cash.cashOnHand,
    recompraEarmark: rec,
    cashAfterRecompra: afterRec,
    payrollMonthly,
    nextQuincena,
    creditCardInstallment,
    immediateFreeCash,
    remainingCalendarDaysInMonth: days,
    notes,
    gaps,
  };
}
