import type { BreakEvenModel } from '@fie/break-even-engine';
import type { FinancialContext } from '@fie/recommendation-ai';
import { listMonthCommitmentSnapshot } from '@/lib/commitmentSchedule';
import {
  fetchClosingsRange,
  fetchClosingStatus,
  fetchFixedCostMonthPayments,
  type ClosingLineRow,
  type ClosingStatus,
} from '@/lib/closingApi';
import type { DebtWorkspace } from '@/lib/debtStore';

function moneyStr(v: number | string | undefined | null): string {
  if (v == null || v === '') return '0';
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.round(n).toFixed(0) : '0';
}

function sumLines(lines: ClosingLineRow[], type: string): number {
  return lines
    .filter((l) => l.line_type === type)
    .reduce((acc, l) => {
      const t = Number(l.total_amount) || 0;
      if (l.direction === 'inflow') return acc + t;
      return acc + t;
    }, 0);
}

function extraordinaryNet(lines: ClosingLineRow[]): number {
  return lines
    .filter((l) => l.line_type === 'extraordinary')
    .reduce((acc, l) => {
      const t = Number(l.total_amount) || 0;
      return l.direction === 'inflow' ? acc + t : acc - t;
    }, 0);
}

export type ClosingBoardFacts = FinancialContext['dailyClosing'];

export async function loadClosingBoardFacts(
  model: BreakEvenModel | null,
  debtWs?: DebtWorkspace | null,
): Promise<{ status: ClosingStatus; facts: ClosingBoardFacts }> {
  const status = await fetchClosingStatus();
  const ym = status.today.slice(0, 7);
  const [{ payments }, { closings }] = await Promise.all([
    fetchFixedCostMonthPayments(ym),
    fetchClosingsRange(status.seriesStart, status.today),
  ]);

  const paidById = new Map(payments.map((p) => [p.fixed_cost_id, p]));
  const fixedCostsThisMonth = (model?.fixedCosts ?? [])
    .filter((l) => l.active)
    .map((l) => {
      const paid = paidById.get(l.id);
      return {
        fixedCostId: l.id,
        label: l.label,
        planAmount: l.amount,
        paid: Boolean(paid),
        totalPaid: paid ? moneyStr(paid.total_paid) : null,
        basePaid: paid ? moneyStr(paid.base_amount) : null,
        lateInterestPaid: paid ? moneyStr(paid.late_interest_amount) : null,
        otherAdjustmentPaid: paid ? moneyStr(paid.other_adjustment_amount) : null,
        paidOn: paid ? String(paid.paid_on).slice(0, 10) : null,
      };
    });

  const commitments = listMonthCommitmentSnapshot(ym, {
    fixedCosts: (model?.fixedCosts ?? []).map((l) => ({
      id: l.id,
      label: l.label,
      amount: l.amount,
      category: l.category,
      active: l.active,
      dueDay: l.dueDay,
    })),
    obligations: (debtWs?.obligations ?? []).map((o) => ({
      id: o.id,
      label: o.label,
      active: o.active,
      paymentDueDay: o.paymentDueDay,
      targetPaymentAmount: o.targetPaymentAmount,
      fixedInstallmentAmount: o.fixedInstallmentAmount,
      minimumPaymentAmount: o.minimumPaymentAmount,
    })),
  }).map((c) => ({
    key: c.key,
    kind: c.kind,
    label: c.label,
    scheduledAmount: c.scheduledAmount,
    status: c.status,
    paidAmount: c.paidAmount ?? null,
    dueDay: c.dueDay,
    deferredTo: c.deferredTo ?? null,
  }));

  const recentClosings = closings.slice(0, 14).map((c) => {
    const lines = c.lines ?? [];
    return {
      businessDay: String(c.business_day).slice(0, 10),
      notes: c.notes,
      lineCount: lines.length,
      expensesTotal: moneyStr(sumLines(lines, 'expense')),
      fixedCostPaymentsTotal: moneyStr(sumLines(lines, 'fixed_cost_payment')),
      obligationPaymentsTotal: moneyStr(sumLines(lines, 'obligation_payment')),
      extraordinaryNet: moneyStr(extraordinaryNet(lines)),
    };
  });

  return {
    status,
    facts: {
      seriesStart: status.seriesStart,
      today: status.today,
      pendingDays: status.pendingDays,
      lastClosed: status.lastClosed,
      canGenerateRecommendations: status.canGenerateRecommendations,
      recentClosings,
      fixedCostsThisMonth,
      commitments,
    },
  };
}
