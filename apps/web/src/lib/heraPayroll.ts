import {
  computeColombiaEmployerPayroll,
  type BreakEvenModel,
  type ColombiaPayrollBreakdown,
} from '@fie/break-even-engine';

export type HeraEmployee = {
  id: string;
  nombre: string;
  salarioBase: string;
  tipoContrato: string;
  createdAt: string;
};

export type HeraPayrollSnapshot = {
  ok: boolean;
  employeeCount: number;
  payrollRunCount: number;
  empty: boolean;
  message: string;
  employees: HeraEmployee[];
  source?: string;
};

/**
 * Sum employer monthly cost for each Hera employee (salary + provisions).
 * If salarioBase is 0, uses SMMLV of `year`.
 */
export function employerCostFromHeraEmployees(input: {
  employees: HeraEmployee[];
  year: number;
  parafiscalExempt?: boolean;
  arlClass?: 'I' | 'II' | 'III' | 'IV' | 'V';
}): {
  totalMonthly: string;
  quincenaTotal: string;
  perWorker: Array<{ employee: HeraEmployee; breakdown: ColombiaPayrollBreakdown }>;
  workerCount: number;
} {
  const perWorker: Array<{ employee: HeraEmployee; breakdown: ColombiaPayrollBreakdown }> = [];
  let total = 0;
  for (const emp of input.employees) {
    const base = Number(emp.salarioBase);
    const breakdown = computeColombiaEmployerPayroll({
      year: input.year,
      workerCount: 1,
      baseSalary: Number.isFinite(base) && base > 0 ? emp.salarioBase : undefined,
      includeTransportAid: true,
      arlClass: input.arlClass ?? 'I',
      parafiscalExempt: input.parafiscalExempt === true,
    });
    perWorker.push({ employee: emp, breakdown });
    total += Number(breakdown.totalMonthly);
  }
  const totalMonthly = String(Math.round(total));
  return {
    totalMonthly,
    quincenaTotal: String(Math.round(total / 2)),
    perWorker,
    workerCount: input.employees.length,
  };
}

/** Upsert single NOMINA CON PROVISION line from Hera headcount cost. */
export function applyHeraPayrollToModel(
  model: BreakEvenModel,
  input: {
    totalMonthly: string;
    workerCount: number;
    year: number;
    notes?: string;
  },
): BreakEvenModel {
  const notes =
    input.notes ??
    `Sync Hera Nómina: ${input.workerCount} trabajador(es), costo empleador ${input.totalMonthly} (SMMLV/provisiones ${input.year}).`;
  const existing = model.fixedCosts.find(
    (l) => l.id === 'f_nomina' || l.kind === 'payroll_with_provisions',
  );
  if (existing) {
    return {
      ...model,
      fixedCosts: model.fixedCosts.map((l) =>
        l.id === existing.id
          ? {
              ...l,
              label: 'NOMINA CON PROVISION',
              category: 'Nómina',
              kind: 'payroll_with_provisions',
              amount: input.totalMonthly,
              notes,
              active: true,
            }
          : l,
      ),
    };
  }
  const nextSort =
    model.fixedCosts.reduce((max, l) => (l.sortOrder > max ? l.sortOrder : max), -1) + 1;
  return {
    ...model,
    fixedCosts: [
      ...model.fixedCosts,
      {
        id: 'f_nomina',
        label: 'NOMINA CON PROVISION',
        category: 'Nómina',
        kind: 'payroll_with_provisions',
        amount: input.totalMonthly,
        notes,
        active: true,
        sortOrder: nextSort,
      },
    ],
  };
}
