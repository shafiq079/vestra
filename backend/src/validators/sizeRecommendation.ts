import { Types } from 'mongoose';
import { z } from 'zod';
import { HttpError, type ErrorDetails } from '../utils/httpError';
import type { SizeRecommendationRequestInput } from '../services/sizeRecommendationService';

const requestSchema = z.object({
  productId: z.string().min(1),
  measurements: z.record(
    z.string().min(1).max(100),
    z.union([z.number().finite(), z.string().trim().min(1).max(100)]),
  ),
  preferredFit: z.enum(['fitted', 'regular', 'relaxed']).optional(),
  unitSystem: z.enum(['metric', 'imperial']),
}).strict();

function details(error: z.ZodError): ErrorDetails {
  const output: ErrorDetails = {};
  for (const issue of error.issues) {
    const field = issue.path.length > 0 ? issue.path.join('.') : 'request';
    (output[field] ??= []).push(issue.message);
  }
  return output;
}

export function parseProductId(value: string | string[] | undefined): string {
  const productId = Array.isArray(value) ? undefined : value;
  if (!productId || !Types.ObjectId.isValid(productId)) {
    throw HttpError.badRequest('Invalid size recommendation request.', {
      productId: ['Must be a valid MongoDB ObjectId.'],
    });
  }
  return productId;
}

export function parseSizeRecommendationRequest(value: unknown): SizeRecommendationRequestInput {
  const result = requestSchema.safeParse(value);
  if (!result.success) throw HttpError.badRequest('Invalid size recommendation request.', details(result.error));
  if (!Types.ObjectId.isValid(result.data.productId)) {
    throw HttpError.badRequest('Invalid size recommendation request.', {
      productId: ['Must be a valid MongoDB ObjectId.'],
    });
  }
  if (Object.keys(result.data.measurements).length > 20) {
    throw HttpError.badRequest('Invalid size recommendation request.', {
      measurements: ['Too many measurement fields were supplied.'],
    });
  }
  return result.data;
}
