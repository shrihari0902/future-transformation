import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('op_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle 401s
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('op_token');
      localStorage.removeItem('op_user');
      // If not already on login page, redirect
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const apiService = {
  // Auth
  login: (username, password) => api.post('/auth/login', { username, password }),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),

  // Devices
  registerDevice: (data) => api.post('/devices/register', data),
  getDevices: () => api.get('/devices'),

  // Wallet & Reserves
  getWallet: () => api.get('/wallet'),
  addDemoFunds: (amount, idempotencyKey) =>
    api.post('/wallet/demo-funding', { amount, idempotency_key: idempotencyKey }),
  createReserve: (amount, device_id) => api.post('/reserves', { amount, device_id }),
  getReserves: () => api.get('/reserves'),
  getLedger: () => api.get('/ledger'),

  // Certificates
  getBankPublicKey: () => api.get('/certificates/public-key'),
  getCertificates: () => api.get('/certificates'),

  // Transactions
  syncTransactions: (transactions) => api.post('/transactions/sync', { transactions }),
  getTransactions: () => api.get('/transactions'),
  getTransactionDetails: (id) => api.get(`/transactions/${id}`),
  getFlaggedTransactions: () => api.get('/transactions/flags'),

  // Risk
  getMyRiskLimit: () => api.get('/risk/my-limit'),
  getRiskTiers: () => api.get('/risk/tiers'),

  // Disputes
  createDispute: (data) => api.post('/disputes', data),
  getDisputes: () => api.get('/disputes'),

  // Analyst
  getAnalystDisputes: (statusFilter) =>
    api.get('/analyst/disputes', { params: statusFilter ? { status_filter: statusFilter } : {} }),
  decideDispute: (id, decision, decision_notes) =>
    api.post(`/analyst/disputes/${id}/decision`, { decision, decision_notes }),
  getAnalystFlags: () => api.get('/analyst/flags'),
  getAnalystTransactions: () => api.get('/analyst/transactions'),
};

export default api;
