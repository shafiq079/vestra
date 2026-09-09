/**
 * GET /api/health
 *
 * The endpoint that proves the whole path is alive: Express is serving, the
 * router is mounted under /api, and Mongoose reports a live connection.
 */

import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app';

const app = createApp();

describe('GET /api/health', () => {
  it('returns 200 while the database is connected', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.type).toBe('application/json');
  });

  it('returns the expected response structure', async () => {
    const response = await request(app).get('/api/health');

    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'vestra-backend',
      environment: 'test',
      database: {
        status: 'connected',
        readyState: 1,
      },
    });

    expect(typeof response.body.uptimeSeconds).toBe('number');
    expect(response.body.uptimeSeconds).toBeGreaterThan(0);

    expect(typeof response.body.timestamp).toBe('string');
    expect(Number.isNaN(Date.parse(response.body.timestamp))).toBe(false);
  });

  it('does not expose connection details or any other configuration secret', async () => {
    const response = await request(app).get('/api/health');
    const serialised = JSON.stringify(response.body);

    // No connection string, host, database name, or credential of any form.
    expect(serialised).not.toMatch(/mongodb(\+srv)?:\/\//i);
    expect(serialised).not.toMatch(/@/);
    expect(serialised.toLowerCase()).not.toContain('password');
    expect(serialised.toLowerCase()).not.toContain('uri');

    // Only the agreed keys are present.
    expect(Object.keys(response.body).sort()).toEqual([
      'database',
      'environment',
      'service',
      'status',
      'timestamp',
      'uptimeSeconds',
    ]);
    expect(Object.keys(response.body.database).sort()).toEqual(['readyState', 'status']);
  });

  it('is not reachable outside the /api base path', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('ROUTE_NOT_FOUND');
  });
});
