import type { Request, RequestHandler } from 'express';
import * as service from '../services/adminService';
import { parseBody } from '../validators/shared';
import { activeBody, bulkDeleteBody, bulkPublishedBody, categoryCreate, categoryUpdate, moderationBody, parseId, parseProductCreate, parseProductUpdate, publishedBody, statusBody, stockBody } from '../validators/admin';
import type { ImageStorage } from '../services/cloudinaryImageStorage';
import { validateImageUpload } from '../services/imageValidationService';

const param = (value: string | string[] | undefined) => Array.isArray(value) ? value[0]! : value!;
const actor = (req: Request) => req.auth!.userId;
export const dashboard: RequestHandler = async (_req,res)=>res.json(await service.dashboard());
export const products: RequestHandler = async (_req,res)=>res.json(await service.listProducts());
export const product: RequestHandler = async (req,res)=>res.json(await service.getProduct(parseId(param(req.params.id))));
export const createProduct: RequestHandler = async(req,res)=>res.status(201).json(await service.createProduct(parseProductCreate(req.body),actor(req)));
export const updateProduct: RequestHandler = async(req,res)=>res.json(await service.updateProduct(parseId(param(req.params.id)),parseProductUpdate(req.body),actor(req)));
export const deleteProduct: RequestHandler = async(req,res)=>{await service.deleteProduct(parseId(param(req.params.id)),actor(req));res.status(204).send();};
export const duplicateProduct: RequestHandler = async(req,res)=>res.status(201).json(await service.duplicateProduct(parseId(param(req.params.id)),actor(req)));
export const published: RequestHandler = async(req,res)=>res.json(await service.setPublished(parseId(param(req.params.id)),parseBody(publishedBody,req.body,'Invalid publish request.').isPublished,actor(req)));
export const bulkPublish: RequestHandler = async(req,res)=>{const body=parseBody(bulkPublishedBody,req.body,'Invalid bulk publish request.');res.json(await service.bulkPublish(body.ids,body.isPublished,actor(req)));};
export const bulkDelete: RequestHandler = async(req,res)=>res.json(await service.bulkDelete(parseBody(bulkDeleteBody,req.body,'Invalid bulk delete request.').ids,actor(req)));
export const reset: RequestHandler = async(req,res)=>res.json(await service.resetProducts(actor(req)));
export const csvImport: RequestHandler = async(req,res)=>res.status(201).json(await service.importCsv(typeof req.body==='string'?req.body:'',actor(req)));
export const categories: RequestHandler = async(_req,res)=>res.json(await service.listCategories());
export const createCategory: RequestHandler = async(req,res)=>res.status(201).json(await service.createCategory(parseBody(categoryCreate,req.body,'Invalid category.'),actor(req)));
export const updateCategory: RequestHandler = async(req,res)=>res.json(await service.updateCategory(parseId(param(req.params.id)),parseBody(categoryUpdate,req.body,'Invalid category update.'),actor(req)));
export const deleteCategory: RequestHandler = async(req,res)=>{await service.deleteCategory(parseId(param(req.params.id)),actor(req));res.status(204).send();};
export const inventory: RequestHandler = async(_req,res)=>res.json(await service.listInventory());
export const updateStock: RequestHandler = async(req,res)=>res.json(await service.updateStock(parseId(param(req.params.productId),'productId'),parseId(param(req.params.variantId),'variantId'),parseBody(stockBody,req.body,'Invalid stock update.').stock,actor(req)));
export const users: RequestHandler = async(_req,res)=>res.json(await service.listUsers());
export const active: RequestHandler = async(req,res)=>res.json(await service.setUserActive(parseId(param(req.params.userId),'userId'),parseBody(activeBody,req.body,'Invalid active-state update.').isActive,actor(req)));
export const orders: RequestHandler = async(_req,res)=>res.json(await service.listOrders());
export const status: RequestHandler = async(req,res)=>res.json(await service.setOrderStatus(parseId(param(req.params.orderId),'orderId'),parseBody(statusBody,req.body,'Invalid order status.').status,actor(req)));
export const reviews: RequestHandler = async(_req,res)=>res.json(await service.listReviews());
export const moderation: RequestHandler = async(req,res)=>res.json(await service.moderateReview(parseId(param(req.params.reviewId),'reviewId'),parseBody(moderationBody,req.body,'Invalid moderation request.'),actor(req)));
export const promotions: RequestHandler = (_req,res)=>res.json(service.listPromotions());
export const uploadImage = (storage: ImageStorage): RequestHandler => async(req,res) => {
  const image = validateImageUpload(req.file);
  const asset = await storage.uploadCatalogue(image);
  res.status(201).json({ url: asset.secureUrl, alt: '', position: 0, isLifestyle: false,
    isTryOnReady: false, cloudinaryAssetId: asset.assetId, cloudinaryPublicId: asset.publicId,
    cloudinaryVersion: asset.version, cloudinaryFormat: asset.format });
};
