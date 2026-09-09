import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';

import { HttpError } from '../utils/httpError';

const RATE_LIMIT_BODY = {
  code: 'RATE_LIMITED',
  message: 'Too many requests. Please try again later.',
};

export function createGlobalRateLimit(limit = 300): RequestHandler {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: RATE_LIMIT_BODY,
  });
}

export function createSensitiveRateLimit(limit = 10): RequestHandler {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: RATE_LIMIT_BODY,
  });
}

/** Reject MongoDB operators/prototype keys before they can reach a validator or query. */
export const rejectUnsafeInput: RequestHandler = (req, _res, next) => {
  const unsafe = (value: unknown, depth = 0): boolean => {
    if (depth > 20) return true;
    if (Array.isArray(value)) return value.some((entry) => unsafe(entry, depth + 1));
    if (value === null || typeof value !== 'object') return false;
    return Object.entries(value).some(([key, child]) =>
      key.includes('$') || key.includes('.') || key === '__proto__' || key === 'constructor' || key === 'prototype' || unsafe(child, depth + 1));
  };

  if (unsafe(req.query) || unsafe(req.body)) {
    next(HttpError.badRequest('Request contains unsafe input.'));
    return;
  }
  next();
};
