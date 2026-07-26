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
    expect(cap.canPayDebtExtra).not.toBeNull();
    // FCF 17M - reserve 10M = 7M
    expect(cap.canPayDebtExtra).toBe('7000000');
    expect(cap.canWithdrawProfit).toBe('7000000');
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
    expect(board.capacity.immediateFreeCash).toBe('17000000');
    expect(board.liquidity?.maxSafeExtraDebtPayment).toBe('7000000');
    expect(board.breakEven).toBeNull();
    expect(board.recommendation).toBeNull();
  });
});
