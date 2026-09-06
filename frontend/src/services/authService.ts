import { AUTH_TOKEN_KEY, REFRESH_TOKEN_KEY, USE_MOCK_API, apiClient } from './apiClient';
import { demoAdmin, demoCustomer, mockUsers, getUserById } from '../mocks/users';
import type { User } from '../types';

type AuthResponse = User & { token: string; refreshToken: string };
export const getDemoUser = (role: 'customer' | 'admin') => role === 'admin' ? demoAdmin : demoCustomer;

function acceptAuthentication(response: AuthResponse): User {
  localStorage.setItem(AUTH_TOKEN_KEY, response.token);
  localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
  const { token: _token, refreshToken: _refreshToken, ...user } = response;
  return user;
}

export async function login(email: string, password: string): Promise<User> {
  if (USE_MOCK_API) {
    await new Promise((r) => setTimeout(r, 400));
    const user = mockUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) throw new Error('Invalid email or password');
    return user;
  }
  const response = await apiClient.post<AuthResponse>('/auth/login', { email, password });
  return acceptAuthentication(response.data);
}

export async function register(data: { firstName: string; lastName: string; email: string; password: string; marketingOptIn: boolean }): Promise<User> {
  if (USE_MOCK_API) {
    await new Promise((r) => setTimeout(r, 500));
    const newUser: User = {
      id: `u${Date.now()}`,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      role: 'customer',
      addresses: [],
      wishlistIds: [],
      createdAt: new Date().toISOString(),
      isActive: true,
      marketingOptIn: data.marketingOptIn,
    };
    return newUser;
  }
  const response = await apiClient.post('/auth/register', data);
  return acceptAuthentication(response.data);
}

export async function getCurrentUser(userId: string): Promise<User | null> {
  if (USE_MOCK_API) {
    await new Promise((r) => setTimeout(r, 200));
    return getUserById(userId) || null;
  }
  const response = await apiClient.get('/auth/me');
  return response.data;
}

export async function forgotPassword(email: string): Promise<void> {
  if (USE_MOCK_API) {
    await new Promise((r) => setTimeout(r, 500));
    return;
  }
  await apiClient.post('/auth/forgot-password', { email });
}

export async function logout(): Promise<void> {
  if (!USE_MOCK_API) {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (refreshToken) await apiClient.post('/auth/logout', { refreshToken });
  }
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}
