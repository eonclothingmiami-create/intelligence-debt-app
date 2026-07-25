import type { LiquidityPolicy } from '@fie/shared';
import { WORKSPACE_CONFIRMED_LIQUIDITY_POLICY } from '@/lib/workspaceProfile';

/** Bumped when owner interview replaces prior ad-hoc drafts. */
const STORAGE_KEY = 'fie.os.liquidityPolicy.v2';

/** Empty shell — no invented months; user (or confirmed AI draft) must set. */
export function emptyLiquidityPolicy(): LiquidityPolicy {
  return {
    reserveMonths: '',
    minCashFloor: '',
    reserveIsHardFloor: true,
    notes: '',
    updatedAt: undefined,
  };
}

export function loadLiquidityPolicy(): LiquidityPolicy {
  if (typeof window === 'undefined') return emptyLiquidityPolicy();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // First visit: apply owner-confirmed interview seed (not a silent product default).
      return saveLiquidityPolicy(WORKSPACE_CONFIRMED_LIQUIDITY_POLICY);
    }
    const parsed = JSON.parse(raw) as Partial<LiquidityPolicy>;
    return {
      reserveMonths: String(parsed.reserveMonths ?? ''),
      minCashFloor: parsed.minCashFloor != null ? String(parsed.minCashFloor) : '',
      reserveIsHardFloor: parsed.reserveIsHardFloor === true,
      notes: parsed.notes != null ? String(parsed.notes) : '',
      updatedAt: parsed.updatedAt != null ? String(parsed.updatedAt) : undefined,
    };
  } catch {
    return emptyLiquidityPolicy();
  }
}

export function saveLiquidityPolicy(policy: LiquidityPolicy): LiquidityPolicy {
  const next: LiquidityPolicy = {
    ...policy,
    reserveMonths: policy.reserveMonths.trim(),
    minCashFloor: policy.minCashFloor?.trim() || undefined,
    notes: policy.notes?.trim() || undefined,
    updatedAt: new Date().toISOString(),
  };
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

export function isLiquidityPolicyComplete(policy: LiquidityPolicy): boolean {
  const months = Number(policy.reserveMonths);
  return Number.isFinite(months) && months >= 0 && policy.reserveMonths.trim() !== '';
}
