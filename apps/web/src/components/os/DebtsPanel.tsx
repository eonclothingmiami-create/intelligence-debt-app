'use client';

import { useMemo, useState } from 'react';
import { SUGGESTED_DEBT_KIND_LABELS } from '@fie/debt-manager';
import { formatCop, formatNumber } from '@/lib/format';
import {
  addObligation,
  createDemoDebtWorkspace,
  debtDashboard,
  optimizeExtraCash,
  patchObligation,
  recordExtraPayment,
  removeObligation,
  simulateObligationPayment,
  type DebtWorkspace,
} from '@/lib/debtStore';

type Props = {
  workspace: DebtWorkspace;
  onChange: (next: DebtWorkspace) => void;
  extraCashHint?: string;
};

export function DebtsPanel({ workspace, onChange, extraCashHint }: Props) {
  const dash = useMemo(() => debtDashboard(workspace), [workspace]);
  const [selectedId, setSelectedId] = useState<string | null>(
    dash.snapshots[0]?.obligation.id ?? null,
  );
  const [sliderPay, setSliderPay] = useState('2500000');
  const [form, setForm] = useState<{
    label: string;
    kindLabel: string;
    institution: string;
    openingPrincipal: string;
    ratePercent: string;
    ratePeriodicity: 'daily' | 'monthly' | 'annual' | 'none';
    allowsExtraPayments: boolean;
    interestOnlyPayments: boolean;
    fixedInstallmentAmount: string;
    purpose: string;
  }>({
    label: '',
    kindLabel: 'Tarjeta de crédito',
    institution: '',
    openingPrincipal: '',
    ratePercent: '',
    ratePeriodicity: 'monthly',
    allowsExtraPayments: true,
    interestOnlyPayments: false,
    fixedInstallmentAmount: '',
    purpose: '',
  });

  const selected = dash.snapshots.find((s) => s.obligation.id === selectedId) ?? dash.snapshots[0];
  const sim = selected
    ? simulateObligationPayment(workspace, selected.obligation.id, sliderPay)
    : null;
  const opt = optimizeExtraCash(workspace, extraCashHint || '1200000');

  return (
    <section className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat
          title="Saldo total"
          value={formatCop(dash.totalBalance)}
          hint={`${dash.obligationCount} obligaciones`}
        />
        <Stat
          title="Intereses mensuales est."
          value={formatCop(dash.estimatedMonthlyInterest)}
          hint="Según tasa × saldo"
        />
        <Stat
          title="Cuotas del mes"
          value={formatCop(dash.monthlyInstallmentsDue)}
          hint="Mín / fija / objetivo"
        />
        <Stat
          title="Permiten abono extra"
          value={String(dash.allowsExtraPaymentCount)}
          hint="Regla por producto"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel rounded-2xl p-4 md:p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="brand-mark text-2xl text-forest">Obligaciones vivas</h2>
            <button
              type="button"
              className="text-xs font-medium text-muted underline"
              onClick={() => onChange(createDemoDebtWorkspace())}
            >
              Recargar demo
            </button>
          </div>
          <p className="mt-1 text-sm text-muted">
            SoT del usuario (no ERP). El saldo se reconstruye por eventos, no se edita a mano.
          </p>
          <ul className="mt-4 divide-y divide-[var(--line)]">
            {dash.snapshots.map((snap) => (
              <li key={snap.obligation.id} className="py-3">
                <button
                  type="button"
                  className={`w-full text-left ${selected?.obligation.id === snap.obligation.id ? 'opacity-100' : 'opacity-80'}`}
                  onClick={() => {
                    setSelectedId(snap.obligation.id);
                    const base = snap.obligation.interestOnlyPayments
                      ? (snap.obligation.fixedInstallmentAmount ??
                        snap.obligation.minimumPaymentAmount ??
                        snap.estimatedMonthlyInterest ??
                        '0')
                      : (snap.obligation.targetPaymentAmount ??
                        snap.obligation.fixedInstallmentAmount ??
                        snap.obligation.minimumPaymentAmount ??
                        '0');
                    setSliderPay(base);
                  }}
                >
                  <p className="font-medium text-forest">{snap.obligation.label}</p>
                  <p className="text-xs text-muted">
                    {snap.obligation.kindLabel}
                    {snap.obligation.institution ? ` · ${snap.obligation.institution}` : ''}
                    {snap.obligation.purpose ? ` · ${snap.obligation.purpose}` : ''}
                    {snap.obligation.interestOnlyPayments ? ' · solo intereses' : ''}
                  </p>
                  <p className="metric mt-1 text-sm">
                    {formatCop(snap.balance)}
                    {snap.estimatedMonthlyInterest
                      ? ` · interés ~${formatCop(snap.estimatedMonthlyInterest)}/mes`
                      : ' · sin interés'}
                  </p>
                </button>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-muted">
                    <input
                      type="checkbox"
                      checked={Boolean(snap.obligation.interestOnlyPayments)}
                      onChange={(e) =>
                        onChange(
                          patchObligation(workspace, snap.obligation.id, {
                            interestOnlyPayments: e.target.checked,
                          }),
                        )
                      }
                    />
                    Solo pago intereses (no capital)
                  </label>
                  <button
                    type="button"
                    className="text-xs font-medium text-danger"
                    onClick={() => {
                      onChange(removeObligation(workspace, snap.obligation.id));
                      if (selectedId === snap.obligation.id) setSelectedId(null);
                    }}
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="panel rounded-2xl p-4 md:p-6">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">
            Simulador de pago
          </h3>
          {selected ? (
            <div className="mt-4 space-y-3">
              <p className="font-medium">{selected.obligation.label}</p>
              <p className="text-sm text-muted">
                Abonos extra: {selected.obligation.allowsExtraPayments ? 'sí' : 'no'} · Tasa:{' '}
                {selected.obligation.ratePercent ?? '0'}% {selected.obligation.ratePeriodicity}
                {selected.obligation.interestOnlyPayments
                  ? ' · modalidad: solo intereses (capital no baja con la cuota)'
                  : ''}
              </p>
              <label className="block text-sm">
                Pago propuesto (slider)
                <input
                  type="range"
                  min={0}
                  max={Math.max(Number(selected.balance) || 0, 1)}
                  step={50000}
                  value={Number(sliderPay) || 0}
                  className="mt-2 w-full"
                  onChange={(e) => setSliderPay(e.target.value)}
                />
                <input
                  className="metric mt-2 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2"
                  value={sliderPay}
                  onChange={(e) => setSliderPay(e.target.value)}
                />
              </label>
              {sim ? (
                <div className="space-y-1 text-sm">
                  <p>
                    Plazos: {sim.periodsAtCurrent ?? 'n/a'} →{' '}
                    <span className="font-semibold">{sim.periodsAtProposed ?? 'n/a'}</span>
                  </p>
                  <p>
                    Intereses est.: {formatCop(sim.interestAtCurrent)} →{' '}
                    {formatCop(sim.interestAtProposed)}
                  </p>
                  <p className="font-semibold text-ok">
                    Ahorro intereses: {formatCop(sim.interestSaved)}
                  </p>
                  {!sim.allowed ? (
                    <p className="text-danger">Esta deuda no permite ese abono extraordinario.</p>
                  ) : null}
                  <ul className="list-disc pl-5 text-muted">
                    {sim.rationale.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                  {sim.allowed ? (
                    <button
                      type="button"
                      className="mt-3 rounded-full bg-moss px-4 py-2 text-sm font-semibold text-mist"
                      onClick={() =>
                        onChange(recordExtraPayment(workspace, selected.obligation.id, sliderPay))
                      }
                    >
                      Registrar abono extra (evento)
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">Selecciona una obligación.</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel rounded-2xl p-4 md:p-6">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">
            Nueva obligación
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field
              label="Nombre"
              value={form.label}
              onChange={(v) => setForm((f) => ({ ...f, label: v }))}
            />
            <label className="block text-xs text-muted">
              Tipo (libre)
              <select
                className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm text-ink"
                value={form.kindLabel}
                onChange={(e) => setForm((f) => ({ ...f, kindLabel: e.target.value }))}
              >
                {SUGGESTED_DEBT_KIND_LABELS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
              <input
                className="mt-2 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
                placeholder="O escribe otro tipo…"
                value={form.kindLabel}
                onChange={(e) => setForm((f) => ({ ...f, kindLabel: e.target.value }))}
              />
            </label>
            <Field
              label="Institución"
              value={form.institution}
              onChange={(v) => setForm((f) => ({ ...f, institution: v }))}
            />
            <Field
              label="Saldo inicial (desembolso)"
              value={form.openingPrincipal}
              onChange={(v) => setForm((f) => ({ ...f, openingPrincipal: v }))}
            />
            <Field
              label="Tasa % (vacío si proveedor)"
              value={form.ratePercent}
              onChange={(v) => setForm((f) => ({ ...f, ratePercent: v }))}
            />
            <label className="block text-xs text-muted">
              Periodicidad tasa
              <select
                className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
                value={form.ratePeriodicity}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    ratePeriodicity: e.target.value as typeof f.ratePeriodicity,
                  }))
                }
              >
                <option value="monthly">Mensual</option>
                <option value="annual">Anual</option>
                <option value="daily">Diaria</option>
                <option value="none">Ninguna</option>
              </select>
            </label>
            <Field
              label="Cuota fija"
              value={form.fixedInstallmentAmount}
              onChange={(v) => setForm((f) => ({ ...f, fixedInstallmentAmount: v }))}
            />
            <Field
              label="Destino / propósito"
              value={form.purpose}
              onChange={(v) => setForm((f) => ({ ...f, purpose: v }))}
            />
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.allowsExtraPayments}
              onChange={(e) => setForm((f) => ({ ...f, allowsExtraPayments: e.target.checked }))}
            />
            Permite abonos extraordinarios
          </label>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.interestOnlyPayments}
              onChange={(e) => setForm((f) => ({ ...f, interestOnlyPayments: e.target.checked }))}
            />
            Solo pago intereses (no abono a capital)
          </label>
          <button
            type="button"
            className="mt-4 rounded-full bg-forest px-4 py-2 text-sm font-semibold text-mist"
            onClick={() => {
              if (!form.label.trim()) return;
              const next = addObligation(workspace, {
                label: form.label.trim(),
                kindLabel: form.kindLabel.trim() || 'Otro',
                ...(form.institution.trim() ? { institution: form.institution.trim() } : {}),
                openingPrincipal: form.openingPrincipal || '0',
                ...(form.ratePercent.trim() ? { ratePercent: form.ratePercent.trim() } : {}),
                ratePeriodicity:
                  form.ratePeriodicity === 'none' || !form.ratePercent.trim()
                    ? 'none'
                    : form.ratePeriodicity,
                allowsExtraPayments: form.allowsExtraPayments,
                interestOnlyPayments: form.interestOnlyPayments,
                ...(form.fixedInstallmentAmount.trim()
                  ? { fixedInstallmentAmount: form.fixedInstallmentAmount.trim() }
                  : {}),
                ...(form.purpose.trim() ? { purpose: form.purpose.trim() } : {}),
              });
              onChange(next);
              setForm({
                label: '',
                kindLabel: 'Tarjeta de crédito',
                institution: '',
                openingPrincipal: '',
                ratePercent: '',
                ratePeriodicity: 'monthly',
                allowsExtraPayments: true,
                interestOnlyPayments: false,
                fixedInstallmentAmount: '',
                purpose: '',
              });
            }}
          >
            Agregar deuda
          </button>
        </div>

        <div className="panel rounded-2xl p-4 md:p-6">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">
            Optimizer (todas a la vez)
          </h3>
          <p className="mt-2 text-sm text-muted">
            Efectivo extra de referencia: {formatCop(extraCashHint || '1200000')}. No usa la regla
            “mayor saldo primero”.
          </p>
          {opt.suggestedTargetObligationId ? (
            <p className="mt-4 text-lg font-semibold text-forest">
              Mejor candidato:{' '}
              {opt.ranked.find((r) => r.obligationId === opt.suggestedTargetObligationId)?.label} ·{' '}
              {formatCop(opt.suggestedAmount)}
            </p>
          ) : (
            <p className="mt-4 text-sm">Sin candidato de abono extra.</p>
          )}
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
            {opt.ranked.slice(0, 5).map((c, i) => (
              <li key={c.obligationId}>
                {i + 1}. {c.label} · tasa {formatNumber(c.ratePercent, 4)}% · saldo{' '}
                {formatCop(c.balance)}
              </li>
            ))}
          </ol>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
            {opt.rationale.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Stat({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <article className="panel rounded-2xl p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{title}</p>
      <p className="metric mt-2 text-2xl font-semibold text-forest">{value}</p>
      <p className="mt-1 text-sm text-muted">{hint}</p>
    </article>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-xs text-muted">
      {label}
      <input
        className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm text-ink"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
