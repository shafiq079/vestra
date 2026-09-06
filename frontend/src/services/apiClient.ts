import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ApiError } from '../types';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
export const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API !== 'false';
export const AUTH_TOKEN_KEY = 'vestra-auth-token';
export const REFRESH_TOKEN_KEY = 'vestra-refresh-token';
export const GUEST_CART_KEY = 'vestra-guest-cart-id';

export function getGuestCartId(): string {
  let id = localStorage.getItem(GUEST_CART_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(GUEST_CART_KEY, id);
  }
  return id;
}

export function getStoredGuestCartId(): string | null {
  return localStorage.getItem(GUEST_CART_KEY);
}

export function clearGuestCartId(): void {
  localStorage.removeItem(GUEST_CART_KEY);
}

export function guestCartHeaders(force = false): Record<string, string> {
  return force || !localStorage.getItem(AUTH_TOKEN_KEY) ? { 'X-Guest-Cart-Id': getGuestCartId() } : {};
}

export function clearAuthTokens(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export const apiClient = axios.create({
  baseURL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };
type RefreshResponse = { token: string; refreshToken: string };
let refreshPromise: Promise<string> | null = null;

function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) return Promise.reject(new Error('No refresh token is available.'));
    refreshPromise = axios.post<RefreshResponse>(`${baseURL}/auth/refresh`, { refreshToken })
      .then(({ data }) => {
        localStorage.setItem(AUTH_TOKEN_KEY, data.token);
        localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
        return data.token;
      })
      .catch((error) => {
        clearAuthTokens();
        throw error;
      })
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

function mayRefresh(config: RetriableConfig | undefined): config is RetriableConfig {
  if (!config || config._retried) return false;
  const path = String(config.url ?? '').split('?')[0]!.replace(baseURL, '');
  return !['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'].includes(path);
}

function normaliseError(error: AxiosError<{ code?: string; message?: string; details?: Record<string, string[]> }>): ApiError {
  if (error.response) return {
    code: error.response.data?.code || `HTTP_${error.response.status}`,
    message: error.response.data?.message || 'An error occurred',
    ...(error.response.data?.details ? { details: error.response.data.details } : {}),
  };
  return { code: 'NETWORK_ERROR', message: 'Unable to connect to the server. Please try again.' };
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ code?: string; message?: string; details?: Record<string, string[]> }>) => {
    const original = error.config as RetriableConfig | undefined;
    if (!USE_MOCK_API && error.response?.status === 401 && mayRefresh(original) && localStorage.getItem(REFRESH_TOKEN_KEY)) {
      original._retried = true;
      try {
        const currentToken = localStorage.getItem(AUTH_TOKEN_KEY);
        const requestToken = String(original.headers.Authorization ?? '').replace(/^Bearer /, '');
        const token = currentToken && requestToken && currentToken !== requestToken
          ? currentToken
          : await refreshAccessToken();
        original.headers.Authorization = `Bearer ${token}`;
        return apiClient(original);
      } catch {
        // The original 401 remains the useful public error after refresh fails.
      }
    }
    return Promise.reject(normaliseError(error));
  },
);
