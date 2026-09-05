import { Router } from 'express';
import * as controller from '../controllers/profileController';
import { authenticate } from '../middleware/authenticate';

export const profileRouter = Router();
profileRouter.use(authenticate);
profileRouter.get('/', controller.getProfile);
profileRouter.patch('/', controller.updateProfile);
profileRouter.get('/addresses', controller.listAddresses);
profileRouter.post('/addresses', controller.addAddress);
profileRouter.patch('/addresses/:addressId/default', controller.setDefaultAddress);
profileRouter.patch('/addresses/:addressId', controller.updateAddress);
profileRouter.delete('/addresses/:addressId', controller.deleteAddress);
profileRouter.get('/measurement-profile', controller.getMeasurement);
profileRouter.patch('/measurement-profile', controller.updateMeasurement);
