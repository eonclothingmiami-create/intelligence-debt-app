import { Money } from '../math/money.js';
import { Rate } from '../math/rate.js';
import type { EventLog } from '../core/events.js';
import { foldEvents, totalPrincipal } from '../core/fold.js';
import { effectiveToMonthly } from '../interest/rates.js';
import { projectPaydown } from '../cashflow/project.js';
import { FORMULA_VERSION } from '../shared/types.js';

export type DebtAccountView = {
  creditId: string;
  name: string;
  principal: Money;
  annualEffectiveRate: string;
  minimumPayment: Money;
  installmentPayment: Money;
};

export type OptimizationContext = {
  accounts: DebtAccountView[];
  extraMonthlyBudget: Money;
  logs: Record<string, EventLog>;
};

export type StrategyScore = {
  strategyId: string;
  totalInterestEstimate: string;
  monthsToDebtFree: number | null;
  cashFlowStress: string;
  explanation: string[];
};

export interface OptimizationStrategy {
  readonly id: string;
  readonly name: string;
  prioritize(accounts: DebtAccountView[]): DebtAccountView[];
  explain(ordered: DebtAccountView[]): string[];
}

function estimatePayoffPure(
  account: DebtAccountView,
  monthlyExtra: Money,
): { months: number | null; interest: Money } {
  const rate = effectiveToMonthly(Rate.fromDecimal(account.annualEffectiveRate));
  const payment = account.minimumPayment.add(monthlyExtra);
  const points = projectPaydown(account.principal, rate.toString(), payment, 600);
  const done = points.find((p) => p.principal.isZero());
  const last = points[points.length - 1]!;
  return {
    months: done?.month ?? null,
    interest: last.interestPaidCumulative,
  };
}

function scoreOrdered(
  strategy: OptimizationStrategy,
  ctx: OptimizationContext,
  ordered: DebtAccountView[],
): StrategyScore {
  let remainingExtra = ctx.extraMonthlyBudget;
  let totalInterest = Money.zero(ctx.extraMonthlyBudget.currency);
  let maxMonths: number | null = 0;
  const explanation = strategy.explain(ordered);

  for (const account of ordered) {
    const est = estimatePayoffPure(account, remainingExtra);
    totalInterest = totalInterest.add(est.interest);
    if (est.months === null) maxMonths = null;
    else if (maxMonths !== null) maxMonths = Math.max(maxMonths, est.months);
    remainingExtra = Money.zero(ctx.extraMonthlyBudget.currency);
  }

  return {
    strategyId: strategy.id,
    totalInterestEstimate: totalInterest.toString(),
    monthsToDebtFree: maxMonths,
    cashFlowStress: ctx.extraMonthlyBudget.toString(),
    explanation,
  };
}

export const snowballStrategy: OptimizationStrategy = {
  id: 'snowball',
  name: 'Snowball',
  prioritize(accounts) {
    return [...accounts].sort((a, b) => a.principal.cmp(b.principal));
  },
  explain(ordered) {
    return [
      'Pay minimums on all debts',
      `Focus extra cash on smallest balance first: ${ordered[0]?.name ?? 'n/a'}`,
      'Roll freed payments into the next smallest (behavioral momentum)',
    ];
  },
};

export const avalancheStrategy: OptimizationStrategy = {
  id: 'avalanche',
  name: 'Avalanche',
  prioritize(accounts) {
    return [...accounts].sort((a, b) =>
      Rate.fromDecimal(b.annualEffectiveRate).decimal.cmp(
        Rate.fromDecimal(a.annualEffectiveRate).decimal,
      ),
    );
  },
  explain(ordered) {
    return [
      'Pay minimums on all debts',
      `Focus extra cash on highest EA first: ${ordered[0]?.name ?? 'n/a'}`,
      'Minimizes total interest mathematically under equal extras',
    ];
  },
};

export const highestInterestStrategy: OptimizationStrategy = avalancheStrategy;

export const highestInstallmentStrategy: OptimizationStrategy = {
  id: 'highest_installment',
  name: 'Highest Installment',
  prioritize(accounts) {
    return [...accounts].sort((a, b) => b.installmentPayment.cmp(a.installmentPayment));
  },
  explain(ordered) {
    return [`Attack largest installment obligation first: ${ordered[0]?.name ?? 'n/a'}`];
  },
};

export const cashFlowFirstStrategy: OptimizationStrategy = {
  id: 'cash_flow_first',
  name: 'Cash Flow First',
  prioritize(accounts) {
    return [...accounts].sort((a, b) => b.minimumPayment.cmp(a.minimumPayment));
  },
  explain() {
    return ['Prioritize debts that free the most monthly cash flow when closed'];
  },
};

export const roiDrivenStrategy: OptimizationStrategy = {
  id: 'roi_driven',
  name: 'ROI Driven',
  prioritize(accounts) {
    return [...accounts].sort((a, b) => {
      const aAds = a.name.toLowerCase().includes('ads') ? 1 : 0;
      const bAds = b.name.toLowerCase().includes('ads') ? 1 : 0;
      if (aAds !== bAds) return aAds - bAds;
      return Rate.fromDecimal(b.annualEffectiveRate).decimal.cmp(
        Rate.fromDecimal(a.annualEffectiveRate).decimal,
      );
    });
  },
  explain() {
    return [
      'Keep financing productive ad spend if ROI spread positive',
      'Accelerate non-productive high-interest balances first',
    ];
  },
};

export const liquidityFirstStrategy: OptimizationStrategy = {
  id: 'liquidity_first',
  name: 'Liquidity First',
  prioritize(accounts) {
    return [...accounts].sort((a, b) => a.minimumPayment.cmp(b.minimumPayment));
  },
  explain() {
    return ['Minimize near-term cash outflow; clear cheapest minimums first'];
  },
};

export function customStrategy(id: string, name: string, orderIds: string[]): OptimizationStrategy {
  return {
    id,
    name,
    prioritize(accounts) {
      const map = new Map(accounts.map((a) => [a.creditId, a]));
      const ordered: DebtAccountView[] = [];
      for (const oid of orderIds) {
        const a = map.get(oid);
        if (a) ordered.push(a);
      }
      for (const a of accounts) {
        if (!orderIds.includes(a.creditId)) ordered.push(a);
      }
      return ordered;
    },
    explain() {
      return [`Custom order: ${orderIds.join(' → ')}`];
    },
  };
}

export const defaultStrategies: OptimizationStrategy[] = [
  snowballStrategy,
  avalancheStrategy,
  highestInstallmentStrategy,
  cashFlowFirstStrategy,
  roiDrivenStrategy,
  liquidityFirstStrategy,
];

export type OptimizationResult = {
  formulaVersion: string;
  scores: StrategyScore[];
  best: StrategyScore;
  assumptions: string[];
};

export function optimize(
  ctx: OptimizationContext,
  strategies: OptimizationStrategy[] = defaultStrategies,
): OptimizationResult {
  const scores = strategies.map((s) => {
    const ordered = s.prioritize(ctx.accounts);
    return scoreOrdered(s, ctx, ordered);
  });
  const best = scores.reduce((a, b) =>
    Money.from(a.totalInterestEstimate, ctx.extraMonthlyBudget.currency).lte(
      Money.from(b.totalInterestEstimate, ctx.extraMonthlyBudget.currency),
    )
      ? a
      : b,
  );
  return {
    formulaVersion: FORMULA_VERSION,
    scores,
    best,
    assumptions: [
      'Strategies only allocate extra monthly budget; interest via projectPaydown',
      'Best = minimum estimated total interest',
    ],
  };
}

export function accountsFromLog(
  creditId: string,
  name: string,
  log: EventLog,
  minimumPayment: Money,
  installmentPayment: Money,
): DebtAccountView {
  const state = foldEvents(log);
  if (!state.config) {
    throw new Error('Credit not open');
  }
  return {
    creditId,
    name,
    principal: totalPrincipal(state),
    annualEffectiveRate: state.config.annualEffectiveRate.toString(),
    minimumPayment,
    installmentPayment,
  };
}
