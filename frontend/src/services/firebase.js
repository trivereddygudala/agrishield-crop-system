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
 * Request notification permission and retrieve FCM device token
 */
export const requestFCMToken = async (vapidKey = '') => {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return { success: false, reason: 'Notifications not supported on this browser' };
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, reason: 'Permission denied by user. Please allow notifications in your browser address bar.' };
    }

    // Register and wait for active service worker
    let swReg = null;
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        swReg = await navigator.serviceWorker.ready;
      } catch (swErr) {
        console.warn('Service worker registration error:', swErr);
      }
    }

    const msgInstance = messaging || (await initMessaging());
    if (!msgInstance) {
      return { success: true, token: null, swReg };
    }

    const options = {};
    if (swReg) options.serviceWorkerRegistration = swReg;
    if (vapidKey) options.vapidKey = vapidKey;

    try {
      const token = await getToken(msgInstance, options);
      if (token) {
        localStorage.setItem('agrishield_fcm_token', token);
        return { success: true, token, swReg };
      }
    } catch (tokenErr) {
      console.warn('FCM token generation notice:', tokenErr);
      return { success: true, token: null, swReg, notice: tokenErr.message };
    }

    return { success: true, token: null, swReg };
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

// Automatic foreground push notification presenter
if (typeof window !== 'undefined') {
  initMessaging().then((msg) => {
    if (msg) {
      try {
        onMessage(msg, async (payload) => {
          console.log('[firebase.js] Foreground Push Received:', payload);
          const title = payload.notification?.title || payload.data?.title || '🌾 AgriShield Farm Alert';
          const body = payload.notification?.body || payload.data?.body || 'New crop health or weather update.';

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
                    tag: 'agrishield-foreground',
                    renotify: true
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
                badge: '/icon-192.png'
              });
            } catch (_) {}
          }
        });
      } catch (_) {}
    }
  }).catch(() => {});
}

export default app;

