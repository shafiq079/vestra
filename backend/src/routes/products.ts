import { Router } from 'express';
import { getFeatured, getNew, getProduct, getProducts, getRelated, getSale, searchProducts } from '../controllers/catalogueController';

export const productsRouter = Router();
productsRouter.get('/', getProducts);
productsRouter.get('/featured', getFeatured);
productsRouter.get('/new', getNew);
productsRouter.get('/sale', getSale);
productsRouter.get('/search', searchProducts);
productsRouter.get('/:id/related', getRelated);
productsRouter.get('/:slug', getProduct);
