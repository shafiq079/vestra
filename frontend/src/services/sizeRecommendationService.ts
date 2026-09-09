import type { SizeRecommendationFormSchema, SizeRecommendationRequest, SizeRecommendationResult } from '../types';
const unavailable = (): never => { throw new Error('ML size recommendation is not available until Phase 13.'); };
export async function getSizeFormSchema(_productId: string, _sizeModelKey: string): Promise<SizeRecommendationFormSchema> { return unavailable(); }
export async function submitSizeRecommendation(_request: SizeRecommendationRequest): Promise<SizeRecommendationResult> { return unavailable(); }
