import { Decimal } from '../math/decimal.js';
import { Rate } from '../math/rate.js';
import { Money } from '../math/money.js';
import { type DayCountConvention, FinancialEngineError } from '../shared/types.js';

/**
 * i = r_nom / m
 */
export function nominalToPeriodic(nominalAnnual: Rate, periodsPerYear: number): Rate {
  if (periodsPerYear <= 0) {
    throw new FinancialEngineError('INVALID_PERIODS', 'periodsPerYear must be > 0');
  }
  return Rate.fromDecimal(nominalAnnual.decimal.div(periodsPerYear));
}

/**
 * r_eff = (1 + r_nom/m)^m - 1
 */
export function nominalToEffective(nominalAnnual: Rate, periodsPerYear: number): Rate {
  const periodic = nominalToPeriodic(nominalAnnual, periodsPerYear);
  const eff = periodic.decimal.plus(1).pow(periodsPerYear).minus(1);
  return Rate.fromDecimal(eff);
}

/**
 * r_nom,m = m * ((1+r_eff)^(1/m) - 1)
 */
export function effectiveToNominal(effectiveAnnual: Rate, periodsPerYear: number): Rate {
  if (periodsPerYear <= 0) {
    throw new FinancialEngineError('INVALID_PERIODS', 'periodsPerYear must be > 0');
  }
  const periodic = effectiveAnnual.decimal.plus(1).pow(new Decimal(1).div(periodsPerYear)).minus(1);
  return Rate.fromDecimal(periodic.times(periodsPerYear));
}

/**
 * i_m = (1+r_eff)^(1/12) - 1
 */
export function effectiveToMonthly(effectiveAnnual: Rate): Rate {
  return Rate.fromDecimal(effectiveAnnual.decimal.plus(1).pow(new Decimal(1).div(12)).minus(1));
}

/**
 * Daily rate from effective annual (actual/365).
 */
export function effectiveToDaily(effectiveAnnual: Rate, daysInYear = 365): Rate {
  return Rate.fromDecimal(
    effectiveAnnual.decimal.plus(1).pow(new Decimal(1).div(daysInYear)).minus(1),
  );
}

/**
 * Linear nominal daily: r_nom / daysInYear
 */
export function nominalToDailyLinear(nominalAnnual: Rate, daysInYear = 365): Rate {
  return Rate.fromDecimal(nominalAnnual.decimal.div(daysInYear));
}

export function dailyRateFromConvention(
  effectiveAnnual: Rate,
  convention: DayCountConvention,
): Rate {
  switch (convention) {
    case 'actual365':
      return effectiveToDaily(effectiveAnnual, 365);
    case 'actual360':
      return effectiveToDaily(effectiveAnnual, 360);
    case 'nominal365': {
      const nominal = effectiveToNominal(effectiveAnnual, 12);
      return nominalToDailyLinear(nominal, 365);
    }
    default: {
      const _exhaustive: never = convention;
      throw new FinancialEngineError('UNKNOWN_CONVENTION', String(_exhaustive));
    }
  }
}

/** I = P * i * t (simple). */
export function simpleInterest(principal: Money, periodicRate: Rate, periods: string): Money {
  return principal.mul(periodicRate.decimal.times(periods)).settle();
}

/** FV = P*(1+i)^n */
export function compoundFutureValue(principal: Money, periodicRate: Rate, periods: number): Money {
  const factor = periodicRate.decimal.plus(1).pow(periods);
  return principal.mul(factor).settle();
}

/**
 * Interest for a cycle using average daily balance:
 * I = round(ADB * i_d * N)
 */
export function interestFromAverageDailyBalance(
  averageDailyBalance: Money,
  dailyRate: Rate,
  days: number,
): Money {
  if (days < 0) {
    throw new FinancialEngineError('INVALID_DAYS', 'days must be >= 0');
  }
  return averageDailyBalance.mul(dailyRate.decimal.times(days)).settle();
}

/**
 * Monthly rate over N days from daily rate: (1+i_d)^N - 1
 */
export function monthlyEquivalentFromDaily(dailyRate: Rate, days: number): Rate {
  return Rate.fromDecimal(dailyRate.decimal.plus(1).pow(days).minus(1));
}
