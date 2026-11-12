/**
 * AgriShield Universal Device Notification Presenter
 * Dispatches real operating system notifications to the Mobile Notification Tray / Desktop Notification Center.
 */

let lastDispatchedTag = '';
let lastDispatchedTime = 0;

export const popDeviceNotification = async (title, body, tag = 'agrishield-alert', url = '/notifications') => {
  if (typeof window === 'undefined') return false;

  // Verify permission
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return false;
  }

  // Deduplicate rapid repeat calls within 3 seconds
  const now = Date.now();
  const alertKey = `${tag}::${title}::${body}`;
  if (alertKey === lastDispatchedTag && (now - lastDispatchedTime < 3000)) {
    return false;
  }
  lastDispatchedTag = alertKey;
  lastDispatchedTime = now;

  const cleanTitle = title || '🌾 AgriShield Alert';
  const cleanBody = body || 'Important crop health or weather update.';

  // 1. Primary: Service Worker showNotification (Mandatory for Android Chrome & mobile PWAs)
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(cleanTitle, {
          body: cleanBody,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          vibrate: [250, 100, 250],
          tag: tag ? `${tag}-${Date.now()}` : `agrishield-${Date.now()}`,
          renotify: true,
          requireInteraction: true,
          data: { url: url || '/notifications' }
        });
        return true;
      }
    } catch (swErr) {
      console.debug('[deviceNotification] ServiceWorker display fallback:', swErr);
    }
  }

  // 2. Fallback: Window Notification constructor (Desktop browsers)
  try {
    new Notification(cleanTitle, {
      body: cleanBody,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: tag || 'agrishield-alert'
    });
    return true;
  } catch (_) {
    return false;
  }
};

