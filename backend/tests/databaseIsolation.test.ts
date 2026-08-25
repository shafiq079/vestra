/**
 * Proves the suite runs against an isolated in-memory database, not the
 * development MongoDB Atlas cluster.
 *
 * This is a safety test, not a feature test: if it ever fails, stop and fix the
 * harness before running anything else, because the suite may be pointed at real
 * data. Every later phase inherits this guarantee.
 */

import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';

import { TEST_DATABASE_NAME } from './setup';

describe('test database isolation', () => {
  it('is connected to a local in-memory server, not a remote cluster', () => {
    expect(mongoose.connection.readyState).toBe(1);

    const host = mongoose.connection.host ?? '';
    expect(['127.0.0.1', 'localhost']).toContain(host);
    expect(host).not.toContain('mongodb.net');
  });

  it('uses the dedicated test database name', () => {
    expect(mongoose.connection.name).toBe(TEST_DATABASE_NAME);
  });

  it('never exposes an Atlas URI to the code under test', () => {
    // setup.ts overwrites MONGODB_URI before src/config/env.ts is imported, so
    // a developer's backend/.env cannot reach the suite.
    const uri = process.env.MONGODB_URI ?? '';

    expect(uri).not.toContain('mongodb+srv://');
    expect(uri).not.toContain('mongodb.net');
    expect(uri).not.toContain('@');
    expect(uri).toContain('127.0.0.1');
  });

  it('starts from an empty database', async () => {
    const database = mongoose.connection.db;
    expect(database).toBeDefined();

    const collections = await database!.listCollections().toArray();
    expect(collections).toHaveLength(0);
  });

  it('registers no models yet — schema design is Phase 2', () => {
    expect(mongoose.modelNames()).toEqual([]);
  });
});
