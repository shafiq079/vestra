/**
 * MongoDB Atlas connection via Mongoose.
 *
 * Nothing here ever logs the connection string. Atlas URIs embed the database
 * username and password, so only the resolved database name and driver-reported
 * state are logged, and every message is additionally passed through the
 * logger's redaction pass as a second line of defence.
 *
 * No models are registered in this phase — Phase 2 owns schema design.
 */

import mongoose from 'mongoose';

import { env } from './env';
import { logger } from '../utils/logger';

/** Human-readable projection of Mongoose's numeric `readyState`. */
export type DatabaseStatus =
  | 'disconnected'
  | 'connected'
  | 'connecting'
  | 'disconnecting'
  | 'uninitialized'
  | 'unknown';

export interface DatabaseState {
  status: DatabaseStatus;
  readyState: number;
}

const READY_STATE_LABELS: Readonly<Record<number, DatabaseStatus>> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
  99: 'uninitialized',
};

/**
 * Current connection state, safe to expose over HTTP: it reports whether the
 * database is reachable without revealing host, credentials or database name.
 */
export function getDatabaseState(): DatabaseState {
  const { readyState } = mongoose.connection;
  return {
    status: READY_STATE_LABELS[readyState] ?? 'unknown',
    readyState,
  };
}

export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

let listenersRegistered = false;

/** Connection-lifecycle logging, attached once per process. */
function registerConnectionListeners(): void {
  if (listenersRegistered) return;
  listenersRegistered = true;

  const connection = mongoose.connection;

  connection.on('connected', () => {
    logger.info(`MongoDB connected (database: ${connection.name ?? 'unknown'})`);
  });
  connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });
  connection.on('reconnected', () => {
    logger.info('MongoDB reconnected');
  });
  connection.on('error', (error: unknown) => {
    logger.error('MongoDB connection error:', describeError(error));
  });
}

/**
 * Reduces a driver error to its name and message only. The stack is dropped
 * because Mongoose/driver stacks can embed the connection options — including
 * the URI — in their frames.
 */
function describeError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return 'an unknown error occurred';
}

/**
 * Opens the Mongoose connection. Called by server.ts only — app.ts stays free
 * of database side effects so tests can exercise the HTTP layer against their
 * own isolated database.
 */
export async function connectDatabase(uri: string = env.MONGODB_URI): Promise<void> {
  registerConnectionListeners();

  mongoose.set('strictQuery', true);

  try {
    await mongoose.connect(uri, {
      // Surface an unreachable cluster or a bad IP allow-list quickly instead of
      // hanging the process on startup.
      serverSelectionTimeoutMS: 10_000,
      // Index builds are convenient in development, unwanted on a live cluster.
      autoIndex: !env.isProduction,
    });
  } catch (error) {
    logger.error(
      'Failed to connect to MongoDB.',
      'Check that MONGODB_URI is correct and that this machine is on the Atlas IP access list.',
      describeError(error),
    );
    throw new Error(`MongoDB connection failed: ${describeError(error)}`);
  }
}

/** Closes the Mongoose connection during graceful shutdown. */
export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 0) return;

  try {
    await mongoose.disconnect();
    logger.info('MongoDB connection closed');
  } catch (error) {
    logger.error('Error while closing the MongoDB connection:', describeError(error));
  }
}
