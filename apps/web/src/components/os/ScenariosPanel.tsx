'use client';

import { formatCop } from '@/lib/format';
import type {
  ScenarioDefinition,
  ScenarioEvaluation,
  ScenarioRecommendation,
  ScenarioWorkspace,
} from '@/lib/scenarioStore';

type Props = {
  workspace: ScenarioWorkspace;
  evaluations: ScenarioEvaluation[];
  recommendation: ScenarioRecommendation | null;
  immediateCapacity: string;
  onChange: (ws: ScenarioWorkspace) => void;
  /** Evaluate + rank + set preferred to app recommendation. */
  onRecommend: () => void;
};

export function ScenariosPanel({
  workspace,
  evaluations,
  recommendation,
  immediateCapacity,
  onChange,
  onRecommend,
}: Props) {
  function patchDef(id: string, patch: Partial<ScenarioDefinition>) {
    onChange({
      ...workspace,
      definitions: workspace.definitions.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    });
  }

  return (
    <section className="space-y-4">
      <div className="panel rounded-2xl p-4 md:p-6">
        <h2 className="brand-mark text-2xl text-forest">Escenarios (los recomienda el OS)</h2>
        <p className="mt-1 text-sm text-muted">
          El sistema evalúa opciones con tu capacidad inmediata, política de liquidez y margen BEP.
          Tú confirmas o cambias; no inventas el escenario desde cero.
        </p>
        <p className="mt-3 text-sm">
          Capacidad inmediata:{' '}
          <strong>{immediateCapacity ? formatCop(immediateCapacity) : '—'}</strong>
        </p>
        <button
          type="button"
          onClick={onRecommend}
          className="mt-4 rounded-full bg-forest px-4 py-2 text-sm font-semibold text-mist"
        >
          Recomendar escenario
        </button>

        {recommendation ? (
          <div className="mt-5 rounded-xl border border-forest/30 bg-moss/20 p-4 text-sm">
            <p className="font-semibold text-forest">{recommendation.summary}</p>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-muted">
              {recommendation.rank.map((r) => (
                <li key={r.id}>
                  <span className="text-ink">{r.label}</span> ({r.score}) — {r.why}
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">
            Pulsa «Recomendar escenario» para que el OS elija y ordene las opciones.
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {workspace.definitions.map((d) => {
          const isRec = recommendation?.recommendedId === d.id;
          return (
            <div
              key={d.id}
              className={`panel rounded-2xl p-4 md:p-6 ${isRec ? 'ring-2 ring-forest' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <label className="flex items-start gap-2 text-sm font-semibold text-forest">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={d.enabled}
                    onChange={(e) => patchDef(d.id, { enabled: e.target.checked })}
                  />
                  {d.label}
                </label>
                {isRec ? (
                  <span className="rounded-full bg-forest px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-mist">
                    Recomendado
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-muted">{d.notes}</p>

              {d.kind === 'extra_debt' ? (
                <label className="mt-3 block text-sm">
                  Monto abono extra (vacío = toda la capacidad)
                  <input
                    className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2"
                    value={d.extraDebtAmount}
                    placeholder="Auto = capacidad"
                    onChange={(e) => patchDef(d.id, { extraDebtAmount: e.target.value })}
                  />
                </label>
              ) : null}

              {d.kind === 'split' ? (
                <label className="mt-3 block text-sm">
                  % a deuda (0.5 = 50%)
                  <input
                    className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2"
                    value={d.debtShare}
                    onChange={(e) => patchDef(d.id, { debtShare: e.target.value })}
                  />
                </label>
              ) : null}

              <label className="mt-3 flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="preferredScenario"
                  checked={workspace.preferredScenarioId === d.id}
                  onChange={() => onChange({ ...workspace, preferredScenarioId: d.id })}
                />
                Usar este (anula recomendación del OS)
              </label>

              {evaluations
                .filter((e) => e.id === d.id)
                .map((e) => (
                  <div key={e.id} className="mt-4 space-y-1 rounded-xl bg-white/50 p-3 text-sm">
                    <p>Abono deuda: {formatCop(e.extraDebtPayment)}</p>
                    <p>A recompra: {formatCop(e.restockAllocation)}</p>
                    <p>Queda: {formatCop(e.capacityLeft)}</p>
                  </div>
                ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}
