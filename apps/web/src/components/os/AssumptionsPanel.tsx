'use client';

import { useEffect, useState } from 'react';
import {
  ASSUMPTION_META,
  assumptionsGaps,
  formatAssumptionDisplay,
  saveAssumptionsWorkspace,
  type AssumptionField,
  type AssumptionKey,
  type AssumptionsWorkspace,
} from '@/lib/assumptionsStore';

type Props = {
  workspace: AssumptionsWorkspace;
  onChange: (ws: AssumptionsWorkspace) => void;
  onGoToScenarios: () => void;
};

/**
 * Centro de supuestos — inputs forward-looking for simulation / AI.
 * Not engine math rules (those live in FINANCIAL_ASSUMPTIONS.md).
 */
export function AssumptionsPanel({ workspace, onChange, onGoToScenarios }: Props) {
  const [draft, setDraft] = useState(workspace);
  const [savedOk, setSavedOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(workspace);
  }, [workspace]);

  function patchField(key: AssumptionKey, patch: Partial<AssumptionField>) {
    setDraft({
      ...draft,
      fields: draft.fields.map((f) => (f.key === key ? { ...f, ...patch } : f)),
    });
  }

  function persist() {
    setError(null);
    for (const f of draft.fields) {
      if (!f.active || !f.value.trim()) continue;
      const n = Number(f.value);
      if (!Number.isFinite(n)) {
        setError(`Valor inválido en ${ASSUMPTION_META[f.key].label}.`);
        return;
      }
      const meta = ASSUMPTION_META[f.key];
      if (meta.unit === 'rate' && (n < -1 || n > 2)) {
        setError(`${ASSUMPTION_META[f.key].label}: usa fracción (ej. 0.05), no 5.`);
        return;
      }
      if (meta.unit === 'months' && (n < 1 || n > 120)) {
        setError('Horizonte: entre 1 y 120 meses.');
        return;
      }
      if (meta.unit === 'fx' && n <= 0) {
        setError('TRM debe ser > 0.');
        return;
      }
    }
    const saved = saveAssumptionsWorkspace(draft);
    onChange(saved);
    setDraft(saved);
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 2000);
  }

  const gaps = assumptionsGaps(draft);
  const filled = draft.fields.filter((f) => f.active && f.value.trim()).length;

  return (
    <section className="space-y-6">
      <header>
        <h2 className="brand-mark text-3xl text-forest md:text-4xl">Supuestos</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Hipótesis a futuro (inflación, salarios, tasas, crecimiento, TRM). El OS no inventa estos
          valores. Escenarios y el CFO AI los usan cuando están definidos.
        </p>
        <p className="mt-1 text-sm text-muted">
          {filled} definido(s) · {gaps.length} activo(s) sin valor
        </p>
      </header>

      <div className="panel rounded-2xl p-4 md:p-5">
        <label className="block text-sm">
          Nombre del set
          <input
            className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2"
            value={draft.setLabel}
            placeholder="Ej. Escenario base 2026"
            onChange={(e) => setDraft({ ...draft, setLabel: e.target.value })}
          />
        </label>
      </div>

      <ul className="space-y-3">
        {draft.fields.map((f) => {
          const meta = ASSUMPTION_META[f.key];
          return (
            <li key={f.key} className="panel rounded-2xl p-4 md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-forest">{meta.label}</p>
                  <p className="mt-0.5 text-xs text-muted">{meta.hint}</p>
                </div>
                <label className="flex items-center gap-1.5 text-xs text-muted">
                  <input
                    type="checkbox"
                    checked={f.active}
                    onChange={(e) => patchField(f.key, { active: e.target.checked })}
                  />
                  Activo
                </label>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block text-xs text-muted">
                  Valor
                  <input
                    className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
                    value={f.value}
                    placeholder={meta.placeholder}
                    disabled={!f.active}
                    onChange={(e) => patchField(f.key, { value: e.target.value })}
                  />
                  {f.value.trim() ? (
                    <span className="mt-1 block text-xs text-forest">
                      Display: {formatAssumptionDisplay(f)}
                    </span>
                  ) : f.active ? (
                    <span className="mt-1 block text-xs text-amber-800">Sin definir</span>
                  ) : null}
                </label>
                <label className="block text-xs text-muted">
                  Notas / fuente
                  <input
                    className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
                    value={f.notes}
                    placeholder="Ej. BanRep / proyección dueño"
                    disabled={!f.active}
                    onChange={(e) => patchField(f.key, { notes: e.target.value })}
                  />
                </label>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={persist}
          className="rounded-full bg-forest px-4 py-2 text-sm font-semibold text-mist"
        >
          Guardar supuestos
        </button>
        <button
          type="button"
          onClick={onGoToScenarios}
          className="rounded-full border border-forest px-4 py-2 text-sm font-semibold text-forest"
        >
          Ir a Escenarios
        </button>
        {savedOk ? <p className="text-sm text-forest">Supuestos guardados.</p> : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
      </div>

      <p className="text-xs text-muted">
        Las reglas matemáticas del motor (day-count, redondeo COP, etc.) no se editan aquí — ver
        docs de <code className="text-[0.7rem]">@fie/financial-engine</code>.
      </p>
    </section>
  );
}
