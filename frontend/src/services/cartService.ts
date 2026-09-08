import { apiClient, clearGuestCartId, getStoredGuestCartId, guestCartHeaders } from './apiClient';
import type { Cart, Product } from '../types';
export async function getCart(): Promise<Cart> { return (await apiClient.get<Cart>('/cart', { headers: guestCartHeaders() })).data; }
export async function mergeGuestCart(): Promise<Cart> { if (!getStoredGuestCartId()) return getCart(); const cart = (await apiClient.post<Cart>('/cart/merge', undefined, { headers: guestCartHeaders(true) })).data; clearGuestCartId(); return cart; }
export async function addToCart(product: Product, variantId: string, colour: string, size: string, quantity: number): Promise<Cart> { return (await apiClient.post<Cart>('/cart/items', { productId: product.id, variantId, colour, size, quantity }, { headers: guestCartHeaders() })).data; }
export async function updateCartItem(itemId: string, quantity: number): Promise<Cart> { return (await apiClient.patch<Cart>(`/cart/items/${itemId}`, { quantity }, { headers: guestCartHeaders() })).data; }
export async function removeFromCart(itemId: string): Promise<Cart> { return (await apiClient.delete<Cart>(`/cart/items/${itemId}`, { headers: guestCartHeaders() })).data; }
export async function applyPromoCode(code: string, _subtotal?: number): Promise<{ valid: boolean; discount: number; message: string }> { return (await apiClient.post('/cart/promo', { code }, { headers: guestCartHeaders() })).data; }
export async function clearCart(): Promise<Cart> { return (await apiClient.delete<Cart>('/cart', { headers: guestCartHeaders() })).data; }
export async function removePromoCode(): Promise<Cart> { return (await apiClient.delete<Cart>('/cart/promo', { headers: guestCartHeaders() })).data; }
