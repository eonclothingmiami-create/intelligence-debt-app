/**
 * Month calendar of vencimientos from budget (costs/debts) + config.
 * Does not invent due dates — only surfaces configured days.
 */

import {
  commitmentKey,
  effectiveDueDay,
  loadCommitmentLedger,
  type CommitmentStatus,
  type ScheduleSource,
} from '@/lib/commitmentSchedule';

export type CalendarEventKind =
  'fixed_cost' | 'obligation' | 'closing' | 'payroll_quincena' | 'restock_hint';

export type CalendarEvent = {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  day: number;
  kind: CalendarEventKind;
  label: string;
  amount: string | null;
  status: CommitmentStatus | null;
  category?: string;
};

export type MonthGridCell = {
  day: number | null;
  date: string | null;
  isToday: boolean;
  events: CalendarEvent[];
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function parseClosingDays(raw: string, dim: number): number[] {
  if (!raw.trim()) return [];
  const out: number[] = [];
  for (const part of raw.split(/[,;\s]+/)) {
    const n = Number(part.trim());
    if (Number.isFinite(n) && n >= 1 && n <= 31) {
      out.push(Math.min(Math.floor(n), dim));
    }
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

export type BuildMonthCalendarInput = {
  year: number;
  /** 1–12 */
  month: number;
  source: ScheduleSource;
  closingDaysOfMonth: string;
  /** When set, marks quincena on day 15 and last day of month. */
  payrollMonthly: string | null;
  /** Average restock cycle — projects hints within the month from day 1. */
  inventoryRestockCycleDays: string;
  asOf?: Date;
};

/**
 * All events for a calendar month from configured facts only.
 */
export function buildMonthEvents(input: BuildMonthCalendarInput): CalendarEvent[] {
  const { year, month } = input;
  const dim = daysInMonth(year, month);
  const ym = `${year}-${pad2(month)}`;
  const sampleDay = isoDate(year, month, 1);
  const ledger = loadCommitmentLedger();
  const events: CalendarEvent[] = [];

  for (const fc of input.source.fixedCosts) {
    if (!fc.active || fc.dueDay == null || fc.dueDay < 1) continue;
    const due = effectiveDueDay(fc.dueDay, sampleDay);
    const key = commitmentKey('fixed_cost', fc.id, ym);
    const rec = ledger[key];
    events.push({
      id: key,
      date: isoDate(year, month, due),
      day: due,
      kind: 'fixed_cost',
      label: fc.label,
      amount: fc.amount,
      status: rec?.status ?? 'programado',
      category: fc.category,
    });
  }

  for (const obl of input.source.obligations) {
    if (!obl.active || obl.paymentDueDay == null || obl.paymentDueDay < 1) continue;
    const due = effectiveDueDay(obl.paymentDueDay, sampleDay);
    const key = commitmentKey('obligation', obl.id, ym);
    const rec = ledger[key];
    const amount =
      obl.targetPaymentAmount ?? obl.fixedInstallmentAmount ?? obl.minimumPaymentAmount ?? null;
    events.push({
      id: key,
      date: isoDate(year, month, due),
      day: due,
      kind: 'obligation',
      label: obl.label,
      amount,
      status: rec?.status ?? 'programado',
    });
  }

  for (const d of parseClosingDays(input.closingDaysOfMonth, dim)) {
    events.push({
      id: `closing:${ym}:${d}`,
      date: isoDate(year, month, d),
      day: d,
      kind: 'closing',
      label: 'Cierre formal (config)',
      amount: null,
      status: null,
    });
  }

  if (input.payrollMonthly != null && input.payrollMonthly !== '') {
    const half = String(Math.round(Number(input.payrollMonthly) / 2));
    const quincenaDays = [15, dim].filter((d, i, arr) => arr.indexOf(d) === i);
    for (const d of quincenaDays) {
      events.push({
        id: `payroll:${ym}:${d}`,
        date: isoDate(year, month, d),
        day: d,
        kind: 'payroll_quincena',
        label: d === 15 ? 'Quincena (1ª mitad)' : 'Quincena (2ª mitad / fin de mes)',
        amount: Number.isFinite(Number(half)) ? half : null,
        status: null,
        category: 'Nómina',
      });
    }
  }

  const cycle = Number(input.inventoryRestockCycleDays);
  if (Number.isFinite(cycle) && cycle >= 1 && cycle <= 31) {
    for (let d = Math.min(Math.floor(cycle), dim); d <= dim; d += Math.floor(cycle)) {
      events.push({
        id: `restock:${ym}:${d}`,
        date: isoDate(year, month, d),
        day: d,
        kind: 'restock_hint',
        label: `Recompra proyectada (ciclo ${Math.floor(cycle)}d)`,
        amount: null,
        status: null,
      });
    }
  }

  return events.sort((a, b) => a.day - b.day || a.label.localeCompare(b.label));
}

/**
 * 7-column grid (Sun–Sat) for the month.
 */
export function buildMonthGrid(
  year: number,
  month: number,
  events: CalendarEvent[],
  asOf: Date = new Date(),
): MonthGridCell[] {
  const dim = daysInMonth(year, month);
  const firstDow = new Date(year, month - 1, 1).getDay(); /* 0=Sun */
  const todayIso = isoDate(asOf.getFullYear(), asOf.getMonth() + 1, asOf.getDate());
  const byDay = new Map<number, CalendarEvent[]>();
  for (const e of events) {
    const list = byDay.get(e.day) ?? [];
    list.push(e);
    byDay.set(e.day, list);
  }

  const cells: MonthGridCell[] = [];
  for (let i = 0; i < firstDow; i++) {
    cells.push({ day: null, date: null, isToday: false, events: [] });
  }
  for (let d = 1; d <= dim; d++) {
    const date = isoDate(year, month, d);
    cells.push({
      day: d,
      date,
      isToday: date === todayIso,
      events: byDay.get(d) ?? [],
    });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ day: null, date: null, isToday: false, events: [] });
  }
  return cells;
}

export function monthLabelEs(year: number, month: number): string {
  const raw = new Date(year, month - 1, 1).toLocaleDateString('es-CO', {
    month: 'long',
    year: 'numeric',
  });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export const EVENT_KIND_LABEL: Record<CalendarEventKind, string> = {
  fixed_cost: 'Costo fijo',
  obligation: 'Deuda / cuota',
  closing: 'Cierre',
  payroll_quincena: 'Nómina',
  restock_hint: 'Recompra',
};
