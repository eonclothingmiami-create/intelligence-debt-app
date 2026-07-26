'use client';

import { useEffect, useState } from 'react';
import type { ConfigCatalogItem, LiquidityPolicy, WorkspaceCentralConfig } from '@fie/shared';
import { PoliciesPanel } from '@/components/os/PoliciesPanel';
import type { FinancialContext } from '@/lib/aiRecommend';
import {
  activeExpenseCategories,
  isCentralConfigUsable,
  saveCentralConfig,
} from '@/lib/configStore';
import { formatCop } from '@/lib/format';

type Props = {
  config: WorkspaceCentralConfig;
  onConfigChange: (config: WorkspaceCentralConfig) => void;
  policy: LiquidityPolicy;
  onPolicyChange: (policy: LiquidityPolicy) => void;
  buildContext: () => FinancialContext;
  fixedBurn: string;
  openaiConnected: boolean;
};

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function CatalogEditor({
  title,
  hint,
  items,
  onChange,
  showDirection,
}: {
  title: string;
  hint: string;
  items: ConfigCatalogItem[];
  onChange: (items: ConfigCatalogItem[]) => void;
  showDirection?: boolean;
}) {
  function patch(i: number, next: Partial<ConfigCatalogItem>) {
    const copy = [...items];
    copy[i] = { ...copy[i]!, ...next };
    onChange(copy);
  }

  function add() {
    onChange([
      ...items,
      {
        id: newId('cat'),
        label: '',
        active: true,
        sortOrder: items.length,
        ...(showDirection ? { direction: 'outflow' as const } : {}),
      },
    ]);
  }

  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }

  return (
    <div className="panel rounded-2xl p-4 md:p-5">
      <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">{title}</h3>
      <p className="mt-1 text-xs text-muted">{hint}</p>
      <ul className="mt-3 space-y-2">
        {items.map((item, i) => (
          <li key={item.id} className="flex flex-wrap items-center gap-2">
            <input
              className="metric min-w-[10rem] flex-1 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
              value={item.label}
              placeholder="Etiqueta"
              onChange={(e) => patch(i, { label: e.target.value })}
            />
            {showDirection ? (
              <select
                className="rounded-lg border border-[var(--line)] bg-white px-2 py-2 text-sm"
                value={item.direction ?? 'outflow'}
                onChange={(e) => patch(i, { direction: e.target.value as 'inflow' | 'outflow' })}
              >
                <option value="inflow">Entrada</option>
                <option value="outflow">Salida</option>
              </select>
            ) : null}
            <label className="flex items-center gap-1 text-xs text-muted">
              <input
                type="checkbox"
                checked={item.active}
                onChange={(e) => patch(i, { active: e.target.checked })}
              />
              Activo
            </label>
            <button
              type="button"
              className="text-xs text-danger underline"
              onClick={() => remove(i)}
            >
              Quitar
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={add}
        className="mt-3 rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-medium"
      >
        + Agregar
      </button>
    </div>
  );
}

/**
 * Centro de Configuración — single place for OS-wide rules (PRD fields).
 * Liquidity policy AI lives in the embedded PoliciesPanel.
 */
export function ConfigPanel({
  config,
  onConfigChange,
  policy,
  onPolicyChange,
  buildContext,
  fixedBurn,
  openaiConnected,
}: Props) {
  const [draft, setDraft] = useState(config);
  const [savedOk, setSavedOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(config);
  }, [config]);

  function persist() {
    setError(null);
    if (!draft.currency.trim()) {
      setError('Indica la moneda (ej. COP). El motor no inventa moneda.');
      return;
    }
    const month = Number(draft.fiscalYearStartMonth);
    if (!Number.isFinite(month) || month < 1 || month > 12) {
      setError('Inicio de año fiscal: mes 1–12.');
      return;
    }
    if (draft.operatingDaysPerMonth.trim()) {
      const days = Number(draft.operatingDaysPerMonth);
      if (!Number.isFinite(days) || days <= 0 || days > 31) {
        setError('Días operativos del mes: número entre 1 y 31.');
        return;
      }
    }
    const saved = saveCentralConfig(draft);
    onConfigChange(saved);
    setDraft(saved);
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 2000);
  }

  const expenseHints = activeExpenseCategories(draft)
    .map((c) => c.label)
    .join(', ');

  return (
    <div className="space-y-6">
      <header>
        <h2 className="brand-mark text-3xl text-forest md:text-4xl">Configuración</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Reglas centralizadas del negocio. Los motores y Capacidad leen estos hechos — sin defaults
          silenciosos del producto.
        </p>
        {!isCentralConfigUsable(config) ? (
          <p className="mt-2 text-sm text-amber-800">Completa moneda e inicio de año fiscal.</p>
        ) : null}
      </header>

      <section className="panel rounded-2xl p-4 md:p-6">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">
          Identidad y calendario
        </h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-sm">
            Moneda
            <input
              className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2"
              value={draft.currency}
              placeholder="COP"
              onChange={(e) => setDraft({ ...draft, currency: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            Inicio año fiscal (mes 1–12)
            <input
              className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2"
              value={draft.fiscalYearStartMonth}
              placeholder="1"
              onChange={(e) => setDraft({ ...draft, fiscalYearStartMonth: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            Días de cierre (día del mes)
            <input
              className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2"
              value={draft.closingDaysOfMonth}
              placeholder="Ej. 15,30 — vacío = solo registro diario"
              onChange={(e) => setDraft({ ...draft, closingDaysOfMonth: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            Días operativos / mes
            <input
              className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2"
              value={draft.operatingDaysPerMonth}
              placeholder="26"
              onChange={(e) => setDraft({ ...draft, operatingDaysPerMonth: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            Días promedio recompra inventario
            <input
              className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2"
              value={draft.inventoryRestockCycleDays}
              placeholder="Ej. 15"
              onChange={(e) => setDraft({ ...draft, inventoryRestockCycleDays: e.target.value })}
            />
          </label>
        </div>
      </section>

      <section className="panel rounded-2xl p-4 md:p-6">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">Metas</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            Meta de utilidad ({draft.currency || 'moneda'})
            <input
              className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2"
              value={draft.targetProfitAmount}
              placeholder="Monto objetivo"
              onChange={(e) => setDraft({ ...draft, targetProfitAmount: e.target.value })}
            />
            {draft.targetProfitAmount.trim() ? (
              <p className="mt-1 text-xs text-muted">{formatCop(draft.targetProfitAmount)}</p>
            ) : null}
          </label>
          <label className="block text-sm">
            Meta de reducción de deuda
            <input
              className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2"
              value={draft.debtReductionTargetAmount}
              placeholder="Monto a reducir en el horizonte"
              onChange={(e) => setDraft({ ...draft, debtReductionTargetAmount: e.target.value })}
            />
            {draft.debtReductionTargetAmount.trim() ? (
              <p className="mt-1 text-xs text-muted">
                {formatCop(draft.debtReductionTargetAmount)}
              </p>
            ) : null}
          </label>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <CatalogEditor
          title="Canales de venta / ads"
          hint="Activos alimentan Publicidad y Capacidad ads."
          items={draft.salesChannels}
          onChange={(salesChannels) => setDraft({ ...draft, salesChannels })}
        />
        <CatalogEditor
          title="Categorías de gastos"
          hint="Catálogo para costos y gastos extraordinarios."
          items={draft.expenseCategories}
          onChange={(expenseCategories) => setDraft({ ...draft, expenseCategories })}
        />
        <CatalogEditor
          title="Movimientos extraordinarios"
          hint="Tipos del registro diario (aporte, retiro, activo…)."
          items={draft.extraordinaryMovementCategories}
          onChange={(extraordinaryMovementCategories) =>
            setDraft({ ...draft, extraordinaryMovementCategories })
          }
          showDirection
        />
      </div>

      {expenseHints ? (
        <p className="text-xs text-muted">Categorías de gasto activas: {expenseHints}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={persist}
          className="rounded-full bg-forest px-4 py-2 text-sm font-semibold text-mist"
        >
          Guardar configuración
        </button>
        {savedOk ? <p className="text-sm text-forest">Configuración guardada.</p> : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {config.updatedAt ? (
          <p className="text-xs text-muted">
            Última actualización: {new Date(config.updatedAt).toLocaleString('es-CO')}
          </p>
        ) : null}
      </div>

      <div>
        <h3 className="brand-mark mb-3 text-2xl text-forest">Reserva y liquidez</h3>
        <p className="mb-4 text-sm text-muted">
          Parte del Centro de Configuración. Misma política que usa Capacidad y el orquestador.
        </p>
        <PoliciesPanel
          policy={policy}
          onPolicyChange={onPolicyChange}
          buildContext={buildContext}
          fixedBurn={fixedBurn}
          openaiConnected={openaiConnected}
          currencyDisplay={draft.currency || config.currency || 'COP'}
        />
      </div>
    </div>
  );
}
