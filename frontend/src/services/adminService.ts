import { apiClient } from './apiClient';
import type { AdminDashboardMetrics, Product, ProductImage, Category, Order } from '../types';

export interface DashboardDetails {
  sales: { month: string; revenue: number }[];
  topProducts: { productId: string; productName: string; unitsSold: number; revenue: number }[];
  recentOrders: { id: string; orderNumber: string; customer: string; date: string; status: string; total: number }[];
  lowStockVariants: { sku: string; productName: string; colour: string; size: string; stock: number }[];
  systemIssues: { id: string; severity: 'error' | 'warning' | 'info'; message: string; time: string }[];
}
export interface CsvImportResult { totalRows: number; importedCount: number; errorCount: number; imported: Product[]; errors: { row: number; errors: string[] }[]; }

export async function getAdminPromotions() { return (await apiClient.get('/admin/promotions')).data; }
export async function getAdminReviews() { return (await apiClient.get('/admin/reviews')).data; }
export async function getDashboardDetails(): Promise<DashboardDetails> {
  const [orders, products] = await Promise.all([getAdminOrders() as Promise<Order[]>, getAdminInventory()]);
  const byProduct = new Map<string, { productName: string; unitsSold: number; revenue: number }>();
  const paidOrders = orders.filter((item) => item.paymentStatus === 'paid');
  for (const order of paidOrders) for (const item of order.items) {
    const current = byProduct.get(item.productId) ?? { productName: item.productName, unitsSold: 0, revenue: 0 };
    current.unitsSold += item.quantity; current.revenue += item.price * item.quantity; byProduct.set(item.productId, current);
  }
  const now = new Date();
  const sales = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + index, 1));
    const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
    const revenue = paidOrders.reduce((total, order) => { const created = new Date(order.createdAt); return `${created.getUTCFullYear()}-${created.getUTCMonth()}` === key ? total + order.total : total; }, 0);
    return { month: new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(date), revenue: Number(revenue.toFixed(2)) };
  });
  return { sales, topProducts: [...byProduct].map(([productId, value]) => ({ productId, ...value })).sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 5),
    recentOrders: orders.slice(0, 5).map((order) => ({ id: order.id, orderNumber: order.orderNumber, customer: `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`, date: order.createdAt, status: order.status, total: order.total })),
    lowStockVariants: products.flatMap((product) => product.variants.filter((variant) => variant.stock <= 5).map((variant) => ({ sku: variant.sku, productName: product.name, colour: variant.colour, size: variant.size, stock: variant.stock }))).slice(0, 5), systemIssues: [] };
}
export async function importAdminProducts(csv: string): Promise<CsvImportResult> { return (await apiClient.post<CsvImportResult>('/admin/products/import', csv, { headers: { 'Content-Type': 'text/csv' } })).data; }
export async function uploadAdminImage(file: File): Promise<Omit<ProductImage, 'id'>> { const data = new FormData(); data.append('image', file); return (await apiClient.post<Omit<ProductImage, 'id'>>('/admin/images', data, { headers: { 'Content-Type': 'multipart/form-data' } })).data; }
export async function getDashboardMetrics(): Promise<AdminDashboardMetrics> { return (await apiClient.get<AdminDashboardMetrics>('/admin/dashboard')).data; }
export async function getAdminUsers() { return (await apiClient.get('/admin/users')).data; }
export async function getAdminOrders() { return (await apiClient.get('/admin/orders')).data; }
export async function getAdminProducts(): Promise<Product[]> { return (await apiClient.get<Product[]>('/admin/products')).data; }
export async function getAdminProduct(id: string): Promise<Product | null> { return (await apiClient.get<Product>(`/admin/products/${id}`)).data; }
export async function createAdminProduct(input: Omit<Product, 'id' | 'createdAt'>): Promise<Product> { return (await apiClient.post<Product>('/admin/products', input)).data; }
export async function updateAdminProduct(id: string, updates: Partial<Product>): Promise<Product | null> { return (await apiClient.put<Product>(`/admin/products/${id}`, updates)).data; }
export async function deleteAdminProduct(id: string): Promise<boolean> { await apiClient.delete(`/admin/products/${id}`); return true; }
export async function duplicateAdminProduct(id: string): Promise<Product | null> { return (await apiClient.post<Product>(`/admin/products/${id}/duplicate`)).data; }
export async function setAdminProductPublished(id: string, isPublished: boolean): Promise<Product | null> { return (await apiClient.patch<Product>(`/admin/products/${id}/published`, { isPublished })).data; }
export async function bulkSetAdminProductPublished(ids: string[], isPublished: boolean): Promise<Product[]> { return (await apiClient.post<Product[]>('/admin/products/bulk/publish', { ids, isPublished })).data; }
export async function bulkDeleteAdminProducts(ids: string[]): Promise<number> { return (await apiClient.post<{ deleted: number }>('/admin/products/bulk/delete', { ids })).data.deleted; }
export async function resetAdminProducts(): Promise<Product[]> { return (await apiClient.post<Product[]>('/admin/products/reset')).data; }
export async function getAdminCategories(): Promise<Category[]> { return (await apiClient.get<Category[]>('/admin/categories')).data; }
export async function createAdminCategory(input: Omit<Category, 'id'>): Promise<Category> { return (await apiClient.post<Category>('/admin/categories', input)).data; }
export async function updateAdminCategory(id: string, updates: Partial<Category>): Promise<Category | null> { return (await apiClient.put<Category>(`/admin/categories/${id}`, updates)).data; }
export async function deleteAdminCategory(id: string): Promise<boolean> { await apiClient.delete(`/admin/categories/${id}`); return true; }
export async function getAdminInventory(): Promise<Product[]> { return (await apiClient.get<Product[]>('/admin/inventory')).data; }
export async function updateVariantStock(productId: string, variantId: string, stock: number): Promise<Product | null> { return (await apiClient.patch<Product>(`/admin/inventory/${productId}/variants/${variantId}`, { stock })).data; }
