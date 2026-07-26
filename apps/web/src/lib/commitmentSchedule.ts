/**
 * Budget vs execution: commitment schedule + status for fixed costs and debt dues.
 * Budget lives in BEP catalog / debt config; execution is confirmed in the daily register.
 */

export type CommitmentStatus = 'programado' | 'pendiente' | 'pagado' | 'parcial' | 'omitido';

export type CommitmentKind = 'fixed_cost' | 'obligation';

export type CommitmentKey = string; // e.g. fc:arriendo:2026-07 | obl:obl_dav:2026-07

export type CommitmentRecord = {
  key: CommitmentKey;
  kind: CommitmentKind;
  refId: string;
  label: string;
  yearMonth: string;
  dueDay: number;
  scheduledAmount: string;
  status: CommitmentStatus;
  paidAmount?: string;
  deferredTo?: string;
  updatedAt: string;
};

export type DueTodayItem = {
  key: CommitmentKey;
  kind: CommitmentKind;
  refId: string;
  label: string;
  category?: string;
  scheduledAmount: string;
  dueDay: number;
  status: CommitmentStatus;
  overdue: boolean;
};

const STORAGE_KEY = 'fie.os.commitments.v1';

function yearMonth(isoDate: string): string {
  return isoDate.slice(0, 7);
}

function dayOfMonth(isoDate: string): number {
  return Number(isoDate.slice(8, 10));
}

function daysInMonth(isoDate: string): number {
  const y = Number(isoDate.slice(0, 4));
  const m = Number(isoDate.slice(5, 7));
  return new Date(y, m, 0).getDate();
}

/** Clamp due day to last day of that month (e.g. 31 in February → 28/29). */
export function effectiveDueDay(dueDay: number, isoDate: string): number {
  const dim = daysInMonth(isoDate);
  return Math.min(Math.max(1, dueDay), dim);
}

export function commitmentKey(kind: CommitmentKind, refId: string, ym: string): CommitmentKey {
  return `${kind === 'fixed_cost' ? 'fc' : 'obl'}:${refId}:${ym}`;
}

export function loadCommitmentLedger(): Record<CommitmentKey, CommitmentRecord> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<CommitmentKey, CommitmentRecord>;
  } catch {
    return {};
  }
}

export function saveCommitmentLedger(ledger: Record<CommitmentKey, CommitmentRecord>): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ledger));
}

export function upsertCommitment(record: CommitmentRecord): CommitmentRecord {
  const ledger = loadCommitmentLedger();
  ledger[record.key] = record;
  saveCommitmentLedger(ledger);
  return record;
}

export type ScheduleSource = {
  fixedCosts: Array<{
    id: string;
    label: string;
    amount: string;
    category: string;
    active: boolean;
    dueDay?: number;
  }>;
  obligations: Array<{
    id: string;
    label: string;
    active: boolean;
    paymentDueDay?: number;
    targetPaymentAmount?: string;
    fixedInstallmentAmount?: string;
    minimumPaymentAmount?: string;
  }>;
};

/**
 * Items that should appear in "Pendientes del día" for businessDay:
 * due today or overdue and not yet pagado this month.
 */
export function listDueCommitmentsForDay(
  businessDay: string,
  source: ScheduleSource,
): DueTodayItem[] {
  const ym = yearMonth(businessDay);
  const todayDom = dayOfMonth(businessDay);
  const ledger = loadCommitmentLedger();
  const out: DueTodayItem[] = [];

  for (const fc of source.fixedCosts) {
    if (!fc.active || fc.dueDay == null || fc.dueDay < 1) continue;
    const due = effectiveDueDay(fc.dueDay, businessDay);
    const key = commitmentKey('fixed_cost', fc.id, ym);
    const rec = ledger[key];
    const status: CommitmentStatus = rec?.status ?? (todayDom < due ? 'programado' : 'pendiente');
    if (status === 'pagado') continue;
    if (status === 'programado' && todayDom < due) continue;
    // deferred to a future date: only show on/after deferredTo
    if (status === 'omitido' && rec?.deferredTo) {
      if (businessDay < rec.deferredTo) continue;
    }
    out.push({
      key,
      kind: 'fixed_cost',
      refId: fc.id,
      label: fc.label,
      category: fc.category,
      scheduledAmount: fc.amount,
      dueDay: due,
      status: status === 'programado' ? 'pendiente' : status,
      overdue: todayDom > due && status !== 'omitido',
    });
  }

  for (const obl of source.obligations) {
    if (!obl.active || obl.paymentDueDay == null || obl.paymentDueDay < 1) continue;
    const due = effectiveDueDay(obl.paymentDueDay, businessDay);
    const key = commitmentKey('obligation', obl.id, ym);
    const rec = ledger[key];
    const scheduled =
      obl.targetPaymentAmount ?? obl.fixedInstallmentAmount ?? obl.minimumPaymentAmount ?? '0';
    const status: CommitmentStatus = rec?.status ?? (todayDom < due ? 'programado' : 'pendiente');
    if (status === 'pagado') continue;
    if (status === 'programado' && todayDom < due) continue;
    if (status === 'omitido' && rec?.deferredTo && businessDay < rec.deferredTo) continue;
    out.push({
      key,
      kind: 'obligation',
      refId: obl.id,
      label: obl.label,
      scheduledAmount: scheduled,
      dueDay: due,
      status: status === 'programado' ? 'pendiente' : status,
      overdue: todayDom > due && status !== 'omitido',
    });
  }

  return out.sort((a, b) => a.dueDay - b.dueDay || a.label.localeCompare(b.label));
}

export function applyCommitmentDecision(input: {
  item: DueTodayItem;
  yearMonth: string;
  decision: 'pagado' | 'parcial' | 'omitido';
  paidAmount?: string;
  deferredTo?: string;
}): CommitmentRecord {
  const record: CommitmentRecord = {
    key: input.item.key,
    kind: input.item.kind,
    refId: input.item.refId,
    label: input.item.label,
    yearMonth: input.yearMonth,
    dueDay: input.item.dueDay,
    scheduledAmount: input.item.scheduledAmount,
    status: input.decision,
    updatedAt: new Date().toISOString(),
  };
  if (input.decision === 'parcial' && input.paidAmount) {
    record.paidAmount = input.paidAmount;
  }
  if (input.decision === 'pagado') {
    record.paidAmount = input.paidAmount ?? input.item.scheduledAmount;
  }
  if (input.decision === 'omitido' && input.deferredTo) {
    record.deferredTo = input.deferredTo;
  }
  return upsertCommitment(record);
}

/** Snapshot for AI / board — all commitments in a month. */
export function listMonthCommitmentSnapshot(
  ym: string,
  source: ScheduleSource,
): CommitmentRecord[] {
  const ledger = loadCommitmentLedger();
  const rows: CommitmentRecord[] = [];
  const probeDay = `${ym}-15`;

  for (const fc of source.fixedCosts) {
    if (!fc.active || fc.dueDay == null) continue;
    const key = commitmentKey('fixed_cost', fc.id, ym);
    const due = effectiveDueDay(fc.dueDay, probeDay);
    const existing = ledger[key];
    rows.push(
      existing ?? {
        key,
        kind: 'fixed_cost',
        refId: fc.id,
        label: fc.label,
        yearMonth: ym,
        dueDay: due,
        scheduledAmount: fc.amount,
        status: 'programado',
        updatedAt: '',
      },
    );
  }
  for (const obl of source.obligations) {
    if (!obl.active || obl.paymentDueDay == null) continue;
    const key = commitmentKey('obligation', obl.id, ym);
    const due = effectiveDueDay(obl.paymentDueDay, probeDay);
    const scheduled =
      obl.targetPaymentAmount ?? obl.fixedInstallmentAmount ?? obl.minimumPaymentAmount ?? '0';
    const existing = ledger[key];
    rows.push(
      existing ?? {
        key,
        kind: 'obligation',
        refId: obl.id,
        label: obl.label,
        yearMonth: ym,
        dueDay: due,
        scheduledAmount: scheduled,
        status: 'programado',
        updatedAt: '',
      },
    );
  }
  return rows;
}
