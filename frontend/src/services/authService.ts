import { AUTH_TOKEN_KEY, REFRESH_TOKEN_KEY, apiClient, clearAuthTokens } from './apiClient';
import type { User } from '../types';

type AuthResponse = User & { token: string; refreshToken: string };
function acceptAuthentication(response: AuthResponse): User {
  localStorage.setItem(AUTH_TOKEN_KEY, response.token);
  localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
  const { token: _token, refreshToken: _refreshToken, ...user } = response;
  return user;
}
export async function login(email: string, password: string): Promise<User> { return acceptAuthentication((await apiClient.post<AuthResponse>('/auth/login', { email, password })).data); }
export async function register(data: { firstName: string; lastName: string; email: string; password: string; marketingOptIn: boolean }): Promise<User> { return acceptAuthentication((await apiClient.post<AuthResponse>('/auth/register', data)).data); }
export async function getCurrentUser(): Promise<User | null> { return (await apiClient.get<User>('/auth/me')).data; }
export async function forgotPassword(email: string): Promise<void> { await apiClient.post('/auth/forgot-password', { email }); }
export async function logout(): Promise<void> {
  try { const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY); if (refreshToken) await apiClient.post('/auth/logout', { refreshToken }); }
  finally { clearAuthTokens(); }
}
