/**
 * Test harness setup — runs before every test file (vitest `setupFiles`).
 *
 * Database isolation is the point of this file. Two independent guarantees keep
 * the suite away from the development Atlas cluster:
 *
 *  1. `MONGODB_URI` is overwritten here, at module scope, BEFORE any test file
 *     imports src/config/env.ts. dotenv never overrides a value that is already
 *     present in process.env, so backend/.env can no longer supply the URI the
 *     tests see.
 *  2. Nothing under test opens a connection of its own. src/app.ts has no
 *     database side effects, and src/config/database.ts#connectDatabase is
 *     called only by src/server.ts, which the suite never imports. The only
 *     connection that exists is the in-memory one created below, whose URI comes
 *     from tests/globalSetup.ts via `inject`.
 *
 * `tests/databaseIsolation.test.ts` asserts both guarantees rather than trusting
 * them.
 */

import mongoose from 'mongoose';
import { afterAll, beforeAll, inject } from 'vitest';

export { TEST_DATABASE_NAME } from './constants';

// --- Environment lockdown (module scope: runs before test-file imports) -----

process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT ?? '5000';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173';

// Placeholder that satisfies env validation and is never dialled: the real
// connection below uses the in-memory server's URI. Overwritten (not defaulted)
// so a developer's backend/.env cannot leak into the suite.
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/vestra-test-placeholder';
process.env.JWT_SECRET = 'test-only-jwt-secret-that-is-at-least-32-characters';
process.env.JWT_ACCESS_TTL_SECONDS = '900';
process.env.BCRYPT_ROUNDS = '4';
process.env.REFRESH_TOKEN_TTL_DAYS = '7';

// ---------------------------------------------------------------------------

beforeAll(async () => {
  await mongoose.connect(inject('mongoUri'));
});

afterAll(async () => {
  // Leave a clean database for the next test file. `fileParallelism` is off, so
  // no other file is using this database concurrently.
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
});
