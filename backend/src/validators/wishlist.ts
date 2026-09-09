import { Types } from 'mongoose';
import { z } from 'zod';
import { parseBody } from './shared';

const toggle = z.object({ productId: z.string().refine(Types.ObjectId.isValid, 'Must be a valid ObjectId') }).strict();
export const parseWishlistToggle = (body: unknown) => parseBody(toggle, body, 'Invalid wishlist item.');
