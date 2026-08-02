// QuickQuote Pro Service Worker
// Caches the static app shell so the tool still opens when offline.
// Uses network-first for pages so edits/deploys are never masked by a stale cache.

const CACHE_NAME = 'quickquote-pro-v1';
const APP_SHELL = [
  './assets/css/style.css',
  './assets/js/app.js',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Network-first for HTML pages: always try to get the latest version first
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Cache-first for static assets (CSS/JS/manifest)
  if (APP_SHELL.some((path) => request.url.includes(path.replace('./', '')))) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
  }
});
