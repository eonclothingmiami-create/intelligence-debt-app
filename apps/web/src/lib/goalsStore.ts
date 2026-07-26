/**
 * Explicit owner goals — engines/AI respect these; never invent targets.
 */

export type GoalKind =
  | 'profit'
  | 'debt_reduction'
  | 'debt_clear'
  | 'sales'
  | 'ads_budget_cap'
  | 'cash_reserve'
  | 'liquidity_months'
  | 'custom';

export type GoalStatus = 'active' | 'paused' | 'achieved' | 'abandoned';

export type BusinessGoal = {
  id: string;
  kind: GoalKind;
  title: string;
  /** Target amount in workspace currency (empty if qualitative / months-only). */
  targetAmount: string;
  /** Optional horizon YYYY-MM-DD. */
  targetDate: string;
  /** For debt_clear: obligation id from debt module. */
  relatedObligationId: string;
  notes: string;
  status: GoalStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type GoalsWorkspace = {
  northStar: string;
  goals: BusinessGoal[];
  updatedAt?: string;
};

export const GOAL_KIND_LABEL: Record<GoalKind, string> = {
  profit: 'Meta de utilidad',
  debt_reduction: 'Reducción de deuda',
  debt_clear: 'Salir de una deuda',
  sales: 'Meta de ventas',
  ads_budget_cap: 'Tope de publicidad',
  cash_reserve: 'Reserva de caja',
  liquidity_months: 'Meses de liquidez',
  custom: 'Otro objetivo',
};

const STORAGE_KEY = 'fie.os.goals.v1';

function newId(): string {
  return `goal_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/** Owner-confirmed north star from interview — not a product default. */
export const WORKSPACE_CONFIRMED_GOALS: GoalsWorkspace = {
  northStar:
    'Salir de deudas sin perder liquidez operativa ni capacidad de recompra; robustecer el negocio.',
  goals: [
    {
      id: 'goal_debt_reduce',
      kind: 'debt_reduction',
      title: 'Reducir deuda cara (TC / altas tasas)',
      targetAmount: '',
      targetDate: '',
      relatedObligationId: '',
      notes: 'Prioridad: abonos seguros sin romper operación ni recompra.',
      status: 'active',
      sortOrder: 0,
      createdAt: '2026-07-25T23:00:00.000Z',
      updatedAt: '2026-07-25T23:00:00.000Z',
    },
    {
      id: 'goal_liquidity',
      kind: 'liquidity_months',
      title: 'Mantener al menos 1 mes de reserva (blanda)',
      targetAmount: '1',
      targetDate: '',
      relatedObligationId: '',
      notes: 'Alineado con política de liquidez confirmada.',
      status: 'active',
      sortOrder: 1,
      createdAt: '2026-07-25T23:00:00.000Z',
      updatedAt: '2026-07-25T23:00:00.000Z',
    },
  ],
  updatedAt: '2026-07-25T23:00:00.000Z',
};

export function emptyGoalsWorkspace(): GoalsWorkspace {
  return { northStar: '', goals: [], updatedAt: undefined };
}

function normalizeGoal(raw: Partial<BusinessGoal>, i: number): BusinessGoal {
  const kind = (raw.kind ?? 'custom') as GoalKind;
  const status = (raw.status ?? 'active') as GoalStatus;
  const now = new Date().toISOString();
  return {
    id: String(raw.id ?? `goal_${i}`),
    kind: Object.keys(GOAL_KIND_LABEL).includes(kind) ? kind : 'custom',
    title: String(raw.title ?? ''),
    targetAmount: String(raw.targetAmount ?? ''),
    targetDate: String(raw.targetDate ?? ''),
    relatedObligationId: String(raw.relatedObligationId ?? ''),
    notes: String(raw.notes ?? ''),
    status: ['active', 'paused', 'achieved', 'abandoned'].includes(status) ? status : 'active',
    sortOrder: typeof raw.sortOrder === 'number' ? raw.sortOrder : i,
    createdAt: String(raw.createdAt ?? now),
    updatedAt: String(raw.updatedAt ?? now),
  };
}

export function loadGoalsWorkspace(): GoalsWorkspace {
  if (typeof window === 'undefined') return emptyGoalsWorkspace();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return saveGoalsWorkspace(WORKSPACE_CONFIRMED_GOALS);
    const parsed = JSON.parse(raw) as Partial<GoalsWorkspace>;
    return {
      northStar: String(parsed.northStar ?? ''),
      goals: Array.isArray(parsed.goals) ? parsed.goals.map((g, i) => normalizeGoal(g, i)) : [],
      updatedAt: parsed.updatedAt != null ? String(parsed.updatedAt) : undefined,
    };
  } catch {
    return emptyGoalsWorkspace();
  }
}

export function saveGoalsWorkspace(ws: GoalsWorkspace): GoalsWorkspace {
  const next: GoalsWorkspace = {
    northStar: ws.northStar.trim(),
    goals: ws.goals.map((g, i) => ({
      ...g,
      title: g.title.trim(),
      targetAmount: g.targetAmount.trim(),
      targetDate: g.targetDate.trim(),
      relatedObligationId: g.relatedObligationId.trim(),
      notes: g.notes.trim(),
      sortOrder: i,
      updatedAt: new Date().toISOString(),
    })),
    updatedAt: new Date().toISOString(),
  };
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

export function createGoal(
  partial: Partial<BusinessGoal> & { title: string; kind: GoalKind },
): BusinessGoal {
  const now = new Date().toISOString();
  return normalizeGoal(
    {
      ...partial,
      id: newId(),
      createdAt: now,
      updatedAt: now,
      status: partial.status ?? 'active',
    },
    0,
  );
}

export function activeGoals(ws: GoalsWorkspace): BusinessGoal[] {
  return ws.goals.filter((g) => g.status === 'active');
}

/**
 * Pulls profit / debt_reduction amounts into central config fields (single source for Capacidad notes).
 */
export function syncGoalsIntoConfigAmounts(ws: GoalsWorkspace): {
  targetProfitAmount: string;
  debtReductionTargetAmount: string;
} {
  const actives = activeGoals(ws);
  const profit = actives.find((g) => g.kind === 'profit' && g.targetAmount);
  const debt = actives.find((g) => g.kind === 'debt_reduction' && g.targetAmount);
  return {
    targetProfitAmount: profit?.targetAmount ?? '',
    debtReductionTargetAmount: debt?.targetAmount ?? '',
  };
}

export type GoalFacts = {
  totalDebtBalance: string | null;
  reserveMonths: string | null;
  runwayMonths: string | null;
  monthSales: string | null;
  marketingBudgetTotal: string | null;
  cashOnHand: string | null;
  currency: string;
};

/**
 * Progress hints from facts — never invents a % if data is missing.
 */
export function describeGoalProgress(goal: BusinessGoal, facts: GoalFacts): string[] {
  const notes: string[] = [];
  if (goal.status !== 'active') {
    notes.push(`Estado: ${goal.status}.`);
    return notes;
  }

  if (goal.kind === 'debt_reduction' || goal.kind === 'debt_clear') {
    if (facts.totalDebtBalance != null) {
      notes.push(`Deuda total actual: ${facts.totalDebtBalance} ${facts.currency}.`);
    } else {
      notes.push('Sin saldo de deuda en el tablero.');
    }
    if (goal.targetAmount) {
      notes.push(`Meta monto: ${goal.targetAmount}.`);
    }
  }
  if (goal.kind === 'profit' && goal.targetAmount) {
    notes.push(
      `Meta utilidad: ${goal.targetAmount}. El OS no inventa utilidad del período si no está calculada.`,
    );
  }
  if (goal.kind === 'sales') {
    if (facts.monthSales != null) {
      notes.push(`Ventas del mes (ERP): ${facts.monthSales}.`);
    } else {
      notes.push('Ventas del mes aún no sincronizadas.');
    }
    if (goal.targetAmount) notes.push(`Meta ventas: ${goal.targetAmount}.`);
  }
  if (goal.kind === 'ads_budget_cap') {
    if (facts.marketingBudgetTotal != null) {
      notes.push(`Presupuesto ads plan: ${facts.marketingBudgetTotal}.`);
    }
    if (goal.targetAmount) notes.push(`Tope declarado: ${goal.targetAmount}.`);
  }
  if (goal.kind === 'liquidity_months' || goal.kind === 'cash_reserve') {
    if (facts.reserveMonths) notes.push(`Política reserva: ${facts.reserveMonths} meses.`);
    if (facts.runwayMonths != null) notes.push(`Runway actual: ${facts.runwayMonths} meses.`);
    if (facts.cashOnHand) notes.push(`Caja: ${facts.cashOnHand}.`);
    if (goal.targetAmount) notes.push(`Meta: ${goal.targetAmount}.`);
  }
  if (goal.targetDate) notes.push(`Horizonte: ${goal.targetDate}.`);
  return notes;
}
