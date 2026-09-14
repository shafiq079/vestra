/**
 * API router root — everything here is mounted under `/api`, matching the base
 * path the frontend already uses (frontend/src/services/apiClient.ts defaults
 * to http://localhost:5000/api).
 */

import { Router } from 'express';

import { diagnosticsRouter } from './diagnostics';
import { healthRouter } from './health';
import { productsRouter } from './products';
import { categoriesRouter } from './categories';
import { collectionsRouter } from './collections';
import { authRouter } from './auth';
import { profileRouter } from './profile';
import { cartRouter } from './cart';
import { wishlistRouter } from './wishlist';
import { ordersRouter } from './orders';
import { createAdminRouter } from './admin';
import { recommendationsRouter } from './recommendations';
import { createVirtualTryOnRouter } from './virtualTryOn';
import { createSizeRecommendationRouter } from './sizeRecommendation';
import type { VirtualTryOnDependencies } from '../services/virtualTryOnService';
import type { SizeRecommendationMlClient } from '../services/sizeRecommendationMlClient';

export interface ApiRouterOptions {
  /** Mounts the test-only diagnostics routes. Never enable in a deployment. */
  enableDiagnostics: boolean;
  virtualTryOn: VirtualTryOnDependencies;
  sizeRecommendation: SizeRecommendationMlClient;
}

export function createApiRouter({ enableDiagnostics, virtualTryOn, sizeRecommendation }: ApiRouterOptions): Router {
  const router = Router();

  router.use('/health', healthRouter);
  router.use('/products', productsRouter);
  router.use('/categories', categoriesRouter);
  router.use('/collections', collectionsRouter);
  router.use('/auth', authRouter);
  router.use('/profile', profileRouter);
  router.use('/cart', cartRouter);
  router.use('/wishlist', wishlistRouter);
  router.use('/orders', ordersRouter);
  router.use('/admin', createAdminRouter(virtualTryOn.imageStorage));
  router.use('/recommendations', recommendationsRouter);
  router.use('/virtual-try-on', createVirtualTryOnRouter(virtualTryOn));
  router.use('/size-recommendation', createSizeRecommendationRouter(sizeRecommendation));

  if (enableDiagnostics) {
    router.use('/__diagnostics', diagnosticsRouter);
  }

  return router;
}
