import { apiClient } from './apiClient';
import type { Product } from '../types';
export async function toggleWishlist(productId: string): Promise<Product[]> { return (await apiClient.post<Product[]>('/wishlist/toggle', { productId })).data; }
export async function getWishlist(): Promise<Product[]> { return (await apiClient.get<Product[]>('/wishlist')).data; }
