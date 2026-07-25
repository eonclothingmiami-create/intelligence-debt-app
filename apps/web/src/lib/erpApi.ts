import type { SalesDashboardSnapshot } from '@fie/erp-integration';

const DEFAULT_API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type HeraSaleSimInput = {
  orderId: string;
  netAmount: string;
  itemCount?: string;
  occurredAt?: string;
};

export async function fetchSalesDashboard(apiBase = DEFAULT_API): Promise<SalesDashboardSnapshot> {
  const res = await fetch(`${apiBase.replace(/\/$/, '')}/v1/projections/sales`);
  if (!res.ok) throw new Error(`API ventas ${res.status}`);
  return (await res.json()) as SalesDashboardSnapshot;
}

/** Simulate Hera push (dev/demo). Production: Hera POSTs directly to the API. */
export async function postHeraSale(
  input: HeraSaleSimInput,
  apiBase = DEFAULT_API,
): Promise<SalesDashboardSnapshot> {
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const res = await fetch(`${apiBase.replace(/\/$/, '')}/integrations/hera/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
    const res = await fetch(`${apiBase.replace(/\/$/, '')}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
