import { z } from 'zod';
import { HttpError } from '../utils/httpError';

export function parseBody<T>(schema: z.ZodType<T>, body: unknown, message: string): T {
  const result = schema.safeParse(body);
  if (result.success) return result.data;
  const details: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const field = issue.path.join('.') || 'body';
    (details[field] ??= []).push(issue.message);
  }
  throw HttpError.badRequest(message, details);
}

export const trimmedRequired = z.string().trim().min(1).max(100);
