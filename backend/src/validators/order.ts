import { Types } from 'mongoose';
import { z } from 'zod';
import { HttpError } from '../utils/httpError';
import { parseBody, trimmedRequired } from './shared';

const objectId = z.string().refine(Types.ObjectId.isValid, 'Must be a valid ObjectId');
const optionalText = z.string().trim().max(200).optional();
const address = z.strictObject({
  id: z.string().optional(), label: trimmedRequired.optional(), firstName: trimmedRequired,
  lastName: trimmedRequired, line1: trimmedRequired, line2: optionalText, city: trimmedRequired,
  county: optionalText, postcode: trimmedRequired.transform((v) => v.toUpperCase()),
  country: trimmedRequired, isDefault: z.boolean().optional(),
});
const delivery = z.strictObject({ id: z.string().trim().min(1), name: z.string().optional(),
  description: z.string().optional(), price: z.number().optional(), estimatedDays: z.string().optional() });
const checkout = z.strictObject({
  userId: objectId.optional(), guestEmail: z.email().trim().toLowerCase().optional(),
  items: z.array(z.unknown()).optional(), shippingAddress: address, deliveryOption: delivery,
  subtotal: z.number().optional(), discount: z.number().optional(), deliveryCost: z.number().optional(),
  total: z.number().optional(), promoCode: z.string().optional(), estimatedDelivery: z.string().optional(),
  orderNumber: z.string().optional(), status: z.string().optional(), paymentStatus: z.string().optional(),
});

export type CheckoutInput = z.infer<typeof checkout>;
export const parseCheckout = (body: unknown) => parseBody(checkout, body, 'Invalid checkout request.');
export function parseOrderId(value: string): string {
  if (!Types.ObjectId.isValid(value)) throw HttpError.badRequest('Invalid order ID.');
  return value;
}
