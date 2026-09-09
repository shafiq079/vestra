import type { RequestHandler } from 'express';
import * as catalogue from '../services/catalogueService';
import { parseCategoryQuery, parseObjectId, parseProductQuery, parseSearchQuery } from '../validators/catalogue';

function parameter(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0]! : value!;
}

export const getProducts: RequestHandler = async (req, res) => { res.json(await catalogue.listProducts(parseProductQuery(req.query))); };
export const getFeatured: RequestHandler = async (_req, res) => { res.json(await catalogue.featuredProducts()); };
export const getNew: RequestHandler = async (_req, res) => { res.json(await catalogue.newProducts()); };
export const getSale: RequestHandler = async (_req, res) => { res.json(await catalogue.saleProducts()); };
export const searchProducts: RequestHandler = async (req, res) => { res.json(await catalogue.searchProducts(parseSearchQuery(req.query))); };
export const getProduct: RequestHandler = async (req, res) => { res.json(await catalogue.productBySlug(parameter(req.params.slug))); };
export const getRelated: RequestHandler = async (req, res) => { res.json(await catalogue.relatedProducts(parseObjectId(parameter(req.params.id), 'id'))); };
export const getCategories: RequestHandler = async (req, res) => { res.json(await catalogue.listCategories(parseCategoryQuery(req.query))); };
export const getCategory: RequestHandler = async (req, res) => { res.json(await catalogue.categoryBySlug(parameter(req.params.slug))); };
export const getCollections: RequestHandler = async (_req, res) => { res.json(await catalogue.listCollections()); };
export const getCollection: RequestHandler = async (req, res) => { res.json(await catalogue.collectionBySlug(parameter(req.params.slug))); };
