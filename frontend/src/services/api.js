import axios from 'axios';

export const PRIMARY_RENDER_BACKEND = 'https://agrishield-ai-worker-1.onrender.com';
export const SECONDARY_RENDER_BACKEND = 'https://agrishield-ai-worker-2.onrender.com';
export const TERTIARY_RENDER_BACKEND = 'https://agrishield-ai-worker-3.onrender.com';
export const LEGACY_RENDER_BACKEND = 'https://agrishield-crop-system.onrender.com';

/**
 * Intelligent Cluster Router:
 * Dynamically partitions workloads across the Render worker cluster:
 *
 * 1. Worker 1 (agrishield-ai-worker-1): Deep Learning PyTorch AI inference (/api/predict, /api/upload)
 * 2. Worker 3 (agrishield-ai-worker-3): Species ID, OCR vision, translations & AI load-balancer (/api/identify-plant, /api/agrochemical-scan)
 * 3. Main Node (agrishield-crop-system): Auth, Equipment Rental, Real-Time Notifications, History, DB Transactions
 */
export const getTargetClusterNode = (url) => {
  if (!url) return PRIMARY_RENDER_BACKEND;
  const path = url.toLowerCase();

  // Worker 1: Heavy PyTorch Leaf Disease Inference & Image Uploads
  if (path.includes('/predict') || path.includes('/upload')) {
    return PRIMARY_RENDER_BACKEND;
  }

  // Worker 3: Species Identification, OCR Agrochemical Scan & Botanical Translations (fresh active worker)
  if (
    path.includes('/identify-plant') ||
    path.includes('/agrochemical') ||
    path.includes('/translate') ||
    path.includes('/crop-advisor')
  ) {
    return TERTIARY_RENDER_BACKEND;
  }

  // Cluster Main: Equipment, Bookings, Auth, Notifications, Farms, History, IoT
  return LEGACY_RENDER_BACKEND;
};

export const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/+$/, '');
  // When running on production domains (e.g., Vercel), route directly to healthy primary worker
  if (typeof window !== 'undefined' && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    return PRIMARY_RENDER_BACKEND;
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
      if (!config.baseURL || config.baseURL === PRIMARY_RENDER_BACKEND || config.baseURL === SECONDARY_RENDER_BACKEND || config.baseURL === LEGACY_RENDER_BACKEND) {
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

    // Automated Cluster Failover: If current worker returned 404, 502, 503, or network timeout, cycle across the cluster
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
        if (currentBase === PRIMARY_RENDER_BACKEND) {
          fallbackConfig.baseURL = TERTIARY_RENDER_BACKEND;
        } else if (currentBase === TERTIARY_RENDER_BACKEND) {
          fallbackConfig.baseURL = SECONDARY_RENDER_BACKEND;
        } else if (currentBase === SECONDARY_RENDER_BACKEND) {
          fallbackConfig.baseURL = LEGACY_RENDER_BACKEND;
        } else {
          fallbackConfig.baseURL = PRIMARY_RENDER_BACKEND;
        }

        const storage = sessionStorage.getItem('token') ? sessionStorage : localStorage;
        const token = storage.getItem('token');
        if (token && fallbackConfig.headers) {
          fallbackConfig.headers.Authorization = `Bearer ${token}`;
        }
        return await axios(fallbackConfig);
      } catch (workerErr) {
        // Fall through to second fallback or regular error handling
      }
    }

    // Session expired or invalid token
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const rt = localStorage.getItem('refresh_token') || sessionStorage.getItem('refresh_token');
      if (rt) {
        try {
          const res = await axios.post('/api/auth/refresh', { refresh_token: rt }, { baseURL: getApiBaseUrl() });
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
