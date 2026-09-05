import { Router } from 'express';
import * as controller from '../controllers/wishlistController';
import { authenticate } from '../middleware/authenticate';

export const wishlistRouter = Router();
wishlistRouter.use(authenticate);
wishlistRouter.get('/', controller.getWishlist);
wishlistRouter.post('/toggle', controller.toggleWishlist);
