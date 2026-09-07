import { Types } from 'mongoose';
import { z } from 'zod';
import { HttpError } from '../utils/httpError';
import { parseBody } from './shared';

const objectId = z.string().refine((value) => Types.ObjectId.isValid(value), 'Must be a valid MongoDB ObjectId');
const uuid = z.string().uuid();
const idempotency = z.string().trim().min(16).max(128).regex(/^[A-Za-z0-9._~-]+$/);

const submission = z.object({
  productId: objectId,
  variantColour: z.string().trim().min(1).max(100),
  consentGiven: z.literal('true'),
}).strict();
const feedback = z.object({ feedback: z.enum(['helpful', 'not_helpful']) }).strict();

export function parseTryOnSubmission(body: unknown) {
  return parseBody(submission, body, 'Invalid Virtual Try-On request.');
}
export function parseFeedback(body: unknown) {
  return parseBody(feedback, body, 'Invalid Virtual Try-On feedback.');
}
export function parseJobId(value: string): string {
  if (!Types.ObjectId.isValid(value)) throw HttpError.badRequest('Invalid Virtual Try-On job id.');
  return value;
}
export function parseGuestSession(value: string | undefined): string {
  const result = uuid.safeParse(value);
  if (!result.success) throw HttpError.badRequest('A valid X-VTO-Session-Id header is required for guest Virtual Try-On.');
  return result.data;
}
export function parseIdempotencyKey(value: string | undefined): string {
  const result = idempotency.safeParse(value);
  if (!result.success) throw HttpError.badRequest('A valid X-Idempotency-Key header is required.');
  return result.data;
}
