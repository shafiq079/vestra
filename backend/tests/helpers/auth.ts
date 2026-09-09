import bcrypt from 'bcrypt';
import request from 'supertest';
import { app } from '../../src/app';
import { env } from '../../src/config/env';
import { User } from '../../src/models';
import { issueAccessToken } from '../../src/services/authService';

export async function createTestUser(overrides: Record<string, unknown> = {}) {
  return User.create({ email: 'phase4@example.com', firstName: 'Test', lastName: 'Customer', passwordHash: await bcrypt.hash('SafeTest123!', env.BCRYPT_ROUNDS), role: 'customer', ...overrides });
}
export async function loginTestUser(email = 'phase4@example.com', password = 'SafeTest123!') { return request(app).post('/api/auth/login').send({ email, password }); }
export const mintTestAccessToken = (user: Awaited<ReturnType<typeof createTestUser>>) => issueAccessToken(user);
export const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });
export const authedRequest = (token: string) => ({ get: (path: string) => request(app).get(path).set(authHeader(token)), patch: (path: string) => request(app).patch(path).set(authHeader(token)), post: (path: string) => request(app).post(path).set(authHeader(token)), delete: (path: string) => request(app).delete(path).set(authHeader(token)) });
