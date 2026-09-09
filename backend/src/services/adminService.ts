import mongoose, { Types, type ClientSession } from 'mongoose';
import { AdminAuditLog, Category, Order, Product, Review, User, VirtualTryOnJob } from '../models';
import { catalogueProducts } from '../seed/data/catalogue';
import { HttpError, isHttpError } from '../utils/httpError';
import type { ProductInput, ProductUpdate } from '../validators/admin';
import { parseProductCreate } from '../validators/admin';
import { buildOrderDto } from './orderService';
import { deriveStockStatus } from './inventoryService';
import { buildUserDto } from './userDtoService';
import { PROMO_RULES } from './promoService';

const audit = (actorUserId: string, action: string, entityType: string, entityId?: Types.ObjectId, metadata?: Record<string, unknown>, session?: ClientSession) =>
  AdminAuditLog.create([{ actorUserId, action, entityType, ...(entityId ? { entityId } : {}), ...(metadata ? { metadata } : {}) }], session ? { session } : undefined);
const duplicateConflict = (error: unknown): never => {
  if ((error as { code?: number }).code === 11000) throw HttpError.conflict('A product with that slug or SKU already exists.');
  throw error;
};
const unique = (values: string[]) => [...new Set(values)];

function normalized(input: ProductInput | ProductUpdate, existing?: InstanceType<typeof Product>) {
  const result: Record<string, unknown> = { ...input };
  const name = String(input.name ?? existing?.name ?? '').trim();
  for (const key of ['shortDescription', 'fullDescription'] as const) {
    if (key in input && !String(input[key] ?? '').trim()) result[key] = key === 'shortDescription' ? name : String(result.shortDescription || existing?.shortDescription || name);
  }
  if ('fitDescription' in input && !String(input.fitDescription ?? '').trim()) result.fitDescription = 'Fit information not provided.';
  if (input.currency) result.currency = input.currency.toUpperCase();
  if (input.images) result.images = normalizeEmbedded(input.images, existing?.images, name, true);
  if (input.lifestyleImages) result.lifestyleImages = normalizeEmbedded(input.lifestyleImages, existing?.lifestyleImages, name, true);
  if (input.variants) {
    result.variants = normalizeEmbedded(input.variants, existing?.variants, name, false);
    result.colours = unique(input.variants.map((v) => v.colour));
    result.availableSizes = unique(input.variants.map((v) => v.size));
    result.stockStatus = deriveStockStatus(input.variants.map((v) => v.stock));
  } else if (existing) {
    result.colours = unique(existing.variants.map((v) => v.colour));
    result.availableSizes = unique(existing.variants.map((v) => v.size));
    result.stockStatus = deriveStockStatus(existing.variants.map((v) => v.stock));
  }
  delete result.id; delete result.createdAt; delete result.updatedAt;
  return result;
}

function normalizeEmbedded(rows: readonly unknown[], existing: readonly unknown[] | undefined, name: string, images: boolean) {
  const ids = new Set((existing ?? []).map((item) => String((item as { id: unknown }).id)));
  return rows.map((item) => { const { id, ...row } = item as Record<string, unknown>;
    return { ...(typeof id === 'string' && Types.ObjectId.isValid(id) && ids.has(id) ? { _id: id } : {}), ...row,
      ...(images && !String(row.alt ?? '').trim() ? { alt: name || 'Product image' } : {}) }; });
}

async function ensureProductUnique(input: ProductInput | ProductUpdate, exclude?: string, session?: ClientSession) {
  const ors: Record<string, unknown>[] = [];
  if (input.slug) ors.push({ slug: input.slug });
  if (input.variants) {
    const skus = input.variants.map((v) => v.sku);
    if (new Set(skus).size !== skus.length) throw HttpError.conflict('Variant SKUs must be unique.');
    ors.push({ 'variants.sku': { $in: skus } });
  }
  if (!ors.length) return;
  const found = await Product.findOne({ ...(exclude ? { _id: { $ne: exclude } } : {}), $or: ors }).session(session ?? null);
  if (found) throw HttpError.conflict('A product with that slug or SKU already exists.');
}

export const listProducts = () => Product.find({}).sort({ createdAt: -1, _id: 1 });
export async function getProduct(id: string) { const value = await Product.findById(id); if (!value) throw HttpError.notFound('Product not found.'); return value; }
export async function createProduct(input: ProductInput, actor: string) {
  await ensureProductUnique(input);
  try { const value = await Product.create(normalized(input)); await audit(actor, 'product.create', 'product', value._id); return value; } catch (e) { return duplicateConflict(e); }
}
export async function updateProduct(id: string, input: ProductUpdate, actor: string) {
  const value = await getProduct(id); await ensureProductUnique(input, id);
  Object.assign(value, normalized(input, value));
  const price = input.price ?? value.price; const sale = input.salePrice ?? value.salePrice;
  if (sale != null && sale >= price) throw HttpError.badRequest('Invalid product update.', { salePrice: ['Sale price must be lower than price'] });
  try { await value.save(); await audit(actor, 'product.update', 'product', value._id, { changedFields: Object.keys(input) }); return value; } catch (e) { return duplicateConflict(e); }
}
export async function deleteProduct(id: string, actor: string) { const value = await getProduct(id); await Product.updateMany({}, { $pull: { relatedProductIds: value._id } }); await value.deleteOne(); await audit(actor, 'product.delete', 'product', value._id); }

async function availableSlug(base: string) { let slug = base; let n = 2; while (await Product.exists({ slug })) slug = `${base}-${n++}`; return slug; }
async function availableSku(base: string) { let sku = `${base}-COPY`; let n = 2; while (await Product.exists({ 'variants.sku': sku })) sku = `${base}-COPY-${n++}`; return sku; }
export async function duplicateProduct(id: string, actor: string) {
  const source = await getProduct(id); const raw = source.toObject();
  const variants = await Promise.all(raw.variants.map(async ({ _id, ...v }) => ({ ...v, sku: await availableSku(v.sku) })));
  const strip = <T extends { _id?: unknown }>(rows: T[]) => rows.map(({ _id, ...row }) => row);
  const copy = await Product.create({ ...raw, _id: undefined, name: `${source.name} (Copy)`, slug: await availableSlug(`${source.slug}-copy`), variants,
    images: strip(raw.images), lifestyleImages: strip(raw.lifestyleImages), badges: [], rating: 0, reviewCount: 0, isPublished: false, createdAt: undefined, updatedAt: undefined });
  await audit(actor, 'product.duplicate', 'product', copy._id, { sourceId: source.id }); return copy;
}
export async function setPublished(id: string, isPublished: boolean, actor: string) { const value = await getProduct(id); const old = value.isPublished; value.isPublished = isPublished; await value.save(); await audit(actor, 'product.published', 'product', value._id, { old, new: isPublished }); return value; }

export async function bulkPublish(ids: string[], isPublished: boolean, actor: string) {
  const session = await mongoose.startSession(); let result: InstanceType<typeof Product>[] = [];
  try { await session.withTransaction(async () => { const values = await Product.find({ _id: { $in: ids } }).session(session); if (values.length !== ids.length) throw HttpError.notFound('One or more products were not found.');
    await Product.updateMany({ _id: { $in: ids } }, { isPublished }, { session }); result = await Product.find({ _id: { $in: ids } }).session(session); await audit(actor, 'product.bulk_publish', 'product', undefined, { count: ids.length, isPublished, ids }, session); });
  } finally { await session.endSession(); } const byId = new Map(result.map((v) => [v.id, v])); return ids.map((id) => byId.get(id)!);
}
export async function bulkDelete(ids: string[], actor: string) { const session = await mongoose.startSession(); try { await session.withTransaction(async () => { const count = await Product.countDocuments({ _id: { $in: ids } }).session(session); if (count !== ids.length) throw HttpError.notFound('One or more products were not found.'); await Product.updateMany({}, { $pull: { relatedProductIds: { $in: ids } } }, { session }); await Product.deleteMany({ _id: { $in: ids } }, { session }); await audit(actor, 'product.bulk_delete', 'product', undefined, { count: ids.length, ids }, session); }); return { deleted: ids.length }; } finally { await session.endSession(); } }

function seedDocuments() { const ids = new Map(catalogueProducts.map((p) => [p.id, new Types.ObjectId()])); return catalogueProducts.map(({ id, relatedProductIds, createdAt, ...p }) => ({ _id: ids.get(id), ...p, relatedProductIds: relatedProductIds.map((x) => ids.get(x)), createdAt: new Date(createdAt), updatedAt: new Date(createdAt) })); }
export async function resetProducts(actor: string) { const session = await mongoose.startSession(); let products: InstanceType<typeof Product>[] = []; try { await session.withTransaction(async () => { await Product.deleteMany({}, { session }); products = await Product.insertMany(seedDocuments() as never[], { session }); await audit(actor, 'product.reset', 'product', undefined, { count: products.length }, session); }); return products; } finally { await session.endSession(); } }

export const listCategories = () => Category.find({}).sort({ displayOrder: 1, _id: 1 });
async function categoryParent(parentId?: string) { if (!parentId) return; if (!await Category.exists({ _id: parentId })) throw HttpError.badRequest('Parent category does not exist.'); }
export async function createCategory(input: Record<string, unknown>, actor: string) { await categoryParent(input.parentId as string | undefined); if (await Category.exists({ slug: input.slug })) throw HttpError.conflict('Category slug already exists.'); const value = await Category.create(input); await audit(actor, 'category.create', 'category', value._id); return value; }
export async function updateCategory(id: string, input: Record<string, unknown>, actor: string) { const value = await Category.findById(id); if (!value) throw HttpError.notFound('Category not found.'); if (input.parentId === id) throw HttpError.badRequest('A category cannot be its own parent.'); await categoryParent(input.parentId as string | undefined); if (input.slug && await Category.exists({ slug: input.slug, _id: { $ne: id } })) throw HttpError.conflict('Category slug already exists.'); const old = value.slug; const session = await mongoose.startSession(); try { await session.withTransaction(async () => { Object.assign(value, input); await value.save({ session }); if (value.slug !== old) await Product.updateMany({ category: old }, { category: value.slug }, { session }); await audit(actor, 'category.update', 'category', value._id, { changedFields: Object.keys(input) }, session); }); return value; } finally { await session.endSession(); } }
export async function deleteCategory(id: string, actor: string) { const value = await Category.findById(id); if (!value) throw HttpError.notFound('Category not found.'); if (await Product.exists({ category: value.slug }) || await Category.exists({ parentId: value._id })) throw HttpError.conflict('Category is in use.'); await value.deleteOne(); await audit(actor, 'category.delete', 'category', value._id); }

export const listInventory = listProducts;
export async function updateStock(productId: string, variantId: string, stock: number, actor: string) { const product = await getProduct(productId); const variant = product.variants.id(variantId); if (!variant) throw HttpError.notFound('Variant not found.'); const old = variant.stock; variant.stock = stock; product.stockStatus = deriveStockStatus(product.variants.map((v) => v.stock)); await product.save(); await audit(actor, 'inventory.update', 'product', product._id, { variantId, oldStock: old, newStock: stock }); return product; }

export async function dashboard(now = new Date()) { const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)); const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)); const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const [currentOrders, previousOrders, customers, newCustomers, products, published, lowStock, vtoCompleted, vtoHelpful, vtoFeedback] = await Promise.all([Order.find({ createdAt: { $gte: start, $lt: next } }), Order.find({ createdAt: { $gte: previous, $lt: start } }), User.countDocuments({ role: 'customer' }), User.countDocuments({ role: 'customer', createdAt: { $gte: start, $lt: next } }), Product.countDocuments(), Product.countDocuments({ isPublished: true }), Product.countDocuments({ stockStatus: 'low_stock' }), VirtualTryOnJob.countDocuments({ status: 'completed' }), VirtualTryOnJob.countDocuments({ status: 'completed', feedback: 'helpful' }), VirtualTryOnJob.countDocuments({ status: 'completed', feedback: { $in: ['helpful', 'not_helpful'] } })]);
  const paid = (orders: typeof currentOrders) => orders.filter((o) => o.paymentStatus === 'paid'); const sum = (orders: typeof currentOrders) => paid(orders).reduce((n, o) => n + o.total, 0); const change = (a: number, b: number) => b === 0 ? (a === 0 ? 0 : 100) : Number((((a - b) / b) * 100).toFixed(1)); const cr = sum(currentOrders), pr = sum(previousOrders); const ca = paid(currentOrders).length ? cr / paid(currentOrders).length : 0; const pa = paid(previousOrders).length ? pr / paid(previousOrders).length : 0; const period = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(start);
  return { revenue: { total: cr, change: change(cr, pr), period }, orders: { total: currentOrders.length, change: change(currentOrders.length, previousOrders.length), period }, avgOrderValue: { total: ca, change: change(ca, pa) }, customers: { total: customers, newThisMonth: newCustomers }, products: { total: products, published, lowStock }, vtoUsage: { total: vtoCompleted, helpfulRate: vtoFeedback ? Number(((vtoHelpful / vtoFeedback) * 100).toFixed(1)) : 0 }, sizeRecUsage: { total: 0, successRate: 0 } };
}
export async function listUsers() { return Promise.all((await User.find({}).sort({ createdAt: -1, _id: 1 })).map(buildUserDto)); }
export async function setUserActive(id: string, active: boolean, actor: string) { if (id === actor && !active) throw HttpError.conflict('You cannot deactivate your own administrator account.'); const user = await User.findById(id); if (!user) throw HttpError.notFound('User not found.'); user.isActive = active; await user.save(); await audit(actor, 'user.active', 'user', user._id, { isActive: active }); return buildUserDto(user); }
export async function listOrders() { return (await Order.find({}).sort({ createdAt: -1, _id: 1 })).map(buildOrderDto); }
const transitions: Record<string, string[]> = { pending: ['confirmed','cancelled'], confirmed: ['processing','cancelled'], processing: ['dispatched','cancelled'], dispatched: ['delivered'], delivered: ['returned'], cancelled: [], returned: [] };
export async function setOrderStatus(id: string, status: string, actor: string) { const order = await Order.findById(id); if (!order) throw HttpError.notFound('Order not found.'); const old = order.status; if (status !== old && !transitions[old]!.includes(status)) throw HttpError.conflict(`Order cannot transition from ${old} to ${status}.`); order.status = status as typeof order.status; await order.save(); await audit(actor, 'order.status', 'order', order._id, { oldStatus: old, newStatus: status }); return buildOrderDto(order); }
export const listReviews = () => Review.find({}).sort({ isReported: -1, createdAt: -1, _id: 1 });
export async function moderateReview(id: string, input: { isApproved?: boolean | undefined; isReported?: boolean | undefined }, actor: string) { const review = await Review.findById(id); if (!review) throw HttpError.notFound('Review not found.'); Object.assign(review, input); await review.save(); await audit(actor, 'review.moderation', 'review', review._id, { changedFields: Object.keys(input) }); return review; }
const PROMO_DISPLAY_METADATA: Readonly<Record<keyof typeof PROMO_RULES, { startDate: string; endDate: string; usageLimit: number }>> = Object.freeze({
  VESTRA10: { startDate: '2024-01-01T00:00:00.000Z', endDate: '2030-12-31T23:59:59.999Z', usageLimit: 10_000 },
  AUTUMN15: { startDate: '2024-09-01T00:00:00.000Z', endDate: '2030-11-30T23:59:59.999Z', usageLimit: 5_000 },
  WELCOME: { startDate: '2024-01-01T00:00:00.000Z', endDate: '2030-12-31T23:59:59.999Z', usageLimit: 25_000 },
});
export function listPromotions() { return Object.entries(PROMO_RULES).map(([code, rule]) => ({ id: code.toLowerCase(), code, discountType: 'percentage', value: rule.percentage, minimumSpend: rule.minimumSpend, ...PROMO_DISPLAY_METADATA[code as keyof typeof PROMO_RULES], active: rule.active })); }

export interface CsvError { row: number; errors: string[] }
export function parseCsv(text: string): string[][] { const rows: string[][] = []; let row: string[] = [], field = '', quoted = false; for (let i=0;i<text.length;i++) { const c=text[i]!; if (quoted) { if (c==='"' && text[i+1]==='"') { field+='"'; i++; } else if (c==='"') quoted=false; else field+=c; } else if (c==='"' && field==='') quoted=true; else if (c===',') { row.push(field); field=''; } else if (c==='\n') { row.push(field); rows.push(row); row=[]; field=''; } else if (c!=='\r') field+=c; } if (quoted) throw HttpError.badRequest('Malformed CSV: unclosed quoted field.'); if (field || row.length) { row.push(field); rows.push(row); } return rows; }
export async function importCsv(text: string, actor: string) { const rows = parseCsv(text); if (!rows.length) throw HttpError.badRequest('CSV requires a header row.'); const headers=rows[0]!.map((h)=>h.trim()); const allowed=['name','slug','category','price','brand','genderCollection','shortDescription','salePrice','isPublished','colour','colourHex','size','sku','stock']; const errors: CsvError[]=[]; const valid: ProductInput[]=[]; const seenSlug=new Set<string>(), seenSku=new Set<string>();
  for(let i=1;i<rows.length;i++){ const cells=rows[i]!; if(cells.every((v)=>!v.trim())) continue; const problems:string[]=[]; if(cells.length!==headers.length) problems.push('Column count does not match header.'); const value=Object.fromEntries(headers.map((h,n)=>[h,cells[n]?.trim()??''])); for(const h of headers) if(!allowed.includes(h)) problems.push(`Unknown column: ${h}`); const price=Number(value.price), sale=value.salePrice?Number(value.salePrice):undefined, stock=value.stock?Number(value.stock):0; if(!value.price || !Number.isFinite(price)||price<=0) problems.push('Invalid price.'); if(value.salePrice && (!Number.isFinite(sale)||sale!<0||sale!>=price)) problems.push('Invalid sale price.'); if(!Number.isInteger(stock)||stock<0) problems.push('Invalid stock.'); const publishedValue=(value.isPublished??'').toLowerCase(); if(publishedValue && !['true','1','yes','false','0','no'].includes(publishedValue)) problems.push('Invalid isPublished value.');
    const slug=(value.slug ?? '').toLowerCase(), sku=value.sku || `CSV-${slug}-${i}`; if(slug && seenSlug.has(slug)) problems.push('Duplicate slug within upload.'); if(seenSku.has(sku)) problems.push('Duplicate SKU within upload.'); seenSlug.add(slug); seenSku.add(sku); if(await Product.exists({slug})) problems.push('Slug already exists.'); if(await Product.exists({'variants.sku':sku})) problems.push('SKU already exists.');
    try { const input=parseProductCreate({ name:value.name,slug,category:value.category,price,brand:value.brand,genderCollection:value.genderCollection,shortDescription:value.shortDescription,fullDescription:value.shortDescription,fitDescription:'',...(sale!==undefined?{salePrice:sale}:{}),isPublished:['true','1','yes'].includes(publishedValue),currency:'GBP',images:[],lifestyleImages:[],variants:[{sku,colour:value.colour||'Default',colourHex:value.colourHex||'#000000',size:value.size||'One Size',stock}],materials:[],careInstructions:[],badges:[],recommendationTags:[],relatedProductIds:[] }); if(!problems.length) valid.push(input); } catch(e){ if(isHttpError(e)) for (const [field, messages] of Object.entries(e.details ?? {})) problems.push(...messages.map((message) => `${field}: ${message}`)); else throw e; } if(problems.length) errors.push({row:i+1,errors:unique(problems)}); }
  const session=await mongoose.startSession(); let imported: InstanceType<typeof Product>[]=[]; try { await session.withTransaction(async()=>{ if(valid.length) imported=await Product.insertMany(valid.map((v)=>normalized(v)) as never[],{session}); await audit(actor,'product.import','product',undefined,{totalRows:rows.length-1,importedCount:imported.length,errorCount:errors.length},session); }); } catch(e){ duplicateConflict(e); } finally { await session.endSession(); } return {totalRows:rows.length-1,importedCount:imported.length,errorCount:errors.length,imported,errors}; }
