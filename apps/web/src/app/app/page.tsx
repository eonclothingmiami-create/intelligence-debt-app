import Link from 'next/link';
import { OsShell } from '@/components/os/OsShell';

export default function AppPage() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-paper/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6">
          <Link href="/" className="brand-mark text-2xl text-forest">
            FIE
          </Link>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
            Operating System
          </p>
        </div>
      </header>
      <OsShell />
    </div>
  );
}
