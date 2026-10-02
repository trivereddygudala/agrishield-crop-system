import axios from 'axios';

export const CANONICAL_MAIN_BACKEND = 'https://agrishield-crop-system.onrender.com';
export const AI_WORKER_1_URL = 'https://agrishield-ai-worker-1.onrender.com';
export const AI_WORKER_2_URL = 'https://agrishield-ai-worker-2.onrender.com';
export const AI_WORKER_3_URL = 'https://agrishield-ai-worker-3.onrender.com';

export const MAIN_RENDER_BACKEND = CANONICAL_MAIN_BACKEND;
export const PRIMARY_RENDER_BACKEND = CANONICAL_MAIN_BACKEND;
export const SECONDARY_RENDER_BACKEND = AI_WORKER_2_URL;
export const TERTIARY_RENDER_BACKEND = AI_WORKER_3_URL;
export const LEGACY_RENDER_BACKEND = CANONICAL_MAIN_BACKEND;

/**
 * Intelligent Cluster Router:
 * Dynamically partitions workloads across the Render worker cluster for direct/standalone invocations:
 *
 * 1. Worker 1 (agrishield-ai-worker-1): Primary Disease Detection & Crop Leaf Uploads (/api/upload, /api/predict).
 * 2. Worker 2 (agrishield-ai-worker-2): Botanical Species & Weed Identification (/api/identify-plant).
 * 3. Worker 3 (agrishield-ai-worker-3): Agrochemical OCR, Crop Advisor, Multilingual Translations.
 * 4. Main Node (agrishield-crop-system): Auth, Equipment Rental, Real-Time Notifications, History, DB Transactions, Admin Firmware.
 */
export const isAiWorkerRoute = (url, baseURL = '') => {
  if (baseURL && baseURL.includes('agrishield-ai-worker')) {
    return true;
  }
  if (!url) return false;
  const path = url.toLowerCase();
  return (
    path === '/api/upload' ||
    path.startsWith('/api/upload?') ||
    path.includes('/predict') ||
    path.startsWith('/uploads') ||
    path.includes('/identify-plant') ||
    path.includes('/agrochemical') ||
    path.includes('/crop-advisor') ||
    path.includes('/translate')
  );
};

export const getTargetClusterNode = (url) => {
  if (!url) return MAIN_RENDER_BACKEND;
  const path = url.toLowerCase();

  // AI Worker 1: Disease Diagnosis & Uploads
  if (path === '/api/upload' || path.startsWith('/api/upload?') || path.includes('/predict') || path.startsWith('/uploads')) {
    return AI_WORKER_1_URL;
  }

  // AI Worker 2: Botanical Plant & Weed Identification
  if (path.includes('/identify-plant')) {
    return AI_WORKER_2_URL;
  }

  // AI Worker 3: Agrochemical OCR, Crop Advisor, Multilingual Plant Translation
  if (path.includes('/agrochemical') || path.includes('/crop-advisor') || path.includes('/translate')) {
    return AI_WORKER_3_URL;
  }

  // Cluster Main: Equipment, Bookings, Auth, Notifications, Farms, History, IoT, Admin Firmware
  return MAIN_RENDER_BACKEND;
};

export const getFailoverTarget = (url, currentTarget) => {
  const path = (url || '').toLowerCase();

  // Botanical species & weed identification:
  // Primary: Worker 2 (agrishield-ai-worker-2).
  // First fallback: Worker 1 (hosts uploaded image locally and has plant_id.router).
  // Secondary fallback: Main Backend.
  if (path.includes('/identify-plant')) {
    if (currentTarget === AI_WORKER_2_URL) return AI_WORKER_1_URL;
    if (currentTarget === AI_WORKER_1_URL) return MAIN_RENDER_BACKEND;
    return MAIN_RENDER_BACKEND;
  }

  // Agrochemical scan OCR:
  // Primary: Worker 3 (agrishield-ai-worker-3).
  // Fallback: Worker 1 (hosts uploaded image locally and has agrochemical.router).
  if (path.includes('/agrochemical')) {
    if (currentTarget === AI_WORKER_3_URL) return AI_WORKER_1_URL;
    return MAIN_RENDER_BACKEND;
  }

  // Stateless LLM Crop Advisor & Multilingual Plant Translations:
  // Primary: Worker 3 (agrishield-ai-worker-3).
  // Fallback: Main Backend (always warm, provides resilient fallback).
  if (path.includes('/crop-advisor') || path.includes('/translate')) {
    if (currentTarget === AI_WORKER_3_URL) return MAIN_RENDER_BACKEND;
    return MAIN_RENDER_BACKEND;
  }

  return null;
};

export const getApiBaseUrl = () => {
  if (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/+$/, '');
  }
  // When running on production domains (e.g., Vercel) or development (Vite),
  // return relative URL ('') so requests pass through Vercel rewrites or Vite proxies cleanly.
  return '';
};

// Create configured Axios instance
const API = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 90000, // 90 seconds

  headers: {
    'Content-Type': 'application/json',
  }
});

// Request interceptor to add JWT authorization token dynamically & assign cluster worker
API.interceptors.request.use(
  (config) => {
    // B9.7: Generate compact client-side X-Request-ID if not already present
    if (!config.headers) {
      config.headers = {};
    }
    if (!config.headers['X-Request-ID']) {
      const randPart = Math.random().toString(36).substring(2, 10);
      config.headers['X-Request-ID'] = `req_${Date.now()}_${randPart}`;
    }

    // When sending FormData (e.g. image uploads), delete Content-Type so browser sets multipart boundary automatically
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    // When running in production on Vercel or localhost, requests use same-origin relative URLs ('')
    // so Vercel rewrites or local Vite proxies cleanly dispatch each request.
    // If the frontend is hosted standalone on an external domain without Vercel rewrites and without VITE_API_URL,
    // getTargetClusterNode acts as direct Render fallback.
    const isVercelOrLocal = typeof window !== 'undefined' && (
      window.location.hostname.includes('vercel.app') ||
      ['localhost', '127.0.0.1'].includes(window.location.hostname)
    );

    if (!isVercelOrLocal && typeof window !== 'undefined' && !config.baseURL) {
      config.baseURL = getTargetClusterNode(config.url);
    }

    const storage = sessionStorage.getItem('token') ? sessionStorage : localStorage;
    const token = storage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Anti-cache protection for multi-device real-time consistency (prevent stale mobile browser caches)
    if (config.method === 'get') {
      config.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
      config.headers['Pragma'] = 'no-cache';
      config.headers['Expires'] = '0';
      if (!config.params) {
        config.params = {};
      }
      // Only append _t if not already present
      if (!config.params._t) {
        config.params._t = Date.now();
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors globally with automated multi-host cluster failover
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest) return Promise.reject(error);

    // D-05: Never failover /predict or /upload to a different cluster node.
    // The uploaded image is physically located on the local disk of the container that processed /api/upload.
    // Failing over across nodes causes a guaranteed 404 missing-image error.
    const reqUrl = (originalRequest.url || '').toLowerCase();
    const isPredictOrUpload = reqUrl.includes('/predict') || reqUrl.includes('/upload');
    if (isPredictOrUpload) {
      return Promise.reject(error);
    }

    // Never failover transactional Main Backend routes (Auth, Bookings, Equipment, Sync, IoT) to AI workers
    // B9.3: Detect AI worker target via baseURL OR request path for Vercel relative URLs
    const isAiNodeTarget = isAiWorkerRoute(originalRequest.url, originalRequest.baseURL);
    if (!isAiNodeTarget) {
      return Promise.reject(error);
    }

    // Automated Cluster Failover for eligible transient infrastructure failures (502, 503, 504, network errors)
    const status = error.response ? error.response.status : null;
    const isTransientStatus = Boolean(status && [502, 503, 504].includes(status));
    const isNetworkError =
      error.code === 'ERR_NETWORK' ||
      error.code === 'ECONNABORTED' ||
      Boolean(error.message && error.message.toLowerCase().includes('timeout'));

    const shouldFailover = isTransientStatus || isNetworkError;

    if (shouldFailover && !originalRequest._failoverRetry) {
      originalRequest._failoverRetry = true;
      try {
        const fallbackConfig = { ...originalRequest };
        const currentTarget = (originalRequest.baseURL && originalRequest.baseURL.includes('agrishield-ai-worker'))
          ? originalRequest.baseURL
          : getTargetClusterNode(originalRequest.url);

        const fallbackTarget = getFailoverTarget(originalRequest.url, currentTarget);
        if (fallbackTarget && fallbackTarget !== currentTarget) {
          fallbackConfig.baseURL = fallbackTarget;
          fallbackConfig._failoverRetry = true;
          // B9.3: Bounded failover timeout (15s) prevents long 90s multiplier delays during cold starts
          fallbackConfig.timeout = 15000;

          if (fallbackConfig.headers) {
            fallbackConfig.headers = { ...fallbackConfig.headers };
            const storage = sessionStorage.getItem('token') ? sessionStorage : localStorage;
            const token = storage.getItem('token');
            if (token) {
              fallbackConfig.headers.Authorization = `Bearer ${token}`;
            }
            if (fallbackConfig.data instanceof FormData) {
              delete fallbackConfig.headers['Content-Type'];
            }
          }

          return await axios(fallbackConfig);
        }
      } catch (workerErr) {
        // Fall through to regular error handling
      }
    }

    // Session expired or invalid token
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // 1. Isolate AI Worker 401s: An authentication or processing failure on a secondary AI worker
      // must NEVER destroy the user's valid primary Main-session login.
      const requestUrl = (originalRequest.url || '').toLowerCase();
      const requestBase = (originalRequest.baseURL || '').toLowerCase();
      const isAiWorkerRequest = isAiWorkerRoute(requestUrl, requestBase);

      if (isAiWorkerRequest) {
        // Return rejection directly to the calling component without evicting the session or redirecting to /login
        return Promise.reject(error);
      }

      // 2. Genuine Main Backend 401: Handle token refresh and session expiration
      const rt = localStorage.getItem('refresh_token') || sessionStorage.getItem('refresh_token');
      if (rt) {
        try {
          // Send refresh_token as FastAPI query parameter to MAIN_RENDER_BACKEND
          const res = await axios.post(
            '/api/auth/refresh',
            null,
            {
              params: { refresh_token: rt },
              baseURL: MAIN_RENDER_BACKEND
            }
          );
          const { access_token, refresh_token } = res.data;
          
          const storage = sessionStorage.getItem('token') ? sessionStorage : localStorage;
          storage.setItem('token', access_token);
          if (refresh_token) storage.setItem('refresh_token', refresh_token);
          
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return API(originalRequest);
        } catch (refreshError) {
          // Fall through to clear storage
        }
      }
      
      // Clear storage
      localStorage.removeItem('token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('refresh_token');
      sessionStorage.removeItem('user');
      
      // We can trigger a window redirect or let the context handle state cleanup
      if (window.location.pathname !== '/' && window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login?expired=true';
      }
    }
    return Promise.reject(error);
  }
);

export default API;
