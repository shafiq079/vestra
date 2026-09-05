import { Types } from 'mongoose';
import { z } from 'zod';

import { HttpError } from '../utils/httpError';

export const PRODUCT_SORTS = ['recommended', 'newest', 'price_asc', 'price_desc', 'rating', 'bestselling'] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export interface ProductQuery {
  categories: string[];
  sizes: string[];
  colours: string[];
  brands: string[];
  fits: string[];
  collection?: string | undefined;
  genderCollection?: 'women' | 'men' | 'unisex' | undefined;
  minPrice?: number | undefined;
  maxPrice?: number | undefined;
  rating?: number | undefined;
  availability?: boolean | undefined;
  onSale?: boolean | undefined;
  tryOnEligible?: boolean | undefined;
  sizeRecEligible?: boolean | undefined;
  search?: string | undefined;
  sortBy: ProductSort;
  paginated: boolean;
  page: number;
  pageSize: number;
}

type QueryObject = Record<string, unknown>;

function fail(field: string, message: string): never {
  throw HttpError.badRequest('Invalid catalogue query.', { [field]: [message] });
}

function single(query: QueryObject, key: string): string | undefined {
  const value = query[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return fail(key, 'Must be supplied once.');
  return value;
}

function array(query: QueryObject, key: string): string[] {
  const raw = query[`${key}[]`] ?? query[key];
  if (raw === undefined) return [];
  const values = Array.isArray(raw) ? raw : [raw];
  if (!values.every((value) => typeof value === 'string' && value.trim().length > 0)) {
    return fail(key, 'Must contain non-empty string values.');
  }
  return (values as string[]).map((value) => value.trim());
}

function number(query: QueryObject, key: string, schema: z.ZodNumber): number | undefined {
  const raw = single(query, key);
  if (raw === undefined) return undefined;
  if (raw.trim() === '') return fail(key, 'Must be a number.');
  const parsed = schema.safeParse(Number(raw));
  if (!parsed.success) return fail(key, parsed.error.issues[0]?.message ?? 'Invalid number.');
  return parsed.data;
}

function boolean(query: QueryObject, key: string): boolean | undefined {
  const raw = single(query, key);
  if (raw === undefined) return undefined;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return fail(key, 'Must be true or false.');
}

export function parseProductQuery(query: QueryObject): ProductQuery {
  const pagePresent = query.page !== undefined;
  const pageSizePresent = query.pageSize !== undefined;
  const page = number(query, 'page', z.number().int().min(1)) ?? 1;
  const pageSize = number(query, 'pageSize', z.number().int().min(1).max(100)) ?? 12;
  const minPrice = number(query, 'minPrice', z.number().min(0));
  const maxPrice = number(query, 'maxPrice', z.number().min(0));
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    fail('minPrice', 'Must be less than or equal to maxPrice.');
  }
  const rating = number(query, 'rating', z.number().min(0).max(5));
  const genderRaw = single(query, 'genderCollection');
  const gender = genderRaw === undefined
    ? undefined
    : z.enum(['women', 'men', 'unisex']).safeParse(genderRaw);
  if (gender && !gender.success) fail('genderCollection', 'Must be women, men, or unisex.');
  const sortRaw = single(query, 'sortBy') ?? 'recommended';
  const sort = z.enum(PRODUCT_SORTS).safeParse(sortRaw);
  if (!sort.success) fail('sortBy', `Must be one of: ${PRODUCT_SORTS.join(', ')}.`);
  const search = single(query, 'search');
  if (search !== undefined && search.trim() === '') fail('search', 'Must contain meaningful text.');

  return {
    categories: array(query, 'category'), sizes: array(query, 'size'), colours: array(query, 'colour'),
    brands: array(query, 'brand'), fits: array(query, 'fit'),
    ...(single(query, 'collection') !== undefined ? { collection: single(query, 'collection') } : {}),
    ...(gender ? { genderCollection: gender.data } : {}), ...(minPrice !== undefined ? { minPrice } : {}),
    ...(maxPrice !== undefined ? { maxPrice } : {}), ...(rating !== undefined ? { rating } : {}),
    ...(boolean(query, 'availability') !== undefined ? { availability: boolean(query, 'availability') } : {}),
    ...(boolean(query, 'onSale') !== undefined ? { onSale: boolean(query, 'onSale') } : {}),
    ...(boolean(query, 'tryOnEligible') !== undefined ? { tryOnEligible: boolean(query, 'tryOnEligible') } : {}),
    ...(boolean(query, 'sizeRecEligible') !== undefined ? { sizeRecEligible: boolean(query, 'sizeRecEligible') } : {}),
    ...(search !== undefined ? { search: search.trim() } : {}),
    sortBy: sort.data, paginated: pagePresent || pageSizePresent, page, pageSize,
  };
}

export function parseSearchQuery(query: QueryObject): string {
  const value = single(query, 'q');
  if (value === undefined || value.trim() === '') fail('q', 'A non-empty search query is required.');
  return value.trim();
}

export function parseObjectId(value: string, field: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) fail(field, 'Must be a valid MongoDB ObjectId.');
  return new Types.ObjectId(value);
}

export function parseCategoryQuery(query: QueryObject): Types.ObjectId | undefined {
  const parentId = single(query, 'parentId');
  return parentId === undefined ? undefined : parseObjectId(parentId, 'parentId');
}
