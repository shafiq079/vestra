import type { RequestHandler } from 'express';
import * as auth from '../services/authService';
import { buildUserDto } from '../services/userDtoService';
import { HttpError } from '../utils/httpError';
import { parseForgotPassword, parseLogin, parseRefreshToken, parseRegister } from '../validators/auth';

const parameter = (v: string | string[] | undefined) => Array.isArray(v) ? v[0]! : v!;
export const register: RequestHandler = async (req, res) => { res.status(201).json(await auth.register(parseRegister(req.body))); };
export const login: RequestHandler = async (req, res) => { const input = parseLogin(req.body); res.json(await auth.login(input.email, input.password)); };
export const me: RequestHandler = async (req, res) => { res.json(await buildUserDto(req.auth!.user)); };
export const compatibleMe: RequestHandler = async (req, res) => { if (parameter(req.params.userId) !== req.auth!.userId) throw HttpError.forbidden('You may only access your own profile.'); res.json(await buildUserDto(req.auth!.user)); };
export const refresh: RequestHandler = async (req, res) => { res.json(await auth.refresh(parseRefreshToken(req.body).refreshToken)); };
export const logout: RequestHandler = async (req, res) => { await auth.logout(parseRefreshToken(req.body).refreshToken); res.status(204).end(); };
export const forgotPassword: RequestHandler = async (req, res) => { parseForgotPassword(req.body); res.json(auth.forgotPassword()); };
