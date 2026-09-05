import { Router } from 'express';
import * as controller from '../controllers/cartController';
import { authenticate, optionalAuthenticate } from '../middleware/authenticate';

export const cartRouter = Router();
cartRouter.post('/merge', authenticate, controller.mergeCart);
cartRouter.use(optionalAuthenticate);
cartRouter.get('/', controller.getCart);
cartRouter.post('/items', controller.addItem);
cartRouter.patch('/items/:itemId', controller.updateItem);
cartRouter.delete('/items/:itemId', controller.removeItem);
cartRouter.delete('/', controller.clearCart);
cartRouter.post('/promo', controller.applyPromo);
cartRouter.delete('/promo', controller.removePromo);
