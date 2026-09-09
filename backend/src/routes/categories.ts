import { Router } from 'express';
import { getCategories, getCategory } from '../controllers/catalogueController';
export const categoriesRouter = Router();
categoriesRouter.get('/', getCategories);
categoriesRouter.get('/:slug', getCategory);
