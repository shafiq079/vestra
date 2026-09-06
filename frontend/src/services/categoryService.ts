import { USE_MOCK_API, apiClient } from './apiClient';
import { mockCategories, mockCollections, getCategoryBySlug, getCollectionBySlug, getSubcategories } from '../mocks/categories';
import { mockRequest } from '../mocks/mockDatabase';
import type { ApiError, Category, Collection } from '../types';

const isNotFound = (error: unknown) => ['NOT_FOUND', 'HTTP_404'].includes((error as ApiError)?.code);

export async function getCategories(): Promise<Category[]> {
  if (USE_MOCK_API) return mockRequest(mockCategories);
  const response = await apiClient.get('/categories');
  return response.data;
}

export async function getCollections(): Promise<Collection[]> {
  if (USE_MOCK_API) return mockRequest(mockCollections);
  const response = await apiClient.get('/collections');
  return response.data;
}

export async function getCategory(slug: string): Promise<Category | null> {
  if (USE_MOCK_API) {
    await new Promise((r) => setTimeout(r, 200));
    return getCategoryBySlug(slug) || null;
  }
  try { return (await apiClient.get<Category>(`/categories/${slug}`)).data; }
  catch (error) { if (isNotFound(error)) return null; throw error; }
}

export async function getCollection(slug: string): Promise<Collection | null> {
  if (USE_MOCK_API) {
    await new Promise((r) => setTimeout(r, 200));
    return getCollectionBySlug(slug) || null;
  }
  try { return (await apiClient.get<Collection>(`/collections/${slug}`)).data; }
  catch (error) { if (isNotFound(error)) return null; throw error; }
}

export async function getSubcategoriesByParent(parentId: string): Promise<Category[]> {
  if (USE_MOCK_API) return mockRequest(getSubcategories(parentId));
  const response = await apiClient.get(`/categories?parentId=${parentId}`);
  return response.data;
}
