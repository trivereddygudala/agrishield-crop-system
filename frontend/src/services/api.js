import axios from 'axios';

export const PRIMARY_RENDER_BACKEND = 'https://agrishield-ai-worker-1.onrender.com';
export const SECONDARY_RENDER_BACKEND = 'https://agrishield-ai-worker-2.onrender.com';
export const LEGACY_RENDER_BACKEND = 'https://agrishield-crop-system.onrender.com';

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

// Request interceptor to add JWT authorization token dynamically
API.interceptors.request.use(
  (config) => {
    // When sending FormData (e.g. image uploads), delete Content-Type so browser sets multipart boundary automatically
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    const storage = sessionStorage.getItem('token') ? sessionStorage : localStorage;
    const token = storage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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

    // Automated Cluster Failover: If primary worker-1 returned 404 or network timeout, retry on worker-2
    const shouldFailover = (
      (error.response && error.response.status === 404) ||
      error.code === 'ERR_NETWORK' ||
      error.code === 'ECONNABORTED'
    );

    if (shouldFailover && !originalRequest._failoverRetry) {
      originalRequest._failoverRetry = true;
      try {
        const fallbackConfig = { ...originalRequest };
        fallbackConfig.baseURL = SECONDARY_RENDER_BACKEND;
        const storage = sessionStorage.getItem('token') ? sessionStorage : localStorage;
        const token = storage.getItem('token');
        if (token && fallbackConfig.headers) {
          fallbackConfig.headers.Authorization = `Bearer ${token}`;
        }
        return await axios(fallbackConfig);
      } catch (workerErr) {
        // Fall through to regular error handling if secondary fallback also fails
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
