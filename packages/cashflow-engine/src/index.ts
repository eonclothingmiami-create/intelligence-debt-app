export const ENGINE_NAME = 'cashflow-engine' as const;

export {
  compareMarketingPlanVsActual,
  totalMarketingBudget,
  totalMarketingActual,
} from './marketing/planVsActual.js';

/**
 * Project operating and financing cash flows over a horizon.
 * TODO: period-by-period projection from inflows, outflows, debt schedules, and ACTUAL ad spend.
 */
export function projectCashFlows(_input: unknown): never {
  throw new Error('TODO: implement projectCashFlows in @fie/cashflow-engine');
}
