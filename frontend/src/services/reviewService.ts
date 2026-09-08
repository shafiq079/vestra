import type { Review } from '../types';
// The implemented API exposes aggregate review counts publicly, but no public review-detail route.
export async function getProductReviews(_productId: string): Promise<Review[]> { return []; }
