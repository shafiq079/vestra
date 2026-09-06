import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
export const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API !== 'false';
export const AUTH_TOKEN_KEY = 'vestra-auth-token';
export const REFRESH_TOKEN_KEY = 'vestra-refresh-token';
export const GUEST_CART_KEY = 'vestra-guest-cart-id';

function guestCartId(): string {
  let id = localStorage.getItem(GUEST_CART_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(GUEST_CART_KEY, id);
  }
  return id;
}

export const apiClient = axios.create({
  baseURL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers['X-Guest-Cart-Id'] = guestCartId();
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as (typeof error.config & { _retried?: boolean }) | undefined;
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!USE_MOCK_API && error.response?.status === 401 && original && !original._retried && refreshToken && !String(original.url).includes('/auth/refresh')) {
      original._retried = true;
      try {
        const response = await axios.post<{ token: string; refreshToken: string }>(`${baseURL}/auth/refresh`, { refreshToken });
        localStorage.setItem(AUTH_TOKEN_KEY, response.data.token);
        localStorage.setItem(REFRESH_TOKEN_KEY, response.data.refreshToken);
        original.headers.Authorization = `Bearer ${response.data.token}`;
        return apiClient(original);
      } catch {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
      }
    }
    if (error.response) {
      return Promise.reject({
        code: error.response.data?.code || `HTTP_${error.response.status}`,
        message: error.response.data?.message || 'An error occurred',
        details: error.response.data?.details,
      });
    }
    return Promise.reject({
      code: 'NETWORK_ERROR',
      message: 'Unable to connect to the server. Please try again.',
    });
  }
);
