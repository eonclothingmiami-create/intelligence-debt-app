/**
 * Owner cash-allocation scenarios (interview / board).
 * Compare uses of immediate free cash — not ERP mutations.
 */

export type ScenarioKind = 'baseline' | 'extra_debt' | 'prioritize_restock' | 'split';

export type ScenarioDefinition = {
  id: string;
  label: string;
  kind: ScenarioKind;
  /** For extra_debt: proposed abono (COP). Empty = use full capacity. */
  extraDebtAmount: string;
  /** For split: share to debt 0..1 (rest to restock). */
  debtShare: string;
  enabled: boolean;
  notes?: string;
};

export type ScenarioEvaluation = {
  id: string;
  label: string;
  kind: ScenarioKind;
  extraDebtPayment: string;
  restockAllocation: string;
  capacityUsed: string;
  capacityLeft: string;
  notes: string[];
};

export type ScenarioWorkspace = {
  definitions: ScenarioDefinition[];
  /** Last evaluated results (board-derived). */
  lastEvaluations: ScenarioEvaluation[];
  preferredScenarioId?: string;
  updatedAt?: string;
};

const STORAGE_KEY = 'fie.os.scenarios.v1';

/** Defaults aligned with owner priorities: operar, recompra, salir de deuda sin ahogar caja. */
export const WORKSPACE_DEFAULT_SCENARIOS: ScenarioWorkspace = {
  definitions: [
    {
      id: 'baseline',
      label: 'Seguir como voy',
      kind: 'baseline',
      extraDebtAmount: '0',
      debtShare: '0',
      enabled: true,
      notes: 'Solo mínimos / cuotas ya comprometidas. Sin abono extra.',
    },
    {
      id: 'extra_tc',
      label: 'Abono extra a tarjeta',
      kind: 'extra_debt',
      extraDebtAmount: '',
      debtShare: '1',
      enabled: true,
      notes: 'Usa la capacidad inmediata (o el monto que indiques) para abonar a TC.',
    },
    {
      id: 'restock',
      label: 'Priorizar recompra',
      kind: 'prioritize_restock',
      extraDebtAmount: '0',
      debtShare: '0',
      enabled: true,
      notes: 'Capacidad inmediata a mercancía; deuda solo mínimos.',
    },
    {
      id: 'split',
      label: 'Mitad deuda / mitad recompra',
      kind: 'split',
      extraDebtAmount: '0',
      debtShare: '0.5',
      enabled: true,
      notes: 'Parte la capacidad inmediata 50/50 (editable).',
    },
  ],
  lastEvaluations: [],
  preferredScenarioId: 'baseline',
  updatedAt: '2026-07-25T23:40:00.000Z',
};

export function loadScenarioWorkspace(): ScenarioWorkspace {
  if (typeof window === 'undefined') return WORKSPACE_DEFAULT_SCENARIOS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return saveScenarioWorkspace(WORKSPACE_DEFAULT_SCENARIOS);
    const parsed = JSON.parse(raw) as Partial<ScenarioWorkspace>;
    return {
      definitions: Array.isArray(parsed.definitions)
        ? parsed.definitions
        : WORKSPACE_DEFAULT_SCENARIOS.definitions,
      lastEvaluations: Array.isArray(parsed.lastEvaluations) ? parsed.lastEvaluations : [],
      preferredScenarioId: parsed.preferredScenarioId,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return WORKSPACE_DEFAULT_SCENARIOS;
  }
}

export function saveScenarioWorkspace(ws: ScenarioWorkspace): ScenarioWorkspace {
  const next = { ...ws, updatedAt: new Date().toISOString() };
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

/**
 * Allocate immediate free capacity across scenarios.
 * Does not invent capacity — caller supplies it (from cash plan / decision).
 */
export function evaluateScenarios(input: {
  definitions: ScenarioDefinition[];
  immediateCapacity: string;
}): ScenarioEvaluation[] {
  const capacity = Math.max(0, Math.round(Number(input.immediateCapacity) || 0));
  return input.definitions
    .filter((d) => d.enabled)
    .map((d) => {
      let extraDebt = 0;
      let restock = 0;
      const notes: string[] = [];
      if (d.notes) notes.push(d.notes);

      switch (d.kind) {
        case 'baseline':
          extraDebt = 0;
          restock = 0;
          notes.push('No despliega capacidad inmediata extra.');
          break;
        case 'extra_debt': {
          const asked = d.extraDebtAmount.trim() ? Math.round(Number(d.extraDebtAmount)) : capacity;
          extraDebt = Math.max(0, Math.min(capacity, Number.isFinite(asked) ? asked : 0));
          restock = 0;
          notes.push(
            extraDebt >= capacity && capacity > 0
              ? 'Usa toda la capacidad inmediata en abono.'
              : `Abono propuesto acotado a capacidad (${capacity}).`,
          );
          break;
        }
        case 'prioritize_restock':
          extraDebt = 0;
          restock = capacity;
          notes.push('Toda la capacidad inmediata a recompra.');
          break;
        case 'split': {
          const share = Math.min(1, Math.max(0, Number(d.debtShare) || 0.5));
          extraDebt = Math.round(capacity * share);
          restock = capacity - extraDebt;
          notes.push(
            `Reparto deuda ${(share * 100).toFixed(0)}% / recompra ${((1 - share) * 100).toFixed(0)}%.`,
          );
          break;
        }
        default:
          break;
      }

      const used = extraDebt + restock;
      return {
        id: d.id,
        label: d.label,
        kind: d.kind,
        extraDebtPayment: String(extraDebt),
        restockAllocation: String(restock),
        capacityUsed: String(used),
        capacityLeft: String(Math.max(0, capacity - used)),
        notes,
      };
    });
}

export type ScenarioRecommendation = {
  recommendedId: string;
  recommendedLabel: string;
  rank: Array<{ id: string; label: string; score: number; why: string }>;
  summary: string;
};

/**
 * Rank scenarios from owner policy + board facts (no invented cash).
 * Priorities: keep operation → recompra when tight → debt only with spare capacity.
 */
export function recommendScenario(input: {
  evaluations: ScenarioEvaluation[];
  immediateCapacity: string;
  /** Soft reserve / tight cash (owner: a tope, recompra 70%). */
  cashTight: boolean;
  /** BEP safety margin rate as decimal string, e.g. "0.12". Null if unknown. */
  safetyMarginRate: string | null;
  /** Soft reserve: true = can touch reserve for debt carefully. */
  reserveIsHardFloor: boolean;
}): ScenarioRecommendation | null {
  if (!input.evaluations.length) return null;
  const capacity = Math.max(0, Number(input.immediateCapacity) || 0);
  const safety =
    input.safetyMarginRate != null && input.safetyMarginRate !== ''
      ? Number(input.safetyMarginRate)
      : null;

  const rank = input.evaluations.map((e) => {
    let score = 50;
    let why = '';

    if (capacity <= 0) {
      if (e.kind === 'baseline') {
        score = 95;
        why = 'Sin capacidad inmediata: lo prudente es sostener mínimos y operación.';
      } else {
        score = 20;
        why = 'No hay caja libre para abono o recompra extra sin tocar compromisos.';
      }
    } else if (input.cashTight || (safety != null && safety < 0.05)) {
      if (e.kind === 'prioritize_restock') {
        score = 90;
        why = 'Caja apretada / margen fino: priorizar recompra sostiene la operación.';
      } else if (e.kind === 'split') {
        score = 75;
        why = 'Reparto permite algo de deuda sin dejar de reponer mercancía.';
      } else if (e.kind === 'baseline') {
        score = 65;
        why = 'Conservador: válido si no quieres mover la capacidad este mes.';
      } else {
        score = 35;
        why = 'Abono agresivo con caja apretada puede sacrificar recompra/operación.';
      }
    } else if (safety != null && safety > 0.15 && capacity > 0) {
      if (e.kind === 'extra_debt') {
        score = input.reserveIsHardFloor ? 70 : 88;
        why = input.reserveIsHardFloor
          ? 'Hay margen; abono posible pero reserva intocable limita agresividad.'
          : 'Hay capacidad y margen: abono extra a deuda cara es razonable.';
      } else if (e.kind === 'split') {
        score = 82;
        why = 'Equilibrio entre bajar interés y mantener stock.';
      } else if (e.kind === 'prioritize_restock') {
        score = 60;
        why = 'Útil si el stock está bajo; si no, podrías acelerar deuda.';
      } else {
        score = 45;
        why = 'Pasivo: deja intereses corriendo con capacidad disponible.';
      }
    } else {
      if (e.kind === 'split') {
        score = 85;
        why = 'Situación mixta: mitad recompra / mitad deuda equilibra prioridades.';
      } else if (e.kind === 'prioritize_restock') {
        score = 78;
        why = 'Recompra primero alinea con no sacrificar operación.';
      } else if (e.kind === 'extra_debt') {
        score = 55;
        why = 'Viable si confirmas que el stock aguanta el mes.';
      } else {
        score = 50;
        why = 'Baseline seguro, pero no usa la capacidad detectada.';
      }
    }

    if (capacity > 0 && e.kind === 'baseline') score -= 5;

    return { id: e.id, label: e.label, score, why };
  });

  rank.sort((a, b) => b.score - a.score);
  const top = rank[0]!;
  return {
    recommendedId: top.id,
    recommendedLabel: top.label,
    rank,
    summary: `Recomendado: «${top.label}» — ${top.why}`,
  };
}
