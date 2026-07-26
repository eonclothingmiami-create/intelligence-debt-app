'use client';

import { useMemo, useState } from 'react';
import {
  buildMonthEvents,
  buildMonthGrid,
  EVENT_KIND_LABEL,
  monthLabelEs,
  type CalendarEvent,
  type CalendarEventKind,
} from '@/lib/calendar';
import type { ScheduleSource } from '@/lib/commitmentSchedule';
import { formatCop } from '@/lib/format';

type Props = {
  source: ScheduleSource;
  closingDaysOfMonth: string;
  payrollMonthly: string | null;
  inventoryRestockCycleDays: string;
  onGoToClosings: () => void;
  onGoToConfig: () => void;
};

const KIND_DOT: Record<CalendarEventKind, string> = {
  fixed_cost: 'bg-forest',
  obligation: 'bg-danger',
  closing: 'bg-moss',
  payroll_quincena: 'bg-amber-700',
  restock_hint: 'bg-ink/40',
};

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/**
 * Vencimientos del mes — costos, deudas, cierres config, quincenas, recompra proyectada.
 */
export function CalendarPanel({
  source,
  closingDaysOfMonth,
  payrollMonthly,
  inventoryRestockCycleDays,
  onGoToClosings,
  onGoToConfig,
}: Props) {
  const asOf = useMemo(() => new Date(), []);
  const [year, setYear] = useState(asOf.getFullYear());
  const [month, setMonth] = useState(asOf.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState<number | null>(asOf.getDate());

  const events = useMemo(
    () =>
      buildMonthEvents({
        year,
        month,
        source,
        closingDaysOfMonth,
        payrollMonthly,
        inventoryRestockCycleDays,
        asOf,
      }),
    [year, month, source, closingDaysOfMonth, payrollMonthly, inventoryRestockCycleDays, asOf],
  );

  const grid = useMemo(
    () => buildMonthGrid(year, month, events, asOf),
    [year, month, events, asOf],
  );

  const dayEvents: CalendarEvent[] = useMemo(() => {
    if (selectedDay == null) return [];
    return events.filter((e) => e.day === selectedDay);
  }, [events, selectedDay]);

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setMonth(m);
    setYear(y);
    setSelectedDay(null);
  }

  const totalConfigured = events.filter(
    (e) => e.kind === 'fixed_cost' || e.kind === 'obligation',
  ).length;

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="brand-mark text-3xl text-forest md:text-4xl">Calendario</h2>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Vencimientos del mes desde costos, deudas y Configuración. No inventa fechas: solo
            muestra días que ya definiste.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-full border border-[var(--line)] px-3 py-1.5 text-sm"
            onClick={() => shiftMonth(-1)}
          >
            ←
          </button>
          <p className="min-w-[10rem] text-center text-sm font-semibold text-forest">
            {monthLabelEs(year, month)}
          </p>
          <button
            type="button"
            className="rounded-full border border-[var(--line)] px-3 py-1.5 text-sm"
            onClick={() => shiftMonth(1)}
          >
            →
          </button>
        </div>
      </header>

      <p className="text-xs text-muted">
        {totalConfigured} pago(s) presupuestado(s) este mes
        {!closingDaysOfMonth.trim() ? ' · sin días de cierre formal en Config' : ''}
        {!payrollMonthly ? ' · sin nómina para marcar quincenas' : ''}. Edita días en{' '}
        <button type="button" className="underline" onClick={onGoToConfig}>
          Configuración
        </button>{' '}
        / Costos / Deudas.
      </p>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="panel rounded-2xl p-3 md:p-4">
          <div className="grid grid-cols-7 gap-1 text-center text-[0.65rem] font-semibold uppercase tracking-wider text-muted">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {grid.map((cell, i) => {
              if (cell.day == null) {
                return <div key={`e-${i}`} className="min-h-[3.25rem] rounded-lg" />;
              }
              const selected = selectedDay === cell.day;
              return (
                <button
                  key={cell.date}
                  type="button"
                  onClick={() => setSelectedDay(cell.day)}
                  className={`min-h-[3.25rem] rounded-lg border p-1 text-left transition ${
                    selected
                      ? 'border-forest bg-forest/10'
                      : cell.isToday
                        ? 'border-moss/50 bg-moss/5'
                        : 'border-transparent hover:border-[var(--line)] hover:bg-white/50'
                  }`}
                >
                  <span
                    className={`text-xs font-semibold ${cell.isToday ? 'text-forest' : 'text-ink'}`}
                  >
                    {cell.day}
                  </span>
                  <div className="mt-1 flex flex-wrap gap-0.5">
                    {cell.events.slice(0, 4).map((e) => (
                      <span
                        key={e.id}
                        className={`h-1.5 w-1.5 rounded-full ${KIND_DOT[e.kind]}`}
                        title={e.label}
                      />
                    ))}
                    {cell.events.length > 4 ? (
                      <span className="text-[0.6rem] text-muted">+{cell.events.length - 4}</span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
          <ul className="mt-3 flex flex-wrap gap-3 text-[0.65rem] text-muted">
            {(Object.keys(EVENT_KIND_LABEL) as CalendarEventKind[]).map((k) => (
              <li key={k} className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${KIND_DOT[k]}`} />
                {EVENT_KIND_LABEL[k]}
              </li>
            ))}
          </ul>
        </div>

        <div className="panel rounded-2xl p-4 md:p-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">
            {selectedDay != null
              ? `Día ${selectedDay} · ${monthLabelEs(year, month)}`
              : 'Selecciona un día'}
          </h3>
          {selectedDay == null ? (
            <p className="mt-4 text-sm text-muted">Toca un día del mes para ver vencimientos.</p>
          ) : dayEvents.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Sin vencimientos configurados este día.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {dayEvents.map((e) => (
                <li key={e.id} className="border-b border-[var(--line)] pb-3 last:border-0">
                  <p className="text-xs uppercase tracking-wide text-muted">
                    {EVENT_KIND_LABEL[e.kind]}
                    {e.status ? ` · ${e.status}` : ''}
                  </p>
                  <p className="mt-0.5 font-medium text-forest">{e.label}</p>
                  {e.amount ? (
                    <p className="metric text-sm text-ink">{formatCop(e.amount)}</p>
                  ) : null}
                  {e.category ? <p className="text-xs text-muted">{e.category}</p> : null}
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={onGoToClosings}
            className="mt-5 rounded-full border border-forest px-4 py-2 text-sm font-semibold text-forest"
          >
            Ir a Movimientos
          </button>
        </div>
      </div>
    </section>
  );
}
