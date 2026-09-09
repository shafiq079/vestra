import { Router } from 'express';
import { getCollection, getCollections } from '../controllers/catalogueController';
export const collectionsRouter = Router();
collectionsRouter.get('/', getCollections);
collectionsRouter.get('/:slug', getCollection);
