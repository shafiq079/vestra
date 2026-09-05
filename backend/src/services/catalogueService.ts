import type { FilterQuery } from 'mongoose';
import { Category, Collection, Product } from '../models';
import type { ProductShape } from '../models/Product';
import { HttpError } from '../utils/httpError';
import type { ProductQuery } from '../validators/catalogue';

const published = { isPublished: true } as const;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function productFilter(query: ProductQuery): FilterQuery<ProductShape> {
  const filter: FilterQuery<ProductShape> = { ...published };
  if (query.categories.length) filter.category = { $in: query.categories };
  if (query.sizes.length) filter.availableSizes = { $in: query.sizes };
  if (query.colours.length) filter.colours = { $in: query.colours };
  if (query.brands.length) filter.brand = { $in: query.brands };
  if (query.collection !== undefined) filter.collection = query.collection;
  if (query.genderCollection !== undefined) filter.genderCollection = query.genderCollection;
  if (query.rating !== undefined) filter.rating = { $gte: query.rating };
  if (query.tryOnEligible !== undefined) filter.tryOnEligible = query.tryOnEligible;
  if (query.sizeRecEligible !== undefined) filter.sizeRecommendationEligible = query.sizeRecEligible;

  const expressions: Record<string, unknown>[] = [];
  const effectivePrice = { $ifNull: ['$salePrice', '$price'] };
  if (query.minPrice !== undefined) expressions.push({ $gte: [effectivePrice, query.minPrice] });
  if (query.maxPrice !== undefined) expressions.push({ $lte: [effectivePrice, query.maxPrice] });
  const isOnSale = { $and: [{ $ne: [{ $type: '$salePrice' }, 'missing'] }, { $ne: ['$salePrice', null] }, { $lt: ['$salePrice', '$price'] }] };
  if (query.onSale === true) expressions.push(isOnSale);
  if (query.onSale === false) expressions.push({ $not: [isOnSale] });
  if (query.availability !== undefined) {
    const available = { $gt: [{ $size: { $filter: { input: '$variants', as: 'variant', cond: { $gt: ['$$variant.stock', 0] } } } }, 0] };
    expressions.push(query.availability ? available : { $not: [available] });
  }
  if (expressions.length) filter.$expr = expressions.length === 1 ? expressions[0]! : { $and: expressions };

  const and: FilterQuery<ProductShape>[] = [];
  if (query.fits.length) and.push({ $or: query.fits.map((fit) => ({ fitDescription: new RegExp(escapeRegex(fit), 'i') })) });
  if (query.search) {
    filter.$text = { $search: query.search };
  }
  if (and.length) filter.$and = and;
  return filter;
}

function sortProducts(products: InstanceType<typeof Product>[], sortBy: ProductQuery['sortBy']): void {
  const effective = (product: InstanceType<typeof Product>) => product.salePrice ?? product.price;
  products.sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'newest') comparison = b.createdAt.getTime() - a.createdAt.getTime();
    else if (sortBy === 'price_asc') comparison = effective(a) - effective(b);
    else if (sortBy === 'price_desc') comparison = effective(b) - effective(a);
    else if (sortBy === 'rating') comparison = b.rating - a.rating;
    else if (sortBy === 'bestselling') comparison = b.reviewCount - a.reviewCount;
    // ObjectIds are assigned in seed catalogue order, making this the stable
    // curated default without relying on MongoDB natural ordering.
    else comparison = a._id.toString().localeCompare(b._id.toString());
    return comparison || a._id.toString().localeCompare(b._id.toString());
  });
}

export async function listProducts(query: ProductQuery) {
  const products = await Product.find(productFilter(query));
  sortProducts(products, query.sortBy);
  if (!query.paginated) return products;
  const total = products.length;
  const start = (query.page - 1) * query.pageSize;
  return { items: products.slice(start, start + query.pageSize), total, page: query.page,
    pageSize: query.pageSize, totalPages: Math.ceil(total / query.pageSize) };
}

export async function featuredProducts() {
  const products = await Product.find({ ...published, badges: { $in: ['bestseller', 'new'] } });
  sortProducts(products, 'recommended');
  return products.slice(0, 8);
}
export async function newProducts() {
  const products = await Product.find({ ...published, badges: 'new' });
  sortProducts(products, 'newest');
  return products.slice(0, 8);
}
export async function saleProducts() {
  const products = await Product.find({ ...published, salePrice: { $type: 'number' }, $expr: { $lt: ['$salePrice', '$price'] } });
  sortProducts(products, 'recommended');
  return products;
}
export async function searchProducts(search: string) {
  return listProducts({ categories: [], sizes: [], colours: [], brands: [], fits: [], search,
    sortBy: 'recommended', paginated: false, page: 1, pageSize: 12 });
}
export async function productBySlug(slug: string) {
  const product = await Product.findOne({ ...published, slug });
  if (!product) throw HttpError.notFound('Product not found.');
  return product;
}
export async function relatedProducts(id: import('mongoose').Types.ObjectId) {
  const source = await Product.findOne({ ...published, _id: id });
  if (!source) throw HttpError.notFound('Product not found.');
  const wanted = source.relatedProductIds;
  const found = await Product.find({ ...published, _id: { $in: wanted } });
  const byId = new Map(found.map((item) => [item._id.toString(), item]));
  return wanted.map((item) => byId.get(item.toString())).filter((item) => item !== undefined).slice(0, 4);
}

export async function listCategories(parentId?: import('mongoose').Types.ObjectId) {
  return Category.find({ isActive: true, ...(parentId ? { parentId } : {}) }).sort({ displayOrder: 1, _id: 1 });
}
export async function categoryBySlug(slug: string) {
  const category = await Category.findOne({ slug, isActive: true });
  if (!category) throw HttpError.notFound('Category not found.');
  return category;
}
export async function listCollections() {
  return Collection.find({ isActive: true }).sort({ name: 1, _id: 1 });
}
export async function collectionBySlug(slug: string) {
  const collection = await Collection.findOne({ slug, isActive: true });
  if (!collection) throw HttpError.notFound('Collection not found.');
  return collection;
}
