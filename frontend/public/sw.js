// AgriShield Service Worker — Cache Buster & Network Direct v3.2
const CACHE_NAME = 'agrishield-v3.2-nobache';

// Immediately take control
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Clean up ALL previous caches and unregister to prevent stale assets
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(names.map((name) => caches.delete(name)));
    }).then(() => self.clients.claim())
  );
});

// Pass all requests straight to the network without stale caching in local network / dev mode
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request, { cache: 'no-store' }).catch(() => {
      return caches.match(event.request);
    })
  );
});
