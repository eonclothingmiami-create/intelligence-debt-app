'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { BreakEvenModel } from '@fie/break-even-engine';
import type { ConfigCatalogItem } from '@fie/shared';
import { applyClosingEffects } from '@/lib/applyClosingEffects';
import {
  applyCommitmentDecision,
  listDueCommitmentsForDay,
  type DueTodayItem,
} from '@/lib/commitmentSchedule';
import {
  fetchClosingStatus,
  markIdlePendingDays,
  postCloseDay,
  type ClosingLineInput,
  type ClosingStatus,
} from '@/lib/closingApi';
import { addObligation, type DebtWorkspace } from '@/lib/debtStore';
import { formatCop } from '@/lib/format';

type Decision = 'none' | 'pagado' | 'parcial' | 'omitido';

type PendingDraft = {
  item: DueTodayItem;
  decision: Decision;
  paidAmount: string;
  deferredTo: string;
};

type ExtraExpense = { category: string; amount: string; note: string };

type ExtraMovement = {
  kind: string;
  concept: string;
  amount: string;
  direction: 'outflow' | 'inflow';
};

type NewDebtDraft = {
  bank: string;
  kindLabel: string;
  balance: string;
  ratePercent: string;
  installment: string;
  dueDay: string;
};

type Phase = 'ask' | 'form' | 'done';

type MovementKindOption = {
  id: string;
  label: string;
  direction: 'inflow' | 'outflow';
};

type Props = {
  model: BreakEvenModel | null;
  debtWs: DebtWorkspace;
  onDebtWsChange: (ws: DebtWorkspace) => void;
  onCashChange: (cash: string) => void;
  onStatusChange: (status: ClosingStatus) => void;
  onClosed: () => void;
  /** From Centro de Configuración — extraordinary movement kinds. */
  movementCategories?: ConfigCatalogItem[];
  /** From Centro de Configuración — expense category suggestions. */
  expenseCategories?: ConfigCatalogItem[];
};

const DEFAULT_EXTRA_KINDS: MovementKindOption[] = [
  { id: 'aporte_capital', label: 'Aporte de capital', direction: 'inflow' },
  { id: 'retiro_utilidades', label: 'Retiro de utilidades', direction: 'outflow' },
  { id: 'compra_activo', label: 'Compra de activo', direction: 'outflow' },
  { id: 'venta_activo', label: 'Venta de activo', direction: 'inflow' },
  { id: 'prestamo_nuevo', label: 'Préstamo nuevo (caja)', direction: 'inflow' },
  { id: 'otro', label: 'Otro', direction: 'outflow' },
];

const fieldClass =
  'mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm text-ink';

function moneyNum(v: string): number {
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function moneyStr(n: number): string {
  return Math.round(n).toFixed(0);
}

function yearMonth(day: string): string {
  return day.slice(0, 7);
}

function resolveMovementKinds(cats?: ConfigCatalogItem[]): MovementKindOption[] {
  const fromConfig = (cats ?? [])
    .filter((c) => c.active && c.label.trim())
    .map((c) => ({
      id: c.id,
      label: c.label,
      direction: (c.direction ?? 'outflow') as 'inflow' | 'outflow',
    }));
  return fromConfig.length > 0 ? fromConfig : DEFAULT_EXTRA_KINDS;
}

/**
 * Registro Diario de Movimientos Financieros
 * Budget stays in Costos/Deudas; here you confirm dues and capture only real changes.
 */
export function DailyClosingGate({
  model,
  debtWs,
  onDebtWsChange,
  onCashChange,
  onStatusChange,
  onClosed,
  movementCategories,
  expenseCategories,
}: Props) {
  const extraKinds = useMemo(() => resolveMovementKinds(movementCategories), [movementCategories]);
  const expenseOptions = useMemo(
    () => (expenseCategories ?? []).filter((c) => c.active && c.label.trim()),
    [expenseCategories],
  );
  const [status, setStatus] = useState<ClosingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('ask');

  const [pendings, setPendings] = useState<PendingDraft[]>([]);
  const [extraExpenses, setExtraExpenses] = useState<ExtraExpense[]>([]);
  const [hasExtras, setHasExtras] = useState(false);
  const [hasMovements, setHasMovements] = useState(false);
  const [movements, setMovements] = useState<ExtraMovement[]>([]);
  const [hasNewDebt, setHasNewDebt] = useState(false);
  const [newDebts, setNewDebts] = useState<NewDebtDraft[]>([
    { bank: '', kindLabel: 'Crédito', balance: '', ratePercent: '', installment: '', dueDay: '' },
  ]);
  const [notes, setNotes] = useState('');

  // Parent often passes inline lambdas — keep refs so mount fetch does not loop / flicker.
  const onStatusChangeRef = useRef(onStatusChange);
  const onClosedRef = useRef(onClosed);
  onStatusChangeRef.current = onStatusChange;
  onClosedRef.current = onClosed;

  const day = status?.nextPendingDay ?? null;
  const pendingCount = status?.pendingDays.length ?? 0;

  const scheduleSource = useMemo(
    () => ({
      fixedCosts: (model?.fixedCosts ?? []).map((l) => ({
        id: l.id,
        label: l.label,
        amount: l.amount,
        category: l.category,
        active: l.active,
        dueDay: l.dueDay,
      })),
      obligations: debtWs.obligations.map((o) => ({
        id: o.id,
        label: o.label,
        active: o.active,
        paymentDueDay: o.paymentDueDay,
        targetPaymentAmount: o.targetPaymentAmount,
        fixedInstallmentAmount: o.fixedInstallmentAmount,
        minimumPaymentAmount: o.minimumPaymentAmount,
      })),
    }),
    [model, debtWs.obligations],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const s = await fetchClosingStatus();
        if (cancelled) return;
        setStatus(s);
        onStatusChangeRef.current(s);
        if (s.pendingDays.length === 0) {
          setPhase('done');
          onClosedRef.current();
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error cargando registro');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!day || phase !== 'form') return;
    const due = listDueCommitmentsForDay(day, scheduleSource);
    setPendings(
      due.map((item) => ({
        item,
        decision: 'none',
        paidAmount: item.scheduledAmount,
        deferredTo: '',
      })),
    );
  }, [day, phase, scheduleSource]);

  function buildLines(): ClosingLineInput[] {
    const lines: ClosingLineInput[] = [];
    for (const p of pendings) {
      if (p.decision === 'none') continue;
      if (p.decision === 'omitido') {
        lines.push({
          lineType: p.item.kind === 'fixed_cost' ? 'fixed_cost_payment' : 'obligation_payment',
          fixedCostId: p.item.kind === 'fixed_cost' ? p.item.refId : null,
          obligationId: p.item.kind === 'obligation' ? p.item.refId : null,
          concept: p.item.label,
          category: p.item.category ?? null,
          paymentKind: p.item.kind === 'fixed_cost' ? 'fixed_cost' : 'cuota',
          baseAmount: '0',
          totalAmount: '0',
          direction: 'outflow',
          note: p.deferredTo ? `Aplazado a ${p.deferredTo}` : 'Omitido / reprogramado',
          meta: {
            commitmentStatus: 'omitido',
            deferredTo: p.deferredTo || null,
            scheduledAmount: p.item.scheduledAmount,
          },
        });
        continue;
      }
      const amount =
        p.decision === 'parcial'
          ? moneyStr(moneyNum(p.paidAmount))
          : moneyStr(moneyNum(p.item.scheduledAmount));
      if (moneyNum(amount) <= 0 && p.decision !== 'parcial') continue;
      lines.push({
        lineType: p.item.kind === 'fixed_cost' ? 'fixed_cost_payment' : 'obligation_payment',
        fixedCostId: p.item.kind === 'fixed_cost' ? p.item.refId : null,
        obligationId: p.item.kind === 'obligation' ? p.item.refId : null,
        concept: p.item.label,
        category: p.item.category ?? null,
        paymentKind: p.item.kind === 'fixed_cost' ? 'fixed_cost' : 'cuota',
        baseAmount: amount,
        totalAmount: amount,
        direction: 'outflow',
        meta: {
          commitmentStatus: p.decision,
          scheduledAmount: p.item.scheduledAmount,
        },
      });
    }

    if (hasExtras) {
      for (const e of extraExpenses) {
        if (moneyNum(e.amount) <= 0) continue;
        lines.push({
          lineType: 'expense',
          category: e.category.trim() || 'extraordinario',
          concept: e.category.trim() || 'Gasto extraordinario',
          note: e.note.trim() || null,
          baseAmount: moneyStr(moneyNum(e.amount)),
          totalAmount: moneyStr(moneyNum(e.amount)),
          direction: 'outflow',
          meta: { extraordinaryExpense: true },
        });
      }
    }

    if (hasMovements) {
      for (const m of movements) {
        if (moneyNum(m.amount) <= 0) continue;
        const kindMeta = extraKinds.find((k) => k.id === m.kind);
        lines.push({
          lineType: 'extraordinary',
          concept: m.concept.trim() || kindMeta?.label || m.kind,
          category: m.kind,
          baseAmount: moneyStr(moneyNum(m.amount)),
          totalAmount: moneyStr(moneyNum(m.amount)),
          direction: m.direction,
          meta: { movementKind: m.kind },
        });
      }
    }

    if (hasNewDebt) {
      for (const d of newDebts) {
        if (!d.bank.trim() || moneyNum(d.balance) <= 0) continue;
        lines.push({
          lineType: 'new_obligation',
          concept: `${d.kindLabel} ${d.bank}`.trim(),
          category: d.kindLabel,
          baseAmount: moneyStr(moneyNum(d.balance)),
          totalAmount: moneyStr(moneyNum(d.balance)),
          direction: 'outflow',
          meta: {
            bank: d.bank.trim(),
            kindLabel: d.kindLabel.trim(),
            ratePercent: d.ratePercent.trim() || null,
            installment: d.installment.trim() || null,
            dueDay: d.dueDay ? Number(d.dueDay) : null,
          },
        });
      }
    }

    return lines;
  }

  function validate(): string | null {
    for (const p of pendings) {
      if (p.decision === 'parcial' && moneyNum(p.paidAmount) <= 0) {
        return `Indica el monto parcial de ${p.item.label}.`;
      }
      if (p.decision === 'omitido' && !p.deferredTo) {
        return `Indica la nueva fecha para ${p.item.label}, o márcalo pagado.`;
      }
    }
    if (hasExtras) {
      const ok = extraExpenses.some((e) => moneyNum(e.amount) > 0);
      if (!ok) return 'Agrega al menos un gasto extraordinario con valor.';
    }
    if (hasMovements) {
      const ok = movements.some((m) => moneyNum(m.amount) > 0);
      if (!ok) return 'Indica el valor del movimiento extraordinario.';
    }
    if (hasNewDebt) {
      const ok = newDebts.some((d) => d.bank.trim() && moneyNum(d.balance) > 0);
      if (!ok) return 'Completa banco y saldo de la nueva obligación.';
    }
    return null;
  }

  async function confirmNoMovements() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await markIdlePendingDays();
      setStatus(result.status);
      onStatusChange(result.status);
      setSuccess(result.message);
      setPhase('done');
      onClosed();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al marcar sin movimientos');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitMovements() {
    if (!day) return;
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const ym = yearMonth(day);
      for (const p of pendings) {
        if (p.decision === 'none') continue;
        applyCommitmentDecision({
          item: p.item,
          yearMonth: ym,
          decision: p.decision,
          paidAmount: p.paidAmount,
          deferredTo: p.deferredTo,
        });
      }

      let nextDebts = debtWs;
      if (hasNewDebt) {
        for (const d of newDebts) {
          if (!d.bank.trim() || moneyNum(d.balance) <= 0) continue;
          nextDebts = addObligation(nextDebts, {
            label: `${d.kindLabel} ${d.bank}`.trim(),
            kindLabel: d.kindLabel.trim() || 'Crédito',
            institution: d.bank.trim(),
            openingPrincipal: moneyStr(moneyNum(d.balance)),
            ratePercent: d.ratePercent.trim() || undefined,
            ratePeriodicity: d.ratePercent.trim() ? 'monthly' : 'none',
            allowsExtraPayments: true,
            fixedInstallmentAmount: d.installment.trim() || undefined,
            targetPaymentAmount: d.installment.trim() || undefined,
          });
          // patch paymentDueDay after add — addObligation doesn't take dueDay; patch via map
          const last = nextDebts.obligations[nextDebts.obligations.length - 1];
          if (last && d.dueDay) {
            nextDebts = {
              ...nextDebts,
              obligations: nextDebts.obligations.map((o) =>
                o.id === last.id ? { ...o, paymentDueDay: Number(d.dueDay) } : o,
              ),
            };
          }
        }
      }

      const lines = buildLines();
      // omitido with 0 total: still persist fact but don't move cash for those
      const cashLines = lines.filter(
        (l) => !(l.meta?.commitmentStatus === 'omitido' && moneyNum(l.totalAmount ?? '0') === 0),
      );

      const result = await postCloseDay(day, {
        salesSnapshot: { source: 'erp_hera', note: 'Ventas no se registran aquí' },
        notes: notes.trim() || null,
        closedBy: 'owner',
        lines,
      });

      const effects = applyClosingEffects(cashLines, nextDebts, day);
      onDebtWsChange(effects.debtWs);
      onCashChange(effects.cashOnHand);
      setStatus(result.status);
      onStatusChange(result.status);
      setSuccess(result.message || 'Movimientos registrados correctamente');

      if (result.status.pendingDays.length === 0) {
        setPhase('done');
        onClosed();
      } else {
        setPhase('ask');
        setHasExtras(false);
        setHasMovements(false);
        setHasNewDebt(false);
        setExtraExpenses([]);
        setMovements([]);
        setNotes('');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al registrar');
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (hasExtras && extraExpenses.length === 0) {
      setExtraExpenses([{ category: '', amount: '', note: '' }]);
    }
  }, [hasExtras, extraExpenses.length]);

  useEffect(() => {
    if (hasMovements && movements.length === 0) {
      setMovements([
        {
          kind: extraKinds[0]?.id ?? 'aporte_capital',
          concept: '',
          amount: '',
          direction: extraKinds[0]?.direction ?? 'inflow',
        },
      ]);
    }
  }, [hasMovements, movements.length]);

  if (loading) {
    return (
      <div className="panel rounded-2xl p-8 text-center text-muted">
        Cargando registro de movimientos…
      </div>
    );
  }
  if (!day || phase === 'done') return null;

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-[var(--bg)]/95 backdrop-blur-sm">
      <div className="mx-auto flex min-h-full max-w-2xl flex-col justify-center px-4 py-10">
        <section className="panel rounded-2xl p-5 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Presupuesto ≠ ejecución · solo confirmas y capturas cambios
          </p>
          <h1 className="brand-mark mt-2 text-3xl text-forest">
            Registro Diario de Movimientos Financieros
          </h1>
          <p className="mt-2 text-sm text-muted">
            Costos fijos y cuotas viven en el presupuesto. Aquí confirmas pendientes del día y
            registras solo lo extraordinario.
            {pendingCount > 1 ? ` · ${pendingCount} día(s) pendientes` : ''}
          </p>

          {error ? (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              {success}
            </p>
          ) : null}

          {phase === 'ask' ? (
            <div className="mt-8 space-y-4">
              <h2 className="text-lg font-semibold text-forest">
                ¿Hubo movimientos financieros manuales desde tu última actualización?
              </h2>
              <p className="text-sm text-muted">
                Incluye confirmar pagos programados, gastos extraordinarios o movimientos de
                capital/activos. Última: {status?.lastClosed ?? 'ninguna'} · Hoy: {status?.today}.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="rounded-lg bg-forest px-5 py-3 text-sm font-semibold text-white"
                  disabled={submitting}
                  onClick={() => {
                    setError(null);
                    setPhase('form');
                  }}
                >
                  Sí — abrir registro
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-[var(--line)] px-5 py-3 text-sm font-medium disabled:opacity-50"
                  disabled={submitting}
                  onClick={() => void confirmNoMovements()}
                >
                  {submitting
                    ? 'Actualizando…'
                    : pendingCount > 1
                      ? `No — marcar ${pendingCount} días sin cambios`
                      : 'No — sin cambios hoy'}
                </button>
              </div>
            </div>
          ) : null}

          {phase === 'form' ? (
            <div className="mt-6 space-y-8">
              <p className="text-sm text-muted">
                Fecha: <strong>{day}</strong>
              </p>

              {/* Pendientes del día */}
              <section className="space-y-3">
                <h2 className="text-base font-semibold text-forest">Pendientes del día</h2>
                <p className="text-xs text-muted">
                  Compromisos del presupuesto que vencen hoy o estánan pendientes. Solo confirma.
                </p>
                {pendings.length === 0 ? (
                  <p className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm text-muted">
                    No hay compromisos programados para este día. (Define día de pago en Costos /
                    Deudas.)
                  </p>
                ) : (
                  pendings.map((p, i) => (
                    <div key={p.item.key} className="rounded-xl border border-[var(--line)] p-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-medium">
                          {p.item.label}{' '}
                          <span className="text-muted">
                            {formatCop(p.item.scheduledAmount)}
                            {p.item.overdue ? ' · vencido' : ''}
                          </span>
                        </p>
                        <span className="text-xs uppercase tracking-wide text-muted">
                          {p.item.kind === 'fixed_cost' ? 'Costo fijo' : 'Obligación'} · día{' '}
                          {p.item.dueDay}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(
                          [
                            ['pagado', 'Pagado'],
                            ['parcial', 'Pagado parcialmente'],
                            ['omitido', 'Aplazado'],
                            ['none', 'Sin acción'],
                          ] as const
                        ).map(([val, label]) => (
                          <button
                            key={val}
                            type="button"
                            className={`rounded-lg px-3 py-1.5 text-xs ${
                              p.decision === val
                                ? 'bg-forest text-white'
                                : 'border border-[var(--line)]'
                            }`}
                            onClick={() => {
                              const next = [...pendings];
                              next[i] = { ...p, decision: val };
                              setPendings(next);
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      {p.decision === 'parcial' ? (
                        <label className="mt-2 block text-xs text-muted">
                          Monto pagado
                          <input
                            className={fieldClass}
                            value={p.paidAmount}
                            onChange={(ev) => {
                              const next = [...pendings];
                              next[i] = { ...p, paidAmount: ev.target.value };
                              setPendings(next);
                            }}
                          />
                        </label>
                      ) : null}
                      {p.decision === 'omitido' ? (
                        <label className="mt-2 block text-xs text-muted">
                          Nueva fecha
                          <input
                            className={fieldClass}
                            type="date"
                            value={p.deferredTo}
                            onChange={(ev) => {
                              const next = [...pendings];
                              next[i] = { ...p, deferredTo: ev.target.value };
                              setPendings(next);
                            }}
                          />
                        </label>
                      ) : null}
                    </div>
                  ))
                )}
              </section>

              {/* Gastos extraordinarios */}
              <section className="space-y-3">
                <h2 className="text-base font-semibold text-forest">Gastos extraordinarios</h2>
                <p className="text-xs text-muted">
                  Solo lo no presupuestado (taxi, almuerzo, reparación, etc.).
                </p>
                {expenseOptions.length > 0 ? (
                  <datalist id="fie-expense-categories">
                    {expenseOptions.map((c) => (
                      <option key={c.id} value={c.label} />
                    ))}
                  </datalist>
                ) : null}
                <YesNo value={hasExtras} onChange={setHasExtras} />
                {hasExtras
                  ? extraExpenses.map((e, i) => (
                      <div
                        key={i}
                        className="grid gap-2 rounded-xl border border-[var(--line)] p-3 md:grid-cols-3"
                      >
                        <label className="text-xs text-muted">
                          Categoría
                          <input
                            className={fieldClass}
                            list="fie-expense-categories"
                            value={e.category}
                            onChange={(ev) => {
                              const next = [...extraExpenses];
                              next[i] = { ...e, category: ev.target.value };
                              setExtraExpenses(next);
                            }}
                          />
                        </label>
                        <label className="text-xs text-muted">
                          Valor
                          <input
                            className={fieldClass}
                            value={e.amount}
                            onChange={(ev) => {
                              const next = [...extraExpenses];
                              next[i] = { ...e, amount: ev.target.value };
                              setExtraExpenses(next);
                            }}
                          />
                        </label>
                        <label className="text-xs text-muted">
                          Observación
                          <input
                            className={fieldClass}
                            value={e.note}
                            onChange={(ev) => {
                              const next = [...extraExpenses];
                              next[i] = { ...e, note: ev.target.value };
                              setExtraExpenses(next);
                            }}
                          />
                        </label>
                      </div>
                    ))
                  : null}
                {hasExtras ? (
                  <button
                    type="button"
                    className="text-sm text-forest underline"
                    onClick={() =>
                      setExtraExpenses([...extraExpenses, { category: '', amount: '', note: '' }])
                    }
                  >
                    + Agregar gasto
                  </button>
                ) : null}
              </section>

              {/* Movimientos extraordinarios */}
              <section className="space-y-3">
                <h2 className="text-base font-semibold text-forest">Movimientos extraordinarios</h2>
                <YesNo value={hasMovements} onChange={setHasMovements} />
                {hasMovements
                  ? movements.map((m, i) => (
                      <div
                        key={i}
                        className="grid gap-2 rounded-xl border border-[var(--line)] p-3 md:grid-cols-2"
                      >
                        <label className="text-xs text-muted">
                          Tipo
                          <select
                            className={fieldClass}
                            value={m.kind}
                            onChange={(ev) => {
                              const kind = extraKinds.find((k) => k.id === ev.target.value);
                              const next = [...movements];
                              next[i] = {
                                ...m,
                                kind: ev.target.value,
                                direction: kind?.direction ?? m.direction,
                              };
                              setMovements(next);
                            }}
                          >
                            {extraKinds.map((k) => (
                              <option key={k.id} value={k.id}>
                                {k.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="text-xs text-muted">
                          Valor
                          <input
                            className={fieldClass}
                            value={m.amount}
                            onChange={(ev) => {
                              const next = [...movements];
                              next[i] = { ...m, amount: ev.target.value };
                              setMovements(next);
                            }}
                          />
                        </label>
                        <label className="text-xs text-muted md:col-span-2">
                          Concepto
                          <input
                            className={fieldClass}
                            value={m.concept}
                            onChange={(ev) => {
                              const next = [...movements];
                              next[i] = { ...m, concept: ev.target.value };
                              setMovements(next);
                            }}
                          />
                        </label>
                      </div>
                    ))
                  : null}
              </section>

              {/* Nueva deuda */}
              <section className="space-y-3">
                <h2 className="text-base font-semibold text-forest">¿Nueva obligación?</h2>
                <YesNo value={hasNewDebt} onChange={setHasNewDebt} />
                {hasNewDebt
                  ? newDebts.map((d, i) => (
                      <div
                        key={i}
                        className="grid gap-2 rounded-xl border border-[var(--line)] p-3 md:grid-cols-2"
                      >
                        <label className="text-xs text-muted">
                          Banco
                          <input
                            className={fieldClass}
                            value={d.bank}
                            onChange={(ev) => {
                              const next = [...newDebts];
                              next[i] = { ...d, bank: ev.target.value };
                              setNewDebts(next);
                            }}
                          />
                        </label>
                        <label className="text-xs text-muted">
                          Tipo
                          <input
                            className={fieldClass}
                            value={d.kindLabel}
                            onChange={(ev) => {
                              const next = [...newDebts];
                              next[i] = { ...d, kindLabel: ev.target.value };
                              setNewDebts(next);
                            }}
                          />
                        </label>
                        <label className="text-xs text-muted">
                          Saldo
                          <input
                            className={fieldClass}
                            value={d.balance}
                            onChange={(ev) => {
                              const next = [...newDebts];
                              next[i] = { ...d, balance: ev.target.value };
                              setNewDebts(next);
                            }}
                          />
                        </label>
                        <label className="text-xs text-muted">
                          Cuota
                          <input
                            className={fieldClass}
                            value={d.installment}
                            onChange={(ev) => {
                              const next = [...newDebts];
                              next[i] = { ...d, installment: ev.target.value };
                              setNewDebts(next);
                            }}
                          />
                        </label>
                        <label className="text-xs text-muted">
                          Tasa % mensual
                          <input
                            className={fieldClass}
                            value={d.ratePercent}
                            onChange={(ev) => {
                              const next = [...newDebts];
                              next[i] = { ...d, ratePercent: ev.target.value };
                              setNewDebts(next);
                            }}
                          />
                        </label>
                        <label className="text-xs text-muted">
                          Día de pago (1–31)
                          <input
                            className={fieldClass}
                            value={d.dueDay}
                            onChange={(ev) => {
                              const next = [...newDebts];
                              next[i] = { ...d, dueDay: ev.target.value };
                              setNewDebts(next);
                            }}
                          />
                        </label>
                      </div>
                    ))
                  : null}
              </section>

              <label className="block text-xs text-muted">
                Observaciones (opcional)
                <textarea
                  className={`${fieldClass} min-h-[72px]`}
                  value={notes}
                  onChange={(ev) => setNotes(ev.target.value)}
                />
              </label>

              <div className="flex flex-wrap justify-between gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm"
                  onClick={() => setPhase('ask')}
                >
                  Atrás
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  disabled={submitting}
                  onClick={() => void submitMovements()}
                >
                  {submitting ? 'Guardando…' : 'Guardar registro del día'}
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function YesNo({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        className={`rounded-lg px-4 py-2 text-sm ${value ? 'bg-forest text-white' : 'border border-[var(--line)]'}`}
        onClick={() => onChange(true)}
      >
        Sí
      </button>
      <button
        type="button"
        className={`rounded-lg px-4 py-2 text-sm ${!value ? 'bg-forest text-white' : 'border border-[var(--line)]'}`}
        onClick={() => onChange(false)}
      >
        No
      </button>
    </div>
  );
}
