import type { RequestHandler } from 'express';
import * as recommendations from '../services/recommendationService';
import { parseRecommendationQuery, parseRecommendationType } from '../validators/recommendation';

const parameter = (value: string | string[] | undefined): string => Array.isArray(value) ? value[0]! : value!;
export const getRecommendationGroups: RequestHandler = async (req, res) => {
  res.json(await recommendations.recommendationGroups(parseRecommendationQuery(req.query, true), req.auth?.userId));
};
export const getRecommendationGroup: RequestHandler = async (req, res) => {
  res.json(await recommendations.recommendationGroup(parseRecommendationType(parameter(req.params.type)),
    parseRecommendationQuery(req.query, false), req.auth?.userId));
};
