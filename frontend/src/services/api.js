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
 * Dynamically partitions workloads across the Render worker cluster:
 *
 * 1. Worker 3 (agrishield-ai-worker-3): Dedicated AI node for PyTorch disease diagnosis,
 *    species plant ID, OCR agrochemical scan, translations, and leaf image uploads (/api/upload).
 * 2. Main Node (agrishield-crop-system): Auth, Equipment Rental, Real-Time Notifications, History, DB Transactions, Admin Firmware.
 * 3. Worker 1 & Worker 2: Standby secondary cluster nodes.
 */
export const getTargetClusterNode = (url) => {
  if (!url) return TERTIARY_RENDER_BACKEND;
  const path = url.toLowerCase();

  // AI Crop Scan Upload: Route /api/upload and query-param variants to Worker 3
  // Keep /api/v1/firmware/upload and all other upload paths on Main backend
  const isCropScanUpload = path === '/api/upload' || path.startsWith('/api/upload?');

  // AI Inference & Specialized Services: Route to Worker 3
  const isAiInference =
    path.includes('/predict') ||
    path.includes('/identify-plant') ||
    path.includes('/agrochemical') ||
    path.includes('/crop-advisor') ||
    path.includes('/translate');

  if (isCropScanUpload || isAiInference) {
    return TERTIARY_RENDER_BACKEND;
  }

  // Cluster Main: Equipment, Bookings, Auth, Notifications, Farms, History, IoT, Admin Firmware
  return MAIN_RENDER_BACKEND;
};

export const getApiBaseUrl = () => {
  if (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/+$/, '');
  }
  // When running on production domains (e.g., Vercel), route directly to healthy primary worker
  if (typeof window !== 'undefined' && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    return TERTIARY_RENDER_BACKEND;
  }
  return ''; // Always use local Vite proxy for localhost setup
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
    // When sending FormData (e.g. image uploads), delete Content-Type so browser sets multipart boundary automatically
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    // In production, dynamically route request to the designated cluster node
    if (typeof window !== 'undefined' && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      if (!config.baseURL || config.baseURL === PRIMARY_RENDER_BACKEND || config.baseURL === SECONDARY_RENDER_BACKEND || config.baseURL === TERTIARY_RENDER_BACKEND || config.baseURL === LEGACY_RENDER_BACKEND) {
        config.baseURL = getTargetClusterNode(config.url);
      }
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
    const isAiNodeTarget = (originalRequest.baseURL || '').includes('agrishield-ai-worker');
    if (!isAiNodeTarget) {
      return Promise.reject(error);
    }

    // Automated Cluster Failover for stateless AI inference across worker nodes:
    const shouldFailover = (
      (error.response && [404, 502, 503, 504].includes(error.response.status)) ||
      error.code === 'ERR_NETWORK' ||
      error.code === 'ECONNABORTED'
    );

    if (shouldFailover && !originalRequest._failoverRetry) {
      originalRequest._failoverRetry = true;
      try {
        const fallbackConfig = { ...originalRequest };
        const currentBase = fallbackConfig.baseURL || '';
        if (currentBase === TERTIARY_RENDER_BACKEND) {
          fallbackConfig.baseURL = SECONDARY_RENDER_BACKEND;
        } else if (currentBase === SECONDARY_RENDER_BACKEND) {
          fallbackConfig.baseURL = AI_WORKER_1_URL;
        } else {
          fallbackConfig.baseURL = TERTIARY_RENDER_BACKEND;
        }

        const storage = sessionStorage.getItem('token') ? sessionStorage : localStorage;
        const token = storage.getItem('token');
        if (token && fallbackConfig.headers) {
          fallbackConfig.headers.Authorization = `Bearer ${token}`;
        }
        return await axios(fallbackConfig);
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
      const isAiWorkerRequest =
        requestBase.includes('agrishield-ai-worker') ||
        requestUrl === '/api/upload' ||
        requestUrl.startsWith('/api/upload?') ||
        requestUrl.includes('/predict') ||
        requestUrl.includes('/identify-plant') ||
        requestUrl.includes('/agrochemical') ||
        requestUrl.includes('/crop-advisor') ||
        requestUrl.includes('/translate');

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
