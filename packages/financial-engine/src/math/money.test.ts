import { describe, expect, it } from 'vitest';
import { Money, Decimal, currencyScale } from './money.js';
import { Rate } from './rate.js';

describe('Money', () => {
  it('adds USD without floating error', () => {
    const a = Money.from('0.1', 'USD');
    const b = Money.from('0.2', 'USD');
    expect(a.add(b).settle().toFixed(2)).toBe('0.30');
  });

  it('rejects currency mismatch', () => {
    expect(() => Money.from('1', 'COP').add(Money.from('1', 'USD'))).toThrow(/Currency mismatch/);
  });

  it('settles COP to 0 decimals half-up', () => {
    expect(currencyScale('COP')).toBe(0);
    expect(Money.from('1000.4', 'COP').settle().toString()).toBe('1000');
    expect(Money.from('1000.5', 'COP').settle().toString()).toBe('1001');
  });

  it('supports mul/div with Decimal factors', () => {
    const m = Money.from('1000000', 'COP');
    expect(m.mul('0.03').settle().toString()).toBe('30000');
    expect(m.div('4').settle().toString()).toBe('250000');
  });

  it('forbids constructing from number via helper', () => {
    expect(() => Money.fromNumberBanned()).toThrow(/JavaScript number/);
  });

  it('compares and min/max', () => {
    const a = Money.from('10', 'COP');
    const b = Money.from('20', 'COP');
    expect(a.lt(b)).toBe(true);
    expect(a.min(b).toString()).toBe('10');
    expect(a.max(b).toString()).toBe('20');
  });
});

describe('Rate', () => {
  it('parses percent and decimal', () => {
    expect(Rate.fromPercent('36').eq(Rate.fromDecimal('0.36'))).toBe(true);
    expect(Rate.fromDecimal(new Decimal('0.03')).toPercentString()).toBe('3');
  });
});
