import axios from 'axios';

// Auto-detect environment
const IS_WEB = typeof window !== 'undefined' && window.localStorage;
const BASE_URL = 'http://127.0.0.1:5000/api';
const TOKEN_KEY = 'securewatch_jwt';

// ── Token storage (localStorage for web, SecureStore for mobile) ──────────────
let SecureStore;
if (!IS_WEB) {
  SecureStore = require('expo-secure-store');
}

export const saveToken = async (token) => {
  if (IS_WEB) return localStorage.setItem(TOKEN_KEY, token);
  return SecureStore.setItemAsync(TOKEN_KEY, token);
};

export const getToken = async () => {
  if (IS_WEB) return localStorage.getItem(TOKEN_KEY);
  return SecureStore.getItemAsync(TOKEN_KEY);
};

export const deleteToken = async () => {
  if (IS_WEB) return localStorage.removeItem(TOKEN_KEY);
  return SecureStore.deleteItemAsync(TOKEN_KEY);
};

// ── Axios instance ────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(
  async (config) => {
    const token = await getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error.response?.data?.message ||
      error.response?.data?.errors?.[0]?.msg ||
      (error.code === 'ECONNABORTED'
        ? 'Request timed out. Check your connection.'
        : 'Network error.');
    return Promise.reject(new Error(message));
  }
);

// ── Auth API ──────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (username, email, password) =>
    api.post('/auth/register', { username, email, password }),
  me: () => api.get('/auth/me'),
};

// ── Events API ────────────────────────────────────────────────────────────────
export const eventsAPI = {
  getEvents: (params = {}) => api.get('/events', { params }),
  getEvent: (id) => api.get(`/events/${id}`),
  createEvent: (data) => api.post('/events', data),
  updateStatus: (id, status) => api.patch(`/events/${id}/status`, { status }),
  getThreatLevelChart: (days = 7) =>
    api.get('/events/analytics/threat-levels', { params: { days } }),
  getSummary: () => api.get('/events/analytics/summary'),
};

export default api;