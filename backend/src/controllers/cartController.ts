import type { Request, RequestHandler } from 'express';
import * as carts from '../services/cartService';
import { parseAddCartItem, parseCartQuantity, parseGuestId, parseItemId, parsePromo } from '../validators/cart';

const guestHeader = (req: Request) => parseGuestId(req.get('X-Guest-Cart-Id'));
const owner = (req: Request): carts.CartOwner => req.auth ? { userId: req.auth.userId } : { guestId: guestHeader(req) };
const param = (req: Request) => { const raw = req.params.itemId; return parseItemId(Array.isArray(raw) ? raw[0]! : raw!); };
export const getCart: RequestHandler = async (req, res) => { res.json(await carts.getCart(owner(req))); };
export const addItem: RequestHandler = async (req, res) => { res.status(201).json(await carts.addItem(owner(req), parseAddCartItem(req.body))); };
export const updateItem: RequestHandler = async (req, res) => { res.json(await carts.updateItem(owner(req), param(req), parseCartQuantity(req.body).quantity)); };
export const removeItem: RequestHandler = async (req, res) => { res.json(await carts.removeItem(owner(req), param(req))); };
export const clearCart: RequestHandler = async (req, res) => { res.json(await carts.clearCart(owner(req))); };
export const applyPromo: RequestHandler = async (req, res) => { res.json(await carts.applyPromo(owner(req), parsePromo(req.body).code)); };
export const removePromo: RequestHandler = async (req, res) => { res.json(await carts.removePromo(owner(req))); };
export const mergeCart: RequestHandler = async (req, res) => { res.json(await carts.mergeCart(req.auth!.userId, guestHeader(req))); };
