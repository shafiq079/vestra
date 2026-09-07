import { Router } from 'express';
import { createVirtualTryOnController } from '../controllers/virtualTryOnController';
import { singleImageUpload } from '../middleware/imageUpload';
import { optionalAuthenticate } from '../middleware/authenticate';
import type { VirtualTryOnDependencies } from '../services/virtualTryOnService';

export function createVirtualTryOnRouter(deps: VirtualTryOnDependencies): Router {
  const router = Router(); const controller = createVirtualTryOnController(deps);
  router.use(optionalAuthenticate);
  router.get('/eligible', controller.eligible);
  router.get('/product/:productId', controller.product);
  router.post('/', singleImageUpload, controller.submit);
  router.get('/jobs/:jobId', controller.status);
  router.post('/jobs/:jobId/cancel', controller.cancel);
  router.put('/jobs/:jobId/feedback', controller.feedback);
  return router;
}
