import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';
import { clearAuthTokens, USE_MOCK_API } from '../services/apiClient';
import type { ApiError } from '../types';
import * as authService from '../services/authService';
import * as profileService from '../services/profileService';
import { mergeGuestCart } from '../services/cartService';
import { useCartStore } from './cartStore';
import { useWishlistStore } from './wishlistStore';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hydrationError: string | null;
  login: (email: string, password: string) => Promise<User>;
  loginDemo: (role: 'customer' | 'admin') => Promise<void>;
  register: (data: { firstName: string; lastName: string; email: string; password: string; marketingOptIn: boolean }) => Promise<User>;
  hydrate: () => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  replaceUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      hydrationError: null,
      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const user = await authService.login(email, password);
          if (!USE_MOCK_API) {
            let merged;
            try { merged = await mergeGuestCart(); }
            catch (error) { await authService.logout().catch(() => undefined); throw error; }
            useCartStore.getState().replaceCart(merged);
          }
          set({ user, isAuthenticated: true });
          if (!USE_MOCK_API) await useWishlistStore.getState().hydrate().catch(() => undefined);
          return user;
        } finally { set({ isLoading: false }); }
      },
      loginDemo: async (role) => {
        if (USE_MOCK_API) {
          set({ user: authService.getDemoUser(role), isAuthenticated: true });
          return;
        }
        throw new Error(`Enter the configured demo password for the ${role} account to sign in.`);
      },
      register: async (data) => {
        const user = await authService.register(data);
        if (!USE_MOCK_API) {
          let merged;
          try { merged = await mergeGuestCart(); }
          catch (error) { await authService.logout().catch(() => undefined); throw error; }
          useCartStore.getState().replaceCart(merged);
        }
        set({ user, isAuthenticated: true });
        return user;
      },
      hydrate: async () => {
        if (USE_MOCK_API || !get().isAuthenticated) return;
        set({ isLoading: true, hydrationError: null });
        try {
          const user = await authService.getCurrentUser(get().user?.id ?? '');
          set({ user, isAuthenticated: !!user });
        } catch (error) {
          const apiError = error as ApiError;
          if (apiError.code === 'UNAUTHORIZED' || apiError.code === 'HTTP_401') {
            clearAuthTokens();
            set({ user: null, isAuthenticated: false, hydrationError: apiError.message });
          } else {
            set({ hydrationError: apiError.message || 'Unable to refresh your account right now.' });
          }
        } finally { set({ isLoading: false }); }
      },
      logout: async () => {
        try { await authService.logout(); } catch {
          // Local logout remains authoritative when the revocation request is unavailable.
        } finally {
          set({ user: null, isAuthenticated: false });
          useCartStore.setState({ items: [], promoCode: undefined, discount: 0 });
          useWishlistStore.getState().clearWishlist();
          if (!USE_MOCK_API) await useCartStore.getState().hydrate().catch(() => undefined);
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
