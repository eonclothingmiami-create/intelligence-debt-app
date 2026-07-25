import type { SalesDashboardSnapshot } from '@fie/erp-integration';
import type { HeraPayrollSnapshot } from '@/lib/heraPayroll';

const DEFAULT_API =
  process.env.NEXT_PUBLIC_API_URL ??
  'https://niilaxdeetuzutycvdkz.supabase.co/functions/v1/fie-os-sales';

const PAYROLL_API =
  process.env.NEXT_PUBLIC_PAYROLL_API_URL ??
  'https://niilaxdeetuzutycvdkz.supabase.co/functions/v1/fie-os-payroll';

const INVENTORY_API =
  process.env.NEXT_PUBLIC_INVENTORY_API_URL ??
  'https://niilaxdeetuzutycvdkz.supabase.co/functions/v1/fie-os-inventory';

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

/**
 * One-way pull: Edge reads Hera public.employees (never mutates ERP).
 * Empty module → empty:true (use SMMLV calculator until workers are registered in Hera).
 */
export async function syncHeraPayroll(apiBase = PAYROLL_API): Promise<HeraPayrollSnapshot> {
  const res = await fetch(`${apiBase.replace(/\/$/, '')}/integrations/hera/payroll/sync`, {
    method: 'POST',
    headers: apiHeaders(),
  });
  const body = (await res.json()) as HeraPayrollSnapshot & { error?: string };
  if (!res.ok) {
    throw new Error(body.error || `Sync nómina Hera ${res.status}`);
  }
  return body;
}

export type HeraInventorySnapshot = {
  currency: string;
  source: string;
  skuCount: number;
  skusWithStock: number;
  skusBelowMin: number;
  units: string;
  valueAtCost: string;
  valueAtPrice: string;
  topByValueAtCost: Array<{
    id: string;
    ref: string;
    name: string;
    stock: number;
    valueAtCost: string;
  }>;
  syncedAt: string;
};

export type HeraInventorySyncResult = {
  ok: boolean;
  empty: boolean;
  message: string;
  snapshot: HeraInventorySnapshot;
};

/** One-way: Edge reads products.stock × cost (never mutates ERP). */
export async function syncHeraInventory(apiBase = INVENTORY_API): Promise<HeraInventorySyncResult> {
  const res = await fetch(`${apiBase.replace(/\/$/, '')}/integrations/hera/inventory/sync`, {
    method: 'POST',
    headers: apiHeaders(),
  });
  const body = (await res.json()) as HeraInventorySyncResult & { error?: string };
  if (!res.ok) {
    throw new Error(body.error || `Sync inventario Hera ${res.status}`);
  }
  return body;
}
