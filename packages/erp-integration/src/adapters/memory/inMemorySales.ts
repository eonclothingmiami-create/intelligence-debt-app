import type { SalesProvider, SyncQuery, ProviderPage, SaleDto } from '../../ports/providers.js';
import { HERAS_PROVIDER_ID } from '../hera/pushIngress.js';

/**
 * Deterministic in-memory sales provider for demos/tests.
 * Simulates Hera API pages — NOT a database connection.
 */
export class InMemorySalesProvider implements SalesProvider {
  readonly providerId = HERAS_PROVIDER_ID;

  constructor(private readonly all: SaleDto[]) {}

  async listSales(query: SyncQuery): Promise<ProviderPage<SaleDto>> {
    const start =
      query.sinceCursor == null ? 0 : this.all.findIndex((s) => s.cursor === query.sinceCursor) + 1;
    const slice = this.all.slice(Math.max(0, start), Math.max(0, start) + query.limit);
    const last = slice[slice.length - 1];
    const exhausted = start + query.limit >= this.all.length;
    return {
      items: slice,
      nextCursor: exhausted || !last ? null : last.cursor,
    };
  }
}
