import { z } from 'zod';
import { parseBody, trimmedRequired } from './shared';

const email = z.email().trim().toLowerCase();
const password = z.string().min(8).max(128).refine((value) => value.trim().length > 0, 'Password cannot be blank.');
const registerSchema = z.strictObject({ firstName: trimmedRequired, lastName: trimmedRequired, email, password, marketingOptIn: z.boolean() });
const loginSchema = z.strictObject({ email, password: z.string().min(1).max(128) });
const tokenSchema = z.strictObject({ refreshToken: z.string().min(1) });
const forgotSchema = z.strictObject({ email });

export type RegisterInput = z.infer<typeof registerSchema>;
export const parseRegister = (body: unknown) => parseBody(registerSchema, body, 'Invalid registration details.');
export const parseLogin = (body: unknown) => parseBody(loginSchema, body, 'Invalid login details.');
export const parseRefreshToken = (body: unknown) => parseBody(tokenSchema, body, 'A refresh token is required.');
export const parseForgotPassword = (body: unknown) => parseBody(forgotSchema, body, 'Invalid email address.');
