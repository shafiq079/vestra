/**
 * Error contract tests.
 *
 * The React frontend's Axios interceptor (frontend/src/services/apiClient.ts)
 * reads `message` and `details` off every error body, so `{ code, message,
 * details? }` is a hard contract. These tests cover the two ways a request can
 * fail without any business logic existing yet: an unknown route, and an
 * unexpected internal fault.
 */

import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app';

const app = createApp();
/** Same app with the test-only diagnostics routes gated off, as in a deployment. */
const appWithoutDiagnostics = createApp({ enableDiagnostics: false });

/** Every key an error body is allowed to contain. */
const ALLOWED_ERROR_KEYS = ['code', 'details', 'message'];

function expectErrorShape(body: unknown): void {
  expect(body).toBeTypeOf('object');
  expect(body).not.toBeNull();

  const error = body as Record<string, unknown>;

  expect(typeof error.code).toBe('string');
  expect((error.code as string).length).toBeGreaterThan(0);
  expect(typeof error.message).toBe('string');
  expect((error.message as string).length).toBeGreaterThan(0);

  // `details` is optional, but nothing else may be present.
  for (const key of Object.keys(error)) {
    expect(ALLOWED_ERROR_KEYS).toContain(key);
  }
}

/** Fails if a response body looks like it carries a stack trace or file path. */
function expectNoStackTrace(response: request.Response): void {
  const serialised = JSON.stringify(response.body);

  expect(serialised).not.toContain('    at ');
  expect(serialised).not.toContain('.ts:');
  expect(serialised).not.toContain('.js:');
  expect(serialised.toLowerCase()).not.toContain('node_modules');
  expect(serialised).not.toContain('stack');

  expect(response.text).not.toContain('<pre>');
  expect(response.text).not.toContain('Error:');
}

describe('unknown routes', () => {
  it('returns 404 in the { code, message, details? } shape', async () => {
    const response = await request(app).get('/api/definitely-not-a-route');

    expect(response.status).toBe(404);
    expect(response.type).toBe('application/json');
    expectErrorShape(response.body);
    expect(response.body.code).toBe('ROUTE_NOT_FOUND');
    expect(response.body.message).toContain('/api/definitely-not-a-route');
  });

  it('returns 404 for an unknown route outside /api too', async () => {
    const response = await request(app).post('/nowhere');

    expect(response.status).toBe(404);
    expectErrorShape(response.body);
    expect(response.body.code).toBe('ROUTE_NOT_FOUND');
  });

  it('reflects a hostile path safely instead of failing with a 500', async () => {
    const response = await request(app).get('/api/bad%00path%0Ainjected');

    expect(response.status).toBe(404);
    expectErrorShape(response.body);
    // Control characters are stripped from the reflected path, and the message
    // stays bounded no matter how long the request path was.
    expect(response.body.message).not.toMatch(/[\u0000-\u001F\u007F]/);
    expect(response.body.message.length).toBeLessThan(300);
  });

  it('caps the reflected path length for an absurdly long request', async () => {
    const response = await request(app).get(`/api/${'a'.repeat(1000)}`);

    expect(response.status).toBe(404);
    expectErrorShape(response.body);
    expect(response.body.message.length).toBeLessThan(300);
  });
});

describe('internal error handling', () => {
  it('returns a generic 500 in the agreed error shape', async () => {
    const response = await request(app).get('/api/__diagnostics/boom');

    expect(response.status).toBe(500);
    expect(response.type).toBe('application/json');
    expectErrorShape(response.body);
    expect(response.body.code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('does not leak a stack trace or the internal error message', async () => {
    const response = await request(app).get('/api/__diagnostics/boom');

    expectNoStackTrace(response);
    // The thrown message is logged server-side only.
    expect(JSON.stringify(response.body)).not.toContain('Deliberate diagnostics failure');
    expect(JSON.stringify(response.body)).not.toContain('internal detail');
  });

  it('handles a rejected async handler the same way', async () => {
    const response = await request(app).get('/api/__diagnostics/boom-async');

    expect(response.status).toBe(500);
    expectErrorShape(response.body);
    expect(response.body.code).toBe('INTERNAL_SERVER_ERROR');
    expectNoStackTrace(response);
  });

  it('keeps the error-triggering diagnostics routes out of a non-test app', async () => {
    const response = await request(appWithoutDiagnostics).get('/api/__diagnostics/boom');

    expect(response.status).toBe(404);
    expectErrorShape(response.body);
    expect(response.body.code).toBe('ROUTE_NOT_FOUND');
  });
});

describe('malformed request bodies', () => {
  it('returns 400 in the agreed shape rather than a 500', async () => {
    const response = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"broken": ');

    expect(response.status).toBe(400);
    expectErrorShape(response.body);
    expect(response.body.code).toBe('INVALID_JSON');
    expectNoStackTrace(response);
  });
});

describe('security middleware', () => {
  it('sets helmet security headers and hides the framework', async () => {
    const response = await request(app).get('/api/health');

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('allows the configured CORS origin', async () => {
    const response = await request(app)
      .get('/api/health')
      .set('Origin', 'http://localhost:5173');

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('does not echo an unconfigured origin back as allowed', async () => {
    const response = await request(app)
      .get('/api/health')
      .set('Origin', 'http://evil.example');

    expect(response.headers['access-control-allow-origin']).not.toBe('http://evil.example');
    expect(response.headers['access-control-allow-origin']).not.toBe('*');
  });
});
