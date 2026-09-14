import { apiClient } from './apiClient';
import type { SizeRecommendationFormSchema, SizeRecommendationRequest, SizeRecommendationResult } from '../types';

export async function getSizeFormSchema(productId: string): Promise<SizeRecommendationFormSchema> {
  return (await apiClient.get<SizeRecommendationFormSchema>(`/size-recommendation/schema/${productId}`)).data;
}

export async function submitSizeRecommendation(request: SizeRecommendationRequest): Promise<SizeRecommendationResult> {
  return (await apiClient.post<SizeRecommendationResult>('/size-recommendation', request)).data;
}
