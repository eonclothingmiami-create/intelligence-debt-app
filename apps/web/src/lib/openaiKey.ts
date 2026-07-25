const STORAGE_KEY = 'fie_openai_api_key';

/** User-supplied OpenAI key — stays in the browser; sent only to our backend per request. */
export function getStoredOpenAiKey(): string {
  if (typeof window === 'undefined') return '';
  try {
    return sessionStorage.getItem(STORAGE_KEY)?.trim() || '';
  } catch {
    return '';
  }
}

export function setStoredOpenAiKey(key: string): void {
  if (typeof window === 'undefined') return;
  const v = key.trim();
  if (!v) {
    sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(STORAGE_KEY, v);
}

export function clearStoredOpenAiKey(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(STORAGE_KEY);
}

export function maskOpenAiKey(key: string): string {
  const k = key.trim();
  if (k.length < 12) return k ? '••••••••' : '';
  return `${k.slice(0, 7)}…${k.slice(-4)}`;
}
