'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import type { BreakEvenModel, BreakEvenSnapshot } from '@fie/break-even-engine';
import type { MarketingChannel, MarketingPortfolioVsActual } from '@fie/shared';
import {
  actionBusinessHealth,
  actionComputeBreakEven,
  actionComputeLiquidity,
  actionLoadDemo,
  actionMarketingPortfolio,
} from '@/lib/actions';
import type { LiquidityView } from '@/lib/engines';
import { formatCop, formatNumber, formatPct } from '@/lib/format';

type Tab = 'overview' | 'costs' | 'marketing' | 'decision';

type ChannelBudgetRow = {
  channelId: string;
  label: string;
  budget: string;
  actual: string;
};

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Resumen' },
  { id: 'costs', label: 'Costos' },
  { id: 'marketing', label: 'Publicidad' },
  { id: 'decision', label: 'Decisión' },
];

const DEFAULT_CHANNELS: MarketingChannel[] = [
  { id: 'tiktok', label: 'TikTok Ads', active: true, sortOrder: 0 },
  { id: 'meta', label: 'Meta Ads', active: true, sortOrder: 1 },
  { id: 'google', label: 'Google Ads', active: true, sortOrder: 2 },
];

const DEFAULT_ROWS: ChannelBudgetRow[] = [
  { channelId: 'tiktok', label: 'TikTok Ads', budget: '2100000', actual: '1800000' },
  { channelId: 'meta', label: 'Meta Ads', budget: '1500000', actual: '1200000' },
  { channelId: 'google', label: 'Google Ads', budget: '900000', actual: '900000' },
];

const PERIOD_FROM = '2026-07-01';
const PERIOD_TO = '2026-07-31';

export function OsShell() {
  const [tab, setTab] = useState<Tab>('overview');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<BreakEvenModel | null>(null);
  const [breakEven, setBreakEven] = useState<BreakEvenSnapshot | null>(null);
  const [liquidity, setLiquidity] = useState<LiquidityView | null>(null);
  const [portfolio, setPortfolio] = useState<MarketingPortfolioVsActual | null>(null);
  const [recommendation, setRecommendation] = useState<{
    action: string;
    rationale: string[];
    valid: boolean;
    suggestedExtraDebtPayment: string;
    adjustedMaxSafeExtraDebtPayment: string;
    marketingFreedCapacity: string;
    marketingOverspend: string;
  } | null>(null);
  const [score, setScore] = useState<{ score: number; riskLevel: string } | null>(null);

  const [cash, setCash] = useState('8000000');
  const [freeCash, setFreeCash] = useState('4500000');
  const [proposedExtra, setProposedExtra] = useState('');
  const [reserveMonths, setReserveMonths] = useState('2');
  const [alertRate, setAlertRate] = useState('0.10');
  const [interestSaved, setInterestSaved] = useState('120000');
  const [channelRows, setChannelRows] = useState<ChannelBudgetRow[]>(DEFAULT_ROWS);
  const [newFixed, setNewFixed] = useState({ label: '', category: '', amount: '' });

  const fixedBurn = useMemo(() => breakEven?.totalFixedCosts ?? '0', [breakEven]);

  function loadDemo() {
    setError(null);
    startTransition(async () => {
      try {
        const { model: demo, breakEven: snap } = await actionLoadDemo();
        setModel(demo);
        setBreakEven(snap);
        setTab('overview');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error cargando demo');
      }
    });
  }

  useEffect(() => {
    loadDemo();
  }, []);

  function recomputeBreakEven(next: BreakEvenModel) {
    setModel(next);
    setError(null);
    startTransition(async () => {
      try {
        setBreakEven(await actionComputeBreakEven(next));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error en punto de equilibrio');
      }
    });
  }

  function updateFixedCost(
    id: string,
    patch: Partial<{ label: string; category: string; amount: string }>,
  ) {
    if (!model) return;
    recomputeBreakEven({
      ...model,
      fixedCosts: model.fixedCosts.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    });
  }

  function removeFixedCost(id: string) {
    if (!model) return;
    const remaining = model.fixedCosts
      .filter((l) => l.id !== id)
      .map((l, idx) => ({ ...l, sortOrder: idx }));
    recomputeBreakEven({ ...model, fixedCosts: remaining });
  }

  function addFixedCost() {
    if (!model) return;
    const label = newFixed.label.trim();
    const category = newFixed.category.trim() || 'General';
    const amount = newFixed.amount.trim() || '0';
    if (!label) {
      setError('Escribe un nombre para el costo fijo nuevo.');
      return;
    }
    const id = `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const nextSort =
      model.fixedCosts.reduce((max, l) => (l.sortOrder > max ? l.sortOrder : max), -1) + 1;
    recomputeBreakEven({
      ...model,
      fixedCosts: [
        ...model.fixedCosts,
        {
          id,
          label,
          category,
          amount,
          active: true,
          sortOrder: nextSort,
        },
      ],
    });
    setNewFixed({ label: '', category: '', amount: '' });
    setError(null);
  }

  function runDecisionStack() {
    if (!breakEven) return;
    setError(null);
    startTransition(async () => {
      try {
        const mkt = await actionMarketingPortfolio({
          currency: 'COP',
          periodFrom: PERIOD_FROM,
          periodTo: PERIOD_TO,
          channels: DEFAULT_CHANNELS,
          budgets: channelRows.map((row) => ({
            id: `b-${row.channelId}`,
            channelId: row.channelId,
            periodFrom: PERIOD_FROM,
            periodTo: PERIOD_TO,
            budgetAmount: row.budget || '0',
            currency: 'COP',
            notes: row.label,
          })),
          actuals: channelRows.map((row) => ({
            id: `a-${row.channelId}`,
            channelId: row.channelId,
            occurredOn: '2026-07-15',
            actualAmount: row.actual || '0',
            currency: 'COP',
            notes: row.label,
          })),
          policy: { alertDeviationRate: alertRate },
        });
        setPortfolio(mkt);

        const proposed = proposedExtra.trim() || '0';
        const liq = await actionComputeLiquidity({
          currency: model?.currency ?? 'COP',
          cash,
          monthlyFixedBurn: fixedBurn,
          monthlyFreeCashFlow: freeCash,
          proposedExtraDebtPayment: proposed,
          reserveMonths,
        });
        setLiquidity(liq);

        const health = await actionBusinessHealth({
          breakEven,
          liquidity: liq,
          proposedExtraDebtPayment: proposedExtra.trim() || undefined,
          futureInterestSaved: interestSaved,
          currency: model?.currency ?? 'COP',
          marketingFreedCapacity: mkt.freedCapacityAmount,
          marketingOverspend: mkt.overspendAmount,
          riskComponents: {
            liquidity: Number(liq.runwayMonths ?? 0) >= 2 ? 75 : 40,
            breakEven: Number(breakEven.safetyMarginRate ?? 0) > 0 ? 80 : 35,
            debtCoverage: Number(mkt.freedCapacityAmount) >= 0 ? 70 : 45,
            margin: Number(breakEven.contributionMarginRate) * 100,
            inventory: 60,
          },
          riskWeights: {
            liquidity: '0.25',
            breakEven: '0.25',
            debtCoverage: '0.20',
            margin: '0.20',
            inventory: '0.10',
          },
          riskBands: { lowMin: 70, mediumMin: 45 },
        });
        setRecommendation(health.recommendation);
        setScore(health.score);
        setTab('decision');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error en decisión');
      }
    });
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="brand-mark text-3xl text-forest md:text-4xl">Tablero operativo</h1>
          <p className="mt-1 text-sm text-muted">
            Demo Local 311 como dataset de ejemplo — no es un default del producto.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadDemo}
            className="rounded-full border border-[var(--line)] bg-white/70 px-4 py-2 text-sm font-medium"
          >
            Recargar demo
          </button>
          <button
            type="button"
            onClick={runDecisionStack}
            className="rounded-full bg-forest px-4 py-2 text-sm font-semibold text-mist"
          >
            Calcular decisión
          </button>
        </div>
      </div>

      <nav className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap ${
              tab === t.id ? 'bg-forest text-mist' : 'bg-white/60 text-ink/80'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {pending ? <p className="mb-4 text-sm text-muted">Calculando con los motores…</p> : null}
      {error ? (
        <p className="mb-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {tab === 'overview' && breakEven ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric
            title="Punto de equilibrio"
            value={formatCop(breakEven.breakEvenSales)}
            hint={`${formatNumber(breakEven.breakEvenUnits)} und/mes`}
          />
          <Metric
            title="Margen de seguridad"
            value={formatCop(breakEven.safetyMargin)}
            hint={formatPct(breakEven.safetyMarginRate)}
          />
          <Metric
            title="Costos fijos"
            value={formatCop(breakEven.totalFixedCosts)}
            hint={`Días op.: ${breakEven.inputsUsed.operatingDaysPerMonth}`}
          />
          <Metric
            title="Meta diaria"
            value={formatCop(breakEven.daily.money)}
            hint={`${formatNumber(breakEven.daily.units)} und/día`}
          />
        </section>
      ) : null}

      {tab === 'costs' && model ? (
        <section className="space-y-4">
          <div className="panel rounded-2xl p-4 md:p-6">
            <h2 className="brand-mark text-2xl text-forest">Costos fijos (inputs)</h2>
            <p className="mt-1 text-sm text-muted">
              Agrega o elimina líneas; el punto de equilibrio se recalcula solo. La publicidad fija
              es presupuesto de plan; el gasto real vive en Publicidad por canal.
            </p>
            <ul className="mt-6 divide-y divide-[var(--line)]">
              {model.fixedCosts.map((line) => (
                <li
                  key={line.id}
                  className="grid gap-2 py-4 md:grid-cols-[1.2fr_1fr_0.9fr_auto] md:items-end"
                >
                  <label className="block text-xs text-muted">
                    Nombre
                    <input
                      className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm text-ink"
                      value={line.label}
                      onChange={(e) => updateFixedCost(line.id, { label: e.target.value })}
                    />
                  </label>
                  <label className="block text-xs text-muted">
                    Categoría
                    <input
                      className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm text-ink"
                      value={line.category}
                      onChange={(e) => updateFixedCost(line.id, { category: e.target.value })}
                    />
                  </label>
                  <label className="block text-xs text-muted">
                    Monto
                    <input
                      className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm text-ink"
                      inputMode="decimal"
                      value={line.amount}
                      onChange={(e) => updateFixedCost(line.id, { amount: e.target.value })}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeFixedCost(line.id)}
                    className="rounded-full border border-danger/30 px-3 py-2 text-sm font-medium text-danger hover:bg-danger/10"
                  >
                    Eliminar
                  </button>
                </li>
              ))}
            </ul>
            {model.fixedCosts.length === 0 ? (
              <p className="mt-4 text-sm text-muted">No hay costos fijos. Agrega al menos uno.</p>
            ) : null}
          </div>

          <div className="panel rounded-2xl p-4 md:p-6">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">
              Nuevo costo fijo
            </h3>
            <div className="mt-4 grid gap-3 md:grid-cols-[1.2fr_1fr_0.9fr_auto] md:items-end">
              <label className="block text-xs text-muted">
                Nombre
                <input
                  className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
                  placeholder="Ej. Seguro local"
                  value={newFixed.label}
                  onChange={(e) => setNewFixed((s) => ({ ...s, label: e.target.value }))}
                />
              </label>
              <label className="block text-xs text-muted">
                Categoría
                <input
                  className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
                  placeholder="Ej. Local"
                  value={newFixed.category}
                  onChange={(e) => setNewFixed((s) => ({ ...s, category: e.target.value }))}
                />
              </label>
              <label className="block text-xs text-muted">
                Monto
                <input
                  className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
                  inputMode="decimal"
                  placeholder="0"
                  value={newFixed.amount}
                  onChange={(e) => setNewFixed((s) => ({ ...s, amount: e.target.value }))}
                />
              </label>
              <button
                type="button"
                onClick={addFixedCost}
                className="rounded-full bg-forest px-4 py-2 text-sm font-semibold text-mist"
              >
                Agregar
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {tab === 'marketing' ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="panel rounded-2xl p-4 md:p-6">
            <h2 className="brand-mark text-2xl text-forest">Presupuesto por canal</h2>
            <p className="mt-1 text-sm text-muted">
              Define lo esperado (TikTok, Meta, Google…) y el cobro real del mes. El sobrante
              aumenta la capacidad de abono a deuda.
            </p>
            <ul className="mt-6 space-y-4">
              {channelRows.map((row) => (
                <li
                  key={row.channelId}
                  className="rounded-xl border border-[var(--line)] bg-white/50 p-3"
                >
                  <p className="font-medium text-forest">{row.label}</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <label className="block text-xs text-muted">
                      Presupuesto
                      <input
                        className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm text-ink"
                        value={row.budget}
                        onChange={(e) =>
                          setChannelRows((rows) =>
                            rows.map((r) =>
                              r.channelId === row.channelId ? { ...r, budget: e.target.value } : r,
                            ),
                          )
                        }
                      />
                    </label>
                    <label className="block text-xs text-muted">
                      Gasto real
                      <input
                        className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm text-ink"
                        value={row.actual}
                        onChange={(e) =>
                          setChannelRows((rows) =>
                            rows.map((r) =>
                              r.channelId === row.channelId ? { ...r, actual: e.target.value } : r,
                            ),
                          )
                        }
                      />
                    </label>
                  </div>
                </li>
              ))}
            </ul>
            <label className="mt-4 block text-sm">
              Umbral de alerta (ej. 0.10 = 10%)
              <input
                className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2"
                value={alertRate}
                onChange={(e) => setAlertRate(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="mt-6 rounded-full bg-moss px-4 py-2 text-sm font-semibold text-mist"
              onClick={runDecisionStack}
            >
              Comparar y recalcular abono
            </button>
          </div>
          <div className="panel rounded-2xl p-4 md:p-6">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">
              Plan vs ejecución
            </h3>
            {portfolio ? (
              <div className="mt-4 space-y-4">
                <div className="space-y-2 text-sm">
                  <p>Presupuesto total: {formatCop(portfolio.totalBudgetAmount)}</p>
                  <p>Gasto real total: {formatCop(portfolio.totalActualAmount)}</p>
                  <p className="font-semibold text-ok">
                    Capacidad liberada: {formatCop(portfolio.freedCapacityAmount)}
                  </p>
                  {Number(portfolio.overspendAmount) > 0 ? (
                    <p className="font-semibold text-danger">
                      Sobrepresupuesto: {formatCop(portfolio.overspendAmount)}
                    </p>
                  ) : null}
                </div>
                <ul className="divide-y divide-[var(--line)] text-sm">
                  {portfolio.channels.map((ch) => {
                    const label =
                      channelRows.find((r) => r.channelId === ch.channelId)?.label ?? ch.channelId;
                    return (
                      <li key={ch.channelId} className="py-2">
                        <p className="font-medium">{label}</p>
                        <p className="text-muted">
                          {formatCop(ch.budgetAmount)} → {formatCop(ch.actualAmount)} ·{' '}
                          {ch.status === 'under_budget'
                            ? 'bajo'
                            : ch.status === 'over_budget'
                              ? 'sobre'
                              : 'en plan'}
                          {ch.alert ? ' · alerta' : ''}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted">
                Compara canales para ver sobrante usable en deuda.
              </p>
            )}
          </div>
        </section>
      ) : null}

      {tab === 'decision' ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="panel rounded-2xl p-4 md:p-6">
            <h2 className="brand-mark text-2xl text-forest">Liquidez (política tuya)</h2>
            <label className="mt-4 block text-sm">
              Caja disponible
              <input
                className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2"
                value={cash}
                onChange={(e) => setCash(e.target.value)}
              />
            </label>
            <label className="mt-3 block text-sm">
              Flujo libre mensual
              <input
                className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2"
                value={freeCash}
                onChange={(e) => setFreeCash(e.target.value)}
              />
            </label>
            <label className="mt-3 block text-sm">
              Reserva (meses de burn)
              <input
                className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2"
                value={reserveMonths}
                onChange={(e) => setReserveMonths(e.target.value)}
              />
            </label>
            <label className="mt-3 block text-sm">
              Abono extra propuesto (opcional — si lo dejas vacío, el motor sugiere)
              <input
                className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2"
                value={proposedExtra}
                placeholder="Auto"
                onChange={(e) => setProposedExtra(e.target.value)}
              />
            </label>
            <label className="mt-3 block text-sm">
              Intereses futuros estimados a ahorrar
              <input
                className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2"
                value={interestSaved}
                onChange={(e) => setInterestSaved(e.target.value)}
              />
            </label>
            <p className="mt-3 text-xs text-muted">
              Burn fijo tomado del BEP: {formatCop(fixedBurn)}
            </p>
            <button
              type="button"
              onClick={runDecisionStack}
              className="mt-5 rounded-full bg-forest px-4 py-2 text-sm font-semibold text-mist"
            >
              Recalcular recomendación
            </button>
          </div>
          <div className="panel rounded-2xl p-4 md:p-6">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">
              Salud y siguiente paso
            </h3>
            {liquidity ? (
              <div className="mt-4 space-y-2 text-sm">
                <p>Runway: {liquidity.runwayMonths ?? '—'} meses</p>
                <p>Máx. abono (solo liquidez): {formatCop(liquidity.maxSafeExtraDebtPayment)}</p>
              </div>
            ) : null}
            {recommendation ? (
              <div className="mt-4 space-y-2 text-sm">
                <p>Liberado por ads: {formatCop(recommendation.marketingFreedCapacity)}</p>
                <p>
                  Capacidad ajustada: {formatCop(recommendation.adjustedMaxSafeExtraDebtPayment)}
                </p>
                <p className="text-lg font-semibold text-forest">
                  Abono sugerido: {formatCop(recommendation.suggestedExtraDebtPayment)}
                </p>
              </div>
            ) : null}
            {score ? (
              <p className="mt-4 text-lg">
                Score {score.score} · riesgo{' '}
                <span className="font-semibold">{score.riskLevel}</span>
              </p>
            ) : null}
            {recommendation ? (
              <div className="mt-4 space-y-2">
                <p className="font-semibold text-forest">{recommendation.action}</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-ink/90">
                  {recommendation.rationale.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted">
                Calcula para ver la recomendación holística.
              </p>
            )}
          </div>
        </section>
      ) : null}

      {!breakEven && !pending ? <p className="text-sm text-muted">Cargando motores…</p> : null}
    </main>
  );
}

function Metric({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <article className="panel rounded-2xl p-4 md:p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{title}</p>
      <p className="metric mt-3 text-2xl font-semibold text-forest md:text-3xl">{value}</p>
      <p className="mt-1 text-sm text-muted">{hint}</p>
    </article>
  );
}
