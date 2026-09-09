import type { RequestHandler } from 'express';
import { HttpError } from '../utils/httpError';

export function authoriseRole(...roles: Array<'customer' | 'admin'>): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) return next(HttpError.unauthorized());
    if (!roles.includes(req.auth.role)) return next(HttpError.forbidden());
    next();
  };
}
