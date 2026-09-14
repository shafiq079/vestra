import type { RequestHandler } from 'express';
import * as sizeRecommendation from '../services/sizeRecommendationService';
import type { SizeRecommendationMlClient } from '../services/sizeRecommendationMlClient';
import { parseProductId, parseSizeRecommendationRequest } from '../validators/sizeRecommendation';

export function createSizeRecommendationController(client: SizeRecommendationMlClient) {
  const getSchema: RequestHandler = async (req, res) => {
    res.json(await sizeRecommendation.sizeFormSchema(parseProductId(req.params.productId), client));
  };

  const recommend: RequestHandler = async (req, res) => {
    res.json(await sizeRecommendation.recommendSize(parseSizeRecommendationRequest(req.body), client));
  };

  return { getSchema, recommend };
}
