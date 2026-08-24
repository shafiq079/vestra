/**
 * Vitest globalSetup — starts ONE in-memory MongoDB for the whole run and hands
 * its URI to the workers via `provide`/`inject`.
 *
 * One server per run rather than one per test file: starting `mongod` four times
 * on Windows proved flaky (an occasional start timeout), and it is needlessly
 * slow. Per-file isolation is preserved by `tests/setup.ts`, which drops the
 * database after each file while `fileParallelism` is off.
 */

import { MongoMemoryServer } from 'mongodb-memory-server';
import type { TestProject } from 'vitest/node';

import { TEST_DATABASE_NAME } from './constants';

declare module 'vitest' {
  interface ProvidedContext {
    mongoUri: string;
  }
}

export default async function globalSetup(project: TestProject): Promise<() => Promise<void>> {
  const server = await MongoMemoryServer.create();

  project.provide('mongoUri', server.getUri(TEST_DATABASE_NAME));

  return async () => {
    await server.stop();
  };
}
