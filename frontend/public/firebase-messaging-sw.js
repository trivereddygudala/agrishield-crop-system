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

// Strict Deduplication Cache — Prevents duplicate notification fires within 3.5 seconds
let lastMessageKey = '';
let lastMessageTime = 0;

function displayPushNotification(payload) {
  const title = payload.notification?.title || payload.data?.title || payload.title || '🌾 AgriShield Farm Alert';
  const body = payload.notification?.body || payload.data?.body || payload.body || 'Important crop diagnostics or weather advisory update.';
  const messageKey = (payload.fcmMessageId || '') + '::' + title + '::' + body;
  const now = Date.now();

  if (messageKey === lastMessageKey && (now - lastMessageTime < 3500)) {
    console.log('[firebase-messaging-sw.js] Dropped duplicate push event:', messageKey);
    return Promise.resolve();
  }
  lastMessageKey = messageKey;
  lastMessageTime = now;

  const alertTag = payload.data?.notification_id || payload.notification?.tag || ('agrishield-' + now);

  const options = {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [250, 100, 250],
    requireInteraction: true,
    tag: alertTag,
    renotify: true,
    data: {
      url: payload.data?.url || '/notifications'
    }
  };
  return self.registration.showNotification(title, options);
}

// Single Unified Firebase background listener (Eliminates parallel duplicate notifications)
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] onBackgroundMessage:', payload);
  return displayPushNotification(payload);
});

// Notification click handler — Focus existing window or open /notifications
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
