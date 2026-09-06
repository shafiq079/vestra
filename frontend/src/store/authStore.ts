import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';
import { USE_MOCK_API } from '../services/apiClient';
import * as authService from '../services/authService';
import * as profileService from '../services/profileService';
import { mergeGuestCart } from '../services/cartService';
import { useCartStore } from './cartStore';
import { useWishlistStore } from './wishlistStore';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  loginDemo: (role: 'customer' | 'admin') => Promise<void>;
  register: (data: { firstName: string; lastName: string; email: string; password: string; marketingOptIn: boolean }) => Promise<User>;
  hydrate: () => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  replaceUser: (user: User) => void;
}

const demoCredentials = {
  customer: { email: 'emma.thompson@example.co.uk', password: import.meta.env.VITE_DEMO_CUSTOMER_PASSWORD as string | undefined },
  admin: { email: 'admin@vestra.co.uk', password: import.meta.env.VITE_DEMO_ADMIN_PASSWORD as string | undefined },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const user = await authService.login(email, password);
          set({ user, isAuthenticated: true });
          if (!USE_MOCK_API) {
            await mergeGuestCart().catch(() => undefined);
            await Promise.all([useCartStore.getState().hydrate(), useWishlistStore.getState().hydrate()]);
          }
          return user;
        } finally { set({ isLoading: false }); }
      },
      loginDemo: async (role) => {
        if (USE_MOCK_API) {
          set({ user: authService.getDemoUser(role), isAuthenticated: true });
          return;
        }
        const credentials = demoCredentials[role];
        if (!credentials.password) throw new Error('This deployment has not configured demo sign-in.');
        await get().login(credentials.email, credentials.password);
      },
      register: async (data) => {
        const user = await authService.register(data);
        set({ user, isAuthenticated: true });
        if (!USE_MOCK_API) { await mergeGuestCart().catch(() => undefined); await useCartStore.getState().hydrate(); }
        return user;
      },
      hydrate: async () => {
        if (USE_MOCK_API || !get().isAuthenticated) return;
        set({ isLoading: true });
        try {
          const user = await authService.getCurrentUser(get().user?.id ?? '');
          set({ user, isAuthenticated: !!user });
        } catch {
          set({ user: null, isAuthenticated: false });
          localStorage.removeItem('vestra-auth-token');
        } finally { set({ isLoading: false }); }
      },
      logout: async () => {
        try { await authService.logout(); } finally {
          set({ user: null, isAuthenticated: false });
          useCartStore.setState({ items: [], promoCode: undefined, discount: 0 });
          useWishlistStore.getState().clearWishlist();
          if (!USE_MOCK_API) await useCartStore.getState().hydrate();
        }
      },
      updateUser: async (updates) => {
        if (USE_MOCK_API) {
          set((state) => ({ user: state.user ? { ...state.user, ...updates } : null }));
          return;
        }
        const allowed = { firstName: updates.firstName, lastName: updates.lastName, avatar: updates.avatar, marketingOptIn: updates.marketingOptIn };
        const payload = Object.fromEntries(Object.entries(allowed).filter(([, value]) => value !== undefined));
        const user = await profileService.updateProfile(payload);
        set({ user });
      },
      replaceUser: (user) => set({ user, isAuthenticated: true }),
    }),
    { name: 'vestra-auth', partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }) }
  )
);
