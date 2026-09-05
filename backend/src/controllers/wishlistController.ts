import type { RequestHandler } from 'express';
import * as wishlist from '../services/wishlistService';
import { parseWishlistToggle } from '../validators/wishlist';

export const getWishlist: RequestHandler = async (req, res) => { res.json(await wishlist.getWishlist(req.auth!.userId)); };
export const toggleWishlist: RequestHandler = async (req, res) => { res.json(await wishlist.toggleWishlist(req.auth!.userId, parseWishlistToggle(req.body).productId)); };
