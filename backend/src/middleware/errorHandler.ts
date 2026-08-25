/**
 * Centralised error handler — the single place any failure becomes an HTTP
 * response.
 *
 * Contract (frontend/src/types/index.ts → ApiError, consumed by the Axios
 * interceptor in frontend/src/services/apiClient.ts):
 *
 *   { "code": string, "message": string, "details"?: Record<string, string[]> }
 *
 * Two rules hold for every branch below:
 *   1. A stack trace is never placed in the response body, in any environment.
 *   2. An unrecognised error yields a generic message. Its real message is
 *      logged server-side only, so an internal fault cannot leak database
 *      internals, file paths or credentials to a client.
 */

import type { ErrorRequestHandler, Request } from 'express';

import { isHttpError, type ErrorDetails } from '../utils/httpError';
import { logger } from '../utils/logger';

interface ErrorResponseBody {
  code: string;
  message: string;
  details?: ErrorDetails;
}

interface MappedError {
  status: number;
  body: ErrorResponseBody;
  /** Server-side only description, never sent to the client. */
  logDescription: string;
}

/** Express body-parser failures arrive as errors carrying `status` and `type`. */
interface BodyParserError extends Error {
  status?: number;
  statusCode?: number;
  type?: string;
}

function isBodyParserError(error: unknown): error is BodyParserError {
  return error instanceof Error && typeof (error as BodyParserError).type === 'string';
}

function describe(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === 'string') return error;
  return 'non-Error value thrown';
}

function mapError(error: unknown): MappedError {
  // Errors the application raised deliberately: status, code, message and
  // details are all intentional and safe to return as-is.
  if (isHttpError(error)) {
    const body: ErrorResponseBody = { code: error.code, message: error.message };
    if (error.details !== undefined) {
      body.details = error.details;
    }
    return { status: error.status, body, logDescription: describe(error) };
  }

  // Malformed JSON / oversized body: a client mistake, not a server fault, so
  // it must not be reported as a 500.
  if (isBodyParserError(error)) {
    const status = error.status ?? error.statusCode ?? 400;

    if (error.type === 'entity.too.large') {
      return {
        status: 413,
        body: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.' },
        logDescription: describe(error),
      };
    }

    if (status === 400) {
      return {
        status: 400,
        body: { code: 'INVALID_JSON', message: 'Request body could not be parsed as JSON.' },
        logDescription: describe(error),
      };
    }
  }

  // Anything else is an unexpected internal fault. The client gets a generic
  // message; the detail goes to the server log only.
  return {
    status: 500,
    body: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred while processing the request.',
    },
    logDescription: describe(error),
  };
}

function requestLabel(req: Request): string {
  return `${req.method} ${req.originalUrl.slice(0, 200)}`;
}

export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  // A partially-written response cannot be replaced with a JSON error body;
  // hand it to Express so the connection is torn down cleanly.
  if (res.headersSent) {
    logger.error(`Error after response headers were sent (${requestLabel(req)}):`, describe(error));
    next(error);
    return;
  }

  const { status, body, logDescription } = mapError(error);

  if (status >= 500) {
    logger.error(`${status} ${requestLabel(req)} -`, logDescription);
    // Full stack to the server log only — never to the client.
    if (error instanceof Error && error.stack) {
      logger.error(error.stack);
    }
  } else {
    logger.warn(`${status} ${requestLabel(req)} -`, logDescription);
  }

  res.status(status).json(body);
};
