import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Cart, CartItem, Product } from '../types';
import { USE_MOCK_API } from '../services/apiClient';
import * as service from '../services/cartService';

interface CartState {
  items: CartItem[]; promoCode?: string; discount: number; isLoading: boolean;
  replaceCart: (cart: Cart) => void;
  resetLocalCart: () => void;
  hydrate: () => Promise<void>;
  addItem: (product: Product, variantId: string, colour: string, size: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  updateVariant: (itemId: string, variantId: string, colour: string, size: string) => void;
  clearCart: () => Promise<void>;
  applyPromoCode: (code: string, discount: number) => void;
  removePromoCode: () => Promise<void>;
  getSubtotal: () => number; getTotal: (deliveryCost: number) => number; getItemCount: () => number;
}
const cartState = (cart: Cart) => ({ items: cart.items, promoCode: cart.promoCode, discount: cart.discount });

export const useCartStore = create<CartState>()(persist((set, get) => ({
  items: [], promoCode: undefined, discount: 0, isLoading: false,
  replaceCart: (cart) => set(cartState(cart)),
  resetLocalCart: () => set({ items: [], promoCode: undefined, discount: 0 }),
  hydrate: async () => { if (USE_MOCK_API) return; set({ isLoading: true }); try { set(cartState(await service.getCart())); } finally { set({ isLoading: false }); } },
  addItem: async (product, variantId, colour, size, quantity) => {
    if (!USE_MOCK_API) { const cart = await service.addToCart(product, variantId, colour, size, quantity); if (cart) set(cartState(cart)); return; }
    const existing = get().items.find((i) => i.productId === product.id && i.variantId === variantId);
    if (existing) set((s) => ({ items: s.items.map((i) => i.id === existing.id ? { ...i, quantity: i.quantity + quantity } : i) }));
    else set((s) => ({ items: [...s.items, { id: `cart-${Date.now()}`, productId: product.id, product, variantId, colour, size, quantity, price: product.salePrice ?? product.price }] }));
  },
  removeItem: async (id) => { if (!USE_MOCK_API) { const cart = await service.removeFromCart(id); if (cart) set(cartState(cart)); } else set((s) => ({ items: s.items.filter((i) => i.id !== id) })); },
  updateQuantity: async (id, quantity) => { if (quantity <= 0) return get().removeItem(id); if (!USE_MOCK_API) { const cart = await service.updateCartItem(id, quantity); if (cart) set(cartState(cart)); } else set((s) => ({ items: s.items.map((i) => i.id === id ? { ...i, quantity } : i) })); },
  updateVariant: (id, variantId, colour, size) => set((s) => ({ items: s.items.map((i) => i.id === id ? { ...i, variantId, colour, size } : i) })),
  clearCart: async () => { if (!USE_MOCK_API) { const cart = await service.clearCart(); if (cart) set(cartState(cart)); } else set({ items: [], promoCode: undefined, discount: 0 }); },
  applyPromoCode: (code, discount) => set({ promoCode: code, discount }),
  removePromoCode: async () => { if (!USE_MOCK_API) set(cartState(await service.removePromoCode())); else set({ promoCode: undefined, discount: 0 }); },
  getSubtotal: () => get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),
  getTotal: (deliveryCost) => Math.max(0, get().getSubtotal() - get().discount + deliveryCost),
  getItemCount: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
}), { name: 'vestra-cart', partialize: (state) => USE_MOCK_API ? { items: state.items, promoCode: state.promoCode, discount: state.discount } : { items: [], discount: 0 } }));
