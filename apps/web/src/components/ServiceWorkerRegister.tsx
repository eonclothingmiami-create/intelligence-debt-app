'use client';

import { useEffect } from 'react';

function basePath(): string {
  return (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
}

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    const base = basePath();

    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    void navigator.serviceWorker
      .register(`${base}/sw.js`, { scope: `${base}/` })
      .then((reg) => {
        void reg.update();
      })
      .catch(() => {
        // PWA install may still work via manifest on supported browsers.
      });

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);
  return null;
}
