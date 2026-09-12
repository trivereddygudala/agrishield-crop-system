/**
 * keepAlive.js
 * 
 * Prevents Render Free Tier cold starts (20-30s delays) by silently pinging
 * the backend /health endpoint every 10 minutes while the app is open.
 * 
 * Render spins down free-tier services after ~15 minutes of inactivity.
 * This service keeps the instance warm so every scan/API call is instant.
 */

const PING_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const HEALTH_ENDPOINT = '/health';

let intervalId = null;
let isRunning = false;

/**
 * Silently ping the backend health endpoint.
 * Uses fetch (not axios) so it never triggers auth interceptors or error toasts.
 */
async function pingBackend() {
  try {
    const baseUrl = import.meta.env.VITE_API_URL
      ? import.meta.env.VITE_API_URL.replace(/\/+$/, '')
      : '';

    const res = await fetch(`${baseUrl}${HEALTH_ENDPOINT}`, {
      method: 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(8000), // 8s timeout – avoid hanging
    });

    if (import.meta.env.DEV) {
      console.debug(`[KeepAlive] ✅ Backend is warm — status: ${res.status}`);
    }
  } catch {
    // Silently ignore – user is likely offline or backend is starting up
    if (import.meta.env.DEV) {
      console.debug('[KeepAlive] ⚠️ Ping failed (backend may be waking up)');
    }
  }
}

/**
 * Start the keep-alive heartbeat.
 * - Fires an immediate ping on first call to warm up after a page load
 * - Then repeats every PING_INTERVAL_MS
 * - Safe to call multiple times (idempotent)
 */
export function startKeepAlive() {
  if (isRunning) return;
  isRunning = true;

  // Warm up immediately when the app loads
  pingBackend();

  // Then keep pinging on interval
  intervalId = setInterval(pingBackend, PING_INTERVAL_MS);

  if (import.meta.env.DEV) {
    console.debug(`[KeepAlive] 🚀 Started — pinging every ${PING_INTERVAL_MS / 60000} minutes`);
  }
}

/**
 * Stop the keep-alive heartbeat (e.g. on logout or unmount).
 */
export function stopKeepAlive() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  isRunning = false;
}
