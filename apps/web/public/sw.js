/* global self, caches, fetch */
/* Minimal offline shell for PWA installability (works under GitHub Pages base path). */
const CACHE = 'fie-os-v1';
const SCOPE = self.registration.scope.replace(/\/$/, '');
const PRECACHE = [
  `${SCOPE}/`,
  `${SCOPE}/app/`,
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

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
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
