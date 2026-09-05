import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { env } from '../config/env';
import { User } from '../models';
import { HttpError } from '../utils/httpError';

export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.get('Authorization');
    if (!header || !/^Bearer [^ ]+$/.test(header)) throw HttpError.unauthorized();
    let payload: jwt.JwtPayload;
    try {
      const verified = jwt.verify(header.slice(7), env.JWT_SECRET, { algorithms: ['HS256'] });
      if (typeof verified === 'string') throw new Error('invalid payload');
      payload = verified;
    } catch { throw HttpError.unauthorized('The access token is invalid or expired.'); }
    if (typeof payload.sub !== 'string' || !Types.ObjectId.isValid(payload.sub) || (payload.role !== 'customer' && payload.role !== 'admin')) throw HttpError.unauthorized('The access token is invalid or expired.');
    const user = await User.findOne({ _id: payload.sub, isActive: true });
    if (!user || user.role !== payload.role) throw HttpError.unauthorized('The access token is invalid or expired.');
    req.auth = { userId: user._id.toString(), role: user.role, user };
    next();
  } catch (error) { next(error); }
};
