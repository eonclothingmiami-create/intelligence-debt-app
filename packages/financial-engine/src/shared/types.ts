export const FORMULA_VERSION = '1.0.0' as const;
export const EVENT_SCHEMA_VERSION = 1 as const;

export type CurrencyCode = 'COP' | 'USD' | 'EUR' | (string & {});

export type RoundingMode = 'half-up' | 'half-even' | 'down' | 'up';

export type DayCountConvention = 'actual365' | 'nominal365' | 'actual360';

export type ExtraPaymentTarget = 'revolving_first' | 'installments_first' | 'pro_rata';

export type DeferredInterestMode = 'included' | 'revolving' | 'flat_addon';

export type ProductType =
  | 'credit_card'
  | 'personal_loan'
  | 'vehicle'
  | 'mortgage'
  | 'business'
  | 'leasing'
  | 'factoring'
  | 'revolving_line'
  | 'supplier';

export type PaymentBucket =
  | 'LateFee'
  | 'Interest'
  | 'Insurance'
  | 'Commission'
  | 'RevolvingPrincipal'
  | 'InstallmentPrincipal';

export class FinancialEngineError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'FinancialEngineError';
    this.code = code;
  }
}

export function isoDate(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseIsoDate(value: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new FinancialEngineError('INVALID_DATE', `Expected YYYY-MM-DD, got: ${value}`);
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

/** Inclusive day difference: from → to (UTC date parts). */
export function daysBetween(from: string, to: string): number {
  const a = parseIsoDate(from);
  const b = parseIsoDate(to);
  const utcA = Date.UTC(a.year, a.month - 1, a.day);
  const utcB = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((utcB - utcA) / 86_400_000);
}

export function addDays(date: string, days: number): string {
  const { year, month, day } = parseIsoDate(date);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return isoDate(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate());
}

export function compareIsoDates(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
