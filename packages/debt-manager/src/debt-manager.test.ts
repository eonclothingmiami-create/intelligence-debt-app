import { describe, expect, it, beforeEach } from 'vitest';
import {
  appendEvent,
  buildDebtPortfolioDashboard,
  foldDebtEvents,
  nextSequence,
  openObligation,
  rankDebtsForExtraPayment,
  resetDebtEventIdSequenceForTests,
  simulateDebtPaymentChange,
  snapshotObligation,
  type DebtObligation,
} from './index.js';
import type { DebtEventLog } from './events/types.js';
import { createDebtEventId } from './events/factory.js';

beforeEach(() => {
  resetDebtEventIdSequenceForTests();
});

const davivienda: DebtObligation = {
  id: 'obl_dav',
  label: 'Davivienda TC',
  kindId: 'tarjeta',
  kindLabel: 'Tarjeta de crédito',
  institution: 'Davivienda',
  currency: 'COP',
  allowsExtraPayments: true,
  prepaymentPenalty: false,
  ratePercent: '2.1085',
  ratePeriodicity: 'monthly',
  installmentCount: 12,
  minimumPaymentAmount: '1862662',
  targetPaymentAmount: '2500000',
  statementDay: 15,
  paymentDueDay: 5,
  purpose: 'Publicidad TikTok',
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const proveedor: DebtObligation = {
  id: 'obl_tela',
  label: 'Proveedor Tela',
  kindId: 'proveedor',
  kindLabel: 'Proveedor',
  institution: 'Tela SAS',
  currency: 'COP',
  allowsExtraPayments: true,
  prepaymentPenalty: false,
  ratePeriodicity: 'none',
  maturityDate: '2026-08-15',
  active: true,
  createdAt: '2026-07-01T00:00:00.000Z',
};

describe('event-sourced debt balance', () => {
  it('reconstructs balance from open + purchase + payments (not a stored saldo)', () => {
    let log: DebtEventLog = [];
    log = appendEvent(
      log,
      openObligation({
        obligationId: 'obl_dav',
        occurredOn: '2026-01-01',
        sequence: 1,
        openingPrincipal: '10000000',
        currency: 'COP',
      }),
    );
    log = appendEvent(log, {
      eventId: createDebtEventId(),
      type: 'PurchaseCharged',
      obligationId: 'obl_dav',
      occurredOn: '2026-02-01',
      sequence: nextSequence(log),
      payload: { amount: '6933600', merchant: 'TikTok' },
    });
    log = appendEvent(log, {
      eventId: createDebtEventId(),
      type: 'OrdinaryPaymentApplied',
      obligationId: 'obl_dav',
      occurredOn: '2026-03-05',
      sequence: nextSequence(log),
      payload: { amount: '2000000' },
    });

    const state = foldDebtEvents('obl_dav', log);
    expect(state.principal.toString()).toBe('14933600');
    expect(state.totalOrdinaryPaid.toString()).toBe('2000000');
  });
});

describe('portfolio dashboard', () => {
  it('aggregates multiple living obligations', () => {
    const logDav: DebtEventLog = [
      openObligation({
        obligationId: 'obl_dav',
        occurredOn: '2026-01-01',
        sequence: 1,
        openingPrincipal: '16933600',
        currency: 'COP',
      }),
    ];
    const logProv: DebtEventLog = [
      openObligation({
        obligationId: 'obl_tela',
        occurredOn: '2026-07-01',
        sequence: 1,
        openingPrincipal: '3500000',
        currency: 'COP',
      }),
    ];

    const dash = buildDebtPortfolioDashboard(
      [davivienda, proveedor],
      { obl_dav: logDav, obl_tela: logProv },
      'COP',
    );

    expect(dash.obligationCount).toBe(2);
    expect(dash.totalBalance).toBe('20433600');
    expect(Number(dash.estimatedMonthlyInterest)).toBeGreaterThan(0);
  });
});

describe('simulator + optimizer', () => {
  it('simulates higher payment reducing interest', () => {
    const log: DebtEventLog = [
      openObligation({
        obligationId: 'obl_dav',
        occurredOn: '2026-01-01',
        sequence: 1,
        openingPrincipal: '10000000',
        currency: 'COP',
      }),
    ];
    const snap = snapshotObligation(davivienda, log);
    const sim = simulateDebtPaymentChange({
      obligation: davivienda,
      state: snap.state,
      currentPayment: '2200000',
      proposedPayment: '2800000',
    });
    expect(sim.allowed).toBe(true);
    expect(sim.periodsAtProposed).not.toBeNull();
    expect(Number(sim.interestSaved)).toBeGreaterThan(0);
  });

  it('ranks by interest burden not largest balance', () => {
    const highRateSmall: DebtObligation = {
      ...davivienda,
      id: 'obl_hi',
      label: 'Cara chica',
      ratePercent: '3.5',
    };
    const lowRateBig: DebtObligation = {
      ...davivienda,
      id: 'obl_lo',
      label: 'Barata grande',
      ratePercent: '0.5',
    };
    const snapHi = snapshotObligation(highRateSmall, [
      openObligation({
        obligationId: 'obl_hi',
        occurredOn: '2026-01-01',
        sequence: 1,
        openingPrincipal: '5000000',
        currency: 'COP',
      }),
    ]);
    const snapLo = snapshotObligation(lowRateBig, [
      openObligation({
        obligationId: 'obl_lo',
        occurredOn: '2026-01-01',
        sequence: 1,
        openingPrincipal: '50000000',
        currency: 'COP',
      }),
    ]);

    const result = rankDebtsForExtraPayment({
      snapshots: [snapLo, snapHi],
      extraCashAvailable: '1200000',
    });

    expect(result.suggestedTargetObligationId).toBe('obl_hi');
    expect(result.rationale.some((r) => /tasa|no por saldo/i.test(r))).toBe(true);
  });
});
