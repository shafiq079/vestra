import { USE_MOCK_API } from './apiClient';
import { getReviewsByProductId } from '../mocks/reviews';
import type { Review } from '../types';

// Public product-review reads are not exposed by the Phase 7 API. Do not
// present demo reviews as database records in real mode.
export async function getProductReviews(productId: string): Promise<Review[]> {
  return USE_MOCK_API ? getReviewsByProductId(productId) : [];
}
