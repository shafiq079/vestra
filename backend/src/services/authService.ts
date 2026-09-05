import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Types, type HydratedDocument } from 'mongoose';
import { env } from '../config/env';
import { AuthSession, User } from '../models';
import type { UserShape } from '../models/User';
import { HttpError } from '../utils/httpError';
import type { RegisterInput } from '../validators/auth';
import { buildUserDto } from './userDtoService';

const invalidCredentials = () => new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
const invalidRefresh = () => new HttpError(401, 'INVALID_REFRESH_TOKEN', 'Authentication could not be refreshed.');
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

export function issueAccessToken(user: { _id: Types.ObjectId; role: 'customer' | 'admin' }): string {
  return jwt.sign({ role: user.role }, env.JWT_SECRET, { algorithm: 'HS256', subject: user._id.toString(), expiresIn: env.JWT_ACCESS_TTL_SECONDS });
}

async function issueRefreshToken(userId: Types.ObjectId): Promise<string> {
  const refreshToken = randomBytes(48).toString('base64url');
  await AuthSession.create({ userId, tokenHash: tokenHash(refreshToken), expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000) });
  return refreshToken;
}

async function authenticatedResponse(user: HydratedDocument<UserShape>) {
  const [dto, refreshToken] = await Promise.all([buildUserDto(user), issueRefreshToken(user._id)]);
  return { ...dto, token: issueAccessToken(user), refreshToken };
}

export async function register(input: RegisterInput) {
  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
  try {
    const user = await User.create({ firstName: input.firstName, lastName: input.lastName, email: input.email, passwordHash, marketingOptIn: input.marketingOptIn, role: 'customer', isActive: true });
    return await authenticatedResponse(user);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) throw HttpError.conflict('An account with this email already exists.');
    throw error;
  }
}

export async function login(email: string, password: string) {
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) throw invalidCredentials();
  return authenticatedResponse(user);
}

export async function refresh(rawToken: string) {
  const now = new Date();
  const session = await AuthSession.findOneAndUpdate({ tokenHash: tokenHash(rawToken), revokedAt: { $exists: false }, expiresAt: { $gt: now } }, { $set: { revokedAt: now } }, { new: true });
  if (!session) throw invalidRefresh();
  const user = await User.findOne({ _id: session.userId, isActive: true });
  if (!user) throw invalidRefresh();
  const refreshToken = await issueRefreshToken(user._id);
  return { token: issueAccessToken(user), refreshToken };
}

export async function logout(rawToken: string): Promise<void> {
  await AuthSession.updateOne({ tokenHash: tokenHash(rawToken), revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
}

export function forgotPassword(): { message: string } {
  return { message: 'If an account can be assisted, password recovery instructions will be available through the configured support process.' };
}
