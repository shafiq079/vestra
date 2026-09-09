import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.ts'],
    // One in-memory mongod for the whole run (globalSetup), then a per-file
    // connection + teardown (setup).
    globalSetup: ['./tests/globalSetup.ts'],
    setupFiles: ['./tests/setup.ts'],
    // Files share one database, so they must not run concurrently.
    fileParallelism: false,
    // The first run may download the mongod binary used by the in-memory server.
    hookTimeout: 180_000,
    testTimeout: 30_000,
  },
});
