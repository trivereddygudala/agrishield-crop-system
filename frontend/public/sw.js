// AgriShield Service Worker — Zero-Internet PWA & Offline Engine v3.5
const CACHE_NAME = 'agrishield-v3.5-pwa-offline';
const OFFLINE_URL = '/offline.html';

const PRECACHE_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Precache essential assets on install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Clean up old caches on activation
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Network-First with graceful Offline Fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Handle page navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(request);
        if (cachedResponse) return cachedResponse;
        return cache.match(OFFLINE_URL);
      })
    );
    return;
  }

  // Handle static assets & API calls
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        // Cache successful GET requests for CSS, JS, and Images
        if (
          request.method === 'GET' &&
          networkResponse &&
          networkResponse.status === 200 &&
          (request.url.includes('/assets/') || request.destination === 'style' || request.destination === 'script' || request.destination === 'image')
        ) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.destination === 'document') {
          return caches.match(OFFLINE_URL);
        }
        return new Response('Network unavailable', { status: 503, statusText: 'Service Unavailable' });
      })
  );
});
