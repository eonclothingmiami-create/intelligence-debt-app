'use client';

import { useMemo, useState } from 'react';
import {
  COLOMBIA_SMMLV_BY_YEAR,
  computeColombiaEmployerPayroll,
  type ColombiaPayrollBreakdown,
} from '@fie/break-even-engine';
import { syncHeraPayroll } from '@/lib/erpApi';
import {
  employerCostFromHeraEmployees,
  type HeraEmployee,
  type HeraPayrollSnapshot,
} from '@/lib/heraPayroll';
import { formatCop } from '@/lib/format';

type Props = {
  onApply: (breakdown: ColombiaPayrollBreakdown) => void;
  /** When Hera returns N workers, apply summed employer cost + list. */
  onApplyHera?: (input: {
    totalMonthly: string;
    quincenaTotal: string;
    workerCount: number;
    year: number;
    employees: HeraEmployee[];
    notes: string;
  }) => void;
};

/**
 * Automates Colombian employer payroll from SMMLV and/or Hera employees sync.
 */
export function PayrollColombiaPanel({ onApply, onApplyHera }: Props) {
  const currentYear = new Date().getFullYear();
  const defaultYear = COLOMBIA_SMMLV_BY_YEAR.some((y) => y.year === currentYear)
    ? currentYear
    : COLOMBIA_SMMLV_BY_YEAR[COLOMBIA_SMMLV_BY_YEAR.length - 1]!.year;

  const [year, setYear] = useState(defaultYear);
  const [workers, setWorkers] = useState('1');
  const [customSalary, setCustomSalary] = useState('');
  const [parafiscalExempt, setParafiscalExempt] = useState(false);
  const [arlClass, setArlClass] = useState<'I' | 'II' | 'III' | 'IV' | 'V'>('I');
  const [heraPending, setHeraPending] = useState(false);
  const [heraSnap, setHeraSnap] = useState<HeraPayrollSnapshot | null>(null);
  const [heraError, setHeraError] = useState<string | null>(null);

  const { breakdown, error } = useMemo(() => {
    try {
      const count = Number(workers);
      if (!Number.isInteger(count) || count < 1) {
        return { breakdown: null as ColombiaPayrollBreakdown | null, error: 'Trabajadores ≥ 1' };
      }
      return {
        breakdown: computeColombiaEmployerPayroll({
          year,
          workerCount: count,
          baseSalary: customSalary.trim() || undefined,
          includeTransportAid: true,
          arlClass,
          parafiscalExempt,
        }),
        error: null as string | null,
      };
    } catch (e) {
      return {
        breakdown: null as ColombiaPayrollBreakdown | null,
        error: e instanceof Error ? e.message : 'Error en cálculo',
      };
    }
  }, [year, workers, customSalary, parafiscalExempt, arlClass]);

  async function syncFromHera() {
    setHeraPending(true);
    setHeraError(null);
    try {
      const snap = await syncHeraPayroll();
      setHeraSnap(snap);
      if (!snap.empty && snap.employees.length > 0 && onApplyHera) {
        const cost = employerCostFromHeraEmployees({
          employees: snap.employees,
          year,
          parafiscalExempt,
          arlClass,
        });
        onApplyHera({
          totalMonthly: cost.totalMonthly,
          quincenaTotal: cost.quincenaTotal,
          workerCount: cost.workerCount,
          year,
          employees: snap.employees,
          notes: [
            `Sync Hera Nómina (${snap.source ?? 'employees'}): ${cost.workerCount} trabajador(es).`,
            ...cost.perWorker.map(
              (p) =>
                `${p.employee.nombre}: base ${p.employee.salarioBase} → costo ${p.breakdown.totalMonthly}`,
            ),
          ].join(' '),
        });
      }
    } catch (e) {
      setHeraError(e instanceof Error ? e.message : 'Error sync nómina Hera');
    } finally {
      setHeraPending(false);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-2xl border border-[var(--line)] bg-white/50 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">
          Trabajadores desde Hera (ERP)
        </h3>
        <p className="mt-1 text-xs text-muted">
          Solo lectura: Edge lee <code>employees</code>. Si hay varios, suma costos empleador y
          actualiza el BEP. Si el módulo está vacío, usa la calculadora SMMLV abajo.
        </p>
        <button
          type="button"
          disabled={heraPending}
          onClick={syncFromHera}
          className="mt-3 rounded-full bg-forest px-4 py-2 text-sm font-semibold text-mist disabled:opacity-50"
        >
          {heraPending ? 'Sincronizando…' : 'Sincronizar nómina Hera'}
        </button>
        {heraError ? <p className="mt-2 text-sm text-red-700">{heraError}</p> : null}
        {heraSnap ? (
          <div className="mt-3 space-y-2 text-sm">
            <p className={heraSnap.empty ? 'text-amber-800' : 'text-forest'}>{heraSnap.message}</p>
            {heraSnap.empty ? (
              <p className="text-xs text-muted">
                Tienes 1 persona trabajando pero no está en el módulo Nómina del ERP. Regístrala en
                Hera (nombre + salario base) y vuelve a sincronizar, o aplica SMMLV manualmente.
              </p>
            ) : (
              <ul className="list-disc space-y-1 pl-5 text-muted">
                {heraSnap.employees.map((e) => (
                  <li key={e.id}>
                    {e.nombre} — base {formatCop(e.salarioBase)} ({e.tipoContrato})
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-[var(--line)] bg-white/50 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">
          Nómina Colombia (SMMLV + provisiones)
        </h3>
        <p className="mt-1 text-xs text-muted">
          Calcula el costo empleador según el salario mínimo del año. No es liquidación oficial; es
          costo fijo operativo con provisiones.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-sm">
            Año SMMLV
            <select
              className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {COLOMBIA_SMMLV_BY_YEAR.map((r) => (
                <option key={r.year} value={r.year}>
                  {r.year} — {formatCop(r.smmlv)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Trabajadores
            <input
              className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2"
              value={workers}
              onChange={(e) => setWorkers(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Salario base (vacío = SMMLV)
            <input
              className="metric mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2"
              value={customSalary}
              placeholder="SMMLV del año"
              onChange={(e) => setCustomSalary(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Clase ARL
            <select
              className="mt-1 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2"
              value={arlClass}
              onChange={(e) => setArlClass(e.target.value as typeof arlClass)}
            >
              <option value="I">I</option>
              <option value="II">II</option>
              <option value="III">III</option>
              <option value="IV">IV</option>
              <option value="V">V</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={parafiscalExempt}
              onChange={(e) => setParafiscalExempt(e.target.checked)}
            />
            Exento de parafiscales Caja/SENA/ICBF (Ley 1607 — confirmar con contador)
          </label>
        </div>

        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

        {breakdown ? (
          <div className="mt-4 space-y-2 text-sm">
            <p>
              SMMLV {breakdown.year}: {formatCop(breakdown.smmlv)} · transporte legal{' '}
              {formatCop(breakdown.transportAidLegal)}
            </p>
            <p>
              Costo empleador / trabajador: <strong>{formatCop(breakdown.perWorkerMonthly)}</strong>
            </p>
            <p>
              Total mensual ({breakdown.workerCount}):{' '}
              <strong>{formatCop(breakdown.totalMonthly)}</strong> · quincena{' '}
              {formatCop(breakdown.quincenaTotal)}
            </p>
            <button
              type="button"
              className="mt-2 rounded-full bg-forest px-4 py-2 text-sm font-semibold text-mist"
              onClick={() => onApply(breakdown)}
            >
              Aplicar a costo fijo NOMINA
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
