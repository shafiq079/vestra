import { useLayoutEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnnouncementBar } from '@/components/layout/announcement-bar';
import { Header } from '@/components/layout/header';
import { CartDrawer } from '@/components/layout/cart-drawer';
import { MobileMenu } from '@/components/layout/mobile-menu';
import { SearchOverlay } from '@/components/layout/search-overlay';
import { Footer } from '@/components/layout/footer';

export function StorefrontLayout() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);

  return (
    <>
      <AnnouncementBar />
      <Header />
      <CartDrawer />
      <MobileMenu />
      <SearchOverlay />
      <main className="min-h-[calc(100dvh-6rem)]">
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
