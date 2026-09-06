import { Router } from 'express';
import { getRecommendationGroup, getRecommendationGroups } from '../controllers/recommendationController';
import { optionalAuthenticate } from '../middleware/authenticate';

export const recommendationsRouter = Router();
recommendationsRouter.use(optionalAuthenticate);
recommendationsRouter.get('/', getRecommendationGroups);
recommendationsRouter.get('/:type', getRecommendationGroup);
