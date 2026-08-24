/**
 * Express application assembly — middleware, routers, error handling.
 *
 * Deliberately does NOT listen on a port and does NOT touch the database, so
 * `tests/` can drive it with supertest against an isolated in-memory MongoDB.
 * Binding the port and opening the database connection belong to server.ts.
 */

import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { createApiRouter } from './routes';

/** Ceiling on JSON/urlencoded bodies — a basic denial-of-service guard. */
const BODY_SIZE_LIMIT = '1mb';

export interface CreateAppOptions {
  /**
   * Mounts the test-only diagnostics routes under `/api/__diagnostics`.
   * Defaults to true under NODE_ENV=test and false everywhere else.
   */
  enableDiagnostics?: boolean;
}

export function createApp(options: CreateAppOptions = {}): Express {
  const enableDiagnostics = options.enableDiagnostics ?? env.isTest;

  const app = express();

  // Do not advertise the framework.
  app.disable('x-powered-by');

  // Render (and most managed hosts) terminate TLS at a proxy; without this,
  // req.ip and req.protocol report the proxy rather than the client.
  if (env.isProduction) {
    app.set('trust proxy', 1);
  }

  // Security headers.
  app.use(helmet());

  // CORS is driven entirely by CORS_ORIGIN. env.ts rejects a wildcard origin
  // when NODE_ENV=production, so a production deployment cannot open the API
  // to every origin by configuration accident.
  app.use(
    cors({
      origin: env.corsOrigins.length === 1 ? env.corsOrigins[0]! : [...env.corsOrigins],
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    }),
  );

  // Request logging — suppressed under test to keep the suite output readable.
  if (!env.isTest) {
    app.use(morgan(env.isProduction ? 'combined' : 'dev'));
  }

  app.use(express.json({ limit: BODY_SIZE_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: BODY_SIZE_LIMIT }));

  app.use('/api', createApiRouter({ enableDiagnostics }));

  // Order matters: unmatched routes become a 404 HttpError, then every error —
  // 404s included — is rendered as `{ code, message, details? }`.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

/** Singleton used by server.ts. Tests build their own via createApp(). */
export const app: Express = createApp();

export default app;
