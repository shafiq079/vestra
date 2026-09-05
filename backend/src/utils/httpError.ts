/**
 * Error type carrying the HTTP status and the `{ code, message, details? }`
 * response contract the React frontend's Axios interceptor already expects
 * (see frontend/src/types/index.ts → ApiError).
 *
 * Anything thrown that is NOT an HttpError is treated as an unexpected internal
 * fault by the centralised error handler: it is logged server-side and reported
 * to the client as a generic 500, never with its message or stack.
 */

/** Matches `ApiError['details']` in frontend/src/types/index.ts. */
export type ErrorDetails = Record<string, string[]>;

export class HttpError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: ErrorDetails;

  constructor(status: number, code: string, message: string, details?: ErrorDetails) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    if (details !== undefined) {
      this.details = details;
    }
    Error.captureStackTrace?.(this, HttpError);
  }

  static badRequest(message: string, details?: ErrorDetails): HttpError {
    return new HttpError(400, 'BAD_REQUEST', message, details);
  }

  static notFound(message: string, details?: ErrorDetails): HttpError {
    return new HttpError(404, 'NOT_FOUND', message, details);
  }
  static unauthorized(message = 'Authentication is required.'): HttpError {
    return new HttpError(401, 'UNAUTHORIZED', message);
  }
  static forbidden(message = 'You do not have permission to perform this action.'): HttpError {
    return new HttpError(403, 'FORBIDDEN', message);
  }
  static conflict(message: string): HttpError {
    return new HttpError(409, 'CONFLICT', message);
  }
}

export function isHttpError(value: unknown): value is HttpError {
  return value instanceof HttpError;
}
