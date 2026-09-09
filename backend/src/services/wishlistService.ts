import { Product, WishlistItem } from '../models';
import { HttpError } from '../utils/httpError';

export async function getWishlist(userId: string) {
  const records = await WishlistItem.find({ userId }).sort({ addedAt: -1 });
  const products = await Product.find({ _id: { $in: records.map((record) => record.productId) }, isPublished: true });
  const byId = new Map(products.map((product) => [product.id, product]));
  return records.map((record) => byId.get(record.productId.toString())).filter((product) => product !== undefined);
}

export async function toggleWishlist(userId: string, productId: string) {
  const product = await Product.findOne({ _id: productId, isPublished: true });
  if (!product) throw HttpError.notFound('Product not found.');
  const removed = await WishlistItem.findOneAndDelete({ userId, productId });
  if (!removed) {
    try { await WishlistItem.create({ userId, productId }); }
    catch (error: unknown) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 11000)) throw error;
    }
  }
  return getWishlist(userId);
}
