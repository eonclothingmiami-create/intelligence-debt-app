import type { DomainEvent, EventLog } from '../core/events.js';
import { foldEvents, totalPrincipal, type DerivedState } from '../core/fold.js';
import { postPayment, closeStatement, postPurchase } from '../credit-card/engine.js';
import { projectPaydown } from '../cashflow/project.js';
import { Money } from '../math/money.js';
import { effectiveToMonthly } from '../interest/rates.js';
import { FORMULA_VERSION } from '../shared/types.js';
import { baseEventFields } from '../core/events.js';

export type SimulationScenario =
  | { type: 'extra_payment'; amount: string; onDate: string; paymentId: string }
  | { type: 'increase_monthly_payment'; monthlyPayment: string; months: number }
  | { type: 'rate_change'; annualEffectiveRate: string; onDate: string }
  | { type: 'ad_spend_change'; plannedDailyAdBudget: string; from: string; to: string }
  | { type: 'refinance'; newTotalInstallments: number; onDate: string; purchaseId: string };

export type SimulationResult = {
  formulaVersion: string;
  baselinePrincipal: string;
  projectedPrincipal: string;
  baselineInterestAccrued: string;
  projectedInterestAccrued: string;
  interestSaved: string;
  monthsToPayoff: number | null;
  hypotheticalEvents: DomainEvent[];
  finalState: DerivedState;
  assumptions: string[];
};

function cloneLog(log: EventLog): DomainEvent[] {
  return log.map((e) => ({ ...e, payload: { ...e.payload } })) as DomainEvent[];
}

function nextSequence(log: EventLog): number {
  return log.reduce((max, e) => Math.max(max, e.sequence), 0) + 1;
}

export function simulate(
  log: EventLog,
  scenario: SimulationScenario,
  options?: { creditId?: string },
): SimulationResult {
  const baseline = foldEvents(log);
  if (!baseline.config) {
    throw new Error('Credit not open');
  }
  const creditId = options?.creditId ?? baseline.config.creditId;
  const working = cloneLog(log);
  const hypothetical: DomainEvent[] = [];
  const assumptions = [
    'Simulation copies the event log; original log is never mutated',
    `formulaVersion=${FORMULA_VERSION}`,
  ];

  const seq = nextSequence(working);

  switch (scenario.type) {
    case 'extra_payment': {
      const state = foldEvents(working);
      const events = postPayment(state, {
        creditId,
        occurredOn: scenario.onDate,
        paymentId: scenario.paymentId,
        amount: scenario.amount,
        sequence: seq,
      }).map((e) => ({ ...e, hypothetical: true as const }));
      hypothetical.push(...events);
      working.push(...events);
      assumptions.push('Extra payment allocated per A-PAY-2 / A-PAY-5');
      break;
    }
    case 'rate_change': {
      const state = foldEvents(working);
      const prev = state.config!.annualEffectiveRate.toString();
      const ev: DomainEvent = {
        ...baseEventFields(creditId, scenario.onDate, seq, { hypothetical: true }),
        type: 'RateChanged',
        payload: {
          annualEffectiveRate: scenario.annualEffectiveRate,
          effectiveOn: scenario.onDate,
          previousRate: prev,
        },
      };
      hypothetical.push(ev);
      working.push(ev);
      break;
    }
    case 'ad_spend_change': {
      const ev: DomainEvent = {
        ...baseEventFields(creditId, scenario.from, seq, { hypothetical: true }),
        type: 'BudgetProjectionSet',
        payload: {
          plannedDailyAdBudget: scenario.plannedDailyAdBudget,
          from: scenario.from,
          to: scenario.to,
        },
      };
      hypothetical.push(ev);
      working.push(ev);
      // Actual debt impact uses a purchase of planned*30 only in simulation of "what if I spend this"
      // Callers should prefer posting AdSpendActualRecorded + PurchaseCreated for real execution.
      const days = 30;
      const monthly = Money.from(scenario.plannedDailyAdBudget, baseline.currency)
        .mul(String(days))
        .settle();
      const purchaseEvents = postPurchase({
        creditId,
        occurredOn: scenario.from,
        purchaseId: `sim_ads_${seq}`,
        amount: monthly.toString(),
        installments: 1,
        sequence: seq + 1,
        category: 'ads',
        merchant: 'TikTok',
      }).map((e) => ({ ...e, hypothetical: true as const }));
      hypothetical.push(...purchaseEvents);
      working.push(...purchaseEvents);
      assumptions.push(
        'ad_spend_change: BudgetProjectionSet stores PLAN; purchase models hypothetical actual charge for debt',
      );
      break;
    }
    case 'refinance': {
      const state = foldEvents(working);
      const remaining = state.installments
        .filter((l) => l.purchaseId === scenario.purchaseId && !l.paid)
        .reduce((acc, l) => acc.add(l.remainingPrincipal), Money.zero(state.currency));
      const ev: DomainEvent = {
        ...baseEventFields(creditId, scenario.onDate, seq, { hypothetical: true }),
        type: 'TermChanged',
        payload: {
          purchaseId: scenario.purchaseId,
          newTotalInstallments: scenario.newTotalInstallments,
          remainingPrincipal: remaining.toString(),
        },
      };
      hypothetical.push(ev);
      working.push(ev);
      break;
    }
    case 'increase_monthly_payment': {
      const state = foldEvents(working);
      const monthlyRate = effectiveToMonthly(state.config!.annualEffectiveRate);
      const points = projectPaydown(
        totalPrincipal(state),
        monthlyRate.toString(),
        Money.from(scenario.monthlyPayment, state.currency),
        scenario.months,
      );
      const last = points[points.length - 1];
      const projected = foldEvents(working);
      return {
        formulaVersion: FORMULA_VERSION,
        baselinePrincipal: totalPrincipal(baseline).toString(),
        projectedPrincipal: last?.principal.toString() ?? totalPrincipal(projected).toString(),
        baselineInterestAccrued: baseline.totalInterestAccrued.toString(),
        projectedInterestAccrued: last?.interestPaidCumulative.toString() ?? '0',
        interestSaved: baseline.totalInterestAccrued
          .sub(Money.from(last?.interestPaidCumulative.toString() ?? '0', baseline.currency))
          .toString(),
        monthsToPayoff: points.find((p) => p.principal.isZero())?.month ?? null,
        hypotheticalEvents: [],
        finalState: projected,
        assumptions: [
          ...assumptions,
          'increase_monthly_payment uses deterministic projectPaydown approximation',
        ],
      };
    }
    default: {
      const _e: never = scenario;
      throw new Error(String(_e));
    }
  }

  const finalState = foldEvents(working);
  const baselinePrincipal = totalPrincipal(baseline);
  const projectedPrincipal = totalPrincipal(finalState);
  const interestSaved = baseline.totalInterestAccrued.sub(finalState.totalInterestAccrued);

  return {
    formulaVersion: FORMULA_VERSION,
    baselinePrincipal: baselinePrincipal.toString(),
    projectedPrincipal: projectedPrincipal.toString(),
    baselineInterestAccrued: baseline.totalInterestAccrued.toString(),
    projectedInterestAccrued: finalState.totalInterestAccrued.toString(),
    interestSaved: interestSaved.toString(),
    monthsToPayoff: null,
    hypotheticalEvents: hypothetical,
    finalState,
    assumptions,
  };
}

export function applyStatementCloseForSim(
  log: EventLog,
  input: {
    creditId: string;
    occurredOn: string;
    statementId: string;
    periodFrom: string;
    periodTo: string;
    averageDailyBalance: string;
    daysInCycle: number;
  },
): DomainEvent[] {
  const state = foldEvents(log);
  return closeStatement(state, {
    ...input,
    sequence: nextSequence(log),
  });
}
