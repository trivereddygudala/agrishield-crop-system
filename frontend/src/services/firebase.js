/**
 * Firebase Client SDK Initialization for AgriShield AI
 * Configured with Firebase Spark Plan (Project ID: agrishield-ai-498f3)
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAnalytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getMessaging, getToken, onMessage, isSupported as isMessagingSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyA-rrSVRkS_CYn2Ae5_uYBYBDGkhJvy2hY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "agrishield-ai-498f3.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "agrishield-ai-498f3",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "agrishield-ai-498f3.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "989671082335",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:989671082335:web:4f68a439d3804c96f60eea",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-50LZ1MEJLM"
};

// Singleton App Instance
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Firebase Authentication
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Safe Analytics Initialization (avoids crashes in unsupported environments or strict ad-blockers)
export let analytics = null;
if (typeof window !== 'undefined') {
  isAnalyticsSupported().then((supported) => {
    if (supported) {
      try {
        analytics = getAnalytics(app);
      } catch (err) {
        console.warn('Firebase Analytics initialization notice:', err);
      }
    }
  }).catch(() => {});
}

/**
 * 1-Tap Google Sign-In helper
 */
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    return {
      success: true,
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        idToken: await user.getIdToken()
      }
    };
  } catch (error) {
    console.error('Firebase Google Sign-In error:', error);
    return {
      success: false,
      error: error.message,
      code: error.code
    };
  }
};

/**
 * Firebase Sign-Out helper
 */
export const logOutFirebase = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    console.error('Firebase Sign-Out error:', error);
    return { success: false, error: error.message };
  }
};

// ── Firebase Cloud Messaging (FCM) Push Notifications ──
export let messaging = null;

export const initMessaging = async () => {
  if (typeof window === 'undefined' || !('Notification' in window)) return null;
  try {
    const supported = await isMessagingSupported();
    if (supported) {
      messaging = getMessaging(app);
      return messaging;
    }
  } catch (err) {
    console.debug('FCM Messaging is not supported in this browser context:', err);
  }
  return null;
};

/**
 * Ensure the Firebase Cloud Messaging Service Worker is registered and fully active
 */
export const ensureActiveServiceWorker = async () => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });

    // If active worker already running in activated state
    if (reg.active && reg.active.state === 'activated') {
      return reg;
    }

    // If worker is still installing or waiting, wait for transition to activated
    const targetWorker = reg.installing || reg.waiting || reg.active;
    if (targetWorker && targetWorker.state !== 'activated') {
      await new Promise((resolve) => {
        const stateHandler = () => {
          if (targetWorker.state === 'activated' || (reg.active && reg.active.state === 'activated')) {
            targetWorker.removeEventListener('statechange', stateHandler);
            resolve();
          }
        };
        targetWorker.addEventListener('statechange', stateHandler);
        setTimeout(resolve, 2000); // 2s fallback so execution never blocks
      });
    }

    return await navigator.serviceWorker.ready;
  } catch (err) {
    console.warn('[FCM] Service worker registration error:', err);
    return null;
  }
};

/**
 * Request notification permission and retrieve FCM device token with auto-retry
 */
export const requestFCMToken = async (vapidKey = '') => {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return { success: false, reason: 'Notifications are not supported on this browser.' };
    }

    let permission = Notification.permission;
    if (permission !== 'granted') {
      permission = await Notification.requestPermission();
    }
    if (permission !== 'granted') {
      return { success: false, reason: 'Permission denied. Please allow notifications in your browser address bar.' };
    }

    // Step 1: Ensure active, non-null Service Worker
    let swReg = await ensureActiveServiceWorker();
    if (!swReg && 'serviceWorker' in navigator) {
      swReg = await navigator.serviceWorker.ready;
    }

    // Step 2: Ensure Firebase Messaging instance is initialized
    const msgInstance = messaging || (await initMessaging());
    if (!msgInstance) {
      return { success: false, reason: 'Firebase Messaging is not supported in this browser context.' };
    }

    // Determine VAPID Web Push Key
    const key = vapidKey || 
      (typeof window !== 'undefined' ? localStorage.getItem('agrishield_vapid_key') : '') || 
      import.meta.env.VITE_FIREBASE_VAPID_KEY || 
      '';

    const options = {};
    if (swReg) options.serviceWorkerRegistration = swReg;
    if (key) options.vapidKey = key;

    // Step 3: Resilient Token Retrieval with Automatic Retry on Worker Activation Race
    let token = null;
    let lastError = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        token = await getToken(msgInstance, options);
        if (token) break;
      } catch (tokenErr) {
        lastError = tokenErr;
        const msg = String(tokenErr?.message || tokenErr);
        console.warn(`[FCM] Token generation attempt ${attempt} notice:`, msg);

        // If worker is still activating or transitioning, wait 900ms and re-fetch active registration
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 900));
          try {
            const refreshedReg = await navigator.serviceWorker.ready;
            if (refreshedReg) options.serviceWorkerRegistration = refreshedReg;
          } catch (_) {}
        }
      }
    }

    if (token) {
      try {
        localStorage.setItem('agrishield_fcm_token', token);
      } catch (_) {}
      return { success: true, token, swReg };
    }

    return {
      success: false,
      token: null,
      swReg,
      error: lastError ? (lastError.message || String(lastError)) : 'Could not generate FCM device token'
    };
  } catch (error) {
    console.error('Error in requestFCMToken:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Listen for foreground push messages
 */
export const onForegroundMessage = (callback) => {
  if (!messaging) return () => {};
  try {
    return onMessage(messaging, callback);
  } catch (err) {
    console.debug('Foreground messaging listener error:', err);
    return () => {};
  }
};

// Automatic foreground push notification presenter with deduplication
let lastForegroundKey = '';
let lastForegroundTime = 0;

if (typeof window !== 'undefined') {
  initMessaging().then((msg) => {
    if (msg) {
      try {
        onMessage(msg, async (payload) => {
          console.log('[firebase.js] Foreground Push Received:', payload);
          const title = payload.notification?.title || payload.data?.title || '🌾 AgriShield Farm Alert';
          const body = payload.notification?.body || payload.data?.body || 'New crop health or weather update.';
          const dedupeKey = (payload.fcmMessageId || '') + '::' + title + '::' + body;
          const now = Date.now();

          // Deduplicate if fired within 3.5 seconds
          if (dedupeKey === lastForegroundKey && (now - lastForegroundTime < 3500)) {
            console.log('[firebase.js] Dropped duplicate foreground push:', dedupeKey);
            return;
          }
          lastForegroundKey = dedupeKey;
          lastForegroundTime = now;

          if ('Notification' in window && Notification.permission === 'granted') {
            // 1. Try ServiceWorker showNotification first (mandatory for Android mobile Chrome & PWAs)
            try {
              if ('serviceWorker' in navigator) {
                const reg = await navigator.serviceWorker.ready;
                if (reg && reg.showNotification) {
                  await reg.showNotification(title, {
                    body,
                    icon: '/icon-192.png',
                    badge: '/icon-192.png',
                    vibrate: [200, 100, 200],
                    tag: 'agrishield-alert',
                    renotify: false
                  });
                  return;
                }
              }
            } catch (swErr) {
              console.warn('[firebase.js] ServiceWorker showNotification notice:', swErr);
            }

            // 2. Fallback to desktop window Notification constructor
            try {
              new Notification(title, {
                body,
                icon: '/icon-192.png',
                badge: '/icon-192.png',
                tag: 'agrishield-alert'
              });
            } catch (_) {}
          }
        });
      } catch (_) {}
    }
  }).catch(() => {});
}

export default app;

