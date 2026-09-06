import { USE_MOCK_API, apiClient, clearGuestCartId, getStoredGuestCartId, guestCartHeaders } from './apiClient';
import { mockPromotions } from '../mocks/dashboard';
import type { Cart, Product } from '../types';

export async function getCart(): Promise<Cart> {
  if (USE_MOCK_API) return { items: [], subtotal: 0, discount: 0, estimatedTotal: 0 };
  return (await apiClient.get<Cart>('/cart', { headers: guestCartHeaders() })).data;
}

export async function mergeGuestCart(): Promise<Cart> {
  if (!getStoredGuestCartId()) return getCart();
  const cart = (await apiClient.post<Cart>('/cart/merge', undefined, { headers: guestCartHeaders(true) })).data;
  clearGuestCartId();
  return cart;
}

export async function addToCart(product: Product, variantId: string, colour: string, size: string, quantity: number): Promise<Cart | undefined> {
  if (USE_MOCK_API) {
    await new Promise((r) => setTimeout(r, 300));
    return;
  }
  return (await apiClient.post<Cart>('/cart/items', { productId: product.id, variantId, colour, size, quantity }, { headers: guestCartHeaders() })).data;
}

export async function updateCartItem(itemId: string, quantity: number): Promise<Cart | undefined> {
  if (USE_MOCK_API) {
    await new Promise((r) => setTimeout(r, 200));
    return;
  }
  return (await apiClient.patch<Cart>(`/cart/items/${itemId}`, { quantity }, { headers: guestCartHeaders() })).data;
}

export async function removeFromCart(itemId: string): Promise<Cart | undefined> {
  if (USE_MOCK_API) {
    await new Promise((r) => setTimeout(r, 200));
    return;
  }
  return (await apiClient.delete<Cart>(`/cart/items/${itemId}`, { headers: guestCartHeaders() })).data;
}

export async function applyPromoCode(code: string, subtotal: number): Promise<{ valid: boolean; discount: number; message: string }> {
  if (USE_MOCK_API) {
    await new Promise((r) => setTimeout(r, 400));
    const promo = mockPromotions.find((p) => p.code.toUpperCase() === code.toUpperCase() && p.active);
    if (!promo) return { valid: false, discount: 0, message: 'Invalid or expired promo code' };
    const discount = promo.discountType === 'percentage' ? subtotal * promo.value / 100 : promo.value;
    return { valid: true, discount: Number(discount.toFixed(2)), message: 'Promo code applied' };
  }
  const response = await apiClient.post('/cart/promo', { code }, { headers: guestCartHeaders() });
  return response.data;
}

export async function clearCart(): Promise<Cart | undefined> {
  if (USE_MOCK_API) {
    await new Promise((r) => setTimeout(r, 100));
    return;
  }
  return (await apiClient.delete<Cart>('/cart', { headers: guestCartHeaders() })).data;
}

export async function removePromoCode(): Promise<Cart> {
  if (USE_MOCK_API) return { items: [], subtotal: 0, discount: 0, estimatedTotal: 0 };
  return (await apiClient.delete<Cart>('/cart/promo', { headers: guestCartHeaders() })).data;
}
