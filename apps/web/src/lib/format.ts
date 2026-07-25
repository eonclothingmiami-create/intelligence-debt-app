export function formatCop(value: string | null | undefined): string {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatNumber(value: string | null | undefined, digits = 2): string {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(n);
}

export function formatPct(rate: string | null | undefined): string {
  if (rate == null || rate === '') return '—';
  const n = Number(rate);
  if (!Number.isFinite(n)) return rate;
  return `${(n * 100).toFixed(1)}%`;
}
