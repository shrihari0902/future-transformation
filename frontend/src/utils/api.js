import axios from 'axios';

// Use Railway backend in production and Vite proxy locally
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to attach JWT token
api.interceptors.request.use((config) => {
  const isSimulatedOffline =
    localStorage.getItem('simulated_offline') === 'true';
  const isRealOffline = !navigator.onLine;

  if (isSimulatedOffline || isRealOffline) {
    return Promise.reject(
      new Error('Network Offline: Device has no connectivity to bank server.')
    );
  }

  const token = localStorage.getItem('offlinepay_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isSimulatedOffline =
        localStorage.getItem('simulated_offline') === 'true';

      if (!isSimulatedOffline && navigator.onLine) {
        localStorage.removeItem('offlinepay_token');
        localStorage.removeItem('offlinepay_user');
      }
    }

    return Promise.reject(error);
  }
);

export default api;
