import { Decimal, d, isDecimal, type DecimalValue } from './decimal.js';
import { FinancialEngineError, type CurrencyCode, type RoundingMode } from '../shared/types.js';

const CURRENCY_SCALE: Record<string, number> = {
  COP: 0,
  USD: 2,
  EUR: 2,
};

const ROUNDING_MAP: Record<RoundingMode, number> = {
  'half-up': Decimal.ROUND_HALF_UP,
  'half-even': Decimal.ROUND_HALF_EVEN,
  down: Decimal.ROUND_DOWN,
  up: Decimal.ROUND_UP,
};

export function currencyScale(currency: CurrencyCode): number {
  return CURRENCY_SCALE[currency] ?? 2;
}

export type MoneyJSON = {
  amount: string;
  currency: CurrencyCode;
};

/**
 * Immutable monetary value backed by decimal.js.
 * Never use JavaScript number for money arithmetic.
 */
export class Money {
  private readonly value: DecimalValue;
  readonly currency: CurrencyCode;

  private constructor(value: DecimalValue, currency: CurrencyCode) {
    if (!value.isFinite()) {
      throw new FinancialEngineError('INVALID_MONEY', 'Money value must be finite');
    }
    this.value = value;
    this.currency = currency;
  }

  static zero(currency: CurrencyCode): Money {
    return new Money(new Decimal(0), currency);
  }

  static from(amount: string | DecimalValue, currency: CurrencyCode): Money {
    return new Money(d(amount), currency);
  }

  static fromNumberBanned(): never {
    throw new FinancialEngineError(
      'NUMBER_FORBIDDEN',
      'Do not construct Money from JavaScript number. Pass a decimal string.',
    );
  }

  get decimal(): DecimalValue {
    return this.value;
  }

  toString(): string {
    return this.value.toFixed();
  }

  toFixed(scale?: number): string {
    const s = scale ?? currencyScale(this.currency);
    return this.value.toFixed(s);
  }

  toJSON(): MoneyJSON {
    return { amount: this.toString(), currency: this.currency };
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new FinancialEngineError(
        'CURRENCY_MISMATCH',
        `Currency mismatch: ${this.currency} vs ${other.currency}`,
      );
    }
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.value.plus(other.value), this.currency);
  }

  sub(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.value.minus(other.value), this.currency);
  }

  mul(factor: string | DecimalValue): Money {
    return new Money(this.value.times(d(factor)), this.currency);
  }

  div(divisor: string | DecimalValue): Money {
    const divisorValue = d(divisor);
    if (divisorValue.isZero()) {
      throw new FinancialEngineError('DIVISION_BY_ZERO', 'Cannot divide Money by zero');
    }
    return new Money(this.value.div(divisorValue), this.currency);
  }

  neg(): Money {
    return new Money(this.value.negated(), this.currency);
  }

  abs(): Money {
    return new Money(this.value.abs(), this.currency);
  }

  round(scale?: number, mode: RoundingMode = 'half-up'): Money {
    const s = scale ?? currencyScale(this.currency);
    return new Money(this.value.toDecimalPlaces(s, ROUNDING_MAP[mode]), this.currency);
  }

  settle(mode: RoundingMode = 'half-up'): Money {
    return this.round(currencyScale(this.currency), mode);
  }

  cmp(other: Money): number {
    this.assertSameCurrency(other);
    return this.value.cmp(other.value);
  }

  eq(other: Money): boolean {
    return this.cmp(other) === 0;
  }

  gt(other: Money): boolean {
    return this.cmp(other) > 0;
  }

  gte(other: Money): boolean {
    return this.cmp(other) >= 0;
  }

  lt(other: Money): boolean {
    return this.cmp(other) < 0;
  }

  lte(other: Money): boolean {
    return this.cmp(other) <= 0;
  }

  isZero(): boolean {
    return this.value.isZero();
  }

  isPositive(): boolean {
    return this.value.gt(0);
  }

  isNegative(): boolean {
    return this.value.lt(0);
  }

  min(other: Money): Money {
    this.assertSameCurrency(other);
    return this.lte(other) ? this : other;
  }

  max(other: Money): Money {
    this.assertSameCurrency(other);
    return this.gte(other) ? this : other;
  }
}

export { Decimal, isDecimal };
export type { DecimalValue };
