import { USE_MOCK_API, apiClient } from './apiClient';
import type { Product } from '../types';

export async function toggleWishlist(productId: string): Promise<Product[] | undefined> {
  if (USE_MOCK_API) {
    await new Promise((r) => setTimeout(r, 200));
    return;
  }
  return (await apiClient.post<Product[]>('/wishlist/toggle', { productId })).data;
}

export async function getWishlist(): Promise<Product[]> {
  if (USE_MOCK_API) {
    await new Promise((r) => setTimeout(r, 200));
    return [];
  }
  const response = await apiClient.get('/wishlist');
  return response.data;
}
