import { describe, expect, it } from 'vitest';
import { Money } from '../math/money.js';
import { Rate } from '../math/rate.js';
import {
  buildFrenchSchedule,
  buildGermanSchedule,
  buildAmericanSchedule,
  frenchPayment,
} from './schedules.js';

describe('Amortization Engine', () => {
  const P = Money.from('10000000', 'COP');
  const i = Rate.fromDecimal('0.02');
  const n = 12;

  it('French payment formula and schedule conserves principal', () => {
    const A = frenchPayment(P, i, n);
    expect(A.isPositive()).toBe(true);
    const schedule = buildFrenchSchedule(P, i, n);
    expect(schedule.rows).toHaveLength(12);
    expect(schedule.rows[11]!.balance.isZero()).toBe(true);
    const principalSum = schedule.rows.reduce((acc, r) => acc.add(r.principal), Money.zero('COP'));
    expect(principalSum.toString()).toBe(P.toString());
  });

  it('German level principal', () => {
    const schedule = buildGermanSchedule(P, i, n);
    expect(schedule.rows[0]!.principal.toString()).toBe('833333');
    expect(schedule.rows[0]!.interest.gt(schedule.rows[11]!.interest)).toBe(true);
    expect(schedule.rows[11]!.balance.isZero()).toBe(true);
  });

  it('American interest-only + balloon', () => {
    const schedule = buildAmericanSchedule(P, i, n);
    for (let k = 0; k < 11; k += 1) {
      expect(schedule.rows[k]!.principal.isZero()).toBe(true);
    }
    expect(schedule.rows[11]!.principal.toString()).toBe('10000000');
    expect(schedule.rows[11]!.balance.isZero()).toBe(true);
  });
});
