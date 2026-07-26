'use client';

import { useMemo, useState } from 'react';
import { formatCop } from '@/lib/format';
import {
  currentMonthStart,
  deleteVersion,
  recordAmountChange,
  versionsForLine,
  type CostVersionsWorkspace,
} from '@/lib/costVersionsStore';

type FixedCostRef = {
  id: string;
  label: string;
  amount: string;
  category: string;
};

type Props = {
  fixedCosts: FixedCostRef[];
  workspace: CostVersionsWorkspace;
  onWorkspaceChange: (ws: CostVersionsWorkspace) => void;
  /** Apply resolved current amount onto live BEP catalog. */
  onApplyLiveAmount: (lineId: string, amount: string) => void;
};

/**
 * Effective-dated budget history for fixed costs.
 * Example: Arriendo 2025 → 2.5M, 2026 → 3M.
 */
export function CostVersionsPanel({
  fixedCosts,
  workspace,
  onWorkspaceChange,
  onApplyLiveAmount,
}: Props) {
  const [lineId, setLineId] = useState(fixedCosts[0]?.id ?? '');
  const [newAmount, setNewAmount] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(currentMonthStart().slice(0, 7));
  const [priorEffectiveFrom, setPriorEffectiveFrom] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const selected = fixedCosts.find((l) => l.id === lineId) ?? null;
  const history = useMemo(
    () => (lineId ? versionsForLine(workspace, lineId) : []),
    [workspace, lineId],
  );
  const needsPrior = history.length === 0;

  function submit() {
    setError(null);
    setOkMsg(null);
    if (!selected) {
      setError('Elige un costo fijo.');
      return;
    }
    const amount = newAmount.trim() || selected.amount;
    const result = recordAmountChange(workspace, {
      lineId: selected.id,
      newAmount: amount,
      effectiveFrom,
      notes,
      ...(needsPrior
        ? {
            priorAmount: selected.amount,
            priorEffectiveFrom: priorEffectiveFrom.trim(),
          }
        : {}),
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onWorkspaceChange(result.workspace);
    onApplyLiveAmount(selected.id, amount);
    setNewAmount('');
    setNotes('');
    setPriorEffectiveFrom('');
    setOkMsg(`Versión registrada · ${selected.label} desde ${effectiveFrom}`);
  }

  function removeVersion(id: string) {
    const next = deleteVersion(workspace, id);
    onWorkspaceChange(next);
  }

  return (
    <div className="space-y-4">
      {fixedCosts.length === 0 ? (
        <p className="text-sm text-muted">Agrega costos fijos arriba para versionarlos.</p>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <label className="block text-xs text-muted">
              Costo fijo
              <select
                className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm text-ink"
                value={lineId}
                onChange={(e) => {
                  setLineId(e.target.value);
                  setError(null);
                  setOkMsg(null);
                }}
              >
                {fixedCosts.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label} ({l.category})
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-muted">
              Nuevo monto
              <input
                className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
                inputMode="decimal"
                placeholder={selected?.amount ?? '0'}
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
              />
            </label>
            <label className="block text-xs text-muted">
              Vigente desde (YYYY-MM)
              <input
                className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
                placeholder="2026-01"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
              />
            </label>
            <label className="block text-xs text-muted">
              Notas
              <input
                className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
                placeholder="Renovación contrato"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
          </div>

          {needsPrior && selected ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-950">
              <p className="font-medium">Primera versión de «{selected.label}»</p>
              <p className="mt-1 text-xs">
                Se preservará el monto actual del catálogo ({formatCop(selected.amount)}) como
                período anterior. Indica desde cuándo aplicaba ese monto.
              </p>
              <label className="mt-2 block text-xs">
                Monto anterior vigente desde (YYYY-MM)
                <input
                  className="mt-1 w-full max-w-xs rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
                  placeholder="2025-01"
                  value={priorEffectiveFrom}
                  onChange={(e) => setPriorEffectiveFrom(e.target.value)}
                />
              </label>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={submit}
              className="rounded-full bg-forest px-4 py-2 text-sm font-semibold text-mist"
            >
              Registrar versión
            </button>
            {okMsg ? <p className="text-sm text-forest">{okMsg}</p> : null}
            {error ? <p className="text-sm text-danger">{error}</p> : null}
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">
              Historial {selected ? `· ${selected.label}` : ''}
            </h3>
            {history.length === 0 ? (
              <p className="mt-2 text-sm text-muted">
                Sin versiones. El catálogo vivo se usa solo para el BEP actual; un as-of histórico
                reportará gap hasta que registres vigencia.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-[var(--line)]">
                {history.map((v) => (
                  <li
                    key={v.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                  >
                    <div>
                      <p className="metric font-semibold text-forest">{formatCop(v.amount)}</p>
                      <p className="text-xs text-muted">
                        Desde {v.effectiveFrom.slice(0, 7)}
                        {v.notes ? ` · ${v.notes}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeVersion(v.id)}
                      className="rounded-full border border-danger/30 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10"
                    >
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
