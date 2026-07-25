import { Decimal, Money, type DecimalValue } from '@fie/financial-engine';

/**
 * Legal SMMLV / transport schedule by year — catalog data, not a silent product default.
 * Update when the government publishes a new decree; engines never invent the year's amount.
 */
export type ColombiaSmmlvYear = {
  year: number;
  smmlv: string;
  transportAid: string;
  source: string;
};

export const COLOMBIA_SMMLV_BY_YEAR: readonly ColombiaSmmlvYear[] = [
  {
    year: 2025,
    smmlv: '1423500',
    transportAid: '200000',
    source: 'Decreto 2228/2024 (SMMLV 2025)',
  },
  {
    year: 2026,
    smmlv: '1750905',
    transportAid: '249095',
    source: 'Decreto 1469/2025; Decreto 0159/2026 (SMMLV 2026)',
  },
] as const;

/** ARL employer rates by risk class (approximate legal table — user may override). */
export const COLOMBIA_ARL_CLASS_RATES: Record<string, string> = {
  I: '0.00522',
  II: '0.01044',
  III: '0.02436',
  IV: '0.04350',
  V: '0.06960',
};

export type ColombiaPayrollInput = {
  /** Calendar year for SMMLV table lookup (required). */
  year: number;
  /** Monthly base salary. If omitted, uses SMMLV of `year`. */
  baseSalary?: string;
  /** Headcount at this salary profile. */
  workerCount: number;
  /**
   * Include auxilio de transporte when base salary ≤ 2 SMMLV.
   * Transport is cash cost; not part of IBC for SS/parafiscales.
   */
  includeTransportAid?: boolean;
  /** ARL risk class I–V, or omit and pass arlRate. */
  arlClass?: keyof typeof COLOMBIA_ARL_CLASS_RATES;
  /** Override ARL rate (decimal string, e.g. "0.00522"). */
  arlRate?: string;
  /**
   * Ley 1607 / similares: employer exempt from Caja (4%) + SENA (2%) + ICBF (3%)
   * for employees under 10 SMMLV when applicable. User must confirm eligibility.
   */
  parafiscalExempt?: boolean;
  currency?: string;
};

export type ColombiaPayrollBreakdown = {
  year: number;
  smmlv: string;
  transportAidLegal: string;
  source: string;
  baseSalary: string;
  workerCount: number;
  transportAidApplied: string;
  employerHealth: string;
  employerPension: string;
  employerArl: string;
  employerCaja: string;
  employerSena: string;
  employerIcbf: string;
  provisionPrima: string;
  provisionCesantias: string;
  provisionInteresesCesantias: string;
  provisionVacaciones: string;
  /** Total monthly employer cost (all workers). */
  totalMonthly: string;
  /** Per worker monthly employer cost. */
  perWorkerMonthly: string;
  /** Half of total — quincena cash planning. */
  quincenaTotal: string;
  assumptions: string[];
};

function roundCop(m: Money): string {
  return m.settle().toString();
}

export function colombiaSmmlvForYear(year: number): ColombiaSmmlvYear {
  const row = COLOMBIA_SMMLV_BY_YEAR.find((r) => r.year === year);
  if (!row) {
    const years = COLOMBIA_SMMLV_BY_YEAR.map((r) => r.year).join(', ');
    throw new Error(
      `No hay SMMLV catalogado para ${year}. Años disponibles: ${years}. Agrega el decreto del año.`,
    );
  }
  return row;
}

/**
 * Employer monthly cost for Colombia payroll with prestaciones provisions.
 * Pure calculation from caller inputs + legal year table — does not invent SMMLV.
 */
export function computeColombiaEmployerPayroll(
  input: ColombiaPayrollInput,
): ColombiaPayrollBreakdown {
  if (!Number.isInteger(input.workerCount) || input.workerCount < 1) {
    throw new Error('workerCount must be an integer >= 1');
  }

  const legal = colombiaSmmlvForYear(input.year);
  const currency = input.currency ?? 'COP';
  const smmlv = Money.from(legal.smmlv, currency);
  const base = Money.from(input.baseSalary?.trim() || legal.smmlv, currency);
  if (!base.isPositive()) throw new Error('baseSalary must be > 0');

  const twoSmmlv = smmlv.mul('2');
  const includeTransport = input.includeTransportAid !== false && base.lte(twoSmmlv);
  const transport = includeTransport
    ? Money.from(legal.transportAid, currency)
    : Money.zero(currency);

  const arlRate: DecimalValue = new Decimal(
    input.arlRate ??
      (input.arlClass ? COLOMBIA_ARL_CLASS_RATES[input.arlClass] : undefined) ??
      COLOMBIA_ARL_CLASS_RATES.I,
  );

  // IBC = base salary only (auxilio de transporte is not salary for SS)
  const health = base.mul('0.085');
  const pension = base.mul('0.12');
  const arl = base.mul(arlRate);

  const parafiscalExempt = input.parafiscalExempt === true;
  const caja = parafiscalExempt ? Money.zero(currency) : base.mul('0.04');
  const sena = parafiscalExempt ? Money.zero(currency) : base.mul('0.02');
  const icbf = parafiscalExempt ? Money.zero(currency) : base.mul('0.03');

  // Prima & cesantías base typically includes transport when paid
  const prestBase = base.add(transport);
  const prima = prestBase.div('12');
  const cesantias = prestBase.div('12');
  // 12% anual sobre cesantías → ~1% mensual del (salario+transporte)
  const interesesCesantias = prestBase.mul('0.01');
  // Vacaciones: 15 días hábiles ≈ salario/24
  const vacaciones = base.div('24');

  const perWorker = base
    .add(transport)
    .add(health)
    .add(pension)
    .add(arl)
    .add(caja)
    .add(sena)
    .add(icbf)
    .add(prima)
    .add(cesantias)
    .add(interesesCesantias)
    .add(vacaciones);

  const total = perWorker.mul(String(input.workerCount));
  const totalRounded = roundCop(total);
  const perRounded = roundCop(perWorker);
  const quincena = roundCop(total.div('2'));

  const assumptions = [
    `SMMLV ${legal.year}: ${legal.smmlv} (${legal.source}).`,
    includeTransport
      ? `Auxilio transporte aplicado: ${legal.transportAid} (salario ≤ 2 SMMLV).`
      : 'Sin auxilio de transporte (salario > 2 SMMLV o desactivado).',
    `ARL tasa ${arlRate.toString()} (clase ${input.arlClass ?? 'I / override'}).`,
    parafiscalExempt
      ? 'Parafiscales Caja/SENA/ICBF: exentos (confirmación del usuario / Ley 1607).'
      : 'Parafiscales Caja 4% + SENA 2% + ICBF 3% incluidos.',
    'Provisiones: prima 1/12, cesantías 1/12, intereses cesantías ~1%/mes, vacaciones salario/24.',
    'Aproximación contable para costo fijo operativo — no reemplaza liquidación oficial ni nómina electrónica.',
  ];

  return {
    year: legal.year,
    smmlv: legal.smmlv,
    transportAidLegal: legal.transportAid,
    source: legal.source,
    baseSalary: base.toString(),
    workerCount: input.workerCount,
    transportAidApplied: transport.toString(),
    employerHealth: roundCop(health),
    employerPension: roundCop(pension),
    employerArl: roundCop(arl),
    employerCaja: roundCop(caja),
    employerSena: roundCop(sena),
    employerIcbf: roundCop(icbf),
    provisionPrima: roundCop(prima),
    provisionCesantias: roundCop(cesantias),
    provisionInteresesCesantias: roundCop(interesesCesantias),
    provisionVacaciones: roundCop(vacaciones),
    totalMonthly: totalRounded,
    perWorkerMonthly: perRounded,
    quincenaTotal: quincena,
    assumptions,
  };
}

/** Convenience: one minimum-wage worker for a given year. */
export function payrollOneSmmlvWorker(year: number, parafiscalExempt = false) {
  return computeColombiaEmployerPayroll({
    year,
    workerCount: 1,
    includeTransportAid: true,
    arlClass: 'I',
    parafiscalExempt,
  });
}
