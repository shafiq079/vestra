import { Types } from 'mongoose';
import { z } from 'zod';
import { HttpError } from '../utils/httpError';
import { parseBody, trimmedRequired } from './shared';

const objectId = z.string().refine(Types.ObjectId.isValid, 'Must be a valid ObjectId');
const quantity = z.number().int().positive();
const addItem = z.object({ productId: objectId, variantId: objectId, colour: trimmedRequired,
  size: trimmedRequired, quantity }).strict();
const updateItem = z.object({ quantity }).strict();
const promo = z.object({ code: trimmedRequired.transform((value) => value.toUpperCase()) }).strict();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AddCartItemInput = z.infer<typeof addItem>;
export const parseAddCartItem = (body: unknown) => parseBody(addItem, body, 'Invalid cart item.');
export const parseCartQuantity = (body: unknown) => parseBody(updateItem, body, 'Invalid cart quantity.');
export const parsePromo = (body: unknown) => parseBody(promo, body, 'Invalid promo code.');
export function parseItemId(value: string): string {
  if (!Types.ObjectId.isValid(value)) throw HttpError.badRequest('Invalid cart item ID.');
  return value;
}
export function parseGuestId(value: string | undefined): string {
  if (!value || !uuid.test(value)) throw HttpError.badRequest('A valid X-Guest-Cart-Id header is required.');
  return value.toLowerCase();
}
