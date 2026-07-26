/**
 * Forward-looking business assumptions (owner inputs for simulation).
 * Distinct from engine FINANCIAL_ASSUMPTIONS.md (binding math rules).
 * Empty fields = not set — never invent inflation/growth/FX.
 */

export type AssumptionKey =
  | 'inflationAnnual'
  | 'salaryIncreaseAnnual'
  | 'interestRateChangeAnnual'
  | 'salesGrowthAnnual'
  | 'fxUsdCop'
  | 'horizonMonths';

export type AssumptionField = {
  key: AssumptionKey;
  /** Decimal string: rates as 0.05 = 5%; FX as absolute; horizon as months. */
  value: string;
  /** Free-text rationale from the owner. */
  notes: string;
  active: boolean;
};

export type AssumptionsWorkspace = {
  fields: AssumptionField[];
  /** Optional label for the active assumption set. */
  setLabel: string;
  updatedAt?: string;
};

export const ASSUMPTION_META: Record<
  AssumptionKey,
  { label: string; hint: string; unit: 'rate' | 'fx' | 'months'; placeholder: string }
> = {
  inflationAnnual: {
    label: 'Inflación anual',
    hint: 'Tasa esperada (ej. 0.05 = 5%). Afecta costos futuros en simulaciones.',
    unit: 'rate',
    placeholder: '0.05',
  },
  salaryIncreaseAnnual: {
    label: 'Alza salarial anual',
    hint: 'Incremento esperado de nómina (ej. 0.08 = 8%).',
    unit: 'rate',
    placeholder: '0.08',
  },
  interestRateChangeAnnual: {
    label: 'Cambio de tasas de interés',
    hint: 'Variación esperada en costo de deuda (ej. 0.02 = +2 pp / −0.01 = baja).',
    unit: 'rate',
    placeholder: '0',
  },
  salesGrowthAnnual: {
    label: 'Crecimiento de ventas anual',
    hint: 'Crecimiento esperado de ingresos (ej. 0.15 = 15%).',
    unit: 'rate',
    placeholder: '0.10',
  },
  fxUsdCop: {
    label: 'TRM USD/COP',
    hint: 'Tipo de cambio supuesto para insumos en USD (vacío = no aplica).',
    unit: 'fx',
    placeholder: '4200',
  },
  horizonMonths: {
    label: 'Horizonte de simulación (meses)',
    hint: 'Cuántos meses adelante aplicar estos supuestos.',
    unit: 'months',
    placeholder: '12',
  },
};

const STORAGE_KEY = 'fie.os.assumptions.v1';

const KEYS = Object.keys(ASSUMPTION_META) as AssumptionKey[];

function emptyFields(): AssumptionField[] {
  return KEYS.map((key) => ({
    key,
    value: '',
    notes: '',
    active: true,
  }));
}

/** Seed: empty values — owner must confirm; not silent product defaults. */
export const WORKSPACE_EMPTY_ASSUMPTIONS: AssumptionsWorkspace = {
  setLabel: 'Supuestos base',
  fields: emptyFields(),
  updatedAt: undefined,
};

export function emptyAssumptionsWorkspace(): AssumptionsWorkspace {
  return {
    setLabel: '',
    fields: emptyFields(),
    updatedAt: undefined,
  };
}

export function loadAssumptionsWorkspace(): AssumptionsWorkspace {
  if (typeof window === 'undefined') return emptyAssumptionsWorkspace();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return saveAssumptionsWorkspace(WORKSPACE_EMPTY_ASSUMPTIONS);
    const parsed = JSON.parse(raw) as Partial<AssumptionsWorkspace>;
    const byKey = new Map(
      (Array.isArray(parsed.fields) ? parsed.fields : []).map((f) => [f.key, f]),
    );
    return {
      setLabel: String(parsed.setLabel ?? ''),
      fields: KEYS.map((key) => {
        const f = byKey.get(key);
        return {
          key,
          value: f?.value != null ? String(f.value) : '',
          notes: f?.notes != null ? String(f.notes) : '',
          active: f?.active !== false,
        };
      }),
      updatedAt: parsed.updatedAt != null ? String(parsed.updatedAt) : undefined,
    };
  } catch {
    return emptyAssumptionsWorkspace();
  }
}

export function saveAssumptionsWorkspace(ws: AssumptionsWorkspace): AssumptionsWorkspace {
  const next: AssumptionsWorkspace = {
    setLabel: ws.setLabel.trim(),
    fields: KEYS.map((key) => {
      const f = ws.fields.find((x) => x.key === key) ?? {
        key,
        value: '',
        notes: '',
        active: true,
      };
      return {
        key,
        value: f.value.trim(),
        notes: f.notes.trim(),
        active: f.active,
      };
    }),
    updatedAt: new Date().toISOString(),
  };
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

export function activeAssumptions(ws: AssumptionsWorkspace): AssumptionField[] {
  return ws.fields.filter((f) => f.active && f.value.trim() !== '');
}

export function assumptionsGaps(ws: AssumptionsWorkspace): AssumptionKey[] {
  return ws.fields.filter((f) => f.active && f.value.trim() === '').map((f) => f.key);
}

export function formatAssumptionDisplay(field: AssumptionField): string {
  const meta = ASSUMPTION_META[field.key];
  const v = field.value.trim();
  if (!v) return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  if (meta.unit === 'rate') return `${(n * 100).toFixed(2)}%`;
  if (meta.unit === 'months') return `${n} meses`;
  return n.toLocaleString('es-CO');
}
