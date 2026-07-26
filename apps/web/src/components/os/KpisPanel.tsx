'use client';

import { useMemo } from 'react';
import {
  deriveKpis,
  KPI_GROUP_LABEL,
  type DeriveKpisInput,
  type KpiItem,
  type KpiStatus,
} from '@/lib/kpis';

type Props = {
  input: DeriveKpisInput;
  onGoToDecision: () => void;
  onGoToCapacidad: () => void;
};

const STATUS_LABEL: Record<KpiStatus, string> = {
  ok: 'OK',
  watch: 'Vigilancia',
  critical: 'Crítico',
  unknown: 'Sin dato',
};

const STATUS_CLASS: Record<KpiStatus, string> = {
  ok: 'text-forest',
  watch: 'text-amber-800',
  critical: 'text-danger',
  unknown: 'text-muted',
};

/**
 * Named KPI board — indicators from engines/facts, not a generic dashboard dump.
 */
export function KpisPanel({ input, onGoToDecision, onGoToCapacidad }: Props) {
  const kpis = useMemo(() => deriveKpis(input), [input]);
  const byGroup = useMemo(() => {
    const map = new Map<KpiItem['group'], KpiItem[]>();
    for (const k of kpis) {
      const list = map.get(k.group) ?? [];
      list.push(k);
      map.set(k.group, list);
    }
    return map;
  }, [kpis]);

  const unknown = kpis.filter((k) => k.status === 'unknown').length;
  const critical = kpis.filter((k) => k.status === 'critical').length;

  return (
    <section className="space-y-6">
      <header>
        <h2 className="brand-mark text-3xl text-forest md:text-4xl">KPIs</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Indicadores con nombre, calculados solo con hechos del tablero. Si falta un dato, el KPI
          queda en «Sin dato» — no se inventa el ratio.
        </p>
        <p className="mt-1 text-sm text-muted">
          {kpis.length} indicadores · {critical} crítico(s) · {unknown} sin dato
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onGoToCapacidad}
          className="rounded-full border border-forest px-4 py-2 text-sm font-semibold text-forest"
        >
          Ver Capacidad
        </button>
        <button
          type="button"
          onClick={onGoToDecision}
          className="rounded-full bg-forest px-4 py-2 text-sm font-semibold text-mist"
        >
          Ir a Decisión
        </button>
      </div>

      {(Object.keys(KPI_GROUP_LABEL) as KpiItem['group'][]).map((group) => {
        const list = byGroup.get(group);
        if (!list?.length) return null;
        return (
          <div key={group}>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-muted">
              {KPI_GROUP_LABEL[group]}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((k) => (
                <article key={k.id} className="panel rounded-2xl p-4 md:p-5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                      {k.label}
                    </p>
                    <span className={`text-[0.65rem] font-semibold ${STATUS_CLASS[k.status]}`}>
                      {STATUS_LABEL[k.status]}
                    </span>
                  </div>
                  <p className="metric mt-3 text-2xl font-semibold text-forest">{k.value ?? '—'}</p>
                  <p className="mt-1 text-xs text-muted">{k.detail}</p>
                </article>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
