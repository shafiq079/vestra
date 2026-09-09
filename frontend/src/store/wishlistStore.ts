import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product, WishlistItem } from '../types';
import { AUTH_TOKEN_KEY } from '../services/apiClient';
import * as service from '../services/wishlistService';

interface WishlistState {
  items: WishlistItem[];
  guestItems: WishlistItem[];
  hydrate: () => Promise<void>;
  mergeGuestWishlist: () => Promise<void>;
  addItem: (product: Product) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  toggleItem: (product: Product) => Promise<void>;
  handleLogout: () => void;
  hasItem: (productId: string) => boolean;
}

const itemsFrom = (products: Product[]): WishlistItem[] => products.map((product) => ({
  id: product.id,
  productId: product.id,
  product,
  addedAt: '',
}));

export const useWishlistStore = create<WishlistState>()(persist((set, get) => ({
  items: [],
  guestItems: [],
  hydrate: async () => {
    if (localStorage.getItem(AUTH_TOKEN_KEY)) set({ items: itemsFrom(await service.getWishlist()) });
  },
  mergeGuestWishlist: async () => {
    if (!localStorage.getItem(AUTH_TOKEN_KEY)) return;
    const guestItems = [...get().guestItems];
    const serverProducts = await service.getWishlist();
    const serverIds = new Set(serverProducts.map((product) => product.id));
    for (const item of guestItems) {
      if (!serverIds.has(item.productId)) {
        await service.toggleWishlist(item.productId);
        serverIds.add(item.productId);
      }
    }
    const finalProducts = await service.getWishlist();
    set({ items: itemsFrom(finalProducts), guestItems: [] });
  },
  addItem: async (product) => { if (!get().hasItem(product.id)) await get().toggleItem(product); },
  removeItem: async (id) => { const item = get().items.find((entry) => entry.productId === id); if (item) await get().toggleItem(item.product); },
  toggleItem: async (product) => {
    if (localStorage.getItem(AUTH_TOKEN_KEY)) {
      set({ items: itemsFrom(await service.toggleWishlist(product.id)) });
      return;
    }
    set((state) => {
      const items = state.items.some((item) => item.productId === product.id)
        ? state.items.filter((item) => item.productId !== product.id)
        : [...state.items, { id: product.id, productId: product.id, product, addedAt: new Date().toISOString() }];
      return { items, guestItems: items };
    });
  },
  handleLogout: () => {
    set((state) => ({ items: state.guestItems }));
  },
  hasItem: (id) => get().items.some((item) => item.productId === id),
}), {
  name: 'vestra-wishlist',
  partialize: (state) => ({ items: state.guestItems, guestItems: state.guestItems }),
}));
