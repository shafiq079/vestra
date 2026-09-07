import { apiClient } from './apiClient';
import type { ApiError, Product, PaginatedResult, FilterState } from '../types';
const isNotFound = (error: unknown) => ['NOT_FOUND', 'HTTP_404'].includes((error as ApiError)?.code);
export async function getFacetProducts(context?: Pick<FilterState, 'genderCollection' | 'onSale'>): Promise<Product[]> { return (await apiClient.get<Product[]>('/products', { params: context })).data; }
export async function getProducts(filters?: FilterState, page = 1, pageSize = 12): Promise<PaginatedResult<Product>> { return (await apiClient.get<PaginatedResult<Product>>('/products', { params: { ...filters, page, pageSize } })).data; }
export async function getProduct(slug: string): Promise<Product | null> { try { return (await apiClient.get<Product>(`/products/${slug}`)).data; } catch (error) { if (isNotFound(error)) return null; throw error; } }
export async function getFeatured(): Promise<Product[]> { return (await apiClient.get<Product[]>('/products/featured')).data; }
export async function getNewIn(): Promise<Product[]> { return (await apiClient.get<Product[]>('/products/new')).data; }
export async function getSale(): Promise<Product[]> { return (await apiClient.get<Product[]>('/products/sale')).data; }
export async function getByCategory(category: string): Promise<Product[]> { return (await apiClient.get<Product[]>('/products', { params: { category } })).data; }
export async function getByGender(genderCollection: string): Promise<Product[]> { return (await apiClient.get<Product[]>('/products', { params: { genderCollection } })).data; }
export async function getByCollection(collection: string): Promise<Product[]> { return (await apiClient.get<Product[]>('/products', { params: { collection } })).data; }
export async function getRelated(productId: string): Promise<Product[]> { return (await apiClient.get<Product[]>(`/products/${productId}/related`)).data; }
export async function search(query: string): Promise<Product[]> { return (await apiClient.get<Product[]>('/products/search', { params: { q: query } })).data; }
export async function getTryOnEligible(): Promise<Product[]> { return (await apiClient.get<Product[]>('/virtual-try-on/eligible')).data; }
