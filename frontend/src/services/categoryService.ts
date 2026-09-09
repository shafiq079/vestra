import { apiClient } from './apiClient';
import type { ApiError, Category, Collection } from '../types';
const isNotFound = (error: unknown) => ['NOT_FOUND', 'HTTP_404'].includes((error as ApiError)?.code);
export async function getCategories(): Promise<Category[]> { return (await apiClient.get<Category[]>('/categories')).data; }
export async function getCollections(): Promise<Collection[]> { return (await apiClient.get<Collection[]>('/collections')).data; }
export async function getCategory(slug: string): Promise<Category | null> { try { return (await apiClient.get<Category>(`/categories/${slug}`)).data; } catch (error) { if (isNotFound(error)) return null; throw error; } }
export async function getCollection(slug: string): Promise<Collection | null> { try { return (await apiClient.get<Collection>(`/collections/${slug}`)).data; } catch (error) { if (isNotFound(error)) return null; throw error; } }
export async function getSubcategoriesByParent(parentId: string): Promise<Category[]> { return (await apiClient.get<Category[]>('/categories', { params: { parentId } })).data; }
