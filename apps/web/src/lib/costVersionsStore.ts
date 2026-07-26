/**
 * Effective-dated budget versions for fixed-cost catalog lines.
 * Live BreakEvenModel.amount is the as-of-today projection; history is SoT for past dates.
 * Empty history = unversioned — historical asOf must report a gap (no silent invention).
 */

import {
  amountAsOf,
  isIsoDate,
  monthStartIso,
  sortSegments,
  type CostAmountSegment,
} from '@fie/break-even-engine';

export type CostAmountVersion = {
  id: string;
  lineId: string;
  amount: string;
  /** Inclusive YYYY-MM-DD. */
  effectiveFrom: string;
  notes: string;
  recordedAt: string;
};

export type CostVersionsWorkspace = {
  versions: CostAmountVersion[];
  updatedAt?: string;
};

const STORAGE_KEY = 'fie.os.costVersions.v1';

function newId(): string {
  return `cv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function emptyCostVersionsWorkspace(): CostVersionsWorkspace {
  return { versions: [], updatedAt: undefined };
}

function normalizeVersion(raw: Partial<CostAmountVersion>): CostAmountVersion | null {
  const lineId = String(raw.lineId ?? '').trim();
  const amount = String(raw.amount ?? '').trim();
  const effectiveFrom = String(raw.effectiveFrom ?? '').trim();
  if (!lineId || !amount || !isIsoDate(effectiveFrom)) return null;
  return {
    id: String(raw.id ?? newId()),
    lineId,
    amount,
    effectiveFrom,
    notes: String(raw.notes ?? ''),
    recordedAt: String(raw.recordedAt ?? new Date().toISOString()),
  };
}

export function loadCostVersionsWorkspace(): CostVersionsWorkspace {
  if (typeof window === 'undefined') return emptyCostVersionsWorkspace();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyCostVersionsWorkspace();
    const parsed = JSON.parse(raw) as Partial<CostVersionsWorkspace>;
    const versions = (parsed.versions ?? [])
      .map((v) => normalizeVersion(v as Partial<CostAmountVersion>))
      .filter((v): v is CostAmountVersion => v != null);
    return {
      versions,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : undefined,
    };
  } catch {
    return emptyCostVersionsWorkspace();
  }
}

export function saveCostVersionsWorkspace(ws: CostVersionsWorkspace): CostVersionsWorkspace {
  const next: CostVersionsWorkspace = {
    versions: ws.versions
      .map((v) => normalizeVersion(v))
      .filter((v): v is CostAmountVersion => v != null),
    updatedAt: new Date().toISOString(),
  };
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

export function versionsForLine(ws: CostVersionsWorkspace, lineId: string): CostAmountVersion[] {
  return [...ws.versions]
    .filter((v) => v.lineId === lineId)
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1));
}

export function toSegments(versions: CostAmountVersion[]): CostAmountSegment[] {
  return sortSegments(
    versions.map((v) => ({
      amount: v.amount,
      effectiveFrom: v.effectiveFrom,
      ...(v.notes.trim() ? { notes: v.notes } : {}),
    })),
  );
}

export function historyByLineId(ws: CostVersionsWorkspace): Record<string, CostAmountSegment[]> {
  const map: Record<string, CostAmountSegment[]> = {};
  for (const v of ws.versions) {
    const list = map[v.lineId] ?? [];
    list.push({
      amount: v.amount,
      effectiveFrom: v.effectiveFrom,
      ...(v.notes.trim() ? { notes: v.notes } : {}),
    });
    map[v.lineId] = list;
  }
  for (const id of Object.keys(map)) {
    map[id] = sortSegments(map[id] ?? []);
  }
  return map;
}

export type RecordAmountChangeInput = {
  lineId: string;
  newAmount: string;
  /** YYYY-MM or YYYY-MM-DD — normalized to month start. */
  effectiveFrom: string;
  notes?: string;
  /**
   * Required when the line has no versions yet: preserves the previous amount
   * under an explicit prior effective date (e.g. Arriendo 2025-01-01 @ 2.5M).
   */
  priorAmount?: string;
  priorEffectiveFrom?: string;
};

export type RecordAmountChangeResult =
  { ok: true; workspace: CostVersionsWorkspace } | { ok: false; error: string };

/**
 * Appends (or replaces same effectiveFrom) a budget version.
 * Never invents priorEffectiveFrom — first change must supply it.
 */
export function recordAmountChange(
  ws: CostVersionsWorkspace,
  input: RecordAmountChangeInput,
): RecordAmountChangeResult {
  const lineId = input.lineId.trim();
  const newAmount = input.newAmount.trim();
  const effectiveFrom = monthStartIso(input.effectiveFrom);
  if (!lineId) return { ok: false, error: 'Falta el costo (lineId).' };
  if (!newAmount || !Number.isFinite(Number(newAmount)) || Number(newAmount) < 0) {
    return { ok: false, error: 'Monto nuevo inválido.' };
  }
  if (!effectiveFrom) {
    return { ok: false, error: 'Fecha de vigencia inválida (usa YYYY-MM).' };
  }

  const existing = versionsForLine(ws, lineId);
  let nextVersions = [...ws.versions];

  if (existing.length === 0) {
    const priorAmount = (input.priorAmount ?? '').trim();
    const priorFrom = input.priorEffectiveFrom ? monthStartIso(input.priorEffectiveFrom) : null;
    if (!priorAmount || !Number.isFinite(Number(priorAmount)) || Number(priorAmount) < 0) {
      return {
        ok: false,
        error: 'Primera versión: indica el monto anterior que no debe perderse.',
      };
    }
    if (!priorFrom) {
      return {
        ok: false,
        error: 'Primera versión: indica desde cuándo aplicaba el monto anterior (YYYY-MM).',
      };
    }
    if (priorFrom >= effectiveFrom) {
      return {
        ok: false,
        error: 'La vigencia anterior debe ser anterior a la nueva vigencia.',
      };
    }
    nextVersions.push({
      id: newId(),
      lineId,
      amount: priorAmount,
      effectiveFrom: priorFrom,
      notes: 'Monto anterior preservado al versionar',
      recordedAt: new Date().toISOString(),
    });
  }

  // Replace same effectiveFrom if re-recording
  nextVersions = nextVersions.filter(
    (v) => !(v.lineId === lineId && v.effectiveFrom === effectiveFrom),
  );
  nextVersions.push({
    id: newId(),
    lineId,
    amount: newAmount,
    effectiveFrom,
    notes: (input.notes ?? '').trim(),
    recordedAt: new Date().toISOString(),
  });

  return {
    ok: true,
    workspace: saveCostVersionsWorkspace({ ...ws, versions: nextVersions }),
  };
}

/** Seed first version when creating a cost line (explicit effectiveFrom). */
export function seedInitialVersion(
  ws: CostVersionsWorkspace,
  input: { lineId: string; amount: string; effectiveFrom: string; notes?: string },
): RecordAmountChangeResult {
  const lineId = input.lineId.trim();
  const amount = input.amount.trim();
  const effectiveFrom = monthStartIso(input.effectiveFrom);
  if (!lineId) return { ok: false, error: 'Falta lineId.' };
  if (!amount || !Number.isFinite(Number(amount)) || Number(amount) < 0) {
    return { ok: false, error: 'Monto inválido.' };
  }
  if (!effectiveFrom) return { ok: false, error: 'Fecha de vigencia inválida.' };
  if (versionsForLine(ws, lineId).length > 0) {
    return { ok: false, error: 'Esta línea ya tiene versiones.' };
  }
  const next = [
    ...ws.versions,
    {
      id: newId(),
      lineId,
      amount,
      effectiveFrom,
      notes: (input.notes ?? '').trim() || 'Versión inicial',
      recordedAt: new Date().toISOString(),
    },
  ];
  return { ok: true, workspace: saveCostVersionsWorkspace({ ...ws, versions: next }) };
}

export function removeVersionsForLine(
  ws: CostVersionsWorkspace,
  lineId: string,
): CostVersionsWorkspace {
  return saveCostVersionsWorkspace({
    ...ws,
    versions: ws.versions.filter((v) => v.lineId !== lineId),
  });
}

export function deleteVersion(ws: CostVersionsWorkspace, versionId: string): CostVersionsWorkspace {
  return saveCostVersionsWorkspace({
    ...ws,
    versions: ws.versions.filter((v) => v.id !== versionId),
  });
}

/** Current budget amount for a line as of a date (null if uncovered). */
export function lineAmountAsOf(
  ws: CostVersionsWorkspace,
  lineId: string,
  asOf: string,
): string | null {
  return amountAsOf(toSegments(versionsForLine(ws, lineId)), asOf)?.amount ?? null;
}

export function todayIsoDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function currentMonthStart(d = new Date()): string {
  return (
    monthStartIso(todayIsoDate(d)) ??
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  );
}
