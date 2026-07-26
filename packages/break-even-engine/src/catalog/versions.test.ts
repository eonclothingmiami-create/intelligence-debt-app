import { describe, expect, it } from 'vitest';
import {
  amountAsOf,
  monthStartIso,
  projectFixedCostsAsOf,
  projectModelAsOf,
  sortSegments,
} from './versions.js';
import type { BreakEvenModel, LineItem } from '../shared/types.js';

const rent: LineItem = {
  id: 'f_arriendo',
  label: 'Arriendo',
  amount: '3000000',
  category: 'Local',
  active: true,
  sortOrder: 0,
};

describe('amountAsOf', () => {
  const segments = [
    { amount: '2500000', effectiveFrom: '2025-01-01' },
    { amount: '3000000', effectiveFrom: '2026-01-01' },
  ];

  it('returns 2025 rent before 2026', () => {
    expect(amountAsOf(segments, '2025-06-15')?.amount).toBe('2500000');
  });

  it('returns 2026 rent on and after effective date', () => {
    expect(amountAsOf(segments, '2026-01-01')?.amount).toBe('3000000');
    expect(amountAsOf(segments, '2026-07-25')?.amount).toBe('3000000');
  });

  it('returns null before first segment', () => {
    expect(amountAsOf(segments, '2024-12-31')).toBeNull();
  });
});

describe('projectFixedCostsAsOf', () => {
  it('projects arriendo timeline and flags unversioned lines', () => {
    const utilities: LineItem = {
      id: 'f_servicios',
      label: 'Servicios',
      amount: '400000',
      category: 'Local',
      active: true,
      sortOrder: 1,
    };
    const { lines, gaps } = projectFixedCostsAsOf(
      [rent, utilities],
      {
        f_arriendo: [
          { amount: '2500000', effectiveFrom: '2025-01-01' },
          { amount: '3000000', effectiveFrom: '2026-01-01' },
        ],
      },
      '2025-03-01',
    );
    expect(lines.find((l) => l.id === 'f_arriendo')?.amount).toBe('2500000');
    expect(gaps).toContain('fixedCost.f_servicios.noVersions');
  });
});

describe('projectModelAsOf', () => {
  it('returns model with dated fixed costs', () => {
    const model: BreakEvenModel = {
      currency: 'COP',
      variableCosts: [],
      fixedCosts: [rent],
      products: [],
      operatingDaysPerMonth: 26,
    };
    const { model: asOf, gaps } = projectModelAsOf(
      model,
      {
        f_arriendo: [
          { amount: '2500000', effectiveFrom: '2025-01-01' },
          { amount: '3000000', effectiveFrom: '2026-01-01' },
        ],
      },
      '2025-12-01',
    );
    expect(asOf.fixedCosts[0]?.amount).toBe('2500000');
    expect(gaps).toEqual([]);
  });
});

describe('sortSegments / monthStartIso', () => {
  it('sorts by effectiveFrom', () => {
    const sorted = sortSegments([
      { amount: '3', effectiveFrom: '2026-01-01' },
      { amount: '2', effectiveFrom: '2025-01-01' },
    ]);
    expect(sorted[0]?.amount).toBe('2');
  });

  it('normalizes YYYY-MM to month start', () => {
    expect(monthStartIso('2026-01')).toBe('2026-01-01');
    expect(monthStartIso('2026-01-15')).toBe('2026-01-01');
  });
});
