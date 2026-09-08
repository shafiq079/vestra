import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';
import { clearAuthTokens } from '../services/apiClient';
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
  cartMergeWarning: string | null;
  login: (email: string, password: string) => Promise<User>;
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
      cartMergeWarning: null,
      login: async (email, password) => {
        set({ isLoading: true, cartMergeWarning: null });
        try {
          const user = await authService.login(email, password);
          set({ user, isAuthenticated: true });
          try { useCartStore.getState().replaceCart(await mergeGuestCart()); }
          catch (error) {
            set({ cartMergeWarning: (error as ApiError).message || 'Your guest bag could not be merged.' });
            await useCartStore.getState().hydrate().catch(() => undefined);
          }
          await useWishlistStore.getState().mergeGuestWishlist().catch(async () => { await useWishlistStore.getState().hydrate().catch(() => undefined); });
          return user;
        } finally { set({ isLoading: false }); }
      },
      register: async (data) => {
        set({ cartMergeWarning: null });
        const user = await authService.register(data);
        set({ user, isAuthenticated: true });
        try { useCartStore.getState().replaceCart(await mergeGuestCart()); }
        catch (error) {
          set({ cartMergeWarning: (error as ApiError).message || 'Your guest bag could not be merged.' });
          await useCartStore.getState().hydrate().catch(() => undefined);
        }
        await useWishlistStore.getState().mergeGuestWishlist().catch(async () => { await useWishlistStore.getState().hydrate().catch(() => undefined); });
        return user;
      },
      hydrate: async () => {
        if (!get().isAuthenticated) return;
        set({ isLoading: true, hydrationError: null });
        try {
          const user = await authService.getCurrentUser();
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
          useWishlistStore.getState().handleLogout();
          await useCartStore.getState().hydrate().catch(() => undefined);
        }
      },
      updateUser: async (updates) => {
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
