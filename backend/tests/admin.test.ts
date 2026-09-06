import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { parseCsv } from '../src/services/adminService';

describe('Phase 7 admin API', () => {
  const app = createApp();
  for (const [method, path] of [
    ['get', '/api/admin/dashboard'], ['get', '/api/admin/products'],
    ['get', '/api/admin/categories'], ['get', '/api/admin/inventory'],
    ['get', '/api/admin/users'], ['get', '/api/admin/orders'],
    ['get', '/api/admin/reviews'], ['get', '/api/admin/promotions'],
  ] as const) {
    it(`protects ${method.toUpperCase()} ${path}`, async () => {
      const response = await request(app)[method](path);
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ code: 'UNAUTHORIZED' });
    });
  }
  it('parses quoted commas and escaped quotes', () => {
    expect(parseCsv('name,description\n"Coat, Wool","A ""fine"" coat"\n')).toEqual([
      ['name', 'description'], ['Coat, Wool', 'A "fine" coat'],
    ]);
  });
  it('parses CRLF and LF records identically', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual(parseCsv('a,b\n1,2\n'));
  });
});
