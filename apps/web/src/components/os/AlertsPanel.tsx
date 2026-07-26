'use client';

import type { OperationalAlert } from '@/lib/alerts';

type Tab =
  | 'capacidad'
  | 'config'
  | 'closings'
  | 'debts'
  | 'marketing'
  | 'costs'
  | 'sales'
  | 'decision'
  | 'calendar';

type Props = {
  alerts: OperationalAlert[];
  onGoToTab: (tab: Tab) => void;
};

const SEVERITY_LABEL: Record<OperationalAlert['severity'], string> = {
  critical: 'Crítica',
  warning: 'Atención',
  info: 'Info',
};

const SEVERITY_CLASS: Record<OperationalAlert['severity'], string> = {
  critical: 'border-danger/40 bg-danger/10 text-danger',
  warning: 'border-amber-700/30 bg-amber-50 text-amber-950',
  info: 'border-[var(--line)] bg-white/50 text-ink',
};

/**
 * Operational alerts surface — not recommendations.
 * One job: show what needs attention from board facts.
 */
export function AlertsPanel({ alerts, onGoToTab }: Props) {
  const critical = alerts.filter((a) => a.severity === 'critical').length;
  const warning = alerts.filter((a) => a.severity === 'warning').length;

  return (
    <section className="space-y-6">
      <header>
        <h2 className="brand-mark text-3xl text-forest md:text-4xl">Alertas</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Avisos automáticos desde hechos del tablero (caja, cierres, deudas, ads, inventario). No
          son recomendaciones — el CFO AI interpreta aparte.
        </p>
        <p className="mt-2 text-sm text-muted">
          {alerts.length === 0
            ? 'Sin alertas con los datos actuales.'
            : `${alerts.length} alerta(s): ${critical} crítica(s), ${warning} de atención.`}
        </p>
      </header>

      {alerts.length === 0 ? (
        <div className="panel rounded-2xl p-6 text-sm text-muted">
          Todo en orden según las reglas actuales. Si falta un dato (nómina, cuota, política),
          aparecerá aquí como info.
        </div>
      ) : (
        <ul className="space-y-3">
          {alerts.map((a) => (
            <li
              key={a.id}
              className={`rounded-2xl border px-4 py-4 md:px-5 ${SEVERITY_CLASS[a.severity]}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em]">
                  {SEVERITY_LABEL[a.severity]} · {a.code}
                </p>
                {a.relatedTab ? (
                  <button
                    type="button"
                    className="text-xs font-medium underline"
                    onClick={() => onGoToTab(a.relatedTab!)}
                  >
                    Ir a {a.relatedTab}
                  </button>
                ) : null}
              </div>
              <p className="mt-2 text-lg font-semibold text-forest">{a.title}</p>
              <p className="mt-1 text-sm opacity-90">{a.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
