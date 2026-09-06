import type { HydratedDocument } from 'mongoose';
import { Order, Product, WishlistItem } from '../models';
import type { ProductShape } from '../models/Product';
import { HttpError } from '../utils/httpError';
import type { RecommendationQuery, RecommendationType } from '../validators/recommendation';
import { RECOMMENDATION_TYPES } from '../validators/recommendation';

export const DEFAULT_ITEMS_PER_GROUP = 4;
export const MAX_ITEMS_PER_GROUP = 8;
export const SCORE_RANGE = { minimum: 0, maximum: 1 } as const;
type ProductDocument = HydratedDocument<ProductShape>;
type Strategy = 'personal' | 'similar' | 'complementary' | 'cooccurrence' | 'wishlist' | 'size' | 'new' | 'trending';
type Metadata = { title: string; subtitle: string; placement: 'homepage' | 'product_detail' | 'account'; strategy: Strategy };

/** Central presentation/strategy registry: one group exists for each declared frontend type. */
export const RECOMMENDATION_GROUPS: Record<RecommendationType, Metadata> = {
  recommended_for_you: { title: 'Recommended for You', subtitle: 'Selected from your saved and purchased styles, when available', placement: 'homepage', strategy: 'personal' },
  similar_styles: { title: 'Similar Styles', subtitle: 'Pieces with related catalogue attributes', placement: 'product_detail', strategy: 'similar' },
  complete_the_look: { title: 'Complete the Look', subtitle: 'Complementary pieces from the current catalogue', placement: 'product_detail', strategy: 'complementary' },
  frequently_bought_together: { title: 'Frequently Bought Together', subtitle: 'Aggregate purchase patterns and catalogue alternatives', placement: 'product_detail', strategy: 'cooccurrence' },
  based_on_recently_viewed: { title: 'More Styles to Explore', subtitle: 'Related to the current product when supplied', placement: 'account', strategy: 'similar' },
  inspired_by_wishlist: { title: 'Inspired by Your Wishlist', subtitle: 'Related to saved styles, when available', placement: 'account', strategy: 'wishlist' },
  trending_in_your_size: { title: 'Trending in Your Size', subtitle: 'Uses previously purchased sizes when available', placement: 'account', strategy: 'size' },
  new_arrivals_you_may_like: { title: 'New Arrivals You May Like', subtitle: 'The newest pieces, with preference matches when available', placement: 'homepage', strategy: 'new' },
  trending: { title: 'Trending Now', subtitle: 'Popular with VESTRA customers', placement: 'homepage', strategy: 'trending' },
};

type Affinity = { categories: Set<string>; collections: Set<string>; genders: Set<string>; tags: Set<string> };
type UserSignals = { combinedAffinity: Affinity; wishlistAffinity: Affinity; purchaseAffinity: Affinity;
  wishlistIds: Set<string>; purchasedIds: Set<string>; purchasedSizes: Map<string, number> };
type Ranked = { product: ProductDocument; score: number; explanation: string; sourceContext?: string };
type RecommendationContext = { products: ProductDocument[]; counts: Map<string, number>; userSignals: UserSignals; source: ProductDocument | null };
const emptyAffinity = (): Affinity => ({ categories: new Set(), collections: new Set(), genders: new Set(), tags: new Set() });
const id = (product: ProductDocument) => product._id.toString();
const available = (product: ProductDocument) => product.isPublished && product.variants.some((variant) => variant.stock > 0);
const successfulOrderFilter = { paymentStatus: 'paid', status: { $nin: ['cancelled', 'returned'] } } as const;

function quality(product: ProductDocument, orders: number): number {
  // Deliberately coarse, documented weights: orders 0.35, reviews 0.20, rating 0.15, bestseller 0.10.
  return Math.min(0.8, Math.min(orders, 10) * 0.035 + Math.min(product.reviewCount, 100) * 0.002
    + (product.rating / 5) * 0.15 + (product.badges.includes('bestseller') ? 0.1 : 0));
}
const round = (value: number) => Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
function stableRank(items: Ranked[], limit: number) {
  const unique = new Map<string, Ranked>();
  for (const item of items) if (!unique.has(id(item.product))) unique.set(id(item.product), item);
  return [...unique.values()].sort((a, b) => b.score - a.score || id(a.product).localeCompare(id(b.product))).slice(0, limit);
}

function addAffinity(affinity: Affinity, product: ProductDocument) {
  affinity.categories.add(product.category); if (product.collection) affinity.collections.add(product.collection);
  affinity.genders.add(product.genderCollection); product.recommendationTags.forEach((tag) => affinity.tags.add(tag));
}

async function signals(userId?: string): Promise<UserSignals> {
  const combinedAffinity = emptyAffinity(); const wishlistAffinity = emptyAffinity(); const purchaseAffinity = emptyAffinity();
  const wishlistIds = new Set<string>(); const purchasedIds = new Set<string>(); const purchasedSizes = new Map<string, number>();
  const result = { combinedAffinity, wishlistAffinity, purchaseAffinity, wishlistIds, purchasedIds, purchasedSizes };
  if (!userId) return result;
  const [saved, orders] = await Promise.all([
    WishlistItem.find({ userId }).select('productId'),
    Order.find({ userId, ...successfulOrderFilter }).select('items'),
  ]);
  const signalIds = new Set<string>();
  saved.forEach((item) => { const value = item.productId.toString(); wishlistIds.add(value); signalIds.add(value); });
  orders.forEach((order) => order.items.forEach((item) => {
    const value = item.productId.toString(); signalIds.add(value); purchasedIds.add(value);
    purchasedSizes.set(item.size, (purchasedSizes.get(item.size) ?? 0) + item.quantity);
  }));
  const products = await Product.find({ _id: { $in: [...signalIds] } });
  products.forEach((product) => {
    addAffinity(combinedAffinity, product);
    if (wishlistIds.has(id(product))) addAffinity(wishlistAffinity, product);
    if (purchasedIds.has(id(product))) addAffinity(purchaseAffinity, product);
  });
  return result;
}

function affinityScore(product: ProductDocument, affinity: Affinity): { score: number; explanation?: string } {
  const sharedTags = product.recommendationTags.filter((tag) => affinity.tags.has(tag)).length;
  if (sharedTags) return { score: Math.min(0.55, 0.3 + sharedTags * 0.08), explanation: 'Shares style tags with items you saved or purchased.' };
  if (affinity.categories.has(product.category)) return { score: 0.32, explanation: 'Matches a category you saved or purchased.' };
  if (product.collection && affinity.collections.has(product.collection)) return { score: 0.28, explanation: 'From a collection you have previously shown interest in.' };
  if (affinity.genders.has(product.genderCollection)) return { score: 0.12, explanation: 'Matches your previous catalogue preferences.' };
  return { score: 0 };
}

async function orderCounts(): Promise<Map<string, number>> {
  const orders = await Order.find(successfulOrderFilter).select('items'); const counts = new Map<string, number>();
  orders.forEach((order) => order.items.forEach((item) => counts.set(item.productId.toString(), (counts.get(item.productId.toString()) ?? 0) + item.quantity)));
  return counts;
}

function similarScore(product: ProductDocument, source: ProductDocument, complementary: boolean): { score: number; explanation: string } {
  const related = source.relatedProductIds.some((value) => value.toString() === id(product));
  if (related) return { score: complementary ? 0.92 : 1, explanation: 'Explicitly related in the product catalogue.' };
  const tags = product.recommendationTags.filter((tag) => source.recommendationTags.includes(tag)).length;
  if (complementary && product.category !== source.category && product.collection && product.collection === source.collection)
    return { score: round(0.72 + Math.min(tags, 2) * 0.05), explanation: 'A complementary category from the same collection.' };
  if (tags) return { score: round(0.62 + Math.min(tags, 3) * 0.06), explanation: 'Shares style tags with this product.' };
  if (!complementary && product.category === source.category && product.subcategory === source.subcategory)
    return { score: 0.58, explanation: 'From the same category and subcategory.' };
  if (product.collection && product.collection === source.collection)
    return { score: complementary ? 0.5 : 0.46, explanation: 'From the same collection.' };
  return { score: product.genderCollection === source.genderCollection ? 0.16 : 0.05, explanation: 'Popular with VESTRA customers.' };
}

async function buildContext(query: RecommendationQuery, userId?: string): Promise<RecommendationContext> {
  const [products, counts, userSignals] = await Promise.all([
    Product.find({ isPublished: true, variants: { $elemMatch: { stock: { $gt: 0 } } } }), orderCounts(), signals(userId),
  ]);
  let source: ProductDocument | null = null;
  if (query.productId) {
    source = await Product.findOne({ _id: query.productId, isPublished: true });
    if (!source) throw HttpError.notFound('Product not found.');
  }
  return { products, counts, userSignals, source };
}

async function groupFromContext(type: RecommendationType, query: RecommendationQuery, context: RecommendationContext) {
  const metadata = RECOMMENDATION_GROUPS[type];
  const { products, counts, userSignals, source } = context;
  const candidates = products.filter((product) => available(product) && (!source || id(product) !== id(source)));
  let ranked: Ranked[];
  if (metadata.strategy === 'similar' || metadata.strategy === 'complementary') {
    ranked = candidates.map((product) => source
      ? { product, ...similarScore(product, source, metadata.strategy === 'complementary'), sourceContext: `Similar to ${source.name}` }
      : { product, score: round(quality(product, counts.get(id(product)) ?? 0)), explanation: 'Popular with VESTRA customers.' });
  } else if (metadata.strategy === 'cooccurrence' && source) {
    const together = new Map<string, number>();
    const orders = await Order.find({ ...successfulOrderFilter, 'items.productId': source._id }).select('items');
    orders.forEach((order) => new Set(order.items.map((item) => item.productId.toString()).filter((value) => value !== id(source)))
      .forEach((value) => together.set(value, (together.get(value) ?? 0) + 1)));
    const maximum = Math.max(0, ...together.values());
    ranked = candidates.map((product) => together.has(id(product))
      ? { product, score: round(0.7 + 0.3 * (together.get(id(product))! / maximum)), explanation: 'Frequently purchased with this product.' }
      : { product, ...similarScore(product, source, true) });
  } else if (metadata.strategy === 'new') {
    const newest = Math.max(1, ...candidates.map((product) => product.createdAt.getTime()));
    const oldest = Math.min(newest, ...candidates.map((product) => product.createdAt.getTime())); const span = Math.max(1, newest - oldest);
    const excluded = new Set([...userSignals.wishlistIds, ...userSignals.purchasedIds]);
    ranked = candidates.filter((product) => !excluded.has(id(product))).map((product) => {
      const match = affinityScore(product, userSignals.combinedAffinity); const recency = (product.createdAt.getTime() - oldest) / span;
      return { product, score: round(0.5 + recency * 0.25 + (product.badges.includes('new') ? 0.15 : 0) + match.score * 0.1),
        explanation: match.score ? 'New arrival matching your preferred categories or styles.' : 'One of the newest available arrivals.' };
    });
  } else if (metadata.strategy === 'personal' || metadata.strategy === 'wishlist') {
    const affinity = metadata.strategy === 'wishlist' ? userSignals.wishlistAffinity : userSignals.combinedAffinity;
    const excluded = metadata.strategy === 'wishlist' ? userSignals.wishlistIds : new Set([...userSignals.wishlistIds, ...userSignals.purchasedIds]);
    const hasSignals = excluded.size > 0;
    ranked = candidates.filter((product) => !excluded.has(id(product))).map((product) => {
      const match = affinityScore(product, affinity);
      return { product, score: round(match.score + quality(product, counts.get(id(product)) ?? 0) * 0.45),
        explanation: hasSignals && match.explanation
          ? (metadata.strategy === 'wishlist' ? match.explanation.replace('items you saved or purchased', 'an item in your wishlist').replace('saved or purchased', 'added to your wishlist') : match.explanation)
          : 'Popular with VESTRA customers.' };
    });
  } else {
    let preferredSize: string | undefined;
    if (metadata.strategy === 'size') preferredSize = [...userSignals.purchasedSizes].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
    ranked = candidates.map((product) => {
      const fits = preferredSize !== undefined && product.variants.some((variant) => variant.size === preferredSize && variant.stock > 0);
      return { product, score: round(quality(product, counts.get(id(product)) ?? 0) + (fits ? 0.2 : 0)),
        explanation: fits ? `Popular and available in size ${preferredSize}.` : 'Popular with VESTRA customers.' };
    });
  }
  const items = stableRank(ranked, query.limit).map(({ product, score, explanation, sourceContext }) => ({
    productId: id(product), product, score, explanation, ...(sourceContext ? { sourceContext } : {}),
  }));
  return { id: `recommendation-${type}`, type, title: metadata.title, subtitle: metadata.subtitle,
    items, isActive: true, placement: metadata.placement };
}

export async function recommendationGroup(type: RecommendationType, query: RecommendationQuery, userId?: string) {
  return groupFromContext(type, query, await buildContext(query, userId));
}

export async function recommendationGroups(query: RecommendationQuery, userId?: string) {
  const types = RECOMMENDATION_TYPES.filter((type) => !query.placement || RECOMMENDATION_GROUPS[type].placement === query.placement);
  const context = await buildContext(query, userId);
  return Promise.all(types.map((type) => groupFromContext(type, query, context)));
}
