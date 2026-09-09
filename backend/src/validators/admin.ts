import { z } from 'zod';
import { GENDER_COLLECTIONS, ORDER_STATUSES, PRODUCT_BADGES } from '../models';
import { HttpError } from '../utils/httpError';
import { parseBody } from './shared';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Must be a valid ObjectId');
const optionalText = z.string().trim().max(2000).optional();
const image = z.object({ id: z.string().optional(), url: z.string().trim().min(1).max(2000), alt: z.string().max(500).optional().default(''), position: z.number().int().nonnegative(), isLifestyle: z.boolean().optional().default(false), colour: z.string().trim().optional(), isTryOnReady: z.boolean().optional().default(false), cloudinaryAssetId: z.string().trim().optional(), cloudinaryPublicId: z.string().trim().optional(), cloudinaryVersion: z.number().int().positive().optional(), cloudinaryFormat: z.string().trim().optional() }).strict().superRefine((value, ctx) => {
  if (value.isTryOnReady && !value.url.startsWith('https://')) ctx.addIssue({ code: 'custom', path: ['url'], message: 'A VTO-ready image URL must use HTTPS' });
});
const variant = z.object({ id: z.string().optional(), sku: z.string().trim().min(1).max(100), colour: z.string().trim().min(1), colourHex: z.string().trim().min(1), size: z.string().trim().min(1), stock: z.number().int().nonnegative(), image: z.string().trim().optional() }).strict();
export const productFields = {
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), name: z.string().trim().min(1), brand: z.string().trim().min(1),
  shortDescription: z.string().max(2000).optional(), fullDescription: z.string().max(10000).optional(), category: z.string().trim().toLowerCase().min(1),
  subcategory: optionalText, collection: optionalText, genderCollection: z.enum(GENDER_COLLECTIONS), price: z.number().positive(), salePrice: z.number().nonnegative().optional(),
  currency: z.string().trim().min(3).max(3).optional(), images: z.array(image).optional(), lifestyleImages: z.array(image).optional(),
  colours: z.array(z.string()).optional(), variants: z.array(variant), availableSizes: z.array(z.string()).optional(), materials: z.array(z.string()).optional(),
  careInstructions: z.array(z.string()).optional(), fitDescription: z.string().max(2000).optional(), modelInformation: optionalText,
  rating: z.number().min(0).max(5).optional(), reviewCount: z.number().int().nonnegative().optional(), stockStatus: z.enum(['in_stock','low_stock','out_of_stock']).optional(),
  badges: z.array(z.enum(PRODUCT_BADGES)).optional(), tryOnEligible: z.boolean().optional(), sizeRecommendationEligible: z.boolean().optional(),
  sizeModelKey: optionalText, recommendationTags: z.array(z.string()).optional(), relatedProductIds: z.array(objectId).optional(), isPublished: z.boolean().optional(),
};
const productCreate = z.object({
  ...productFields,
  shortDescription: productFields.shortDescription.default(''),
  fullDescription: productFields.fullDescription.default(''),
  currency: productFields.currency.default('GBP'),
  images: productFields.images.default([]),
  lifestyleImages: productFields.lifestyleImages.default([]),
  materials: productFields.materials.default([]),
  careInstructions: productFields.careInstructions.default([]),
  fitDescription: productFields.fitDescription.default(''),
  rating: productFields.rating.default(0),
  reviewCount: productFields.reviewCount.default(0),
  badges: productFields.badges.default([]),
  tryOnEligible: productFields.tryOnEligible.default(false),
  sizeRecommendationEligible: productFields.sizeRecommendationEligible.default(false),
  recommendationTags: productFields.recommendationTags.default([]),
  relatedProductIds: productFields.relatedProductIds.default([]),
  isPublished: productFields.isPublished.default(false),
}).strict().superRefine((v, ctx) => { if (v.salePrice !== undefined && v.salePrice >= v.price) ctx.addIssue({ code: 'custom', path: ['salePrice'], message: 'Sale price must be lower than price' }); });
const productUpdate = z.object(productFields).partial().strict();
export type ProductInput = z.infer<typeof productCreate>;
export type ProductUpdate = z.infer<typeof productUpdate>;
export const parseProductCreate = (body: unknown) => parseBody(productCreate, body, 'Invalid product.');
export const parseProductUpdate = (body: unknown) => parseBody(productUpdate, body, 'Invalid product update.');
export const parseId = (value: string, label = 'id') => { const result = objectId.safeParse(value); if (!result.success) throw HttpError.badRequest(`Invalid ${label}.`, { [label]: ['Must be a valid ObjectId'] }); return result.data; };
export const publishedBody = z.object({ isPublished: z.boolean() }).strict();
export const bulkPublishedBody = z.object({ ids: z.array(objectId).min(1).refine((v) => new Set(v).size === v.length, 'IDs must be unique'), isPublished: z.boolean() }).strict();
export const bulkDeleteBody = z.object({ ids: z.array(objectId).min(1).refine((v) => new Set(v).size === v.length, 'IDs must be unique') }).strict();
export const categoryCreate = z.object({ name: z.string().trim().min(1), slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), parentId: objectId.optional(), image: optionalText, description: optionalText, isActive: z.boolean().optional().default(true), displayOrder: z.number().int().nonnegative().optional().default(0) }).strict();
export const categoryUpdate = categoryCreate.partial().strict();
export const stockBody = z.object({ stock: z.number().int().nonnegative() }).strict();
export const activeBody = z.object({ isActive: z.boolean() }).strict();
export const statusBody = z.object({ status: z.enum(ORDER_STATUSES) }).strict();
export const moderationBody = z.object({ isApproved: z.boolean().optional(), isReported: z.boolean().optional() }).strict().refine((v) => v.isApproved !== undefined || v.isReported !== undefined, 'At least one moderation field is required');
