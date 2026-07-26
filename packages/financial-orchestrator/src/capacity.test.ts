import { describe, expect, it } from 'vitest';
import { deriveCapacity } from './capacity.js';
import { runBoard } from './runBoard.js';
import { validateBoardInputs } from './validate.js';
import type { BoardInput } from './types.js';

function baseInput(overrides?: Partial<BoardInput>): BoardInput {
  return {
    cash: {
      cashOnHand: '12500000',
      recompraShareOfCash: '0.7',
    },
    policy: {
      reserveMonths: '1',
      currency: 'COP',
    },
    nearTerm: {
      payrollMonthly: '6000000',
      creditCardInstallment: '1866000',
    },
    monthlyFixedBurn: '15000000',
    ...overrides,
  };
}

describe('validateBoardInputs', () => {
  it('flags missing payroll and CC', () => {
    const v = validateBoardInputs(
      baseInput({
        nearTerm: { payrollMonthly: null, creditCardInstallment: null },
      }),
    );
    expect(v.ok).toBe(false);
    expect(v.missingFields).toContain('nearTerm.payrollMonthly');
    expect(v.missingFields).toContain('nearTerm.creditCardInstallment');
  });

  it('ok when all capacity facts present', () => {
    expect(validateBoardInputs(baseInput()).ok).toBe(true);
  });
});

describe('deriveCapacity', () => {
  it('computes immediate free cash after recompra + quincena + TC', () => {
    // cash 12.5M, recompra 70% = 8.75M, after = 3.75M
    // quincena = 3M, TC = 1.866M → free = max(0, 3.75M - 3M - 1.866M) = 0
    const cap = deriveCapacity(baseInput());
    expect(cap.recompraEarmark).toBe('8750000');
    expect(cap.cashAfterRecompra).toBe('3750000');
    expect(cap.nextQuincena).toBe('3000000');
    expect(cap.immediateFreeCash).toBe('0');
    expect(cap.canSpendToday).toBe('0');
    expect(cap.canRestock).toBe('8750000');
  });

  it('positive capacity when cash is larger', () => {
    const cap = deriveCapacity(
      baseInput({
        cash: { cashOnHand: '40000000', recompraShareOfCash: '0.5' },
        nearTerm: { payrollMonthly: '4000000', creditCardInstallment: '1000000' },
        monthlyFixedBurn: '10000000',
        policy: { reserveMonths: '1', currency: 'COP' },
      }),
    );
    // after recompra = 20M; quincena 2M; TC 1M → 17M
    expect(cap.immediateFreeCash).toBe('17000000');
    expect(cap.canSpendToday).toBe('17000000');
    expect(cap.canInvest).toBe('7000000');
    expect(cap.canPayDebtExtra).not.toBeNull();
    // FCF 17M - reserve 10M = 7M
    expect(cap.canPayDebtExtra).toBe('7000000');
    expect(cap.canWithdrawProfit).toBe('7000000');
    expect(cap.canSpendAds).toBe('7000000');
  });

  it('lists gaps when payroll missing', () => {
    const cap = deriveCapacity(
      baseInput({
        nearTerm: { payrollMonthly: null, creditCardInstallment: '1000000' },
      }),
    );
    expect(cap.immediateFreeCash).toBeNull();
    expect(cap.gaps).toContain('payrollMonthly');
    expect(cap.gaps).toContain('immediateFreeCash');
  });
});

describe('runBoard', () => {
  it('returns capacity and liquidity when facts are complete', () => {
    const board = runBoard(
      baseInput({
        cash: { cashOnHand: '40000000', recompraShareOfCash: '0.5' },
        nearTerm: { payrollMonthly: '4000000', creditCardInstallment: '1000000' },
        monthlyFixedBurn: '10000000',
      }),
    );
    expect(board.validation.ok).toBe(true);
    expect(board.pipeline[0]).toBe('validateBoardInputs');
    expect(board.pipeline.at(-1)).toBe('computeBusinessScore');
    expect(board.capacity.immediateFreeCash).toBe('17000000');
    expect(board.liquidity?.maxSafeExtraDebtPayment).toBe('7000000');
    expect(board.breakEven).toBeNull();
    expect(board.recommendation).toBeNull();
    expect(board.score).toBeNull();
  });

  it('derives risk score from board facts when risk inputs omitted', () => {
    const board = runBoard(
      baseInput({
        cash: { cashOnHand: '40000000', recompraShareOfCash: '0.5' },
        nearTerm: { payrollMonthly: '4000000', creditCardInstallment: '1000000' },
        monthlyFixedBurn: '10000000',
        breakEvenSnapshot: {
          formulaVersion: 'test',
          variableCostPerUnit: '5000',
          averageProductCost: '5000',
          averageFullUnitCost: '8000',
          averageSalePrice: '16000',
          contributionMarginPerUnit: '8000',
          contributionMarginRate: '0.5',
          totalFixedCosts: '10000000',
          targetProfit: '0',
          breakEvenUnits: '1250',
          breakEvenSales: '20000000',
          monthly: { units: '1250', money: '20000000' },
          daily: { units: '48', money: '769231' },
          weekly: { units: '288', money: '4615385' },
          annual: { units: '15000', money: '240000000' },
          projectedSales: '30000000',
          safetyMargin: '10000000',
          safetyMarginRate: '0.333',
          inputsUsed: { operatingDaysPerMonth: 26, currency: 'COP' },
        },
        inventoryHint: { units: '100', skusBelowMin: 1, skusWithStock: 10 },
      }),
    );
    expect(board.recommendation).not.toBeNull();
    expect(board.score).not.toBeNull();
    expect(board.score!.score).toBeGreaterThan(0);
  });
});

describe('deriveRiskInputsFromBoard', () => {
  it('maps runway and safety margin into components', async () => {
    const { deriveRiskInputsFromBoard } = await import('./riskDefaults.js');
    const risk = deriveRiskInputsFromBoard({
      breakEven: {
        formulaVersion: 'test',
        variableCostPerUnit: '1',
        averageProductCost: '1',
        averageFullUnitCost: '1',
        averageSalePrice: '2',
        contributionMarginPerUnit: '1',
        contributionMarginRate: '0.4',
        totalFixedCosts: '1',
        targetProfit: '0',
        breakEvenUnits: '1',
        breakEvenSales: '1',
        monthly: { units: '1', money: '1' },
        daily: { units: '1', money: '1' },
        weekly: { units: '1', money: '1' },
        annual: { units: '1', money: '1' },
        projectedSales: '2',
        safetyMargin: '1',
        safetyMarginRate: '0.1',
        inputsUsed: { operatingDaysPerMonth: 26, currency: 'COP' },
      },
      runwayMonths: '2.5',
    });
    expect(risk.components.liquidity).toBe(75);
    expect(risk.components.breakEven).toBe(80);
    expect(risk.weights.liquidity).toBe('0.25');
  });
});
