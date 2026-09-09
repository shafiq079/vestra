import { Types } from 'mongoose';
import { z } from 'zod';
import { HttpError } from '../utils/httpError';
import { parseBody, trimmedRequired } from './shared';

const optionalText = z.string().trim().max(200).optional();
const profileSchema = z.strictObject({ firstName: trimmedRequired.optional(), lastName: trimmedRequired.optional(), avatar: z.url().max(2048).optional().nullable(), marketingOptIn: z.boolean().optional() }).refine((v) => Object.keys(v).length > 0, 'Supply at least one field.');
const addressFields = { label: trimmedRequired, firstName: trimmedRequired, lastName: trimmedRequired, line1: trimmedRequired, line2: optionalText, city: trimmedRequired, county: optionalText, postcode: trimmedRequired, country: trimmedRequired, isDefault: z.boolean().optional() };
const createAddressSchema = z.strictObject(addressFields);
const updateAddressSchema = z.strictObject({
  label: trimmedRequired.optional(), firstName: trimmedRequired.optional(), lastName: trimmedRequired.optional(),
  line1: trimmedRequired.optional(), line2: optionalText, city: trimmedRequired.optional(), county: optionalText,
  postcode: trimmedRequired.optional(), country: trimmedRequired.optional(), isDefault: z.boolean().optional(),
}).refine((v) => Object.keys(v).length > 0, 'Supply at least one field.');
const measurementFields = { height: z.number().nonnegative().optional(), weight: z.number().nonnegative().optional(), chest: z.number().nonnegative().optional(), waist: z.number().nonnegative().optional(), hips: z.number().nonnegative().optional(), inseam: z.number().nonnegative().optional(), ageRange: optionalText, bodyProfile: optionalText, preferredFit: z.enum(['fitted', 'regular', 'relaxed']).optional(), unitSystem: z.enum(['metric', 'imperial']).optional() };
const measurementSchema = z.strictObject(measurementFields).refine((v) => Object.keys(v).length > 0, 'Supply at least one field.');

export type AddressInput = z.infer<typeof createAddressSchema>;
export type AddressUpdate = z.infer<typeof updateAddressSchema>;
export type MeasurementInput = z.infer<typeof measurementSchema>;
export const parseProfile = (b: unknown) => parseBody(profileSchema, b, 'Invalid profile update.');
export const parseAddress = (b: unknown) => parseBody(createAddressSchema, b, 'Invalid address.');
export const parseAddressUpdate = (b: unknown) => parseBody(updateAddressSchema, b, 'Invalid address update.');
export const parseMeasurement = (b: unknown) => parseBody(measurementSchema, b, 'Invalid measurement profile.');
export function parseAddressId(value: string): Types.ObjectId { if (!Types.ObjectId.isValid(value)) throw HttpError.badRequest('Invalid address id.', { addressId: ['Must be a valid MongoDB ObjectId.'] }); return new Types.ObjectId(value); }
