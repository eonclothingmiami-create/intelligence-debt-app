/**
 * Report snapshots from board facts — export only; never invent figures.
 */

export type ReportKind =
  'monthly_snapshot' | 'liquidity' | 'debts' | 'costs' | 'capacity' | 'kpis' | 'full_board';

export type ReportRow = {
  section: string;
  label: string;
  value: string;
  note?: string;
};

export type ReportSnapshot = {
  kind: ReportKind;
  title: string;
  generatedAt: string;
  currency: string;
  audience: string;
  rows: ReportRow[];
  gaps: string[];
};

export const REPORT_KIND_META: Record<
  ReportKind,
  { title: string; audience: string; blurb: string }
> = {
  monthly_snapshot: {
    title: 'Resumen mensual',
    audience: 'Dueño / socios',
    blurb: 'Caja, ventas, BEP, deudas y capacidad del mes.',
  },
  liquidity: {
    title: 'Liquidez y reserva',
    audience: 'Tesorería',
    blurb: 'Runway, piso, reserva y capacidad inmediata.',
  },
  debts: {
    title: 'Cartera de deudas',
    audience: 'Banco / dueño',
    blurb: 'Saldos, cuotas e interés estimado por obligación.',
  },
  costs: {
    title: 'Presupuesto de costos',
    audience: 'Contador / dueño',
    blurb: 'Costos fijos y variables del catálogo BEP.',
  },
  capacity: {
    title: 'Capacidad financiera',
    audience: 'Dueño (diario)',
    blurb: 'Las 6 preguntas + earmarks.',
  },
  kpis: {
    title: 'KPIs nombrados',
    audience: 'Dueño / inversores',
    blurb: 'Indicadores con estado OK / vigilancia / crítico / sin dato.',
  },
  full_board: {
    title: 'Tablero completo',
    audience: 'Archivo / auditoría ligera',
    blurb: 'Consolida secciones clave del OS en un solo export.',
  },
};

export type BoardReportInput = {
  currency: string;
  cashOnHand: string | null;
  immediateFreeCash: string | null;
  runwayMonths: string | null;
  reserveMonths: string | null;
  reserveAmount: string | null;
  minCashFloor: string | null;
  maxSafeExtraDebt: string | null;
  monthSales: string | null;
  breakEvenSales: string | null;
  safetyMargin: string | null;
  contributionMarginRate: string | null;
  totalFixedCosts: string | null;
  totalDebtBalance: string | null;
  estimatedMonthlyInterest: string | null;
  obligations: Array<{
    label: string;
    kindLabel: string;
    balance: string;
    installment: string | null;
    interest: string | null;
  }>;
  fixedCosts: Array<{ label: string; category: string; amount: string; dueDay?: number }>;
  variableCosts: Array<{ label: string; category: string; amount: string }>;
  capacity: {
    canSpendToday: string | null;
    canInvest: string | null;
    canPayDebtExtra: string | null;
    canRestock: string | null;
    canWithdrawProfit: string | null;
    canSpendAds: string | null;
    recompraEarmark: string | null;
    nextQuincena: string | null;
    creditCardInstallment: string | null;
    gaps: string[];
  };
  kpis: Array<{
    label: string;
    value: string | null;
    status: string;
    detail: string;
  }>;
  goalsNorthStar: string | null;
  recommendationAction: string | null;
};

function row(
  section: string,
  label: string,
  value: string | null | undefined,
  note?: string,
): ReportRow {
  return {
    section,
    label,
    value: value != null && value !== '' ? value : '— (sin dato)',
    ...(note ? { note } : {}),
  };
}

function collectGaps(input: BoardReportInput): string[] {
  const gaps: string[] = [...input.capacity.gaps];
  if (!input.cashOnHand) gaps.push('cashOnHand');
  if (!input.monthSales) gaps.push('monthSales');
  if (!input.runwayMonths) gaps.push('runwayMonths');
  if (!input.breakEvenSales) gaps.push('breakEvenSales');
  return [...new Set(gaps)];
}

export function buildReport(kind: ReportKind, input: BoardReportInput): ReportSnapshot {
  const meta = REPORT_KIND_META[kind];
  const generatedAt = new Date().toISOString();
  const gaps = collectGaps(input);
  const rows: ReportRow[] = [];

  const pushLiquidity = () => {
    rows.push(row('Liquidez', 'Caja', input.cashOnHand));
    rows.push(row('Liquidez', 'Capacidad inmediata', input.immediateFreeCash));
    rows.push(row('Liquidez', 'Runway (meses)', input.runwayMonths));
    rows.push(row('Liquidez', 'Reserva (meses)', input.reserveMonths));
    rows.push(row('Liquidez', 'Reserva (monto)', input.reserveAmount));
    rows.push(row('Liquidez', 'Piso de caja', input.minCashFloor));
    rows.push(row('Liquidez', 'Máx. abono seguro', input.maxSafeExtraDebt));
  };

  const pushSalesBep = () => {
    rows.push(row('Ventas / BEP', 'Ventas mes', input.monthSales));
    rows.push(row('Ventas / BEP', 'Punto de equilibrio', input.breakEvenSales));
    rows.push(row('Ventas / BEP', 'Margen de seguridad', input.safetyMargin));
    rows.push(row('Ventas / BEP', 'Margen contribución', input.contributionMarginRate));
    rows.push(row('Ventas / BEP', 'Costos fijos totales', input.totalFixedCosts));
  };

  const pushDebts = () => {
    rows.push(row('Deudas', 'Saldo total', input.totalDebtBalance));
    rows.push(row('Deudas', 'Interés mensual est.', input.estimatedMonthlyInterest));
    for (const o of input.obligations) {
      rows.push(
        row(
          'Deudas',
          `${o.label} (${o.kindLabel})`,
          o.balance,
          `Cuota ${o.installment ?? '—'} · interés ${o.interest ?? '—'}`,
        ),
      );
    }
    if (!input.obligations.length) {
      rows.push(row('Deudas', 'Obligaciones', null, 'Sin obligaciones en el tablero'));
    }
  };

  const pushCosts = () => {
    for (const c of input.fixedCosts) {
      rows.push(
        row(
          'Costos fijos',
          c.label,
          c.amount,
          `${c.category}${c.dueDay != null ? ` · día ${c.dueDay}` : ''}`,
        ),
      );
    }
    for (const c of input.variableCosts) {
      rows.push(row('Costos variables', c.label, c.amount, c.category));
    }
    if (!input.fixedCosts.length && !input.variableCosts.length) {
      rows.push(row('Costos', 'Catálogo', null, 'Sin líneas de costo'));
    }
  };

  const pushCapacity = () => {
    rows.push(row('Capacidad', 'Gastar hoy', input.capacity.canSpendToday));
    rows.push(row('Capacidad', 'Invertir', input.capacity.canInvest));
    rows.push(row('Capacidad', 'Abonar deuda', input.capacity.canPayDebtExtra));
    rows.push(row('Capacidad', 'Recomprar', input.capacity.canRestock));
    rows.push(row('Capacidad', 'Retirar utilidad', input.capacity.canWithdrawProfit));
    rows.push(row('Capacidad', 'Publicidad', input.capacity.canSpendAds));
    rows.push(row('Capacidad', 'Earmark recompra', input.capacity.recompraEarmark));
    rows.push(row('Capacidad', 'Quincena', input.capacity.nextQuincena));
    rows.push(row('Capacidad', 'Cuota TC', input.capacity.creditCardInstallment));
  };

  const pushKpis = () => {
    for (const k of input.kpis) {
      rows.push(row('KPIs', k.label, k.value, `${k.status} · ${k.detail}`));
    }
    if (!input.kpis.length) rows.push(row('KPIs', 'Indicadores', null));
  };

  switch (kind) {
    case 'monthly_snapshot':
      if (input.goalsNorthStar) rows.push(row('Contexto', 'Visión norte', input.goalsNorthStar));
      pushLiquidity();
      pushSalesBep();
      rows.push(row('Deudas', 'Saldo total', input.totalDebtBalance));
      rows.push(row('Deudas', 'Interés mes', input.estimatedMonthlyInterest));
      pushCapacity();
      if (input.recommendationAction) {
        rows.push(row('Decisión', 'Acción motores', input.recommendationAction));
      }
      break;
    case 'liquidity':
      pushLiquidity();
      break;
    case 'debts':
      pushDebts();
      break;
    case 'costs':
      pushCosts();
      break;
    case 'capacity':
      pushCapacity();
      break;
    case 'kpis':
      pushKpis();
      break;
    case 'full_board':
      if (input.goalsNorthStar) rows.push(row('Contexto', 'Visión norte', input.goalsNorthStar));
      pushLiquidity();
      pushSalesBep();
      pushDebts();
      pushCosts();
      pushCapacity();
      pushKpis();
      if (input.recommendationAction) {
        rows.push(row('Decisión', 'Acción motores', input.recommendationAction));
      }
      break;
  }

  return {
    kind,
    title: meta.title,
    generatedAt,
    currency: input.currency,
    audience: meta.audience,
    rows,
    gaps,
  };
}

export function reportToCsv(snapshot: ReportSnapshot): string {
  const header = ['section', 'label', 'value', 'note'];
  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = [
    `# ${snapshot.title}`,
    `# generatedAt=${snapshot.generatedAt}`,
    `# currency=${snapshot.currency}`,
    `# audience=${snapshot.audience}`,
    `# gaps=${snapshot.gaps.join('|') || 'none'}`,
    header.join(','),
    ...snapshot.rows.map((r) => [r.section, r.label, r.value, r.note ?? ''].map(escape).join(',')),
  ];
  return lines.join('\n');
}

export function downloadTextFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadReportCsv(snapshot: ReportSnapshot): void {
  const stamp = snapshot.generatedAt.slice(0, 10);
  downloadTextFile(
    `fie-${snapshot.kind}-${stamp}.csv`,
    reportToCsv(snapshot),
    'text/csv;charset=utf-8',
  );
}

export function downloadReportJson(snapshot: ReportSnapshot): void {
  const stamp = snapshot.generatedAt.slice(0, 10);
  downloadTextFile(
    `fie-${snapshot.kind}-${stamp}.json`,
    JSON.stringify(snapshot, null, 2),
    'application/json',
  );
}

/** Opens a print-friendly window (user can Save as PDF). */
export function printReport(snapshot: ReportSnapshot): void {
  const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
  if (!win) return;
  const rowsHtml = snapshot.rows
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.section)}</td><td>${escapeHtml(r.label)}</td><td>${escapeHtml(r.value)}</td><td>${escapeHtml(r.note ?? '')}</td></tr>`,
    )
    .join('');
  win.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"/>
<title>${escapeHtml(snapshot.title)}</title>
<style>
  body{font-family:Georgia,serif;margin:2rem;color:#1a1a1a}
  h1{font-size:1.6rem;margin:0 0 .25rem}
  p{color:#555;font-size:.9rem}
  table{width:100%;border-collapse:collapse;margin-top:1.5rem;font-size:.85rem}
  th,td{border-bottom:1px solid #ddd;padding:.45rem .35rem;text-align:left;vertical-align:top}
  th{font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:#666}
  .gaps{margin-top:1rem;font-size:.8rem;color:#8a5a00}
</style></head><body>
<h1>${escapeHtml(snapshot.title)}</h1>
<p>Audiencia: ${escapeHtml(snapshot.audience)} · Moneda: ${escapeHtml(snapshot.currency)} · ${escapeHtml(snapshot.generatedAt)}</p>
<p>Financial OS — solo hechos del tablero; sin inventar cifras.</p>
<table><thead><tr><th>Sección</th><th>Concepto</th><th>Valor</th><th>Nota</th></tr></thead>
<tbody>${rowsHtml}</tbody></table>
${
  snapshot.gaps.length
    ? `<p class="gaps">Gaps declarados: ${escapeHtml(snapshot.gaps.join(', '))}</p>`
    : ''
}
<script>window.onload=()=>window.print()</script>
</body></html>`);
  win.document.close();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
