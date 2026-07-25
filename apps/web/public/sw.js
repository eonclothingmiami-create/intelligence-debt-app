/* global self, caches, fetch */
/* PWA shell — network-first for app shell so GitHub Pages deploys are not stuck on old UI. */
const CACHE = 'fie-os-v3';
const SCOPE = self.registration.scope.replace(/\/$/, '');
const PRECACHE = [
  `${SCOPE}/manifest.webmanifest`,
  `${SCOPE}/icons/icon-192.png`,
  `${SCOPE}/icons/icon-512.png`,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isCacheableGet(request) {
  if (request.method !== 'GET') return false;
  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  // Never cache API / supabase / localhost
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return false;
  if (url.hostname.includes('supabase.co')) return false;
  return true;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (!isCacheableGet(request)) return;

  const url = new URL(request.url);
  const isAppShell =
    request.mode === 'navigate' ||
    url.pathname.endsWith('.html') ||
    url.pathname.includes('/_next/') ||
    url.pathname.endsWith('/app/') ||
    url.pathname.endsWith('/app');

  // Network-first for JS/HTML so new deploys win over stale cache
  if (isAppShell) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const fetched = fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => cached);
      return cached || fetched;
    }),
  );
});
