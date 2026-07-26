'use client';

import { useState } from 'react';
import type { LiquidityPolicy } from '@fie/shared';
import type { FinancialContext, LiquidityPolicySuggestion } from '@/lib/aiRecommend';
import { requestLiquidityPolicySuggestion } from '@/lib/aiRecommend';
import { getStoredOpenAiKey } from '@/lib/openaiKey';
import { isLiquidityPolicyComplete, saveLiquidityPolicy } from '@/lib/policyStore';
import { formatCop } from '@/lib/format';

type Props = {
  policy: LiquidityPolicy;
  onPolicyChange: (policy: LiquidityPolicy) => void;
  /** Partial context for AI draft (burn, sales, debts…). */
  buildContext: () => FinancialContext;
  fixedBurn: string;
  openaiConnected: boolean;
};

/**
 * Always-editable liquidity policies. AI may draft; user confirms before save.
 */
export function PoliciesPanel({
  policy,
  onPolicyChange,
  buildContext,
  fixedBurn,
  openaiConnected,
}: Props) {
  const [draft, setDraft] = useState<LiquidityPolicy>(policy);
  const [savedOk, setSavedOk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiPending, setAiPending] = useState(false);
  const [suggestion, setSuggestion] = useState<LiquidityPolicySuggestion | null>(null);

  const reserveAmt =
    draft.reserveMonths.trim() && Number(fixedBurn) > 0
      ? String(Number(fixedBurn) * Number(draft.reserveMonths || 0))
      : null;

  function persist(next: LiquidityPolicy) {
    const saved = saveLiquidityPolicy(next);
    onPolicyChange(saved);
    setDraft(saved);
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 2000);
  }

  function saveManual() {
    setError(null);
    if (!isLiquidityPolicyComplete(draft)) {
      setError('Indica reserva en meses (≥ 0). Es tu política; el motor no inventa un default.');
      return;
    }
    persist(draft);
  }

  async function suggestWithAi() {
    setError(null);
    setSuggestion(null);
    if (!getStoredOpenAiKey()) {
      setError('Conecta tu API key en la pestaña CFO AI para pedir una sugerencia.');
      return;
    }
    setAiPending(true);
    try {
      const s = await requestLiquidityPolicySuggestion(buildContext());
      setSuggestion(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al sugerir política');
    } finally {
      setAiPending(false);
    }
  }

  function applySuggestion() {
    if (!suggestion) return;
    const next: LiquidityPolicy = {
      reserveMonths: suggestion.suggestedReserveMonths,
      minCashFloor: suggestion.suggestedMinCashFloor ?? '',
      reserveIsHardFloor: suggestion.reserveIsHardFloor,
      notes: suggestion.rationale,
    };
    setDraft(next);
    persist(next);
    setSuggestion(null);
  }

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="panel rounded-2xl p-4 md:p-6">
        <h2 className="brand-mark text-2xl text-forest">Políticas de liquidez</h2>
        <p className="mt-1 text-sm text-muted">
          Editables en cualquier momento. Los motores y el CFO AI las usan; no hay default
          silencioso del producto.
        </p>

        <label className="mt-5 block text-sm">
          Moneda de display
          <input
            className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-mist/40 px-3 py-2"
            value="COP"
            readOnly
          />
        </label>
        <p className="mt-1 text-xs text-muted">
          Viene del modelo BEP / workspace. El Centro de Configuración completo (más campos) es Fase
          2.
        </p>

        <label className="mt-3 block text-sm">
          Reserva mínima (meses de burn fijo)
          <input
            className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2"
            value={draft.reserveMonths}
            placeholder="Ej. 2"
            onChange={(e) => setDraft({ ...draft, reserveMonths: e.target.value })}
          />
        </label>
        {reserveAmt != null && Number.isFinite(Number(reserveAmt)) ? (
          <p className="mt-1 text-xs text-muted">
            ≈ {formatCop(reserveAmt)} con burn actual ({formatCop(fixedBurn)})
          </p>
        ) : null}

        <label className="mt-3 block text-sm">
          Piso mínimo de caja (COP, opcional)
          <input
            className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2"
            value={draft.minCashFloor ?? ''}
            placeholder="Ej. 5000000"
            onChange={(e) => setDraft({ ...draft, minCashFloor: e.target.value })}
          />
        </label>

        <label className="mt-4 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={draft.reserveIsHardFloor}
            onChange={(e) => setDraft({ ...draft, reserveIsHardFloor: e.target.checked })}
          />
          <span>
            Reserva intocable para abonos extra a deuda (recomendado). Si la desmarcas, el sistema
            puede advertir pero no bloqueará con la misma dureza.
          </span>
        </label>

        <label className="mt-3 block text-sm">
          Notas / criterio
          <textarea
            className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
            rows={3}
            value={draft.notes ?? ''}
            placeholder="Por qué elegiste esta reserva…"
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          />
        </label>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={saveManual}
            className="rounded-full bg-forest px-4 py-2 text-sm font-semibold text-mist"
          >
            Guardar política
          </button>
          <button
            type="button"
            disabled={!openaiConnected || aiPending}
            onClick={suggestWithAi}
            className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-forest disabled:opacity-50"
          >
            {aiPending ? 'Sugiriendo…' : 'Sugerir con IA'}
          </button>
        </div>
        {savedOk ? <p className="mt-2 text-sm text-forest">Política guardada.</p> : null}
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
        {policy.updatedAt ? (
          <p className="mt-2 text-xs text-muted">
            Última actualización: {new Date(policy.updatedAt).toLocaleString('es-CO')}
          </p>
        ) : (
          <p className="mt-2 text-xs text-amber-800">Aún no hay política guardada.</p>
        )}
      </div>

      <div className="panel rounded-2xl p-4 md:p-6">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">
          Borrador IA (no se aplica solo)
        </h3>
        {!openaiConnected ? (
          <p className="mt-4 text-sm text-muted">
            Conecta OpenAI en CFO AI. La IA propone; tú confirmas o editas.
          </p>
        ) : null}
        {suggestion ? (
          <div className="mt-4 space-y-3 text-sm">
            <p>
              Reserva sugerida: <strong>{suggestion.suggestedReserveMonths}</strong> meses
            </p>
            <p>
              Piso de caja:{' '}
              {suggestion.suggestedMinCashFloor
                ? formatCop(suggestion.suggestedMinCashFloor)
                : 'sin piso absoluto'}
            </p>
            <p>Intocable: {suggestion.reserveIsHardFloor ? 'sí' : 'no'}</p>
            <p className="text-muted">{suggestion.rationale}</p>
            <p className="text-xs text-muted">Confianza: {suggestion.confidenceLevel}</p>
            {suggestion.questionsForUser.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5 text-muted">
                {suggestion.questionsForUser.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            ) : null}
            <button
              type="button"
              onClick={applySuggestion}
              className="rounded-full bg-forest px-4 py-2 text-sm font-semibold text-mist"
            >
              Aplicar sugerencia (puedo editar después)
            </button>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">
            Usa «Sugerir con IA» cuando quieras un borrador basado en burn, ventas y deudas del
            tablero. Nunca se guarda sola.
          </p>
        )}
      </div>
    </section>
  );
}
