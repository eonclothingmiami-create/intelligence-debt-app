'use client';

import type { CapacitySnapshot } from '@fie/financial-orchestrator';
import { formatCop, formatPct } from '@/lib/format';

type Props = {
  capacity: CapacitySnapshot | null;
  currency: string;
  cash: string;
  recompraShare: string;
  reserveMonths: string;
  minCashFloor: string;
  policyComplete: boolean;
  hasPendingClosings: boolean;
  pendingClosingCount: number;
  onCashChange: (cash: string) => void;
  onRecompraShareChange: (share: string) => void;
  onUseInDecision: () => void;
  onGenerateAi: () => void;
  aiPending: boolean;
};

const QUESTIONS: {
  key: keyof Pick<
    CapacitySnapshot,
    | 'canSpendToday'
    | 'canInvest'
    | 'canPayDebtExtra'
    | 'canRestock'
    | 'canWithdrawProfit'
    | 'canSpendAds'
  >;
  title: string;
  hint: string;
}[] = [
  { key: 'canSpendToday', title: '¿Cuánto puedo gastar hoy?', hint: 'Tras earmarks operativos' },
  { key: 'canInvest', title: '¿Cuánto puedo invertir?', hint: 'Misma capacidad inmediata' },
  { key: 'canPayDebtExtra', title: '¿Cuánto abonar a deuda?', hint: 'Respetando reserva' },
  { key: 'canRestock', title: '¿Cuánto recomprar inventario?', hint: 'Earmark de recompra' },
  {
    key: 'canWithdrawProfit',
    title: '¿Cuánto retirar como utilidad?',
    hint: 'Tope seguro post-reserva',
  },
  { key: 'canSpendAds', title: '¿Cuánto destinar a publicidad?', hint: 'Capacidad vs ads' },
];

/**
 * Daily owner screen: six capacity questions from the orchestrator.
 * One composition — not a KPI dashboard.
 */
export function CapacityPanel({
  capacity,
  currency,
  cash,
  recompraShare,
  reserveMonths,
  minCashFloor,
  policyComplete,
  hasPendingClosings,
  pendingClosingCount,
  onCashChange,
  onRecompraShareChange,
  onUseInDecision,
  onGenerateAi,
  aiPending,
}: Props) {
  const sharePct =
    recompraShare.trim() && Number.isFinite(Number(recompraShare)) ? formatPct(recompraShare) : '—';

  return (
    <section className="space-y-6">
      <header>
        <h2 className="brand-mark text-3xl text-forest md:text-4xl">Capacidad Financiera</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Respuestas del día con hechos del tablero (caja, recompra, nómina, cuota, reserva). Sin
          inventar saldos.
        </p>
      </header>

      <div className="panel rounded-2xl p-4 md:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
          Entradas mínimas
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="block text-sm">
            Moneda (display)
            <input
              className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-mist/40 px-3 py-2"
              value={currency}
              readOnly
            />
          </label>
          <label className="block text-sm">
            Caja disponible hoy
            <input
              className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2"
              value={cash}
              onChange={(e) => onCashChange(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            % caja a recompra (earmark)
            <input
              className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2"
              value={recompraShare}
              placeholder="0.40"
              onChange={(e) => onRecompraShareChange(e.target.value)}
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-muted">
          Reserva {reserveMonths || '—'} meses
          {minCashFloor ? ` · piso ${formatCop(minCashFloor)}` : ''} · earmark {sharePct}. Edita
          reserva en Políticas.
        </p>
        {!policyComplete ? (
          <p className="mt-2 text-sm text-amber-800">
            Define la política de liquidez para abonos seguros.
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {QUESTIONS.map((q) => {
          const raw = capacity?.[q.key] ?? null;
          return (
            <article key={q.key} className="panel rounded-2xl p-4 md:p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                {q.title}
              </p>
              <p className="metric mt-3 text-2xl font-semibold text-forest md:text-3xl">
                {raw != null ? formatCop(raw) : '—'}
              </p>
              <p className="mt-1 text-sm text-muted">{q.hint}</p>
            </article>
          );
        })}
      </div>

      <div className="panel rounded-2xl p-4 md:p-6">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">
          Cómo se calculó
        </h3>
        {capacity ? (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink/90">
            <li>
              Recompra earmarked: {formatCop(capacity.recompraEarmark)} → queda{' '}
              {formatCop(capacity.cashAfterRecompra)}
            </li>
            <li>
              Próxima quincena:{' '}
              {capacity.nextQuincena ? formatCop(capacity.nextQuincena) : '— (falta nómina)'}
            </li>
            <li>
              Cuota TC:{' '}
              {capacity.creditCardInstallment
                ? formatCop(capacity.creditCardInstallment)
                : '— (falta en deudas)'}
            </li>
            <li>
              Reserva: {capacity.reserveAmount != null ? formatCop(capacity.reserveAmount) : '—'} ·
              runway {capacity.runwayMonths ?? '—'} meses
            </li>
            <li>
              Días de calendario restantes (incluye hoy): {capacity.remainingCalendarDaysInMonth}
            </li>
            {capacity.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">Indica caja y política para ver el desglose.</p>
        )}
        {capacity?.gaps.length ? (
          <p className="mt-3 text-sm text-amber-800">Gaps: {capacity.gaps.join(', ')}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onUseInDecision}
          className="rounded-full bg-forest px-4 py-2 text-sm font-semibold text-mist"
        >
          Usar en Decisión
        </button>
        <button
          type="button"
          onClick={onGenerateAi}
          disabled={aiPending || hasPendingClosings}
          className="rounded-full border border-forest px-4 py-2 text-sm font-semibold text-forest disabled:opacity-50"
        >
          {aiPending ? 'Generando…' : 'Generar recomendación AI'}
        </button>
        {hasPendingClosings ? (
          <p className="w-full text-xs text-amber-800">
            Hay {pendingClosingCount} día(s) sin actualizar — cierra movimientos antes de AI.
          </p>
        ) : null}
      </div>
    </section>
  );
}
