import { Decimal, d, type DecimalValue } from './decimal.js';
import { FinancialEngineError } from '../shared/types.js';

/**
 * Interest / rate value as a decimal fraction (0.36 = 36%).
 */
export class Rate {
  private readonly value: DecimalValue;

  private constructor(value: DecimalValue) {
    if (!value.isFinite()) {
      throw new FinancialEngineError('INVALID_RATE', 'Rate must be finite');
    }
    this.value = value;
  }

  static fromDecimal(fraction: string | DecimalValue): Rate {
    return new Rate(d(fraction));
  }

  static fromPercent(percent: string | DecimalValue): Rate {
    return new Rate(d(percent).div(100));
  }

  get decimal(): DecimalValue {
    return this.value;
  }

  toString(): string {
    return this.value.toFixed();
  }

  toPercentString(): string {
    return this.value.times(100).toFixed();
  }

  eq(other: Rate): boolean {
    return this.value.eq(other.value);
  }
}

export function assertPositiveAmountString(amount: string, field: string): void {
  if (d(amount).lte(0)) {
    throw new FinancialEngineError('INVALID_AMOUNT', `${field} must be > 0`);
  }
}

export { Decimal };
