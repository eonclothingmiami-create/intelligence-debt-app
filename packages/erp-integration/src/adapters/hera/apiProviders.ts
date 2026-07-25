import type {
  ExpenseDto,
  ExpenseProvider,
  InventoryAdjustmentDto,
  InventoryProvider,
  InventoryPurchaseDto,
  PaymentDto,
  PaymentProvider,
  ProviderPage,
  SaleDto,
  SalesProvider,
  SyncQuery,
} from '../../ports/providers.js';
import { HERAS_PROVIDER_ID } from './pushIngress.js';

/**
 * HTTP API client for Ventas Hera — pull path for bootstrap / catch-up.
 *
 * FORBIDDEN: direct SQL, Prisma models of Hera, shared DB credentials.
 * REQUIRED: Hera public/private HTTP API with cursor pagination.
 *
 * Methods throw until `baseUrl` + fetch are configured — intentional fail-fast.
 */
export type VentasHeraClientConfig = {
  baseUrl: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
};

async function getJson<T>(
  config: VentasHeraClientConfig,
  path: string,
  query: Record<string, string | null>,
): Promise<T> {
  const url = new URL(path, config.baseUrl.replace(/\/$/, '') + '/');
  for (const [k, v] of Object.entries(query)) {
    if (v != null && v !== '') url.searchParams.set(k, v);
  }
  const fetchFn = config.fetchImpl ?? fetch;
  const res = await fetchFn(url, {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`Ventas Hera API ${res.status} on ${url.pathname}`);
  }
  return (await res.json()) as T;
}

type HeraListResponse<T> = { items: T[]; nextCursor: string | null };

export class VentasHeraSalesProvider implements SalesProvider {
  readonly providerId = HERAS_PROVIDER_ID;
  constructor(private readonly config: VentasHeraClientConfig) {}

  async listSales(query: SyncQuery): Promise<ProviderPage<SaleDto>> {
    const body = await getJson<HeraListResponse<SaleDto>>(this.config, 'v1/sales', {
      since: query.sinceCursor,
      limit: String(query.limit),
    });
    return { items: body.items, nextCursor: body.nextCursor };
  }
}

export class VentasHeraPaymentProvider implements PaymentProvider {
  readonly providerId = HERAS_PROVIDER_ID;
  constructor(private readonly config: VentasHeraClientConfig) {}

  async listPayments(query: SyncQuery): Promise<ProviderPage<PaymentDto>> {
    const body = await getJson<HeraListResponse<PaymentDto>>(this.config, 'v1/payments', {
      since: query.sinceCursor,
      limit: String(query.limit),
    });
    return { items: body.items, nextCursor: body.nextCursor };
  }
}

export class VentasHeraExpenseProvider implements ExpenseProvider {
  readonly providerId = HERAS_PROVIDER_ID;
  constructor(private readonly config: VentasHeraClientConfig) {}

  async listExpenses(query: SyncQuery): Promise<ProviderPage<ExpenseDto>> {
    const body = await getJson<HeraListResponse<ExpenseDto>>(this.config, 'v1/expenses', {
      since: query.sinceCursor,
      limit: String(query.limit),
    });
    return { items: body.items, nextCursor: body.nextCursor };
  }
}

export class VentasHeraInventoryProvider implements InventoryProvider {
  readonly providerId = HERAS_PROVIDER_ID;
  constructor(private readonly config: VentasHeraClientConfig) {}

  async listPurchases(query: SyncQuery): Promise<ProviderPage<InventoryPurchaseDto>> {
    const body = await getJson<HeraListResponse<InventoryPurchaseDto>>(
      this.config,
      'v1/inventory/purchases',
      { since: query.sinceCursor, limit: String(query.limit) },
    );
    return { items: body.items, nextCursor: body.nextCursor };
  }

  async listAdjustments(query: SyncQuery): Promise<ProviderPage<InventoryAdjustmentDto>> {
    const body = await getJson<HeraListResponse<InventoryAdjustmentDto>>(
      this.config,
      'v1/inventory/adjustments',
      { since: query.sinceCursor, limit: String(query.limit) },
    );
    return { items: body.items, nextCursor: body.nextCursor };
  }
}
