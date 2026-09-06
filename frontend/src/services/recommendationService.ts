import { apiClient, USE_MOCK_API } from './apiClient';
import { mockRecommendationGroups, getRecommendationsByType, getRecommendationsByPlacement } from '../mocks/recommendations';
import { mockRequest } from '../mocks/mockDatabase';
import type { ApiError, RecommendationGroup, RecommendationType } from '../types';

export interface RecommendationContext { productId?: string; limit?: number }

export async function getRecommendations(type: RecommendationType, context?: RecommendationContext): Promise<RecommendationGroup | null> {
  if (USE_MOCK_API) {
    await new Promise((r) => setTimeout(r, 350));
    return getRecommendationsByType(type) || null;
  }
  try {
    return (await apiClient.get<RecommendationGroup>(`/recommendations/${type}`, { params: context })).data;
  } catch (error) {
    const apiError = error as ApiError;
    if (apiError.code === 'NOT_FOUND' || apiError.code === 'HTTP_404') return null;
    throw error;
  }
}

export async function getRecommendationsByPage(placement: string): Promise<RecommendationGroup[]> {
  if (USE_MOCK_API) return mockRequest(getRecommendationsByPlacement(placement));
  return (await apiClient.get<RecommendationGroup[]>('/recommendations', { params: { placement } })).data;
}

export async function getAllRecommendationGroups(): Promise<RecommendationGroup[]> {
  if (USE_MOCK_API) return mockRequest(mockRecommendationGroups);
  return (await apiClient.get<RecommendationGroup[]>('/recommendations')).data;
}
