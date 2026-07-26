'use client';

import { useMemo, useState } from 'react';
import {
  buildReport,
  downloadReportCsv,
  downloadReportJson,
  printReport,
  REPORT_KIND_META,
  type BoardReportInput,
  type ReportKind,
} from '@/lib/reports';

type Props = {
  input: BoardReportInput;
};

const KINDS = Object.keys(REPORT_KIND_META) as ReportKind[];

/**
 * Export surfaces — CSV / JSON / print-PDF from board facts only.
 */
export function ReportsPanel({ input }: Props) {
  const [kind, setKind] = useState<ReportKind>('monthly_snapshot');
  const snapshot = useMemo(() => buildReport(kind, input), [kind, input]);

  return (
    <section className="space-y-6">
      <header>
        <h2 className="brand-mark text-3xl text-forest md:text-4xl">Reportes</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Exporta hechos ya calculados del tablero (CSV para Excel, JSON, o imprimir / guardar PDF).
          No recalcula ni inventa cifras.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {KINDS.map((k) => {
          const meta = REPORT_KIND_META[k];
          const selected = kind === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-2xl border p-4 text-left transition ${
                selected
                  ? 'border-forest bg-forest/10'
                  : 'border-[var(--line)] bg-white/40 hover:border-forest/40'
              }`}
            >
              <p className="font-semibold text-forest">{meta.title}</p>
              <p className="mt-1 text-xs text-muted">{meta.audience}</p>
              <p className="mt-2 text-sm text-ink/80">{meta.blurb}</p>
            </button>
          );
        })}
      </div>

      <div className="panel rounded-2xl p-4 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-forest">{snapshot.title}</h3>
            <p className="text-xs text-muted">
              {snapshot.audience} · {snapshot.currency} · {snapshot.rows.length} filas · generado{' '}
              {new Date(snapshot.generatedAt).toLocaleString('es-CO')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => downloadReportCsv(snapshot)}
              className="rounded-full bg-forest px-4 py-2 text-sm font-semibold text-mist"
            >
              Descargar CSV
            </button>
            <button
              type="button"
              onClick={() => downloadReportJson(snapshot)}
              className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold"
            >
              JSON
            </button>
            <button
              type="button"
              onClick={() => printReport(snapshot)}
              className="rounded-full border border-forest px-4 py-2 text-sm font-semibold text-forest"
            >
              Imprimir / PDF
            </button>
          </div>
        </div>

        {snapshot.gaps.length > 0 ? (
          <p className="mt-3 text-sm text-amber-800">
            Gaps declarados en el export: {snapshot.gaps.join(', ')}
          </p>
        ) : null}

        <div className="mt-4 max-h-[28rem] overflow-auto rounded-xl border border-[var(--line)]">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-mist/90 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2">Sección</th>
                <th className="px-3 py-2">Concepto</th>
                <th className="px-3 py-2">Valor</th>
                <th className="px-3 py-2">Nota</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.rows.map((r, i) => (
                <tr key={`${r.section}-${r.label}-${i}`} className="border-t border-[var(--line)]">
                  <td className="px-3 py-2 text-muted">{r.section}</td>
                  <td className="px-3 py-2 font-medium">{r.label}</td>
                  <td className="metric px-3 py-2">{r.value}</td>
                  <td className="px-3 py-2 text-xs text-muted">{r.note ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
