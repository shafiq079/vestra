import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { Order, Product, User, WishlistItem } from '../src/models';
import { seedCatalogue } from '../src/seed/catalogueSeed';
import { DEFAULT_ITEMS_PER_GROUP } from '../src/services/recommendationService';
import { RECOMMENDATION_TYPES } from '../src/validators/recommendation';
import { authHeader, createTestUser, mintTestAccessToken } from './helpers/auth';
import { orderFixture } from './fixtures/models';

const app = createApp({ enableDiagnostics: false });
beforeAll(async () => { await Product.createIndexes(); });
beforeEach(async () => { await Promise.all([Order.deleteMany({}), WishlistItem.deleteMany({}), Product.deleteMany({}), User.deleteMany({})]); await seedCatalogue(); });
afterAll(async () => { await Promise.all([Order.deleteMany({}), WishlistItem.deleteMany({}), Product.deleteMany({}), User.deleteMany({})]); });

async function restrictCandidates(products: Array<InstanceType<typeof Product>>) {
  const keep = new Set(products.map((product) => product.id));
  const others = await Product.find({ _id: { $nin: products.map((product) => product._id) } });
  for (const product of others) { product.variants.forEach((variant) => { variant.stock = 0; }); await product.save(); }
  expect(keep.size).toBe(products.length);
}

async function makeOrder(userId: unknown, products: Array<InstanceType<typeof Product>>, options: { status?: string; paymentStatus?: string; size?: string } = {}) {
  return Order.create(orderFixture({ userId, status: options.status ?? 'confirmed', paymentStatus: options.paymentStatus ?? 'paid',
    items: products.map((product) => ({ productId: product._id, productName: product.name, productImage: product.images[0]!.url,
      brand: product.brand, colour: product.variants[0]!.colour, size: options.size ?? 'M', quantity: 1, price: product.price })),
    subtotal: products.reduce((total, product) => total + product.price, 0), total: products.reduce((total, product) => total + product.price, 0) }));
}

function assertGroup(group: Record<string, unknown>) {
  expect(group).toEqual(expect.objectContaining({ id: expect.any(String), type: expect.any(String), title: expect.any(String),
    items: expect.any(Array), isActive: true, placement: expect.any(String) }));
  const items = group.items as Array<Record<string, unknown>>;
  expect(items.length).toBeGreaterThan(0); expect(items.length).toBeLessThanOrEqual(8);
  expect(new Set(items.map((item) => item.productId)).size).toBe(items.length);
  items.forEach((item) => {
    expect(item).toEqual(expect.objectContaining({ productId: expect.any(String), product: expect.objectContaining({ id: item.productId }),
      score: expect.any(Number), explanation: expect.any(String) }));
    expect(item.score).toBeGreaterThanOrEqual(0); expect(item.score).toBeLessThanOrEqual(1);
    const serialised = JSON.stringify(item);
    for (const privateField of ['userId', 'email', 'addresses', 'measurementProfile', 'wishlistItems', 'orders']) {
      expect(serialised).not.toContain(`"${privateField}"`);
    }
  });
}

describe('Phase 9 recommendation API', () => {
  it('returns all nine deterministic, DTO-compatible groups for a guest', async () => {
    const first = await request(app).get('/api/recommendations').expect(200);
    const second = await request(app).get('/api/recommendations').expect(200);
    expect(first.body.map((group: { type: string }) => group.type)).toEqual(RECOMMENDATION_TYPES);
    first.body.forEach(assertGroup);
    expect(first.body.map((g: { items: Array<{ productId: string; score: number }> }) => g.items.map((i) => [i.productId, i.score])))
      .toEqual(second.body.map((g: { items: Array<{ productId: string; score: number }> }) => g.items.map((i) => [i.productId, i.score])));
  });

  it.each(RECOMMENDATION_TYPES)('serves the %s type', async (type) => {
    assertGroup((await request(app).get(`/api/recommendations/${type}`).expect(200)).body);
  });

  it('filters placement and enforces default, requested, and maximum result caps', async () => {
    const defaults = await request(app).get('/api/recommendations?placement=homepage').expect(200);
    expect(defaults.body.map((group: { type: string }) => group.type)).toEqual(['recommended_for_you', 'new_arrivals_you_may_like', 'trending']);
    expect(defaults.body.every((group: { items: unknown[] }) => group.items.length <= DEFAULT_ITEMS_PER_GROUP)).toBe(true);
    const one = await request(app).get('/api/recommendations?placement=homepage&limit=1').expect(200);
    expect(one.body.every((group: { items: unknown[] }) => group.items.length <= 1)).toBe(true);
    const maximum = await request(app).get('/api/recommendations?placement=homepage&limit=8').expect(200);
    expect(maximum.body.every((group: { items: unknown[] }) => group.items.length <= 8)).toBe(true);
  });

  it('excludes unpublished, unavailable, and source products', async () => {
    const [source, hidden, unavailable] = await Product.find({ isPublished: true }).limit(3);
    hidden!.isPublished = false; await hidden!.save();
    unavailable!.variants.forEach((variant) => { variant.stock = 0; }); await unavailable!.save();
    const response = await request(app).get(`/api/recommendations/similar_styles?productId=${source!.id}&limit=8`).expect(200);
    const ids = response.body.items.map((item: { productId: string }) => item.productId);
    expect(ids).not.toContain(source!.id); expect(ids).not.toContain(hidden!.id); expect(ids).not.toContain(unavailable!.id);
  });

  it('allows a cold-start authenticated customer and rejects invalid credentials', async () => {
    const user = await createTestUser({ email: 'phase9@example.com' }); const token = mintTestAccessToken(user);
    assertGroup((await request(app).get('/api/recommendations/recommended_for_you').set(authHeader(token)).expect(200)).body);
    await request(app).get('/api/recommendations').set('Authorization', 'Bearer invalid').expect(401);
  });

  it.each(['unknown', 'similar_styles?productId=invalid', 'trending?limit=0', 'trending?limit=9'])('validates %s', async (path) => {
    const response = await request(app).get(`/api/recommendations/${path}`).expect(400);
    expect(response.body).toEqual(expect.objectContaining({ code: 'BAD_REQUEST', details: expect.any(Object) }));
  });

  it('uses wishlist-only affinity for inspired-by-wishlist and excludes the saved product', async () => {
    const [saved, matching, unrelated] = await Product.find({ isPublished: true }).limit(3);
    saved!.recommendationTags = ['minimal']; matching!.recommendationTags = ['minimal']; unrelated!.recommendationTags = ['sport'];
    matching!.category = 'matching'; unrelated!.category = 'unrelated';
    await Promise.all([saved!.save(), matching!.save(), unrelated!.save()]); await restrictCandidates([saved!, matching!, unrelated!]);
    const user = await createTestUser({ email: 'wishlist-phase9@example.com' });
    await WishlistItem.create({ userId: user._id, productId: saved!._id }); const token = mintTestAccessToken(user);
    const response = await request(app).get('/api/recommendations/inspired_by_wishlist?limit=8').set(authHeader(token)).expect(200);
    const ids = response.body.items.map((item: { productId: string }) => item.productId);
    expect(ids).not.toContain(saved!.id); expect(ids.indexOf(matching!.id)).toBeLessThan(ids.indexOf(unrelated!.id));
    expect(response.body.items.find((item: { productId: string }) => item.productId === matching!.id).explanation).toContain('wishlist');
  });

  it('does not use purchase affinity or wishlist claims when the wishlist is empty', async () => {
    const [purchased, matching] = await Product.find({ isPublished: true }).limit(2);
    purchased!.recommendationTags = ['purchase-only']; matching!.recommendationTags = ['purchase-only'];
    await Promise.all([purchased!.save(), matching!.save()]); await restrictCandidates([purchased!, matching!]);
    const user = await createTestUser({ email: 'no-wishlist-phase9@example.com' }); await makeOrder(user._id, [purchased!]);
    const response = await request(app).get('/api/recommendations/inspired_by_wishlist?limit=8').set(authHeader(mintTestAccessToken(user))).expect(200);
    response.body.items.forEach((item: { explanation: string }) => expect(item.explanation.toLowerCase()).not.toContain('wishlist'));
    expect(response.body.items[0].explanation).toBe('Popular with VESTRA customers.');
  });

  it('combines wishlist and purchase affinity for recommended-for-you and excludes signal products', async () => {
    const [saved, purchased, matching, unrelated] = await Product.find({ isPublished: true }).limit(4);
    saved!.recommendationTags = ['saved-style']; purchased!.recommendationTags = ['bought-style']; matching!.recommendationTags = ['bought-style'];
    unrelated!.recommendationTags = ['other']; await Promise.all([saved!.save(), purchased!.save(), matching!.save(), unrelated!.save()]);
    await restrictCandidates([saved!, purchased!, matching!, unrelated!]); const user = await createTestUser({ email: 'combined-phase9@example.com' });
    await WishlistItem.create({ userId: user._id, productId: saved!._id }); await makeOrder(user._id, [purchased!]);
    const response = await request(app).get('/api/recommendations/recommended_for_you?limit=8').set(authHeader(mintTestAccessToken(user))).expect(200);
    const ids = response.body.items.map((item: { productId: string }) => item.productId);
    expect(ids).not.toContain(saved!.id); expect(ids).not.toContain(purchased!.id);
    expect(ids.indexOf(matching!.id)).toBeLessThan(ids.indexOf(unrelated!.id));
  });

  it('ranks only successful paid co-occurrences and gives their truthful deterministic explanation', async () => {
    const [source, candidateA, candidateB] = await Product.find({ isPublished: true }).limit(3); await restrictCandidates([source!, candidateA!, candidateB!]);
    const user = await createTestUser({ email: 'cooccurrence-phase9@example.com' });
    await makeOrder(user._id, [source!, candidateA!]); await makeOrder(user._id, [source!, candidateA!]);
    await makeOrder(user._id, [source!, candidateB!], { status: 'cancelled' });
    await makeOrder(user._id, [source!, candidateB!], { paymentStatus: 'failed' });
    const path = `/api/recommendations/frequently_bought_together?productId=${source!.id}&limit=8`;
    const first = await request(app).get(path).expect(200); const second = await request(app).get(path).expect(200);
    expect(first.body.items[0]).toMatchObject({ productId: candidateA!.id, explanation: 'Frequently purchased with this product.' });
    expect(first.body.items.map((item: { productId: string; score: number }) => [item.productId, item.score]))
      .toEqual(second.body.items.map((item: { productId: string; score: number }) => [item.productId, item.score]));
    expect(first.body.items.map((item: { productId: string }) => item.productId)).not.toContain(source!.id);
  });

  it('boosts purchased-size availability and falls back without claiming a size', async () => {
    const [history, availableM, unavailableM] = await Product.find({ isPublished: true }).limit(3);
    for (const product of [history!, availableM!, unavailableM!]) { product.rating = 0; product.reviewCount = 0; product.badges = []; }
    history!.variants.forEach((variant) => { variant.stock = 0; });
    availableM!.variants[0]!.size = 'M'; availableM!.variants[0]!.stock = 2;
    unavailableM!.variants[0]!.size = 'L'; unavailableM!.variants[0]!.stock = 2;
    await Promise.all([history!.save(), availableM!.save(), unavailableM!.save()]); await restrictCandidates([history!, availableM!, unavailableM!]);
    const user = await createTestUser({ email: 'size-phase9@example.com' }); await makeOrder(user._id, [history!], { size: 'M' });
    const personalised = await request(app).get('/api/recommendations/trending_in_your_size?limit=8').set(authHeader(mintTestAccessToken(user))).expect(200);
    expect(personalised.body.items[0]).toMatchObject({ productId: availableM!.id, explanation: 'Popular and available in size M.' });
    const cold = await createTestUser({ email: 'size-cold-phase9@example.com' });
    const fallback = await request(app).get('/api/recommendations/trending_in_your_size?limit=8').set(authHeader(mintTestAccessToken(cold))).expect(200);
    fallback.body.items.forEach((item: { explanation: string }) => expect(item.explanation.toLowerCase()).not.toContain('your size'));
  });

  it('uses product id as the stable tie-break for equal scores', async () => {
    const candidates = await Product.find({ isPublished: true }).limit(3);
    for (const product of candidates) { product.rating = 0; product.reviewCount = 0; product.badges = []; await product.save(); }
    await restrictCandidates(candidates);
    const response = await request(app).get('/api/recommendations/trending?limit=8').expect(200);
    const ids = response.body.items.map((item: { productId: string }) => item.productId);
    expect(ids).toEqual([...ids].sort((a, b) => a.localeCompare(b)));
    response.body.items.forEach((item: { score: number; explanation: string }) => {
      expect(item.score).toBeGreaterThanOrEqual(0); expect(item.score).toBeLessThanOrEqual(1);
      expect(item.explanation).toBe('Popular with VESTRA customers.');
    });
  });
});
