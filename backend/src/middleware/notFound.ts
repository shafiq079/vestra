/**
 * Terminal 404 handler.
 *
 * Runs after every mounted router, so any unmatched request becomes an
 * HttpError and is rendered by the centralised error handler — guaranteeing an
 * unknown route returns the same `{ code, message, details? }` body as every
 * other failure rather than Express's default HTML page.
 */

import type { NextFunction, Request, Response } from 'express';

import { HttpError } from '../utils/httpError';

const MAX_REFLECTED_PATH_LENGTH = 200;

/** Control characters, stripped to prevent response/log injection. */
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/g;

/**
 * The requested path is echoed back because it is genuinely useful when
 * debugging a client, but it is untrusted input: control characters are
 * stripped and the length is capped.
 */
function safePath(originalUrl: string): string {
  return originalUrl.slice(0, MAX_REFLECTED_PATH_LENGTH).replace(CONTROL_CHARACTERS, '');
}

export function notFound(req: Request, _res: Response, next: NextFunction): void {
  next(
    new HttpError(
      404,
      'ROUTE_NOT_FOUND',
      `Cannot ${req.method} ${safePath(req.originalUrl)} - no such route on this API.`,
    ),
  );
}
