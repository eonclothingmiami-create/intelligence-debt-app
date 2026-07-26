'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchClosingDay,
  fetchClosingsRange,
  patchClosingDay,
  type ClosingLineInput,
  type ClosingLineRow,
  type ClosingStatus,
  type DailyClosingRow,
} from '@/lib/closingApi';
import { formatCop } from '@/lib/format';

type Props = {
  status: ClosingStatus | null;
};

function moneyStr(v: number | string): string {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.round(n).toFixed(0) : '0';
}

function rowToInput(row: ClosingLineRow): ClosingLineInput {
  return {
    lineType: row.line_type,
    sortOrder: row.sort_order,
    concept: row.concept,
    category: row.category,
    note: row.note,
    obligationId: row.obligation_id,
    fixedCostId: row.fixed_cost_id,
    paymentKind: row.payment_kind,
    baseAmount: moneyStr(row.base_amount),
    lateInterestAmount: moneyStr(row.late_interest_amount),
    otherAdjustmentAmount: moneyStr(row.other_adjustment_amount),
    totalAmount: moneyStr(row.total_amount),
    direction: row.direction,
    meta: row.meta,
  };
}

export function ClosingHistoryPanel({ status }: Props) {
  const [rows, setRows] = useState<Array<DailyClosingRow & { lines: ClosingLineRow[] }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [audit, setAudit] = useState<unknown[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!status?.seriesStart || !status.today) return;
    setLoading(true);
    setError(null);
    try {
      const { closings } = await fetchClosingsRange(status.seriesStart, status.today);
      setRows(closings);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando historial');
    } finally {
      setLoading(false);
    }
  }, [status?.seriesStart, status?.today]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openDay(day: string) {
    setSelectedDay(day);
    setError(null);
    try {
      const detail = await fetchClosingDay(day);
      setEditNotes(detail.closing.notes ?? '');
      setAudit(detail.audit ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error abriendo cierre');
    }
  }

  async function saveNotes() {
    if (!selectedDay) return;
    setSaving(true);
    setError(null);
    try {
      const detail = await fetchClosingDay(selectedDay);
      const lines = detail.lines.map(rowToInput);
      await patchClosingDay(selectedDay, {
        notes: editNotes,
        lines,
        changedBy: 'owner',
      });
      setAudit((await fetchClosingDay(selectedDay)).audit ?? []);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error guardando');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="panel rounded-2xl p-4 md:p-6">
        <h2 className="brand-mark text-2xl text-forest">Registro de movimientos</h2>
        <p className="mt-1 text-sm text-muted">
          Hechos manuales (gastos, pagos, deudas, extraordinarios). Ventas e inventario viven en el
          ERP. No se borran; las ediciones quedan en auditoría.
        </p>
        {status ? (
          <p className="mt-2 text-xs text-muted">
            Serie desde {status.seriesStart} · Cerrados {status.closedCount} · Pendientes{' '}
            {status.pendingDays.length}
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}
        {loading ? <p className="mt-4 text-sm text-muted">Cargando…</p> : null}
        <ul className="mt-4 divide-y divide-[var(--line)]">
          {rows.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <p className="font-medium">{String(c.business_day).slice(0, 10)}</p>
                <p className="text-xs text-muted">
                  {c.lines?.length ?? 0} líneas · rev {c.revision} · {c.closed_by}
                </p>
              </div>
              <button
                type="button"
                className="text-sm text-forest underline"
                onClick={() => void openDay(String(c.business_day).slice(0, 10))}
              >
                Ver / editar notas
              </button>
            </li>
          ))}
          {!loading && rows.length === 0 ? (
            <li className="py-4 text-sm text-muted">Aún no hay registros en la serie.</li>
          ) : null}
        </ul>
      </div>

      {selectedDay ? (
        <div className="panel rounded-2xl p-4 md:p-6">
          <h3 className="text-lg font-semibold text-forest">Registro {selectedDay}</h3>
          <label className="mt-3 block text-sm text-muted">
            Notas
            <textarea
              className="mt-1 min-h-[80px] w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm text-ink"
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
            />
          </label>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="rounded-lg bg-forest px-4 py-2 text-sm text-white disabled:opacity-50"
              disabled={saving}
              onClick={() => void saveNotes()}
            >
              {saving ? 'Guardando…' : 'Guardar notas (audit)'}
            </button>
            <button
              type="button"
              className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm"
              onClick={() => setSelectedDay(null)}
            >
              Cerrar
            </button>
          </div>
          {rows
            .find((r) => String(r.business_day).slice(0, 10) === selectedDay)
            ?.lines?.map((line) => (
              <div
                key={line.id}
                className="mt-3 rounded-lg border border-[var(--line)] p-3 text-sm"
              >
                <p className="font-medium">
                  {line.line_type} · {line.concept ?? '—'}
                </p>
                <p className="text-muted">
                  Total {formatCop(moneyStr(line.total_amount))}
                  {Number(line.late_interest_amount) > 0
                    ? ` (mora ${formatCop(moneyStr(line.late_interest_amount))})`
                    : ''}
                </p>
              </div>
            ))}
          {audit.length > 0 ? (
            <div className="mt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
                Auditoría
              </h4>
              <ul className="mt-2 space-y-1 text-xs text-muted">
                {audit.map((a, i) => {
                  const row = a as {
                    field_path?: string;
                    changed_at?: string;
                    changed_by?: string;
                  };
                  return (
                    <li key={i}>
                      {row.changed_at} · {row.field_path} · {row.changed_by}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
