/**
 * Typed facade over decimal.js (CJS) for ESM / NodeNext compatibility.
 * All monetary math must go through Money → this module.
 */
import DecimalJS from 'decimal.js';

type DecimalCtor = {
  new (value?: string | number): DecimalValue;
  set(options: { precision?: number; rounding?: number }): void;
  ROUND_HALF_UP: number;
  ROUND_HALF_EVEN: number;
  ROUND_DOWN: number;
  ROUND_UP: number;
};

export type DecimalValue = {
  plus(n: DecimalValue | string | number): DecimalValue;
  minus(n: DecimalValue | string | number): DecimalValue;
  times(n: DecimalValue | string | number): DecimalValue;
  div(n: DecimalValue | string | number): DecimalValue;
  pow(n: DecimalValue | string | number): DecimalValue;
  abs(): DecimalValue;
  negated(): DecimalValue;
  isFinite(): boolean;
  isZero(): boolean;
  eq(n: DecimalValue | string | number): boolean;
  gt(n: DecimalValue | string | number): boolean;
  gte(n: DecimalValue | string | number): boolean;
  lt(n: DecimalValue | string | number): boolean;
  lte(n: DecimalValue | string | number): boolean;
  cmp(n: DecimalValue | string | number): number;
  toFixed(dp?: number): string;
  toDecimalPlaces(dp: number, rounding?: number): DecimalValue;
  toString(): string;
};

export const Decimal = DecimalJS as unknown as DecimalCtor;

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export function isDecimal(value: unknown): value is DecimalValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as DecimalValue).plus === 'function' &&
    typeof (value as DecimalValue).toFixed === 'function'
  );
}

export function d(value: string | number | DecimalValue): DecimalValue {
  return isDecimal(value) ? value : new Decimal(value);
}
