import {
  appendEvent,
  buildDebtPortfolioDashboard,
  createDebtEventId,
  nextSequence,
  openObligation,
  rankDebtsForExtraPayment,
  simulateDebtPaymentChange,
  snapshotObligation,
  type DebtEventLog,
  type DebtObligation,
  type DebtPaymentSimulationResult,
  type DebtPortfolioDashboard,
} from '@fie/debt-manager';

export type DebtWorkspace = {
  obligations: DebtObligation[];
  logs: Record<string, DebtEventLog>;
};

export function createDemoDebtWorkspace(): DebtWorkspace {
  const dav: DebtObligation = {
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
    minimumPaymentAmount: '1866000',
    targetPaymentAmount: '1866000',
    statementDay: 15,
    paymentDueDay: 5,
    purpose: 'Publicidad TikTok',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  const veh: DebtObligation = {
    id: 'obl_vehiculo',
    label: 'Crédito vehículo',
    kindId: 'vehiculo',
    kindLabel: 'Vehículo',
    institution: 'Bancolombia',
    currency: 'COP',
    allowsExtraPayments: true,
    prepaymentPenalty: false,
    ratePercent: '1.35',
    ratePeriodicity: 'monthly',
    fixedInstallmentAmount: '780000',
    maturityDate: '2029-12-01',
    active: true,
    createdAt: '2025-06-01T00:00:00.000Z',
  };

  const tela: DebtObligation = {
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

  const logs: Record<string, DebtEventLog> = {
    obl_dav: [
      openObligation({
        obligationId: 'obl_dav',
        occurredOn: '2026-01-01',
        sequence: 1,
        openingPrincipal: '16933600',
        currency: 'COP',
      }),
    ],
    obl_vehiculo: [
      openObligation({
        obligationId: 'obl_vehiculo',
        occurredOn: '2025-06-01',
        sequence: 1,
        openingPrincipal: '28000000',
        currency: 'COP',
      }),
    ],
    obl_tela: [
      openObligation({
        obligationId: 'obl_tela',
        occurredOn: '2026-07-01',
        sequence: 1,
        openingPrincipal: '3500000',
        currency: 'COP',
      }),
    ],
  };

  return { obligations: [dav, veh, tela], logs };
}

export function debtDashboard(ws: DebtWorkspace): DebtPortfolioDashboard {
  return buildDebtPortfolioDashboard(ws.obligations, ws.logs, 'COP');
}

export function addObligation(
  ws: DebtWorkspace,
  input: {
    label: string;
    kindLabel: string;
    institution?: string;
    openingPrincipal: string;
    ratePercent?: string;
    ratePeriodicity: DebtObligation['ratePeriodicity'];
    allowsExtraPayments: boolean;
    interestOnlyPayments?: boolean;
    fixedInstallmentAmount?: string;
    minimumPaymentAmount?: string;
    targetPaymentAmount?: string;
    purpose?: string;
  },
): DebtWorkspace {
  const id = `obl_${Date.now().toString(36)}`;
  const kindId =
    input.kindLabel
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '') || 'otro';

  const obligation: DebtObligation = {
    id,
    label: input.label,
    kindId,
    kindLabel: input.kindLabel,
    ...(input.institution ? { institution: input.institution } : {}),
    currency: 'COP',
    allowsExtraPayments: input.allowsExtraPayments,
    interestOnlyPayments: input.interestOnlyPayments ?? false,
    prepaymentPenalty: false,
    ...(input.ratePercent ? { ratePercent: input.ratePercent } : {}),
    ratePeriodicity: input.ratePeriodicity,
    ...(input.fixedInstallmentAmount
      ? { fixedInstallmentAmount: input.fixedInstallmentAmount }
      : {}),
    ...(input.minimumPaymentAmount ? { minimumPaymentAmount: input.minimumPaymentAmount } : {}),
    ...(input.targetPaymentAmount ? { targetPaymentAmount: input.targetPaymentAmount } : {}),
    ...(input.purpose ? { purpose: input.purpose } : {}),
    active: true,
    createdAt: new Date().toISOString(),
  };

  const today = new Date().toISOString().slice(0, 10);
  const log = [
    openObligation({
      obligationId: id,
      occurredOn: today,
      sequence: 1,
      openingPrincipal: input.openingPrincipal || '0',
      currency: 'COP',
    }),
  ];

  return {
    obligations: [...ws.obligations, obligation],
    logs: { ...ws.logs, [id]: log },
  };
}

export function patchObligation(
  ws: DebtWorkspace,
  id: string,
  patch: Partial<
    Pick<
      DebtObligation,
      | 'allowsExtraPayments'
      | 'interestOnlyPayments'
      | 'fixedInstallmentAmount'
      | 'minimumPaymentAmount'
      | 'targetPaymentAmount'
      | 'ratePercent'
      | 'label'
      | 'purpose'
    >
  >,
): DebtWorkspace {
  return {
    ...ws,
    obligations: ws.obligations.map((o) => (o.id === id ? { ...o, ...patch } : o)),
  };
}

export function removeObligation(ws: DebtWorkspace, id: string): DebtWorkspace {
  const restLogs = { ...ws.logs };
  delete restLogs[id];
  return {
    obligations: ws.obligations.filter((o) => o.id !== id),
    logs: restLogs,
  };
}

export function recordExtraPayment(
  ws: DebtWorkspace,
  obligationId: string,
  amount: string,
): DebtWorkspace {
  const log = ws.logs[obligationId] ?? [];
  const next = appendEvent(log, {
    eventId: createDebtEventId('extra'),
    type: 'ExtraPaymentApplied',
    obligationId,
    occurredOn: new Date().toISOString().slice(0, 10),
    sequence: nextSequence(log),
    payload: { amount },
  });
  return { ...ws, logs: { ...ws.logs, [obligationId]: next } };
}

export function simulateObligationPayment(
  ws: DebtWorkspace,
  obligationId: string,
  proposedPayment: string,
): DebtPaymentSimulationResult | null {
  const obligation = ws.obligations.find((o) => o.id === obligationId);
  if (!obligation) return null;
  const snap = snapshotObligation(obligation, ws.logs[obligationId] ?? []);
  const current = obligation.interestOnlyPayments
    ? (obligation.fixedInstallmentAmount ??
      obligation.minimumPaymentAmount ??
      snap.estimatedMonthlyInterest ??
      proposedPayment)
    : (obligation.targetPaymentAmount ??
      obligation.fixedInstallmentAmount ??
      obligation.minimumPaymentAmount ??
      proposedPayment);
  return simulateDebtPaymentChange({
    obligation,
    state: snap.state,
    currentPayment: current,
    proposedPayment,
  });
}

export function optimizeExtraCash(ws: DebtWorkspace, extraCash: string) {
  const dash = debtDashboard(ws);
  return rankDebtsForExtraPayment({
    snapshots: dash.snapshots,
    extraCashAvailable: extraCash || '0',
    currency: 'COP',
  });
}
