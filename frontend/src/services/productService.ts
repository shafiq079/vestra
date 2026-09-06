import { USE_MOCK_API, apiClient } from './apiClient';
import type { ApiError, Product, PaginatedResult, FilterState } from '../types';
import { mockRequest } from '../mocks/mockDatabase';
import * as repo from '../mocks/productRepository';

const isNotFound = (error: unknown) => ['NOT_FOUND', 'HTTP_404'].includes((error as ApiError)?.code);

export async function getFacetProducts(context?: Pick<FilterState, 'genderCollection' | 'onSale'>): Promise<Product[]> {
  if (USE_MOCK_API) {
    let products = repo.getProducts().filter((product) => product.isPublished);
    if (context?.genderCollection) products = products.filter((product) => product.genderCollection === context.genderCollection);
    if (context?.onSale) products = products.filter((product) => product.salePrice !== undefined && product.salePrice < product.price);
    return mockRequest(products);
  }
  return (await apiClient.get<Product[]>('/products', { params: context })).data;
}

export async function getProducts(filters?: FilterState, page = 1, pageSize = 12): Promise<PaginatedResult<Product>> {
  if (USE_MOCK_API) {
    let products = repo.getProducts().filter((p) => p.isPublished);

    if (filters?.genderCollection) products = products.filter((p) => p.genderCollection === filters.genderCollection);
    if (filters?.category && filters.category.length > 0) products = products.filter((p) => filters.category!.includes(p.category));
    if (filters?.onSale) products = products.filter((p) => p.salePrice !== undefined && p.salePrice < p.price);
    if (filters?.tryOnEligible) products = products.filter((p) => p.tryOnEligible);
    if (filters?.sizeRecEligible) products = products.filter((p) => p.sizeRecommendationEligible);
    if (filters?.minPrice !== undefined) products = products.filter((p) => (p.salePrice ?? p.price) >= filters.minPrice!);
    if (filters?.maxPrice !== undefined) products = products.filter((p) => (p.salePrice ?? p.price) <= filters.maxPrice!);
    if (filters?.size && filters.size.length > 0) products = products.filter((p) => filters.size!.some((s) => p.availableSizes.includes(s)));
    if (filters?.colour && filters.colour.length > 0) products = products.filter((p) => filters.colour!.some((c) => p.colours.includes(c)));
    if (filters?.brand && filters.brand.length > 0) products = products.filter((p) => filters.brand!.includes(p.brand));
    if (filters?.rating) products = products.filter((p) => p.rating >= filters.rating!);
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      products = products.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.shortDescription.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.recommendationTags.some((t) => t.toLowerCase().includes(q))
      );
    }

    switch (filters?.sortBy) {
      case 'newest': products.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); break;
      case 'price_asc': products.sort((a, b) => (a.salePrice ?? a.price) - (b.salePrice ?? b.price)); break;
      case 'price_desc': products.sort((a, b) => (b.salePrice ?? b.price) - (a.salePrice ?? a.price)); break;
      case 'rating': products.sort((a, b) => b.rating - a.rating); break;
      case 'bestselling': products.sort((a, b) => b.reviewCount - a.reviewCount); break;
      default: break;
    }

    const total = products.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const items = products.slice(start, start + pageSize);

    return mockRequest({ items, total, page, pageSize, totalPages });
  }
  const response = await apiClient.get('/products', { params: { ...filters, page, pageSize } });
  return response.data;
}

export async function getProduct(slug: string): Promise<Product | null> {
  if (USE_MOCK_API) {
    await new Promise((r) => setTimeout(r, 300));
    return repo.getProductBySlug(slug) || null;
  }
  try { return (await apiClient.get<Product>(`/products/${slug}`)).data; }
  catch (error) { if (isNotFound(error)) return null; throw error; }
}

export async function getFeatured(): Promise<Product[]> {
  if (USE_MOCK_API) {
    const products = repo.getProducts().filter((p) => p.isPublished && (p.badges.includes('bestseller') || p.badges.includes('new'))).slice(0, 8);
    return mockRequest(products);
  }
  const response = await apiClient.get('/products/featured');
  return response.data;
}

export async function getNewIn(): Promise<Product[]> {
  if (USE_MOCK_API) {
    const products = repo.getProducts().filter((p) => p.isPublished && p.badges.includes('new')).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8);
    return mockRequest(products);
  }
  const response = await apiClient.get('/products/new');
  return response.data;
}

export async function getSale(): Promise<Product[]> {
  if (USE_MOCK_API) {
    const products = repo.getProducts().filter((p) => p.isPublished && p.salePrice !== undefined && p.salePrice < p.price);
    return mockRequest(products);
  }
  const response = await apiClient.get('/products/sale');
  return response.data;
}

export async function getByCategory(slug: string): Promise<Product[]> {
  if (USE_MOCK_API) {
    const products = repo.getProducts().filter((p) => p.isPublished && p.category.toLowerCase() === slug.toLowerCase());
    return mockRequest(products);
  }
  const response = await apiClient.get(`/products?category=${slug}`);
  return response.data;
}

export async function getByGender(gender: string): Promise<Product[]> {
  if (USE_MOCK_API) {
    const products = repo.getProducts().filter((p) => p.isPublished && p.genderCollection === gender);
    return mockRequest(products);
  }
  const response = await apiClient.get(`/products?genderCollection=${gender}`);
  return response.data;
}

export async function getByCollection(slug: string): Promise<Product[]> {
  if (USE_MOCK_API) {
    const products = repo.getProducts().filter((p) => p.isPublished && p.collection === slug);
    return mockRequest(products);
  }
  const response = await apiClient.get(`/products?collection=${slug}`);
  return response.data;
}

export async function getRelated(productId: string): Promise<Product[]> {
  if (USE_MOCK_API) {
    const product = repo.getProductById(productId);
    if (!product) return mockRequest([]);
    const related = product.relatedProductIds.map((id) => repo.getProductById(id)).filter((p): p is Product => p !== undefined && p.isPublished).slice(0, 4);
    return mockRequest(related);
  }
  const response = await apiClient.get(`/products/${productId}/related`);
  return response.data;
}

export async function search(query: string): Promise<Product[]> {
  if (USE_MOCK_API) {
    const q = query.toLowerCase();
    const products = repo.getProducts().filter((p) =>
      p.isPublished &&
      (p.name.toLowerCase().includes(q) ||
        p.shortDescription.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.recommendationTags.some((t) => t.toLowerCase().includes(q)))
    );
    return mockRequest(products);
  }
  const response = await apiClient.get('/products/search', { params: { q: query } });
  return response.data;
}

export async function getTryOnEligible(): Promise<Product[]> {
  if (USE_MOCK_API) {
    const products = repo.getProducts().filter((p) => p.isPublished && p.tryOnEligible);
    return mockRequest(products);
  }
  const response = await apiClient.get('/products?tryOnEligible=true');
  return response.data;
}
