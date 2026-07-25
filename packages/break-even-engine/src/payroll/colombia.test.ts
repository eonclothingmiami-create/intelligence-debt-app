import { describe, expect, it } from 'vitest';
import {
  colombiaSmmlvForYear,
  computeColombiaEmployerPayroll,
  payrollOneSmmlvWorker,
} from './colombia.js';

describe('Colombia payroll with provisions', () => {
  it('loads 2026 SMMLV from catalog (not invented)', () => {
    const row = colombiaSmmlvForYear(2026);
    expect(row.smmlv).toBe('1750905');
    expect(row.transportAid).toBe('249095');
  });

  it('one SMMLV worker 2026 with parafiscales is under 3M and near ~2.95M', () => {
    const full = payrollOneSmmlvWorker(2026, false);
    expect(Number(full.totalMonthly)).toBeGreaterThan(2_800_000);
    expect(Number(full.totalMonthly)).toBeLessThan(3_000_000);
    expect(full.quincenaTotal).toBe(String(Math.round(Number(full.totalMonthly) / 2)));
  });

  it('exemption lowers cost vs full parafiscales', () => {
    const full = payrollOneSmmlvWorker(2026, false);
    const exempt = payrollOneSmmlvWorker(2026, true);
    expect(Number(exempt.totalMonthly)).toBeLessThan(Number(full.totalMonthly));
  });

  it('scales by worker count (COP rounding ±1)', () => {
    const one = computeColombiaEmployerPayroll({ year: 2026, workerCount: 1 });
    const two = computeColombiaEmployerPayroll({ year: 2026, workerCount: 2 });
    expect(Math.abs(Number(two.totalMonthly) - Number(one.totalMonthly) * 2)).toBeLessThanOrEqual(
      1,
    );
  });

  it('refuses unknown year instead of inventing SMMLV', () => {
    expect(() => colombiaSmmlvForYear(2099)).toThrow(/SMMLV/);
  });
});
