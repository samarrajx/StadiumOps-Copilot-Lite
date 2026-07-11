/**
 * @file sw.js
 * Minimal Service Worker for StadiumOps Copilot
 * Cache-first for app shell assets, Network-first for /api/ routes.
 */

const CACHE_NAME = 'stadiumops-shell-v3';
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/css/index.css',
  '/js/app.js',
  '/js/api.js',
  '/js/liveSignals.js',
  '/js/state.js',
  '/js/utils/dom.js',
  '/js/utils/formatters.js',
  '/js/utils/validators.js',
  '/js/panels/gateGrid.js',
  '/js/panels/briefing.js',
  '/js/panels/assistant.js',
  '/js/panels/broadcast.js',
  '/js/panels/accessibility.js',
  '/icons/icon-192x192.svg',
  '/icons/icon-512x512.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(SHELL_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Network-first for API requests (never serve stale live data, though it might fail if offline)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch((err) => {
        // Fallback if offline.
        throw err;
      })
    );
    return;
  }

  // Cache-first for app shell and static assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      
      return fetch(event.request).then((networkResponse) => {
        // Optionally cache new dynamic assets here if needed
        return networkResponse;
      });
    })
  );
});
