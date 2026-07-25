import { describe, expect, it } from 'vitest';
import { compareMarketingPlanVsActual, compareMarketingPortfolio } from './planVsActual.js';

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

describe('compareMarketingPortfolio', () => {
  it('sums channels and frees capacity when total actual < budget', () => {
    const result = compareMarketingPortfolio({
      currency: 'COP',
      periodFrom: '2026-07-01',
      periodTo: '2026-07-31',
      channels: [
        { id: 'tiktok', label: 'TikTok Ads', active: true, sortOrder: 0 },
        { id: 'meta', label: 'Meta Ads', active: true, sortOrder: 1 },
        { id: 'google', label: 'Google Ads', active: true, sortOrder: 2 },
      ],
      budgets: [
        {
          id: 'b-tt',
          channelId: 'tiktok',
          periodFrom: '2026-07-01',
          periodTo: '2026-07-31',
          budgetAmount: '2100000',
          currency: 'COP',
        },
        {
          id: 'b-meta',
          channelId: 'meta',
          periodFrom: '2026-07-01',
          periodTo: '2026-07-31',
          budgetAmount: '1500000',
          currency: 'COP',
        },
        {
          id: 'b-g',
          channelId: 'google',
          periodFrom: '2026-07-01',
          periodTo: '2026-07-31',
          budgetAmount: '900000',
          currency: 'COP',
        },
      ],
      actuals: [
        {
          id: 'a-tt',
          channelId: 'tiktok',
          occurredOn: '2026-07-15',
          actualAmount: '1800000',
          currency: 'COP',
        },
        {
          id: 'a-meta',
          channelId: 'meta',
          occurredOn: '2026-07-18',
          actualAmount: '1200000',
          currency: 'COP',
        },
        {
          id: 'a-g',
          channelId: 'google',
          occurredOn: '2026-07-20',
          actualAmount: '900000',
          currency: 'COP',
        },
      ],
      policy: { alertDeviationRate: '0.10' },
    });

    expect(result.totalBudgetAmount).toBe('4500000');
    expect(result.totalActualAmount).toBe('3900000');
    expect(result.freedCapacityAmount).toBe('600000');
    expect(result.overspendAmount).toBe('0');
    expect(result.channels).toHaveLength(3);
  });
});
