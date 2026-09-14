import { Router } from 'express';
import { createSizeRecommendationController } from '../controllers/sizeRecommendationController';
import type { SizeRecommendationMlClient } from '../services/sizeRecommendationMlClient';

export function createSizeRecommendationRouter(client: SizeRecommendationMlClient): Router {
  const router = Router();
  const controller = createSizeRecommendationController(client);
  router.get('/schema/:productId', controller.getSchema);
  router.post('/', controller.recommend);
  return router;
}
