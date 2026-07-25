import { describe, expect, it } from 'vitest';
import { computeBreakEven } from '../compute/breakEven.js';
import { applyPatch, simulateWhatIf } from '../simulate/whatIf.js';
import { exampleUserDatasetLocal311, LOCAL311_EXPECTED } from '../fixtures/local311.js';
import { priceFromUtility, sumFixedCosts, sumVariableCostsPerUnit } from '../catalog/model.js';
import { Money } from '@fie/financial-engine';

describe('User-configurable break-even (Local 311 as example dataset)', () => {
  it('computes BEP from user inputs — never stores BEP as input', () => {
    const model = exampleUserDatasetLocal311();
    expect(sumVariableCostsPerUnit(model).toString()).toBe(LOCAL311_EXPECTED.variableTotal);
    expect(sumFixedCosts(model).toString()).toBe(LOCAL311_EXPECTED.fixedTotal);

    const snap = computeBreakEven(model);
    expect(snap.averageFullUnitCost).toBe(LOCAL311_EXPECTED.fullUnitCost);
    expect(snap.averageSalePrice).toBe(LOCAL311_EXPECTED.salePrice);
    expect(snap.breakEvenUnits).toBe(LOCAL311_EXPECTED.breakEvenUnits);
    expect(snap.breakEvenSales).toBe(LOCAL311_EXPECTED.breakEvenSales);
    expect(snap.daily.units).toBe(LOCAL311_EXPECTED.dailyUnits);
    expect(snap.daily.money).toBe(LOCAL311_EXPECTED.dailyMoney);
    expect(snap.safetyMargin).toBe('5906112');
    expect(snap.inputsUsed.operatingDaysPerMonth).toBe(26);
    // Model has no breakEvenSales field — output only
    expect('breakEvenSales' in model).toBe(false);
  });

  it('requires operatingDaysPerMonth from user', () => {
    const model = exampleUserDatasetLocal311();
    expect(() => computeBreakEven({ ...model, operatingDaysPerMonth: 0 })).toThrow(
      /operatingDaysPerMonth/,
    );
  });

  it('recalculates when user edits a fixed cost', () => {
    const model = exampleUserDatasetLocal311();
    const { snapshot } = applyPatch(model, {
      type: 'upsert_fixed',
      item: {
        id: 'f_publicidad',
        label: 'PUBLICIDAD',
        amount: '3000000',
        category: 'Marketing',
        active: true,
        sortOrder: 10,
      },
    });
    expect(Money.from(snapshot.totalFixedCosts, 'COP').gt(Money.from('15146944', 'COP'))).toBe(
      true,
    );
    expect(Money.from(snapshot.breakEvenSales, 'COP').gt(Money.from('30293888', 'COP'))).toBe(true);
  });

  it('target profit (user input) increases required sales (output)', () => {
    const model = exampleUserDatasetLocal311();
    const base = computeBreakEven(model);
    const { snapshot } = simulateWhatIf(model, {
      type: 'change_target_profit',
      amount: '5000000',
    });
    expect(
      Money.from(snapshot.breakEvenSales, 'COP').gt(Money.from(base.breakEvenSales, 'COP')),
    ).toBe(true);
  });

  it('priceFromUtility uses caller-supplied utility — not a global default', () => {
    const full = Money.from('17448', 'COP');
    expect(priceFromUtility(full, '0.5').toString()).toBe('34896');
  });
});
