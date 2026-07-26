import { Money } from '@fie/financial-engine';
import { computeLiquidity } from '@fie/liquidity-engine';
import type { BoardInput, CapacitySnapshot } from './types.js';

function moneyNum(v: string): number {
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

function moneyStr(n: number): string {
  return Math.round(n).toFixed(0);
}

function floor0(n: number): string {
  return moneyStr(Math.max(0, n));
}

/** Inclusive of asOf day. */
export function remainingCalendarDaysInMonth(asOf: Date = new Date()): number {
  const last = new Date(asOf.getFullYear(), asOf.getMonth() + 1, 0).getDate();
  return Math.max(0, last - asOf.getDate() + 1);
}

export function recompraEarmark(cashOnHand: string, share: string): string {
  const c = moneyNum(cashOnHand);
  const s = moneyNum(share);
  if (!Number.isFinite(c) || !Number.isFinite(s) || c < 0 || s < 0) return '0';
  return moneyStr(c * s);
}

export function cashAfterRecompra(cashOnHand: string, share: string): string {
  const c = moneyNum(cashOnHand);
  const e = moneyNum(recompraEarmark(cashOnHand, share));
  if (!Number.isFinite(c)) return '0';
  return floor0(c - e);
}

/**
 * Derives the six owner capacity questions from facts + liquidity policy.
 * Does not invent payroll/CC — lists gaps instead.
 */
export function deriveCapacity(input: BoardInput): CapacitySnapshot {
  const currency = input.policy.currency || 'COP';
  const notes: string[] = [];
  const gaps: string[] = [];
  const asOf = input.asOf ?? new Date();
  const days = remainingCalendarDaysInMonth(asOf);

  const cashOnHand = input.cash.cashOnHand.trim() || '0';
  const share = input.cash.recompraShareOfCash.trim() || '0';
  const earmark = recompraEarmark(cashOnHand, share);
  const afterRec = cashAfterRecompra(cashOnHand, share);

  const payrollMonthly = input.nearTerm.payrollMonthly;
  const nextQuincena =
    payrollMonthly != null && payrollMonthly !== '' ? moneyStr(moneyNum(payrollMonthly) / 2) : null;
  const creditCardInstallment = input.nearTerm.creditCardInstallment;

  if (payrollMonthly != null && payrollMonthly !== '') {
    notes.push(`Nómina mensual: ${payrollMonthly}. Quincena ≈ ${nextQuincena}.`);
  } else {
    gaps.push('payrollMonthly');
  }
  if (creditCardInstallment != null && creditCardInstallment !== '') {
    notes.push(`Cuota tarjeta: ${creditCardInstallment}.`);
  } else {
    gaps.push('creditCardInstallment');
  }
  notes.push(`Recompra earmarked (${share}): ${earmark}. Tras recompra: ${afterRec}.`);
  notes.push(`Días de calendario restantes en el mes (incluye hoy): ${days}.`);

  let immediateFreeCash: string | null = null;
  if (nextQuincena != null && creditCardInstallment != null && creditCardInstallment !== '') {
    const free = moneyNum(afterRec) - moneyNum(nextQuincena) - moneyNum(creditCardInstallment);
    immediateFreeCash = floor0(free);
    if (free < 0) {
      notes.push(`Caja apretada tras earmarks: faltan ≈ ${moneyStr(-free)}.`);
    } else {
      notes.push(
        `Capacidad inmediata (tras recompra + quincena + cuota TC): ${immediateFreeCash}.`,
      );
    }
  } else {
    gaps.push('immediateFreeCash');
  }

  let canPayDebtExtra: string | null = null;
  let reserveAmount: string | null = null;
  let runwayMonths: string | null = null;

  if (
    immediateFreeCash != null &&
    input.monthlyFixedBurn.trim() &&
    input.policy.reserveMonths.trim()
  ) {
    try {
      const liq = computeLiquidity({
        cash: Money.from(cashOnHand, currency),
        monthlyFixedBurn: Money.from(input.monthlyFixedBurn, currency),
        monthlyFreeCashFlow: Money.from(immediateFreeCash, currency),
        proposedExtraDebtPayment: Money.from(
          input.proposedExtraDebtPayment?.trim() || '0',
          currency,
        ),
        reserveMonths: input.policy.reserveMonths,
        ...(input.policy.minCashFloor?.trim()
          ? { minCashFloor: Money.from(input.policy.minCashFloor, currency) }
          : {}),
      });
      canPayDebtExtra = liq.maxSafeExtraDebtPayment.toString();
      reserveAmount = liq.policyUsed.reserveAmount.toString();
      runwayMonths = liq.runwayMonths;
      notes.push(
        `Reserva (${input.policy.reserveMonths} meses de burn): ${reserveAmount}. Máx. abono seguro: ${canPayDebtExtra}.`,
      );
    } catch (e) {
      gaps.push('liquidity');
      notes.push(e instanceof Error ? e.message : 'Error de liquidez');
    }
  } else {
    gaps.push('canPayDebtExtra');
  }

  const canSpendToday = immediateFreeCash;
  const canInvest = immediateFreeCash;
  const canRestock = earmark;
  const canWithdrawProfit = canPayDebtExtra;
  const adsFreed = input.marketingFreedCapacity?.trim();
  const adsOver = input.marketingOverspend?.trim();
  let canSpendAds: string | null = immediateFreeCash;
  if (adsOver && moneyNum(adsOver) > 0) {
    canSpendAds = '0';
    notes.push(`Publicidad ya sobre presupuesto (${adsOver}); capacidad ads = 0.`);
  } else if (adsFreed && moneyNum(adsFreed) > 0 && immediateFreeCash != null) {
    canSpendAds = floor0(Math.min(moneyNum(immediateFreeCash), moneyNum(adsFreed)));
    notes.push(`Publicidad: min(capacidad inmediata, freed ${adsFreed}) = ${canSpendAds}.`);
  }

  return {
    currency,
    cashOnHand,
    recompraEarmark: earmark,
    cashAfterRecompra: afterRec,
    payrollMonthly,
    nextQuincena,
    creditCardInstallment,
    immediateFreeCash,
    remainingCalendarDaysInMonth: days,
    canSpendToday,
    canInvest,
    canPayDebtExtra,
    canRestock,
    canWithdrawProfit,
    canSpendAds,
    reserveAmount,
    runwayMonths,
    notes,
    gaps: [...new Set(gaps)],
  };
}
