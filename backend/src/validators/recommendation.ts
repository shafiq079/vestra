import { Types } from 'mongoose';
import { z } from 'zod';
import { HttpError } from '../utils/httpError';

export const RECOMMENDATION_TYPES = ['recommended_for_you', 'similar_styles', 'complete_the_look',
  'frequently_bought_together', 'based_on_recently_viewed', 'inspired_by_wishlist',
  'trending_in_your_size', 'new_arrivals_you_may_like', 'trending'] as const;
export type RecommendationType = (typeof RECOMMENDATION_TYPES)[number];
export const RECOMMENDATION_PLACEMENTS = ['homepage', 'product_detail', 'account'] as const;

export interface RecommendationQuery { productId?: Types.ObjectId; limit: number; placement?: string }

function invalid(field: string, message: string): never {
  throw HttpError.badRequest('Invalid recommendation request.', { [field]: [message] });
}

export function parseRecommendationType(value: string): RecommendationType {
  const result = z.enum(RECOMMENDATION_TYPES).safeParse(value);
  if (!result.success) invalid('type', `Must be one of: ${RECOMMENDATION_TYPES.join(', ')}.`);
  return result.data;
}

export function parseRecommendationQuery(query: Record<string, unknown>, allowPlacement: boolean): RecommendationQuery {
  for (const key of ['productId', 'limit', 'placement']) {
    if (query[key] !== undefined && typeof query[key] !== 'string') invalid(key, 'Must be supplied once.');
  }
  const productId = query.productId as string | undefined;
  if (productId !== undefined && !Types.ObjectId.isValid(productId)) invalid('productId', 'Must be a valid MongoDB ObjectId.');
  const rawLimit = query.limit as string | undefined;
  const parsedLimit = rawLimit === undefined ? 4 : Number(rawLimit);
  if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 8) invalid('limit', 'Must be an integer from 1 to 8.');
  const placement = query.placement as string | undefined;
  if (placement !== undefined && (!allowPlacement || !RECOMMENDATION_PLACEMENTS.includes(placement as typeof RECOMMENDATION_PLACEMENTS[number]))) {
    invalid('placement', `Must be one of: ${RECOMMENDATION_PLACEMENTS.join(', ')}.`);
  }
  return { ...(productId ? { productId: new Types.ObjectId(productId) } : {}), limit: parsedLimit,
    ...(placement ? { placement } : {}) };
}
