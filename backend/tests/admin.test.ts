import request, { type Test } from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { createTestUser, mintTestAccessToken } from './helpers/auth';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
interface RouteCase { method: Method; path: string; body?: unknown; csv?: string }
const id = '000000000000000000000001';
const routes: RouteCase[] = [
  { method: 'get', path: '/api/admin/dashboard' },
  { method: 'get', path: '/api/admin/products' },
  { method: 'get', path: `/api/admin/products/${id}` },
  { method: 'post', path: '/api/admin/products', body: {} },
  { method: 'put', path: `/api/admin/products/${id}`, body: {} },
  { method: 'delete', path: `/api/admin/products/${id}` },
  { method: 'post', path: `/api/admin/products/${id}/duplicate` },
  { method: 'patch', path: `/api/admin/products/${id}/published`, body: { isPublished: false } },
  { method: 'post', path: '/api/admin/products/bulk/publish', body: { ids: [id], isPublished: false } },
  { method: 'post', path: '/api/admin/products/bulk/delete', body: { ids: [id] } },
  { method: 'post', path: '/api/admin/products/reset' },
  { method: 'post', path: '/api/admin/products/import', csv: 'name,slug,category,price,brand,genderCollection\n' },
  { method: 'get', path: '/api/admin/categories' },
  { method: 'post', path: '/api/admin/categories', body: {} },
  { method: 'put', path: `/api/admin/categories/${id}`, body: {} },
  { method: 'delete', path: `/api/admin/categories/${id}` },
  { method: 'get', path: '/api/admin/inventory' },
  { method: 'patch', path: `/api/admin/inventory/${id}/variants/${id}`, body: { stock: 0 } },
  { method: 'get', path: '/api/admin/users' },
  { method: 'patch', path: `/api/admin/users/${id}/active`, body: { isActive: false } },
  { method: 'get', path: '/api/admin/orders' },
  { method: 'patch', path: `/api/admin/orders/${id}/status`, body: { status: 'confirmed' } },
  { method: 'get', path: '/api/admin/reviews' },
  { method: 'patch', path: `/api/admin/reviews/${id}/moderation`, body: { isApproved: true } },
  { method: 'get', path: '/api/admin/promotions' },
];

function call(route: RouteCase, token?: string): Test {
  let test = request(app)[route.method](route.path);
  if (token) test = test.set('Authorization', `Bearer ${token}`);
  if (route.csv !== undefined) return test.set('Content-Type', 'text/csv').send(route.csv);
  return route.body === undefined ? test : test.send(route.body);
}

describe('admin authorization matrix', () => {
  let customerToken: string;
  let adminToken: string;
  beforeAll(async () => {
    customerToken = mintTestAccessToken(await createTestUser({ email: 'admin-matrix-customer@example.com' }));
    adminToken = mintTestAccessToken(await createTestUser({ email: 'admin-matrix-admin@example.com', role: 'admin' }));
  });

  for (const route of routes) {
    const label = `${route.method.toUpperCase()} ${route.path}`;
    it(`${label}: rejects no token`, async () => expect((await call(route)).status).toBe(401));
    it(`${label}: rejects a customer`, async () => expect((await call(route, customerToken)).status).toBe(403));
    it(`${label}: lets an admin reach normal handling`, async () => {
      const response = await call(route, adminToken);
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
    });
  }
});
