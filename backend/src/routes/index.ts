/**
 * API router root — everything here is mounted under `/api`, matching the base
 * path the frontend already uses (frontend/src/services/apiClient.ts defaults
 * to http://localhost:5000/api).
 *
 * Phase 1 exposes the health endpoint only. Later phases mount their route
 * groups here (catalogue, auth, cart, orders, admin, virtual try-on).
 */

import { Router } from 'express';

import { diagnosticsRouter } from './diagnostics';
import { healthRouter } from './health';

export interface ApiRouterOptions {
  /** Mounts the test-only diagnostics routes. Never enable in a deployment. */
  enableDiagnostics: boolean;
}

export function createApiRouter({ enableDiagnostics }: ApiRouterOptions): Router {
  const router = Router();

  router.use('/health', healthRouter);

  if (enableDiagnostics) {
    router.use('/__diagnostics', diagnosticsRouter);
  }

  return router;
}
