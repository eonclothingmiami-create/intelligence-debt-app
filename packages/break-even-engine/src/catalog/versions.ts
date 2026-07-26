import type { BreakEvenModel, LineItem } from '../shared/types.js';

/**
 * One effective-dated budget amount for a fixed-cost line.
 * Engines stay pure — history is resolved before computeBreakEven.
 */
export type CostAmountSegment = {
  /** Budget amount for the period starting at effectiveFrom. */
  amount: string;
  /** Inclusive start date YYYY-MM-DD (owner-set; never invented). */
  effectiveFrom: string;
  notes?: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const t = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(t);
}

/** Lexicographic compare is valid for YYYY-MM-DD. */
export function compareIsoDate(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function sortSegments(segments: CostAmountSegment[]): CostAmountSegment[] {
  return [...segments].sort((x, y) => compareIsoDate(x.effectiveFrom, y.effectiveFrom));
}

/**
 * Latest segment with effectiveFrom <= asOf.
 * Returns null when no segment covers the date (caller must not invent).
 */
export function amountAsOf(
  segments: CostAmountSegment[],
  asOf: string,
): { amount: string; effectiveFrom: string; notes?: string } | null {
  if (!isIsoDate(asOf)) return null;
  const sorted = sortSegments(segments.filter((s) => isIsoDate(s.effectiveFrom)));
  let hit: CostAmountSegment | null = null;
  for (const s of sorted) {
    if (compareIsoDate(s.effectiveFrom, asOf) <= 0) hit = s;
    else break;
  }
  if (!hit) return null;
  return {
    amount: hit.amount,
    effectiveFrom: hit.effectiveFrom,
    ...(hit.notes ? { notes: hit.notes } : {}),
  };
}

export type ProjectFixedCostsAsOfResult = {
  lines: LineItem[];
  /** Line ids (or keys) where history could not resolve asOf. */
  gaps: string[];
};

/**
 * Projects fixed-cost catalog amounts for a business date.
 * Lines without covering segments keep the live catalog amount and are listed in gaps
 * when `requireVersions` is true (historical honesty).
 */
export function projectFixedCostsAsOf(
  lines: LineItem[],
  historyByLineId: Record<string, CostAmountSegment[]>,
  asOf: string,
  opts?: { requireVersions?: boolean },
): ProjectFixedCostsAsOfResult {
  const requireVersions = opts?.requireVersions ?? true;
  const gaps: string[] = [];
  if (!isIsoDate(asOf)) {
    return { lines: [...lines], gaps: ['asOf.invalid'] };
  }

  const projected = lines.map((line) => {
    const segs = historyByLineId[line.id] ?? [];
    if (!segs.length) {
      if (requireVersions) gaps.push(`fixedCost.${line.id}.noVersions`);
      return { ...line };
    }
    const hit = amountAsOf(segs, asOf);
    if (!hit) {
      gaps.push(`fixedCost.${line.id}.noSegmentForDate`);
      return { ...line };
    }
    return { ...line, amount: hit.amount };
  });

  return { lines: projected, gaps };
}

export type ProjectModelAsOfResult = {
  model: BreakEvenModel;
  gaps: string[];
};

/** Returns a BreakEvenModel whose fixedCosts amounts match asOf. Variable/products unchanged. */
export function projectModelAsOf(
  model: BreakEvenModel,
  historyByLineId: Record<string, CostAmountSegment[]>,
  asOf: string,
  opts?: { requireVersions?: boolean },
): ProjectModelAsOfResult {
  const { lines, gaps } = projectFixedCostsAsOf(model.fixedCosts, historyByLineId, asOf, opts);
  return {
    model: { ...model, fixedCosts: lines },
    gaps,
  };
}

/** First calendar day of YYYY-MM (or of an ISO date's month). */
export function monthStartIso(yearMonthOrDate: string): string | null {
  const ym = yearMonthOrDate.trim();
  if (/^\d{4}-\d{2}$/.test(ym)) return `${ym}-01`;
  if (isIsoDate(ym)) return `${ym.slice(0, 7)}-01`;
  return null;
}
