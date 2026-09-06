import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import { useWishlistStore } from '@/store/wishlistStore';

export function useApiBootstrap() {
  useEffect(() => {
    void (async () => {
      await useAuthStore.getState().hydrate();
      await useCartStore.getState().hydrate();
      if (useAuthStore.getState().isAuthenticated) await useWishlistStore.getState().hydrate();
    })();
  }, []);
}
