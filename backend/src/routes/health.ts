/**
 * GET /api/health
 *
 * Liveness/readiness probe for local development, the test suite and (from
 * Phase 12) the Render health check.
 *
 * Deliberately reports nothing that could assist an attacker: no connection
 * string, no host, no database name, no environment variable values. Only the
 * service name, the runtime mode, uptime, and whether the database is reachable.
 *
 * Returns 200 while the database is connected and 503 otherwise, so a platform
 * health check can distinguish "process alive" from "actually serving".
 */

import { Router } from 'express';

import { getDatabaseState, isDatabaseConnected } from '../config/database';
import { env } from '../config/env';

export interface HealthResponse {
  status: 'ok' | 'degraded';
  service: string;
  environment: string;
  uptimeSeconds: number;
  timestamp: string;
  database: {
    status: string;
    readyState: number;
  };
}

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  const database = getDatabaseState();
  const healthy = isDatabaseConnected();

  const body: HealthResponse = {
    status: healthy ? 'ok' : 'degraded',
    service: 'vestra-backend',
    environment: env.NODE_ENV,
    uptimeSeconds: Number(process.uptime().toFixed(3)),
    timestamp: new Date().toISOString(),
    database,
  };

  res.status(healthy ? 200 : 503).json(body);
});
