import { USE_MOCK_API } from './apiClient';
// Phase 9 has not shipped: real mode returns an honest unavailable state.
import { mockRecommendationGroups, getRecommendationsByType, getRecommendationsByPlacement } from '../mocks/recommendations';
import { mockRequest } from '../mocks/mockDatabase';
import type { RecommendationGroup } from '../types';

export async function getRecommendations(type: string): Promise<RecommendationGroup | null> {
  if (USE_MOCK_API) {
    await new Promise((r) => setTimeout(r, 350));
    return getRecommendationsByType(type) || null;
  }
  return null;
}

export async function getRecommendationsByPage(placement: string): Promise<RecommendationGroup[]> {
  if (USE_MOCK_API) return mockRequest(getRecommendationsByPlacement(placement));
  return [];
}

export async function getAllRecommendationGroups(): Promise<RecommendationGroup[]> {
  if (USE_MOCK_API) return mockRequest(mockRecommendationGroups);
  return [];
}
