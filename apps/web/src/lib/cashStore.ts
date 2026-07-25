import {
  WORKSPACE_CONFIRMED_CASH_SNAPSHOT,
  type WorkspaceCashSnapshot,
} from '@/lib/workspaceProfile';

/** Bumped when owner confirms payroll/CC linkage. */
const STORAGE_KEY = 'fie.os.cashSnapshot.v2';

export function emptyCashSnapshot(): WorkspaceCashSnapshot {
  return {
    cashOnHand: '',
    recompraShareOfCash: '',
    commitments: {},
    updatedAt: undefined,
  };
}

export function loadCashSnapshot(): WorkspaceCashSnapshot {
  if (typeof window === 'undefined') return emptyCashSnapshot();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return saveCashSnapshot(WORKSPACE_CONFIRMED_CASH_SNAPSHOT);
    }
    const parsed = JSON.parse(raw) as Partial<WorkspaceCashSnapshot>;
    return {
      cashOnHand: String(parsed.cashOnHand ?? ''),
      recompraShareOfCash: String(parsed.recompraShareOfCash ?? ''),
      commitments: {
        payroll: parsed.commitments?.payroll,
        creditCardInstallment: parsed.commitments?.creditCardInstallment,
        otherForced: parsed.commitments?.otherForced,
        notes: parsed.commitments?.notes,
      },
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return emptyCashSnapshot();
  }
}

export function saveCashSnapshot(snapshot: WorkspaceCashSnapshot): WorkspaceCashSnapshot {
  const next: WorkspaceCashSnapshot = {
    ...snapshot,
    cashOnHand: snapshot.cashOnHand.trim(),
    recompraShareOfCash: snapshot.recompraShareOfCash.trim(),
    updatedAt: new Date().toISOString(),
  };
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}
