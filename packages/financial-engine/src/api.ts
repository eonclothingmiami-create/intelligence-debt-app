import type { EventLog } from './core/events.js';
import { foldEvents, totalPrincipal, totalDue, type DerivedState } from './core/fold.js';
import { simulate, type SimulationScenario, type SimulationResult } from './simulation/simulate.js';
import {
  optimize,
  defaultStrategies,
  type OptimizationContext,
  type OptimizationResult,
  type OptimizationStrategy,
} from './optimization/strategies.js';
import { projectPaydown, projectMonthlyCashflow } from './cashflow/project.js';
import { Money } from './math/money.js';
import { effectiveToMonthly } from './interest/rates.js';
import { Rate } from './math/rate.js';
import { computeAdsRoi, type AdsRoiResult } from './roi/ads.js';
import { FORMULA_VERSION } from './shared/types.js';
import { computeMinimumPayment } from './payments/allocate.js';

export type PortfolioInput = {
  credits: Array<{
    creditId: string;
    name: string;
    log: EventLog;
  }>;
};

export type Analysis = {
  formulaVersion: string;
  totalDebt: string;
  totalInterestAccrued: string;
  totalPurchases: string;
  totalPayments: string;
  credits: Array<{
    creditId: string;
    name: string;
    principal: string;
    interestDue: string;
    minimumPayment: string;
    totalDue: string;
  }>;
  assumptions: string[];
};

export function analyzePortfolio(input: PortfolioInput): Analysis {
  const credits = input.credits.map(({ creditId, name, log }) => {
    const state = foldEvents(log);
    const minPay = computeMinimumPayment(state);
    return {
      creditId,
      name,
      principal: totalPrincipal(state).toString(),
      interestDue: state.interestDue.toString(),
      minimumPayment: minPay.toString(),
      totalDue: totalDue(state).toString(),
      _state: state,
    };
  });

  const currency = credits[0]?._state.currency ?? 'COP';
  let totalDebt = Money.zero(currency);
  let totalInterestAccrued = Money.zero(currency);
  let totalPurchases = Money.zero(currency);
  let totalPayments = Money.zero(currency);

  for (const c of credits) {
    totalDebt = totalDebt.add(Money.from(c.principal, currency));
    totalInterestAccrued = totalInterestAccrued.add(c._state.totalInterestAccrued);
    totalPurchases = totalPurchases.add(c._state.totalPurchases);
    totalPayments = totalPayments.add(c._state.totalPaymentsReceived);
  }

  return {
    formulaVersion: FORMULA_VERSION,
    totalDebt: totalDebt.toString(),
    totalInterestAccrued: totalInterestAccrued.toString(),
    totalPurchases: totalPurchases.toString(),
    totalPayments: totalPayments.toString(),
    credits: credits.map(({ _state: _, ...rest }) => rest),
    assumptions: ['Balances derived by event fold only', `formulaVersion=${FORMULA_VERSION}`],
  };
}

export function simulateScenario(log: EventLog, scenario: SimulationScenario): SimulationResult {
  return simulate(log, scenario);
}

export type RecommendConstraints = {
  extraMonthlyBudget: string;
  currency?: string;
  strategies?: OptimizationStrategy[];
};

export type Recommendation = {
  formulaVersion: string;
  optimization: OptimizationResult;
  analysis: Analysis;
  rationale: string[];
};

export function recommend(
  input: PortfolioInput,
  constraints: RecommendConstraints,
): Recommendation {
  const analysis = analyzePortfolio(input);
  const currency = (constraints.currency ?? 'COP') as 'COP';
  const accounts = input.credits.map(({ creditId, name, log }) => {
    const state = foldEvents(log);
    return {
      creditId,
      name,
      principal: totalPrincipal(state),
      annualEffectiveRate: state.config?.annualEffectiveRate.toString() ?? '0',
      minimumPayment: computeMinimumPayment(state),
      installmentPayment: state.installments
        .filter((l) => !l.paid)
        .reduce((acc, l) => acc.add(l.principalAmount), Money.zero(currency)),
    };
  });

  const ctx: OptimizationContext = {
    accounts,
    extraMonthlyBudget: Money.from(constraints.extraMonthlyBudget, currency),
    logs: Object.fromEntries(input.credits.map((c) => [c.creditId, c.log])),
  };

  const optimization = optimize(ctx, constraints.strategies ?? defaultStrategies);

  return {
    formulaVersion: FORMULA_VERSION,
    optimization,
    analysis,
    rationale: [
      `Best strategy: ${optimization.best.strategyId}`,
      ...optimization.best.explanation,
      ...optimization.assumptions,
    ],
  };
}

export type Forecast = {
  formulaVersion: string;
  creditId: string;
  points: Array<{ month: number; principal: string; interestPaidCumulative: string }>;
  cashflow: Array<{ periodIndex: number; outflow: string; inflow: string; net: string }>;
  assumptions: string[];
};

export function forecast(
  log: EventLog,
  horizon: {
    months: number;
    monthlyPayment: string;
    monthlyIncome?: string;
    creditId?: string;
  },
): Forecast {
  const state = foldEvents(log);
  if (!state.config) {
    throw new Error('Credit not open');
  }
  const monthlyRate = effectiveToMonthly(state.config.annualEffectiveRate);
  const payment = Money.from(horizon.monthlyPayment, state.currency);
  const points = projectPaydown(
    totalPrincipal(state),
    monthlyRate.toString(),
    payment,
    horizon.months,
  );
  const income = Money.from(horizon.monthlyIncome ?? '0', state.currency);
  const cashflow = projectMonthlyCashflow(state, horizon.months, payment, income);

  return {
    formulaVersion: FORMULA_VERSION,
    creditId: horizon.creditId ?? state.config.creditId,
    points: points.map((p) => ({
      month: p.month,
      principal: p.principal.toString(),
      interestPaidCumulative: p.interestPaidCumulative.toString(),
    })),
    cashflow: cashflow.map((c) => ({
      periodIndex: c.periodIndex,
      outflow: c.outflow.toString(),
      inflow: c.inflow.toString(),
      net: c.net.toString(),
    })),
    assumptions: [
      'Paydown uses monthly equivalent of EA',
      'Interest applied then payment each month',
    ],
  };
}

export type Explanation = {
  summary: string;
  bullets: string[];
  formulaVersion: string;
};

export function explain(
  result: SimulationResult | OptimizationResult | Analysis | AdsRoiResult | Recommendation,
): Explanation {
  if ('hypotheticalEvents' in result) {
    return {
      formulaVersion: result.formulaVersion,
      summary: 'Simulation result',
      bullets: [
        `Baseline principal: ${result.baselinePrincipal}`,
        `Projected principal: ${result.projectedPrincipal}`,
        `Interest saved (vs baseline accrued): ${result.interestSaved}`,
        ...result.assumptions,
      ],
    };
  }
  if ('best' in result && 'scores' in result) {
    return {
      formulaVersion: result.formulaVersion,
      summary: `Optimal strategy: ${result.best.strategyId}`,
      bullets: [...result.best.explanation, ...result.assumptions],
    };
  }
  if ('optimization' in result && 'rationale' in result) {
    return {
      formulaVersion: result.formulaVersion,
      summary: 'Recommendation',
      bullets: result.rationale,
    };
  }
  if ('totalDebt' in result) {
    return {
      formulaVersion: result.formulaVersion,
      summary: `Portfolio debt ${result.totalDebt}`,
      bullets: result.assumptions,
    };
  }
  if ('netRoi' in result) {
    return {
      formulaVersion: result.formulaVersion,
      summary: `Ads ROI net ${result.netRoi}`,
      bullets: [
        `Actual spend ${result.actualSpend.toString()}`,
        `Revenue ${result.revenue.toString()}`,
        `Financing ${result.financingCost.toString()}`,
        `Spread ${result.spread.toString()}`,
      ],
    };
  }
  return {
    formulaVersion: FORMULA_VERSION,
    summary: 'Unknown result',
    bullets: [],
  };
}

export { computeAdsRoi, Rate, Money };
export type { DerivedState };
