/**
 * Test-only diagnostics router.
 *
 * Exists so the test suite can prove the centralised error handler behaves
 * correctly on a genuinely unexpected internal fault, without leaving a route
 * in the deployed API that can crash a request handler on demand.
 *
 * It is mounted only when `createApp` is asked for diagnostics, which defaults
 * to `NODE_ENV === 'test'`. `tests/errorHandling.test.ts` asserts both halves of
 * that gate: the route works under test, and it 404s when diagnostics are off.
 */

import { Router } from 'express';

export const diagnosticsRouter = Router();

/** Throws a plain Error — i.e. NOT an HttpError — to exercise the 500 path. */
diagnosticsRouter.get('/boom', () => {
  throw new Error('Deliberate diagnostics failure: internal detail that must not be exposed.');
});

/** Rejects asynchronously; Express 5 forwards this to the error handler. */
diagnosticsRouter.get('/boom-async', async () => {
  await Promise.resolve();
  throw new Error('Deliberate async diagnostics failure: internal detail that must not be exposed.');
});
