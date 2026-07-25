import type { SalesDashboardSnapshot } from '@fie/erp-integration';

const DEFAULT_API =
  process.env.NEXT_PUBLIC_API_URL ??
  'https://niilaxdeetuzutycvdkz.supabase.co/functions/v1/fie-os-sales';

const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5paWxheGRlZXR1enV0eWN2ZGt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjc0NjIsImV4cCI6MjA4ODk0MzQ2Mn0.GI8E7vRzxi5NumN_f4T432Lx4BcmgGLZo81BR9h3h8c';

function apiHeaders(extra?: HeadersInit): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (ANON_KEY) {
    headers.Authorization = `Bearer ${ANON_KEY}`;
    headers.apikey = ANON_KEY;
  }
  return { ...headers, ...extra };
}

export type HeraSaleSimInput = {
  orderId: string;
  netAmount: string;
  itemCount?: string;
  occurredAt?: string;
};

export async function fetchSalesDashboard(apiBase = DEFAULT_API): Promise<SalesDashboardSnapshot> {
  const res = await fetch(`${apiBase.replace(/\/$/, '')}/v1/projections/sales`, {
    headers: apiHeaders(),
  });
  if (!res.ok) throw new Error(`API ventas ${res.status}`);
  return (await res.json()) as SalesDashboardSnapshot;
}

/**
 * One-way pull: Edge Function copies Hera public.ventas → fie_domain_events (OS only).
 * Default scope = current calendar month (America/Bogota).
 */
export async function syncHeraSalesMonth(
  apiBase = DEFAULT_API,
): Promise<{ scanned: number; upserted: number; dashboard: SalesDashboardSnapshot }> {
  const res = await fetch(`${apiBase.replace(/\/$/, '')}/integrations/hera/sync?scope=month`, {
    method: 'POST',
    headers: apiHeaders(),
  });
  if (!res.ok) throw new Error(`Sync Hera ${res.status}`);
  const body = (await res.json()) as {
    scanned: number;
    upserted: number;
    dashboard: SalesDashboardSnapshot;
  };
  return body;
}

/** Optional webhook path (Hera → OS). Kept for compatibility; prefer sync from ERP. */
export async function postHeraSale(
  input: HeraSaleSimInput,
  apiBase = DEFAULT_API,
): Promise<SalesDashboardSnapshot> {
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const res = await fetch(`${apiBase.replace(/\/$/, '')}/integrations/hera/events`, {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify({
      type: 'sale.created',
      id: input.orderId,
      occurredAt,
      cursor: input.orderId,
      currency: 'COP',
      data: {
        orderId: input.orderId,
        grossAmount: input.netAmount,
        netAmount: input.netAmount,
        itemCount: input.itemCount ?? '1',
        lines: [],
      },
    }),
  });
  if (!res.ok) throw new Error(`Webhook Hera ${res.status}`);
  const body = (await res.json()) as { dashboard: SalesDashboardSnapshot };
  return body.dashboard;
}

export async function pingApi(apiBase = DEFAULT_API): Promise<boolean> {
  try {
    const res = await fetch(`${apiBase.replace(/\/$/, '')}/health`, {
      headers: apiHeaders(),
    });
    return res.ok;
  } catch {
    return false;
  }
}
