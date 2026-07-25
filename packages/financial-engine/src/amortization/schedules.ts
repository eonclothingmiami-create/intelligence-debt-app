import { Money } from '../math/money.js';
import { Rate } from '../math/rate.js';
import { FinancialEngineError } from '../shared/types.js';

export type AmortizationSystem = 'french' | 'german' | 'american';

export type AmortizationPeriod = {
  period: number;
  payment: Money;
  interest: Money;
  principal: Money;
  balance: Money;
};

export type AmortizationSchedule = {
  system: AmortizationSystem;
  principal: Money;
  ratePerPeriod: Rate;
  periods: number;
  rows: AmortizationPeriod[];
  totalInterest: Money;
  totalPayment: Money;
};

/** French: A = P * i(1+i)^n / ((1+i)^n - 1) */
export function frenchPayment(principal: Money, ratePerPeriod: Rate, periods: number): Money {
  if (periods <= 0) {
    throw new FinancialEngineError('INVALID_PERIODS', 'periods must be > 0');
  }
  if (ratePerPeriod.decimal.isZero()) {
    return principal.div(String(periods)).settle();
  }
  const i = ratePerPeriod.decimal;
  const factor = i.times(i.plus(1).pow(periods)).div(i.plus(1).pow(periods).minus(1));
  return principal.mul(factor).settle();
}

export function buildFrenchSchedule(
  principal: Money,
  ratePerPeriod: Rate,
  periods: number,
): AmortizationSchedule {
  const payment = frenchPayment(principal, ratePerPeriod, periods);
  let balance = principal;
  const rows: AmortizationPeriod[] = [];
  let totalInterest = Money.zero(principal.currency);
  let totalPayment = Money.zero(principal.currency);

  for (let k = 1; k <= periods; k += 1) {
    const interest = balance.mul(ratePerPeriod.decimal).settle();
    let principalPart = payment.sub(interest);
    if (k === periods) {
      principalPart = balance;
    }
    const actualPayment = interest.add(principalPart);
    balance = balance.sub(principalPart).max(Money.zero(principal.currency));
    rows.push({
      period: k,
      payment: actualPayment,
      interest,
      principal: principalPart,
      balance,
    });
    totalInterest = totalInterest.add(interest);
    totalPayment = totalPayment.add(actualPayment);
  }

  return {
    system: 'french',
    principal,
    ratePerPeriod,
    periods,
    rows,
    totalInterest,
    totalPayment,
  };
}

export function buildGermanSchedule(
  principal: Money,
  ratePerPeriod: Rate,
  periods: number,
): AmortizationSchedule {
  if (periods <= 0) {
    throw new FinancialEngineError('INVALID_PERIODS', 'periods must be > 0');
  }
  const principalPart = principal.div(String(periods)).settle();
  let balance = principal;
  const rows: AmortizationPeriod[] = [];
  let totalInterest = Money.zero(principal.currency);
  let totalPayment = Money.zero(principal.currency);

  for (let k = 1; k <= periods; k += 1) {
    const interest = balance.mul(ratePerPeriod.decimal).settle();
    const cap = k === periods ? balance : principalPart;
    const payment = interest.add(cap);
    balance = balance.sub(cap).max(Money.zero(principal.currency));
    rows.push({ period: k, payment, interest, principal: cap, balance });
    totalInterest = totalInterest.add(interest);
    totalPayment = totalPayment.add(payment);
  }

  return {
    system: 'german',
    principal,
    ratePerPeriod,
    periods,
    rows,
    totalInterest,
    totalPayment,
  };
}

export function buildAmericanSchedule(
  principal: Money,
  ratePerPeriod: Rate,
  periods: number,
): AmortizationSchedule {
  if (periods <= 0) {
    throw new FinancialEngineError('INVALID_PERIODS', 'periods must be > 0');
  }
  const rows: AmortizationPeriod[] = [];
  let totalInterest = Money.zero(principal.currency);
  let totalPayment = Money.zero(principal.currency);

  for (let k = 1; k <= periods; k += 1) {
    const interest = principal.mul(ratePerPeriod.decimal).settle();
    const principalPart = k === periods ? principal : Money.zero(principal.currency);
    const payment = interest.add(principalPart);
    const balance = k === periods ? Money.zero(principal.currency) : principal;
    rows.push({ period: k, payment, interest, principal: principalPart, balance });
    totalInterest = totalInterest.add(interest);
    totalPayment = totalPayment.add(payment);
  }

  return {
    system: 'american',
    principal,
    ratePerPeriod,
    periods,
    rows,
    totalInterest,
    totalPayment,
  };
}

export function buildAmortizationSchedule(
  system: AmortizationSystem,
  principal: Money,
  ratePerPeriod: Rate,
  periods: number,
): AmortizationSchedule {
  switch (system) {
    case 'french':
      return buildFrenchSchedule(principal, ratePerPeriod, periods);
    case 'german':
      return buildGermanSchedule(principal, ratePerPeriod, periods);
    case 'american':
      return buildAmericanSchedule(principal, ratePerPeriod, periods);
    default: {
      const _e: never = system;
      throw new FinancialEngineError('UNKNOWN_SYSTEM', String(_e));
    }
  }
}
