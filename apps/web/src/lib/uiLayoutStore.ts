/**
 * Persisted UI layout preferences (accordion open/closed).
 * Keyed by stable section ids — never invents business data.
 */

const STORAGE_KEY = 'fie.os.uiLayout.v1';

export type UiLayoutWorkspace = {
  /** sectionId → open */
  accordions: Record<string, boolean>;
  /** Last OS tab (optional). */
  lastTab?: string;
  updatedAt?: string;
};

export function emptyUiLayout(): UiLayoutWorkspace {
  return { accordions: {}, updatedAt: undefined };
}

export function loadUiLayout(): UiLayoutWorkspace {
  if (typeof window === 'undefined') return emptyUiLayout();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyUiLayout();
    const parsed = JSON.parse(raw) as Partial<UiLayoutWorkspace>;
    return {
      accordions:
        parsed.accordions && typeof parsed.accordions === 'object' ? { ...parsed.accordions } : {},
      lastTab: typeof parsed.lastTab === 'string' ? parsed.lastTab : undefined,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : undefined,
    };
  } catch {
    return emptyUiLayout();
  }
}

export function saveUiLayout(ws: UiLayoutWorkspace): UiLayoutWorkspace {
  const next: UiLayoutWorkspace = {
    accordions: { ...ws.accordions },
    ...(ws.lastTab ? { lastTab: ws.lastTab } : {}),
    updatedAt: new Date().toISOString(),
  };
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

export function isAccordionOpen(
  sectionId: string,
  defaultOpen: boolean,
  layout?: UiLayoutWorkspace,
): boolean {
  const ws = layout ?? loadUiLayout();
  if (Object.prototype.hasOwnProperty.call(ws.accordions, sectionId)) {
    return Boolean(ws.accordions[sectionId]);
  }
  return defaultOpen;
}

export function setAccordionOpen(sectionId: string, open: boolean): UiLayoutWorkspace {
  const ws = loadUiLayout();
  return saveUiLayout({
    ...ws,
    accordions: { ...ws.accordions, [sectionId]: open },
  });
}

export function persistLastTab(tab: string): void {
  const ws = loadUiLayout();
  saveUiLayout({ ...ws, lastTab: tab });
}

export function loadLastTab(allowed: string[], fallback: string): string {
  const ws = loadUiLayout();
  if (ws.lastTab && allowed.includes(ws.lastTab)) return ws.lastTab;
  return fallback;
}
