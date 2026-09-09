import type { Request, RequestHandler } from 'express';
import * as orders from '../services/orderService';
import type { CartOwner } from '../services/cartService';
import { parseGuestId } from '../validators/cart';
import { parseCheckout, parseOrderId } from '../validators/order';
import { HttpError } from '../utils/httpError';

const owner = (req: Request, guestEmail?: string): CartOwner => {
  if (req.auth) return { userId: req.auth.userId };
  if (!guestEmail) throw HttpError.badRequest('guestEmail is required for guest checkout.');
  return { guestId: parseGuestId(req.get('X-Guest-Cart-Id')) };
};
export const createOrder: RequestHandler = async (req, res) => {
  const input = parseCheckout(req.body);
  if (req.auth && input.userId && input.userId !== req.auth.userId) throw HttpError.forbidden('The supplied userId does not match the authenticated user.');
  res.status(201).json(await orders.createOrder(owner(req, input.guestEmail), input));
};
export const listOrders: RequestHandler = async (req, res) => {
  const queryId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
  if (queryId && queryId !== req.auth!.userId) throw HttpError.forbidden();
  res.json(await orders.listOrders(req.auth!.userId));
};
export const getOrder: RequestHandler = async (req, res) => {
  const raw = req.params.orderId; const id = parseOrderId(Array.isArray(raw) ? raw[0]! : raw!);
  res.json(await orders.getOrder(req.auth!.userId, id));
};
