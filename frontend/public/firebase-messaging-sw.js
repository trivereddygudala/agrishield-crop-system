// Firebase Cloud Messaging Service Worker for AgriShield AI
// Handles background push notifications when website is closed or in background

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyA-rrSVRkS_CYn2Ae5_uYBYBDGkhJvy2hY",
  authDomain: "agrishield-ai-498f3.firebaseapp.com",
  projectId: "agrishield-ai-498f3",
  storageBucket: "agrishield-ai-498f3.firebasestorage.app",
  messagingSenderId: "989671082335",
  appId: "1:989671082335:web:4f68a439d3804c96f60eea",
  measurementId: "G-50LZ1MEJLM"
});

// Immediately claim clients and skip waiting on update
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

const messaging = firebase.messaging();

function displayPushNotification(payload) {
  const title = payload.notification?.title || payload.data?.title || payload.title || '🌾 AgriShield Farm Alert';
  const body = payload.notification?.body || payload.data?.body || payload.body || 'Important crop diagnostics or weather advisory update.';
  const options = {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    requireInteraction: true,
    tag: payload.data?.tag || payload.notification?.tag || 'agrishield-alert',
    renotify: true,
    data: {
      url: payload.data?.url || '/notifications'
    }
  };
  return self.registration.showNotification(title, options);
}

// 1. Firebase background listener
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] onBackgroundMessage:', payload);
  return displayPushNotification(payload);
});

// 2. Direct Web Push Event listener (Fallback & Guarantees delivery)
self.addEventListener('push', (event) => {
  console.log('[firebase-messaging-sw.js] Native push event received');
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      payload = { title: '🌾 AgriShield Alert', body: event.data.text() };
    }
  }
  event.waitUntil(displayPushNotification(payload));
});

// 3. Notification click handler — Focus existing window or open /notifications
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/notifications';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
