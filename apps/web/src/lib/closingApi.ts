/** Client for fie-os-closing Edge Function. */

const CLOSING_API =
  process.env.NEXT_PUBLIC_CLOSING_API_URL ??
  'https://niilaxdeetuzutycvdkz.supabase.co/functions/v1/fie-os-closing';

const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5paWxheGRlZXR1enV0eWN2ZGt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjc0NjIsImV4cCI6MjA4ODk0MzQ2Mn0.GI8E7vRzxi5NumN_f4T432Lx4BcmgGLZo81BR9h3h8c';

function apiHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${ANON_KEY}`,
    apikey: ANON_KEY,
  };
}

export type ClosingLineType =
  'expense' | 'obligation_payment' | 'fixed_cost_payment' | 'extraordinary' | 'new_obligation';

export type PaymentKind = 'minimo' | 'cuota' | 'abono_extra' | 'fixed_cost';

export type ClosingLineInput = {
  lineType: ClosingLineType;
  sortOrder?: number;
  concept?: string | null;
  category?: string | null;
  note?: string | null;
  obligationId?: string | null;
  fixedCostId?: string | null;
  paymentKind?: PaymentKind | null;
  baseAmount?: string;
  lateInterestAmount?: string;
  otherAdjustmentAmount?: string;
  totalAmount?: string;
  direction?: 'outflow' | 'inflow';
  meta?: Record<string, unknown>;
};

export type ClosingStatus = {
  seriesStart: string;
  today: string;
  timezone: string;
  pendingDays: string[];
  nextPendingDay: string | null;
  lastClosed: string | null;
  closedCount: number;
  canGenerateRecommendations: boolean;
};

export type ClosingLineRow = {
  id: string;
  closing_id: string;
  line_type: ClosingLineType;
  sort_order: number;
  concept: string | null;
  category: string | null;
  note: string | null;
  obligation_id: string | null;
  fixed_cost_id: string | null;
  payment_kind: PaymentKind | null;
  base_amount: number | string;
  late_interest_amount: number | string;
  other_adjustment_amount: number | string;
  total_amount: number | string;
  direction: 'outflow' | 'inflow';
  meta: Record<string, unknown>;
};

export type DailyClosingRow = {
  id: string;
  business_day: string;
  status: string;
  sales_snapshot: Record<string, unknown>;
  notes: string | null;
  closed_at: string;
  closed_by: string;
  revision: number;
};

export type FixedCostMonthPayment = {
  id: string;
  fixed_cost_id: string;
  year_month: string;
  closing_id: string;
  base_amount: number | string;
  late_interest_amount: number | string;
  other_adjustment_amount: number | string;
  total_paid: number | string;
  paid_on: string;
};

export type CloseDayPayload = {
  salesSnapshot?: Record<string, unknown>;
  notes?: string | null;
  closedBy?: string;
  lines?: ClosingLineInput[];
};

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string; error?: string };
    return body.message || body.error || `Registro API ${res.status}`;
  } catch {
    return `Registro API ${res.status}`;
  }
}

export async function fetchClosingStatus(apiBase = CLOSING_API): Promise<ClosingStatus> {
  const res = await fetch(`${apiBase.replace(/\/$/, '')}/v1/closing/status`, {
    headers: apiHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as ClosingStatus;
}

export async function fetchFixedCostMonthPayments(
  yearMonth: string,
  apiBase = CLOSING_API,
): Promise<{ yearMonth: string; payments: FixedCostMonthPayment[] }> {
  const res = await fetch(
    `${apiBase.replace(/\/$/, '')}/v1/closing/fixed-cost-payments?yearMonth=${encodeURIComponent(yearMonth)}`,
    { headers: apiHeaders() },
  );
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as { yearMonth: string; payments: FixedCostMonthPayment[] };
}

export async function fetchClosingsRange(
  from: string,
  to: string,
  apiBase = CLOSING_API,
): Promise<{
  from: string;
  to: string;
  closings: Array<DailyClosingRow & { lines: ClosingLineRow[] }>;
}> {
  const res = await fetch(
    `${apiBase.replace(/\/$/, '')}/v1/closing?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    { headers: apiHeaders() },
  );
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as {
    from: string;
    to: string;
    closings: Array<DailyClosingRow & { lines: ClosingLineRow[] }>;
  };
}

export async function fetchClosingDay(
  day: string,
  apiBase = CLOSING_API,
): Promise<{ closing: DailyClosingRow; lines: ClosingLineRow[]; audit: unknown[] }> {
  const res = await fetch(`${apiBase.replace(/\/$/, '')}/v1/closing/${day}`, {
    headers: apiHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as {
    closing: DailyClosingRow;
    lines: ClosingLineRow[];
    audit: unknown[];
  };
}

export async function postCloseDay(
  day: string,
  payload: CloseDayPayload,
  apiBase = CLOSING_API,
): Promise<{
  ok: boolean;
  message: string;
  closing: DailyClosingRow & { lines: ClosingLineRow[] };
  status: ClosingStatus;
}> {
  const res = await fetch(`${apiBase.replace(/\/$/, '')}/v1/closing/${day}`, {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as {
    ok: boolean;
    message: string;
    closing: DailyClosingRow & { lines: ClosingLineRow[] };
    status: ClosingStatus;
  };
}

export async function patchClosingDay(
  day: string,
  payload: CloseDayPayload & { changedBy?: string },
  apiBase = CLOSING_API,
): Promise<{
  ok: boolean;
  closing: { closing: DailyClosingRow; lines: ClosingLineRow[]; audit: unknown[] };
}> {
  const res = await fetch(`${apiBase.replace(/\/$/, '')}/v1/closing/${day}`, {
    method: 'PATCH',
    headers: apiHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as {
    ok: boolean;
    closing: { closing: DailyClosingRow; lines: ClosingLineRow[]; audit: unknown[] };
  };
}

export async function markIdlePendingDays(apiBase = CLOSING_API): Promise<{
  ok: boolean;
  message: string;
  markedDays: string[];
  status: ClosingStatus;
}> {
  const res = await fetch(`${apiBase.replace(/\/$/, '')}/v1/closing/mark-idle`, {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify({ closedBy: 'owner' }),
  });
  if (res.ok) {
    return (await res.json()) as {
      ok: boolean;
      message: string;
      markedDays: string[];
      status: ClosingStatus;
    };
  }

  // Fallback if Edge not yet redeployed with mark-idle: close each pending day empty.
  if (res.status === 404) {
    const status = await fetchClosingStatus(apiBase);
    const markedDays: string[] = [];
    let lastStatus = status;
    for (const day of status.pendingDays) {
      const closed = await postCloseDay(
        day,
        {
          salesSnapshot: {
            source: 'erp_hera',
            note: 'Sin movimientos manuales — ventas siguen en ERP',
          },
          notes: 'sin_movimientos_manuales',
          closedBy: 'owner',
          lines: [],
        },
        apiBase,
      );
      markedDays.push(day);
      lastStatus = closed.status;
    }
    return {
      ok: true,
      message:
        markedDays.length === 0
          ? 'No había días pendientes'
          : `Sin movimientos manuales — ${markedDays.length} día(s) actualizado(s)`,
      markedDays,
      status: lastStatus,
    };
  }

  throw new Error(await parseError(res));
}

export async function pingClosingApi(apiBase = CLOSING_API): Promise<boolean> {
  try {
    const res = await fetch(`${apiBase.replace(/\/$/, '')}/health`, { headers: apiHeaders() });
    return res.ok;
  } catch {
    return false;
  }
}
