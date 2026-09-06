import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product, WishlistItem } from '../types';
import { USE_MOCK_API } from '../services/apiClient';
import * as service from '../services/wishlistService';

interface WishlistState {
  items: WishlistItem[];
  hydrate: () => Promise<void>;
  addItem: (product: Product) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  toggleItem: (product: Product) => Promise<void>;
  clearWishlist: () => void;
  hasItem: (productId: string) => boolean;
}
const itemsFrom = (products: Product[]): WishlistItem[] => products.map((product) => ({ id: product.id, productId: product.id, product, addedAt: '' }));
export const useWishlistStore = create<WishlistState>()(persist((set, get) => ({
  items: [],
  hydrate: async () => { if (!USE_MOCK_API) set({ items: itemsFrom(await service.getWishlist()) }); },
  addItem: async (product) => { if (!get().hasItem(product.id)) await get().toggleItem(product); },
  removeItem: async (id) => { const item = get().items.find((entry) => entry.productId === id); if (item) await get().toggleItem(item.product); },
  toggleItem: async (product) => {
    if (!USE_MOCK_API) { const products = await service.toggleWishlist(product.id); if (products) set({ items: itemsFrom(products) }); return; }
    set((state) => state.items.some((item) => item.productId === product.id)
      ? { items: state.items.filter((item) => item.productId !== product.id) }
      : { items: [...state.items, { id: product.id, productId: product.id, product, addedAt: new Date().toISOString() }] });
  },
  clearWishlist: () => set({ items: [] }),
  hasItem: (id) => get().items.some((item) => item.productId === id),
}), { name: 'vestra-wishlist', partialize: (state) => USE_MOCK_API ? { items: state.items } : { items: [] } }));
