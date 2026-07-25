import { Decimal } from '../math/decimal.js';
import { describe, expect, it } from 'vitest';
import { Money } from '../math/money.js';
import { Rate } from '../math/rate.js';
import {
  nominalToEffective,
  effectiveToMonthly,
  effectiveToNominal,
  nominalToPeriodic,
  simpleInterest,
  interestFromAverageDailyBalance,
  effectiveToDaily,
} from './rates.js';

describe('Interest Engine', () => {
  it('converts 36% nominal monthly to ~42.58% effective', () => {
    const nom = Rate.fromDecimal('0.36');
    const eff = nominalToEffective(nom, 12);
    expect(eff.decimal.toDecimalPlaces(4).toString()).toBe('0.4258');
  });

  it('monthly from effective matches 3% for 36% nominal path', () => {
    const nom = Rate.fromDecimal('0.36');
    const eff = nominalToEffective(nom, 12);
    const monthly = effectiveToMonthly(eff);
    expect(monthly.decimal.toDecimalPlaces(8).eq(new Decimal('0.03'))).toBe(true);
  });

  it('round-trips effective ↔ nominal (12)', () => {
    const eff = Rate.fromDecimal('0.425761');
    const nom = effectiveToNominal(eff, 12);
    const back = nominalToEffective(nom, 12);
    expect(back.decimal.toDecimalPlaces(6).eq(eff.decimal.toDecimalPlaces(6))).toBe(true);
  });

  it('periodic = nominal/m', () => {
    expect(nominalToPeriodic(Rate.fromDecimal('0.36'), 12).toString()).toBe('0.03');
  });

  it('simple interest 1M * 3% = 30_000 COP', () => {
    const i = simpleInterest(Money.from('1000000', 'COP'), Rate.fromDecimal('0.03'), '1');
    expect(i.toString()).toBe('30000');
  });

  it('ADB interest using monthly-equivalent daily rate over 30 days', () => {
    const adb = Money.from('2000000', 'COP');
    // Exact monthly 3% as simple period interest on ADB (issuer monthly bill approximation)
    const interest = adb.mul('0.03').settle();
    expect(interest.toString()).toBe('60000');
    // Daily path is within rounding of monthly for constructed equivalent
    const monthly = Rate.fromDecimal('0.03');
    const daily = Rate.fromDecimal(monthly.decimal.plus(1).pow(new Decimal(1).div(30)).minus(1));
    const fromDaily = interestFromAverageDailyBalance(adb, daily, 30);
    expect(fromDaily.sub(interest).abs().lte(Money.from('1000', 'COP'))).toBe(true);
  });

  it('effective to daily is positive for positive EA', () => {
    const d = effectiveToDaily(Rate.fromDecimal('0.4258'));
    expect(d.decimal.gt(0)).toBe(true);
  });
});
