import type { ErpProviderId } from '../events/types.js';

/**
 * Persisted sync checkpoint per provider + stream.
 * Stored by Financial OS (own DB) — never in the ERP.
 */
export type SyncCheckpoint = {
  providerId: ErpProviderId;
  stream: SyncStream;
  cursor: string | null;
  updatedAt: string;
};

export type SyncStream =
  'sales' | 'payments' | 'expenses' | 'inventory_purchases' | 'inventory_adjustments';

export interface SyncCheckpointStore {
  get(providerId: ErpProviderId, stream: SyncStream): Promise<SyncCheckpoint | null>;
  save(checkpoint: SyncCheckpoint): Promise<void>;
}

/** In-memory store for tests / local bootstrap. */
export class InMemorySyncCheckpointStore implements SyncCheckpointStore {
  private readonly map = new Map<string, SyncCheckpoint>();

  private key(providerId: string, stream: SyncStream): string {
    return `${providerId}::${stream}`;
  }

  async get(providerId: ErpProviderId, stream: SyncStream): Promise<SyncCheckpoint | null> {
    return this.map.get(this.key(providerId, stream)) ?? null;
  }

  async save(checkpoint: SyncCheckpoint): Promise<void> {
    this.map.set(this.key(checkpoint.providerId, checkpoint.stream), checkpoint);
  }
}
