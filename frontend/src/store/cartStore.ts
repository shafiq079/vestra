import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Cart, CartItem, Product } from '../types';
import * as service from '../services/cartService';

interface CartState {
  items: CartItem[]; promoCode?: string; discount: number; isLoading: boolean;
  replaceCart: (cart: Cart) => void; resetLocalCart: () => void; hydrate: () => Promise<void>;
  addItem: (product: Product, variantId: string, colour: string, size: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>; updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  updateVariant: (itemId: string, variantId: string, colour: string, size: string) => void;
  clearCart: () => Promise<void>; applyPromoCode: (code: string, discount: number) => void; removePromoCode: () => Promise<void>;
  getSubtotal: () => number; getTotal: (deliveryCost: number) => number; getItemCount: () => number;
}
const cartState = (cart: Cart) => ({ items: cart.items, promoCode: cart.promoCode, discount: cart.discount });
export const useCartStore = create<CartState>()(persist((set, get) => ({
  items: [], promoCode: undefined, discount: 0, isLoading: false,
  replaceCart: (cart) => set(cartState(cart)), resetLocalCart: () => set({ items: [], promoCode: undefined, discount: 0 }),
  hydrate: async () => { set({ isLoading: true }); try { set(cartState(await service.getCart())); } finally { set({ isLoading: false }); } },
  addItem: async (product, variantId, colour, size, quantity) => { set(cartState(await service.addToCart(product, variantId, colour, size, quantity))); },
  removeItem: async (id) => { set(cartState(await service.removeFromCart(id))); },
  updateQuantity: async (id, quantity) => { if (quantity <= 0) return get().removeItem(id); set(cartState(await service.updateCartItem(id, quantity))); },
  updateVariant: (id, variantId, colour, size) => set((state) => ({ items: state.items.map((item) => item.id === id ? { ...item, variantId, colour, size } : item) })),
  clearCart: async () => { set(cartState(await service.clearCart())); }, applyPromoCode: (code, discount) => set({ promoCode: code, discount }),
  removePromoCode: async () => { set(cartState(await service.removePromoCode())); },
  getSubtotal: () => get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),
  getTotal: (deliveryCost) => Math.max(0, get().getSubtotal() - get().discount + deliveryCost),
  getItemCount: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
}), { name: 'vestra-cart', partialize: () => ({ items: [], discount: 0 }) }));
