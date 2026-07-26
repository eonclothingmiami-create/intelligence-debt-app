'use client';

import { useEffect } from 'react';

function basePath(): string {
  return (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
}

/**
 * Registers the PWA service worker only in production.
 * Auto-reload on controllerchange caused full-page flicker loops in some deploys.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    const base = basePath();
    void navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` }).catch(() => {
      // PWA install may still work via manifest on supported browsers.
    });
  }, []);
  return null;
}
