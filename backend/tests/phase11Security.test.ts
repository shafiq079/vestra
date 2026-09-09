import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { createGlobalRateLimit } from '../src/middleware/security';
import { User } from '../src/models';
import { createTestUser, authHeader, mintTestAccessToken } from './helpers/auth';

const apiError = (response: request.Response, status = 400) => {
  expect(response.status).toBe(status);
  expect(response.body).toEqual(expect.objectContaining({ code: expect.any(String), message: expect.any(String) }));
  expect(response.body).not.toHaveProperty('stack');
};

describe('Phase 11 cross-cutting security hardening', () => {
  beforeEach(async () => User.deleteMany({}));

  it('exempts repeated health probes while rate-limiting ordinary API routes', async () => {
    const limited = express();
    limited.use('/api', createGlobalRateLimit(2));
    limited.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
    limited.get('/api/products', (_req, res) => res.json({ products: [] }));

    for (let probe = 0; probe < 5; probe += 1) {
      expect((await request(limited).get('/api/health')).status).toBe(200);
    }

    expect((await request(limited).get('/api/products')).status).toBe(200);
    expect((await request(limited).get('/api/products')).status).toBe(200);
    const blocked = await request(limited).get('/api/products');
    apiError(blocked, 429);
    expect(blocked.headers['ratelimit']).toBeDefined();
  });

  it.each([
    '/api/products?price[$gt]=0',
    '/api/products?__proto__.polluted=true',
    '/api/products?constructor[prototype][polluted]=true',
  ])('rejects query/prototype injection before database access: %s', async (path) => {
    apiError(await request(createApp()).get(path));
  });

  it('rejects nested MongoDB operators and excessive nesting in JSON', async () => {
    apiError(await request(createApp()).post('/api/auth/login').send({ email: { $ne: null }, password: 'password' }));
    let nested: Record<string, unknown> = {};
    let cursor = nested;
    for (let index = 0; index < 22; index += 1) cursor = cursor.child = {} as Record<string, unknown>;
    apiError(await request(createApp()).post('/api/auth/login').send(nested));
  });

  it('enforces the JSON size ceiling without leaking parser internals', async () => {
    apiError(await request(createApp()).post('/api/auth/login').send({ email: `${'a'.repeat(1024 * 1024)}@example.com`, password: 'password' }), 413);
  });

  it('strictly rejects empty, null, unexpected and oversized credential payloads', async () => {
    apiError(await request(createApp()).post('/api/auth/login').set('Content-Type', 'application/json').send('null'));
    for (const body of [{}, { email: 'a@example.com', password: 'password', role: 'admin' },
      { refreshToken: 'x'.repeat(2049) }]) {
      const path = 'refreshToken' in body ? '/api/auth/refresh' : '/api/auth/login';
      apiError(await request(createApp()).post(path).send(body));
    }
  });

  it('accepts legitimate Unicode names while retaining mass-assignment protection', async () => {
    const response = await request(createApp()).post('/api/auth/register').send({
      firstName: 'Zoë', lastName: '山田', email: 'unicode@example.com', password: 'SafeTest123!', marketingOptIn: false,
    });
    expect(response.status).toBe(201);
    expect(response.body).toEqual(expect.objectContaining({ firstName: 'Zoë', lastName: '山田', role: 'customer' }));
  });

  it('rejects unexpected and duplicate catalogue query parameters', async () => {
    apiError(await request(createApp()).get('/api/products?where=%7B%22$ne%22:null%7D'));
    apiError(await request(createApp()).get('/api/products?page=1&page=2'));
  });

  it('denies guests from every customer-owned route group', async () => {
    for (const path of ['/api/profile', '/api/profile/addresses', '/api/profile/measurement-profile',
      '/api/wishlist', '/api/orders']) {
      apiError(await request(createApp()).get(path), 401);
    }
  });

  it('allows admin identity only where customer routes are role-neutral and never bypasses ownership', async () => {
    const customer = await createTestUser({ email: 'owner@example.com' });
    const admin = await createTestUser({ email: 'admin-phase11@example.com', role: 'admin' });
    const customerToken = mintTestAccessToken(customer);
    const adminToken = mintTestAccessToken(admin);
    expect((await request(createApp()).get('/api/profile').set(authHeader(customerToken))).status).toBe(200);
    const adminProfile = await request(createApp()).get('/api/profile').set(authHeader(adminToken));
    expect(adminProfile.status).toBe(200);
    expect(adminProfile.body.id).toBe(admin.id);
    expect(adminProfile.body.id).not.toBe(customer.id);
  });
});
