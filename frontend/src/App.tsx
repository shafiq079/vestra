import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/theme-provider';
import { StorefrontLayout } from '@/layouts/storefront-layout';
import { ProtectedAccountRoute, ProtectedAdminRoute } from '@/components/route-guards';
import { HomePage } from '@/pages/home';
import { ShopPage } from '@/pages/shop';
import { ProductPage } from '@/pages/product';
import { CategoryPage } from '@/pages/category';
import { CollectionPage } from '@/pages/collection';
import { SearchPage } from '@/pages/search';
import { CartPage } from '@/pages/cart';
import { CheckoutPage } from '@/pages/checkout';
import { OrderConfirmationPage } from '@/pages/order-confirmation';
import { VirtualFittingRoomPage } from '@/pages/virtual-fitting-room';
import { LoginPage } from '@/pages/login';
import { RegisterPage } from '@/pages/register';
import { AccountLayout } from '@/layouts/account-layout';
import { AccountOrdersPage } from '@/pages/account/orders';
import { AccountWishlistPage } from '@/pages/account/wishlist';
import { AccountAddressesPage } from '@/pages/account/addresses';
import { AccountMeasurementsPage } from '@/pages/account/measurements';
import { AccountRecommendationsPage } from '@/pages/account/recommendations';
import { AccountSettingsPage } from '@/pages/account/settings';
import { AboutPage } from '@/pages/about';
import { ContactPage } from '@/pages/contact';
import { FaqPage } from '@/pages/faq';
import { DeliveryReturnsPage } from '@/pages/delivery-returns';
import { PrivacyPage } from '@/pages/privacy';
import { TermsPage } from '@/pages/terms';
import { AccessibilityPage } from '@/pages/accessibility';
import { SizeGuidePage } from '@/pages/size-guide';
import { NotFoundPage } from '@/pages/not-found';
import { AdminLayout } from '@/layouts/admin-layout';
import { AdminDashboardPage } from '@/pages/admin/dashboard';
import { AdminProductsPage } from '@/pages/admin/products';
import { AdminProductNewPage } from '@/pages/admin/product-new';
import { AdminProductEditPage } from '@/pages/admin/product-edit';
import { AdminCategoriesPage } from '@/pages/admin/categories';
import { AdminInventoryPage } from '@/pages/admin/inventory';
import { AdminOrdersPage } from '@/pages/admin/orders';
import { AdminUsersPage } from '@/pages/admin/users';
import { AdminReviewsPage } from '@/pages/admin/reviews';
import { AdminPromotionsPage } from '@/pages/admin/promotions';
import { AdminAiFeaturesPage } from '@/pages/admin/ai-features';
import { useApiBootstrap } from '@/hooks/use-api-bootstrap';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60000, retry: 1 } },
});

export function App() {
  useApiBootstrap();
  return (
    <ThemeProvider defaultTheme="light" storageKey="vestra-theme">
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route element={<StorefrontLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/shop" element={<ShopPage />} />
              <Route path="/new-in" element={<ShopPage />} />
              <Route path="/women" element={<ShopPage />} />
              <Route path="/men" element={<ShopPage />} />
              <Route path="/category/:slug" element={<CategoryPage />} />
              <Route path="/collection/:slug" element={<CollectionPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/product/:slug" element={<ProductPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/order-confirmation/:orderId" element={<OrderConfirmationPage />} />
              <Route path="/virtual-fitting-room" element={<VirtualFittingRoomPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route element={<ProtectedAccountRoute />}>
                <Route path="/account" element={<AccountLayout />}>
                  <Route index element={<AccountOrdersPage />} />
                  <Route path="orders" element={<AccountOrdersPage />} />
                  <Route path="wishlist" element={<AccountWishlistPage />} />
                  <Route path="addresses" element={<AccountAddressesPage />} />
                  <Route path="measurements" element={<AccountMeasurementsPage />} />
                  <Route path="recommendations" element={<AccountRecommendationsPage />} />
                  <Route path="settings" element={<AccountSettingsPage />} />
                </Route>
              </Route>
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/faq" element={<FaqPage />} />
              <Route path="/delivery-returns" element={<DeliveryReturnsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/accessibility" element={<AccessibilityPage />} />
              <Route path="/size-guide" element={<SizeGuidePage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
            <Route element={<ProtectedAdminRoute />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboardPage />} />
                <Route path="products" element={<AdminProductsPage />} />
                <Route path="products/new" element={<AdminProductNewPage />} />
                <Route path="products/:productId/edit" element={<AdminProductEditPage />} />
                <Route path="categories" element={<AdminCategoriesPage />} />
                <Route path="inventory" element={<AdminInventoryPage />} />
                <Route path="orders" element={<AdminOrdersPage />} />
                <Route path="users" element={<AdminUsersPage />} />
                <Route path="reviews" element={<AdminReviewsPage />} />
                <Route path="promotions" element={<AdminPromotionsPage />} />
                <Route path="ai-features" element={<AdminAiFeaturesPage />} />
              </Route>
            </Route>
          </Routes>
          <Toaster position="top-center" richColors />
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
