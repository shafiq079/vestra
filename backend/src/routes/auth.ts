import { Router } from 'express';
import * as controller from '../controllers/authController';
import { authenticate } from '../middleware/authenticate';

export const authRouter = Router();
authRouter.post('/register', controller.register);
authRouter.post('/login', controller.login);
authRouter.post('/refresh', controller.refresh);
authRouter.post('/logout', controller.logout);
authRouter.post('/forgot-password', controller.forgotPassword);
authRouter.get('/me', authenticate, controller.me);
authRouter.get('/me/:userId', authenticate, controller.compatibleMe);
