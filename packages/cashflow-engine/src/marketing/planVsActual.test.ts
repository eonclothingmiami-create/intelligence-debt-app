import { describe, expect, it } from 'vitest';
import { compareMarketingPlanVsActual } from './planVsActual.js';

describe('compareMarketingPlanVsActual', () => {
  it('alerts when actual exceeds budget beyond user threshold', () => {
    const result = compareMarketingPlanVsActual({
      currency: 'COP',
      channelId: 'tiktok',
      periodFrom: '2026-07-01',
      periodTo: '2026-07-31',
      budgets: [
        {
          id: 'b1',
          channelId: 'tiktok',
          periodFrom: '2026-07-01',
          periodTo: '2026-07-31',
          budgetAmount: '2100000',
          currency: 'COP',
        },
      ],
      actuals: [
        {
          id: 'a1',
          channelId: 'tiktok',
          occurredOn: '2026-07-15',
          actualAmount: '1800000',
          currency: 'COP',
        },
      ],
      policy: { alertDeviationRate: '0.10' },
    });

    expect(result.budgetAmount).toBe('2100000');
    expect(result.actualAmount).toBe('1800000');
    expect(result.status).toBe('under_budget');
    expect(result.alert).toBe(true);
  });

  it('on_plan when within threshold', () => {
    const result = compareMarketingPlanVsActual({
      currency: 'COP',
      channelId: 'tiktok',
      periodFrom: '2026-07-01',
      periodTo: '2026-07-31',
      budgets: [
        {
          id: 'b1',
          channelId: 'tiktok',
          periodFrom: '2026-07-01',
          periodTo: '2026-07-31',
          budgetAmount: '2100000',
          currency: 'COP',
        },
      ],
      actuals: [
        {
          id: 'a1',
          channelId: 'tiktok',
          occurredOn: '2026-07-10',
          actualAmount: '2000000',
          currency: 'COP',
        },
      ],
      policy: { alertDeviationRate: '0.10' },
    });
    expect(result.status).toBe('on_plan');
    expect(result.alert).toBe(false);
  });
});
