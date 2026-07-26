'use client';

import { useEffect, useState } from 'react';
import {
  createGoal,
  describeGoalProgress,
  GOAL_KIND_LABEL,
  saveGoalsWorkspace,
  type BusinessGoal,
  type GoalFacts,
  type GoalKind,
  type GoalsWorkspace,
  type GoalStatus,
} from '@/lib/goalsStore';
import { formatCop } from '@/lib/format';

type DebtOption = { id: string; label: string };

type Props = {
  workspace: GoalsWorkspace;
  onChange: (ws: GoalsWorkspace) => void;
  facts: GoalFacts;
  debtOptions: DebtOption[];
  onGoToConfig: () => void;
  onGoToDecision: () => void;
};

const KINDS = Object.keys(GOAL_KIND_LABEL) as GoalKind[];
const STATUSES: GoalStatus[] = ['active', 'paused', 'achieved', 'abandoned'];

/**
 * Explicit objectives the OS must respect — not recommendations.
 */
export function GoalsPanel({
  workspace,
  onChange,
  facts,
  debtOptions,
  onGoToConfig,
  onGoToDecision,
}: Props) {
  const [draft, setDraft] = useState(workspace);
  const [savedOk, setSavedOk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newGoal, setNewGoal] = useState({
    kind: 'custom' as GoalKind,
    title: '',
    targetAmount: '',
    targetDate: '',
    relatedObligationId: '',
    notes: '',
  });

  useEffect(() => {
    setDraft(workspace);
  }, [workspace]);

  function persist(next: GoalsWorkspace) {
    const saved = saveGoalsWorkspace(next);
    onChange(saved);
    setDraft(saved);
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 2000);
  }

  function saveAll() {
    setError(null);
    if (!draft.northStar.trim() && draft.goals.length === 0) {
      setError('Define al menos la visión norte o un objetivo. El motor no inventa metas.');
      return;
    }
    for (const g of draft.goals) {
      if (!g.title.trim()) {
        setError('Cada objetivo necesita un título.');
        return;
      }
    }
    persist(draft);
  }

  function patchGoal(id: string, patch: Partial<BusinessGoal>) {
    setDraft({
      ...draft,
      goals: draft.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    });
  }

  function removeGoal(id: string) {
    setDraft({ ...draft, goals: draft.goals.filter((g) => g.id !== id) });
  }

  function addGoal() {
    if (!newGoal.title.trim()) {
      setError('Indica el título del nuevo objetivo.');
      return;
    }
    const g = createGoal({
      kind: newGoal.kind,
      title: newGoal.title,
      targetAmount: newGoal.targetAmount,
      targetDate: newGoal.targetDate,
      relatedObligationId: newGoal.relatedObligationId,
      notes: newGoal.notes,
    });
    setDraft({ ...draft, goals: [...draft.goals, g] });
    setNewGoal({
      kind: 'custom',
      title: '',
      targetAmount: '',
      targetDate: '',
      relatedObligationId: '',
      notes: '',
    });
    setAdding(false);
    setError(null);
  }

  const activeCount = draft.goals.filter((g) => g.status === 'active').length;

  return (
    <section className="space-y-6">
      <header>
        <h2 className="brand-mark text-3xl text-forest md:text-4xl">Objetivos</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Metas explícitas del dueño. Capacidad, Decisión y el CFO AI las respetan — no inventan
          objetivos. Reserva/piso siguen en{' '}
          <button type="button" className="underline" onClick={onGoToConfig}>
            Configuración
          </button>
          .
        </p>
        <p className="mt-1 text-sm text-muted">
          {activeCount} activo(s) · {draft.goals.length} en total
        </p>
      </header>

      <div className="panel rounded-2xl p-4 md:p-6">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">
          Visión norte
        </h3>
        <textarea
          className="mt-3 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
          rows={3}
          value={draft.northStar}
          placeholder="Ej. Salir de deudas sin perder liquidez ni recompra…"
          onChange={(e) => setDraft({ ...draft, northStar: e.target.value })}
        />
      </div>

      <ul className="space-y-4">
        {draft.goals.map((g) => {
          const hints = describeGoalProgress(g, facts);
          return (
            <li key={g.id} className="panel rounded-2xl p-4 md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted">
                    {GOAL_KIND_LABEL[g.kind]}
                  </p>
                  <input
                    className="mt-1 w-full min-w-[12rem] rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-lg font-semibold text-forest"
                    value={g.title}
                    onChange={(e) => patchGoal(g.id, { title: e.target.value })}
                  />
                </div>
                <select
                  className="rounded-lg border border-[var(--line)] bg-white px-2 py-2 text-sm"
                  value={g.status}
                  onChange={(e) => patchGoal(g.id, { status: e.target.value as GoalStatus })}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="block text-xs text-muted">
                  Tipo
                  <select
                    className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm text-ink"
                    value={g.kind}
                    onChange={(e) => patchGoal(g.id, { kind: e.target.value as GoalKind })}
                  >
                    {KINDS.map((k) => (
                      <option key={k} value={k}>
                        {GOAL_KIND_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-muted">
                  Monto meta ({facts.currency})
                  <input
                    className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
                    value={g.targetAmount}
                    placeholder={g.kind === 'liquidity_months' ? 'Ej. 2 (meses)' : 'Opcional'}
                    onChange={(e) => patchGoal(g.id, { targetAmount: e.target.value })}
                  />
                  {g.targetAmount && g.kind !== 'liquidity_months' ? (
                    <span className="mt-1 block text-xs">{formatCop(g.targetAmount)}</span>
                  ) : null}
                </label>
                <label className="block text-xs text-muted">
                  Fecha horizonte
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
                    value={g.targetDate}
                    onChange={(e) => patchGoal(g.id, { targetDate: e.target.value })}
                  />
                </label>
              </div>

              {g.kind === 'debt_clear' ? (
                <label className="mt-3 block text-xs text-muted">
                  Deuda objetivo
                  <select
                    className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
                    value={g.relatedObligationId}
                    onChange={(e) => patchGoal(g.id, { relatedObligationId: e.target.value })}
                  >
                    <option value="">— Elegir —</option>
                    {debtOptions.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <label className="mt-3 block text-xs text-muted">
                Notas
                <textarea
                  className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
                  rows={2}
                  value={g.notes}
                  onChange={(e) => patchGoal(g.id, { notes: e.target.value })}
                />
              </label>

              {hints.length > 0 ? (
                <ul className="mt-3 list-disc space-y-0.5 pl-5 text-xs text-muted">
                  {hints.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              ) : null}

              <button
                type="button"
                className="mt-3 text-xs text-danger underline"
                onClick={() => removeGoal(g.id)}
              >
                Eliminar objetivo
              </button>
            </li>
          );
        })}
      </ul>

      {adding ? (
        <div className="panel rounded-2xl border border-dashed border-forest/40 p-4 md:p-5">
          <h3 className="text-sm font-semibold text-forest">Nuevo objetivo</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-muted">
              Tipo
              <select
                className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
                value={newGoal.kind}
                onChange={(e) => setNewGoal({ ...newGoal, kind: e.target.value as GoalKind })}
              >
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {GOAL_KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-muted">
              Título
              <input
                className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
                value={newGoal.title}
                onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
              />
            </label>
            <label className="block text-xs text-muted">
              Monto
              <input
                className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
                value={newGoal.targetAmount}
                onChange={(e) => setNewGoal({ ...newGoal, targetAmount: e.target.value })}
              />
            </label>
            <label className="block text-xs text-muted">
              Horizonte
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
                value={newGoal.targetDate}
                onChange={(e) => setNewGoal({ ...newGoal, targetDate: e.target.value })}
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addGoal}
              className="rounded-full bg-forest px-4 py-2 text-sm font-semibold text-mist"
            >
              Agregar
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-full border border-[var(--line)] px-4 py-2 text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium"
        >
          + Nuevo objetivo
        </button>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={saveAll}
          className="rounded-full bg-forest px-4 py-2 text-sm font-semibold text-mist"
        >
          Guardar objetivos
        </button>
        <button
          type="button"
          onClick={onGoToDecision}
          className="rounded-full border border-forest px-4 py-2 text-sm font-semibold text-forest"
        >
          Ir a Decisión
        </button>
        {savedOk ? <p className="text-sm text-forest">Objetivos guardados.</p> : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
      </div>
    </section>
  );
}
