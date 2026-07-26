import type { ClosingLineInput } from '@/lib/closingApi';
import { loadCashSnapshot, saveCashSnapshot } from '@/lib/cashStore';
import { recordExtraPayment, recordOrdinaryPayment, type DebtWorkspace } from '@/lib/debtStore';
import type { WorkspaceCashSnapshot } from '@/lib/workspaceProfile';

function moneyNum(v: string | undefined | null): number {
  if (v == null || v === '') return 0;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function moneyStr(n: number): string {
  return Math.round(n).toFixed(0);
}

/** Net cash delta from closing lines (inflows − outflows). */
export function netCashDeltaFromLines(lines: ClosingLineInput[]): number {
  let delta = 0;
  for (const line of lines) {
    // New obligation registration is a balance fact, not a cash movement.
    if (line.lineType === 'new_obligation') continue;
    const total =
      line.totalAmount != null && line.totalAmount !== ''
        ? moneyNum(line.totalAmount)
        : moneyNum(line.baseAmount) +
          moneyNum(line.lateInterestAmount) +
          moneyNum(line.otherAdjustmentAmount);
    if (line.direction === 'inflow') delta += total;
    else delta -= total;
  }
  return delta;
}

export type ApplyClosingEffectsResult = {
  cashSnapshot: WorkspaceCashSnapshot;
  cashOnHand: string;
  debtWs: DebtWorkspace;
};

/**
 * Applies confirmed closing lines to local cash + debt workspace.
 * Fixed-cost month ledger lives in Supabase (Edge); this only updates client cash/debts.
 */
export function applyClosingEffects(
  lines: ClosingLineInput[],
  debtWs: DebtWorkspace,
  businessDay: string,
): ApplyClosingEffectsResult {
  const snap = loadCashSnapshot();
  const current = moneyNum(snap.cashOnHand);
  const nextCash = moneyStr(current + netCashDeltaFromLines(lines));
  const cashSnapshot = saveCashSnapshot({ ...snap, cashOnHand: nextCash });

  let nextDebts = debtWs;
  for (const line of lines) {
    if (line.lineType !== 'obligation_payment' || !line.obligationId) continue;
    const amount =
      line.totalAmount != null && line.totalAmount !== ''
        ? line.totalAmount
        : moneyStr(
            moneyNum(line.baseAmount) +
              moneyNum(line.lateInterestAmount) +
              moneyNum(line.otherAdjustmentAmount),
          );
    if (moneyNum(amount) <= 0) continue;
    const kind = line.paymentKind ?? 'abono_extra';
    if (kind === 'abono_extra') {
      nextDebts = recordExtraPayment(nextDebts, line.obligationId, amount, businessDay);
    } else {
      nextDebts = recordOrdinaryPayment(nextDebts, line.obligationId, amount, businessDay);
    }
  }

  return { cashSnapshot, cashOnHand: nextCash, debtWs: nextDebts };
}
