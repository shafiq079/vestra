import type { HydratedDocument } from 'mongoose';
import type { UserShape } from '../models/User';

declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string; role: 'customer' | 'admin'; user: HydratedDocument<UserShape> };
    }
  }
}
export {};
