import { apiClient } from './apiClient';
import type { ApiError, RecommendationGroup, RecommendationType } from '../types';
export interface RecommendationContext { productId?: string; limit?: number }
export async function getRecommendations(type: RecommendationType, context?: RecommendationContext): Promise<RecommendationGroup | null> { try { return (await apiClient.get<RecommendationGroup>(`/recommendations/${type}`, { params: context })).data; } catch (error) { const apiError = error as ApiError; if (['NOT_FOUND', 'HTTP_404'].includes(apiError.code)) return null; throw error; } }
export async function getRecommendationsByPage(placement: string): Promise<RecommendationGroup[]> { return (await apiClient.get<RecommendationGroup[]>('/recommendations', { params: { placement } })).data; }
export async function getAllRecommendationGroups(): Promise<RecommendationGroup[]> { return (await apiClient.get<RecommendationGroup[]>('/recommendations')).data; }
