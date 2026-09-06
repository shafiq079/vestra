import { Router } from 'express';
import * as controller from '../controllers/orderController';
import { authenticate, optionalAuthenticate } from '../middleware/authenticate';

export const ordersRouter = Router();
ordersRouter.post('/', optionalAuthenticate, controller.createOrder);
ordersRouter.get('/', authenticate, controller.listOrders);
ordersRouter.get('/:orderId', authenticate, controller.getOrder);
