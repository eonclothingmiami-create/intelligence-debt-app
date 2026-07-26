'use client';

import { useState, type ReactNode } from 'react';
import { isAccordionOpen, setAccordionOpen } from '@/lib/uiLayoutStore';

type Props = {
  /** Stable id for localStorage persistence. */
  id: string;
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
};

/** Collapsible module section — open state persists across reloads. */
export function SectionAccordion({
  id,
  title,
  hint,
  defaultOpen = false,
  children,
  className = '',
}: Props) {
  const [open, setOpen] = useState(() => isAccordionOpen(id, defaultOpen));

  function toggle() {
    const next = !open;
    setOpen(next);
    setAccordionOpen(id, next);
  }

  return (
    <section className={`panel overflow-hidden rounded-2xl ${className}`}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left md:px-5 md:py-4"
      >
        <span>
          <span className="block text-sm font-semibold text-forest md:text-base">{title}</span>
          {hint ? <span className="mt-0.5 block text-xs text-muted">{hint}</span> : null}
        </span>
        <span
          className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--line)] text-sm text-muted transition-transform ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden
        >
          ▾
        </span>
      </button>
      {open ? (
        <div className="border-t border-[var(--line)] px-4 py-4 md:px-5 md:py-5">{children}</div>
      ) : null}
    </section>
  );
}
