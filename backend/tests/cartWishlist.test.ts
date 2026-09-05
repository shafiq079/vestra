import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { Cart, Product, User, WishlistItem } from '../src/models';
import { productFixture } from './fixtures/models';
import { authHeader, createTestUser, mintTestAccessToken } from './helpers/auth';

const guestA = '123e4567-e89b-42d3-a456-426614174000';
const guestB = '123e4567-e89b-42d3-a456-426614174001';
const guest = (id = guestA) => ({ 'X-Guest-Cart-Id': id });
const addBody = (product: InstanceType<typeof Product>, overrides = {}) => ({ productId: product.id,
  variantId: product.variants[0]!.id, colour: 'Black', size: 'M', quantity: 1, ...overrides });

beforeEach(async () => { await Promise.all([Cart.deleteMany({}), WishlistItem.deleteMany({}), Product.deleteMany({}), User.deleteMany({})]); });

describe('Phase 5 cart', () => {
  it('requires a valid identity and returns a non-persisted empty cart', async () => {
    for (const headers of [{}, guest('bad')]) { const response = await request(app).get('/api/cart').set(headers); expect(response.status).toBe(400); expect(response.body).toMatchObject({ code: 'BAD_REQUEST' }); }
    const response = await request(app).get('/api/cart').set(guest()); expect(response.body).toEqual({ items: [], subtotal: 0, discount: 0, estimatedTotal: 0 });
    expect(await Cart.countDocuments()).toBe(0);
  });
  it('adds and persists a populated item using sale price, increments duplicates, and hides persistence fields', async () => {
    const product = await Product.create(productFixture({ price: 100, salePrice: 75, isPublished: true, variants: [{ sku: 'CART-1', colour: 'Black', colourHex: '#000', size: 'M', stock: 4 }] }));
    const first = await request(app).post('/api/cart/items').set(guest()).send(addBody(product));
    expect(first.status).toBe(201); expect(first.body).toMatchObject({ subtotal: 75, discount: 0, estimatedTotal: 75, items: [{ productId: product.id, variantId: product.variants[0]!.id, colour: 'Black', size: 'M', quantity: 1, price: 75, product: { id: product.id, name: product.name, variants: expect.any(Array) } }] });
    expect(JSON.stringify(first.body)).not.toMatch(/guestId|userId|__v|deliveryOptionId/);
    const second = await request(app).post('/api/cart/items').set(guest()).send(addBody(product, { quantity: 2 }));
    expect(second.body.items).toHaveLength(1); expect(second.body.items[0].quantity).toBe(3);
    expect((await request(app).get('/api/cart').set(guest())).body.items[0].quantity).toBe(3);
  });
  it('strictly validates product, variant, selection, quantities, stock, and item IDs', async () => {
    const product = await Product.create(productFixture({ isPublished: true, variants: [{ sku: 'CART-2', colour: 'Black', colourHex: '#000', size: 'M', stock: 1 }] }));
    for (const body of [addBody(product, { price: 1 }), addBody(product, { quantity: 0 }), addBody(product, { variantId: new Product()._id.toString() }), addBody(product, { colour: 'White' }), addBody(product, { quantity: 2 })]) expect((await request(app).post('/api/cart/items').set(guest()).send(body)).status).toBeGreaterThanOrEqual(400);
    product.variants[0]!.stock = 0; await product.save(); expect((await request(app).post('/api/cart/items').set(guest()).send(addBody(product))).status).toBe(409);
    product.isPublished = false; await product.save(); expect((await request(app).post('/api/cart/items').set(guest()).send(addBody(product))).status).toBe(404);
    expect((await request(app).patch('/api/cart/items/bad').set(guest()).send({ quantity: 1 })).status).toBe(400);
  });
  it('returns 404 for a valid but missing product and rejects client-owned totals', async () => {
    const missingProductId = new Product()._id.toString();
    const variantId = new Product()._id.toString();
    expect((await request(app).post('/api/cart/items').set(guest()).send({ productId: missingProductId,
      variantId, colour: 'Black', size: 'M', quantity: 1 })).status).toBe(404);
    const product = await Product.create(productFixture({ isPublished: true }));
    for (const field of ['subtotal', 'discount', 'estimatedTotal']) {
      const response = await request(app).post('/api/cart/items').set(guest()).send(addBody(product, { [field]: 0 }));
      expect(response.status).toBe(400); expect(response.body.code).toBe('BAD_REQUEST');
    }
  });
  it('updates, removes, and idempotently clears only owned cart items', async () => {
    const product = await Product.create(productFixture({ isPublished: true, variants: [{ sku: 'CART-3', colour: 'Black', colourHex: '#000', size: 'M', stock: 2 }] }));
    const added = await request(app).post('/api/cart/items').set(guest()).send(addBody(product)); const id = added.body.items[0].id;
    expect((await request(app).patch(`/api/cart/items/${id}`).set(guest()).send({ quantity: 2 })).body.items[0].quantity).toBe(2);
    expect((await request(app).patch(`/api/cart/items/${id}`).set(guest()).send({ quantity: 3 })).status).toBe(409);
    expect((await request(app).delete(`/api/cart/items/${id}`).set(guestB)).status).toBe(404);
    expect((await request(app).delete(`/api/cart/items/${id}`).set(guest())).body.items).toEqual([]);
    expect((await request(app).delete('/api/cart').set(guest())).body).toEqual({ items: [], subtotal: 0, discount: 0, estimatedTotal: 0 });
  });
  it('applies percentage promos and treats invalid, inactive, and minimum-spend codes as compatibility responses', async () => {
    const product = await Product.create(productFixture({ price: 100, isPublished: true, variants: [{ sku: 'CART-4', colour: 'Black', colourHex: '#000', size: 'M', stock: 3 }] })); await request(app).post('/api/cart/items').set(guest()).send(addBody(product));
    for (const code of ['NOPE', 'WELCOME', 'AUTUMN15']) { const result = await request(app).post('/api/cart/promo').set(guest()).send({ code }); expect(result.status).toBe(200); expect(result.body.valid).toBe(false); }
    expect((await request(app).post('/api/cart/promo').set(guest()).send({ code: 'vestra10' })).body).toEqual({ valid: true, discount: 10, message: 'Promo code applied' });
    expect((await request(app).get('/api/cart').set(guest())).body).toMatchObject({ subtotal: 100, discount: 10, promoCode: 'VESTRA10', estimatedTotal: 90 });
    expect((await request(app).delete('/api/cart/promo').set(guest())).body).toMatchObject({ discount: 0, estimatedTotal: 100 });
  });
  it('isolates authenticated users and gives authentication precedence over a guest header', async () => {
    const [a, b] = await Promise.all([createTestUser(), createTestUser({ email: 'other@example.com' })]); const product = await Product.create(productFixture({ isPublished: true, variants: [{ sku: 'CART-5', colour: 'Black', colourHex: '#000', size: 'M', stock: 3 }] }));
    await request(app).post('/api/cart/items').set({ ...guest(), ...authHeader(mintTestAccessToken(a)) }).send(addBody(product));
    expect((await request(app).get('/api/cart').set(authHeader(mintTestAccessToken(b)))).body.items).toEqual([]); expect((await request(app).get('/api/cart').set(guest())).body.items).toEqual([]);
  });
  it('merges guest lines, combines duplicates, removes guest state, and is repeat-safe', async () => {
    const user = await createTestUser(); const token = mintTestAccessToken(user); const product = await Product.create(productFixture({ isPublished: true, variants: [{ sku: 'CART-6', colour: 'Black', colourHex: '#000', size: 'M', stock: 4 }] }));
    await request(app).post('/api/cart/items').set(guest()).send(addBody(product)); await request(app).post('/api/cart/items').set(authHeader(token)).send(addBody(product));
    const merged = await request(app).post('/api/cart/merge').set({ ...guest(), ...authHeader(token) }); expect(merged.body.items[0].quantity).toBe(2); expect(await Cart.findOne({ guestId: guestA })).toBeNull();
    expect((await request(app).post('/api/cart/merge').set({ ...guest(), ...authHeader(token) })).body.items[0].quantity).toBe(2);
  });
  it('rejects a merge stock conflict without modifying either cart', async () => {
    const user = await createTestUser(); const token = mintTestAccessToken(user); const product = await Product.create(productFixture({ isPublished: true, variants: [{ sku: 'CART-7', colour: 'Black', colourHex: '#000', size: 'M', stock: 2 }] }));
    await request(app).post('/api/cart/items').set(guest()).send(addBody(product)); await request(app).post('/api/cart/items').set(authHeader(token)).send(addBody(product, { quantity: 2 }));
    expect((await request(app).post('/api/cart/merge').set({ ...guest(), ...authHeader(token) })).status).toBe(409); expect(await Cart.findOne({ guestId: guestA })).not.toBeNull(); expect((await request(app).get('/api/cart').set(authHeader(token))).body.items[0].quantity).toBe(2);
  });
});

describe('Phase 5 wishlist', () => {
  it('requires auth, returns Product[], toggles both ways, and updates the User DTO', async () => {
    expect((await request(app).get('/api/wishlist')).status).toBe(401); const user = await createTestUser(); const headers = authHeader(mintTestAccessToken(user)); const product = await Product.create(productFixture({ isPublished: true }));
    expect((await request(app).get('/api/wishlist').set(headers)).body).toEqual([]);
    const added = await request(app).post('/api/wishlist/toggle').set(headers).send({ productId: product.id }); expect(added.body).toMatchObject([{ id: product.id, name: product.name }]); expect(await WishlistItem.countDocuments()).toBe(1);
    expect((await request(app).get('/api/auth/me').set(headers)).body.wishlistIds).toEqual([product.id]);
    expect((await request(app).post('/api/wishlist/toggle').set(headers).send({ productId: product.id })).body).toEqual([]); expect(await WishlistItem.countDocuments()).toBe(0);
  });
  it('rejects invalid, missing, and unpublished products and isolates users', async () => {
    const [a, b] = await Promise.all([createTestUser(), createTestUser({ email: 'wish-b@example.com' })]); const product = await Product.create(productFixture({ isPublished: true }));
    expect((await request(app).post('/api/wishlist/toggle').set(authHeader(mintTestAccessToken(a))).send({ productId: 'bad' })).status).toBe(400);
    expect((await request(app).post('/api/wishlist/toggle').set(authHeader(mintTestAccessToken(a))).send({ productId: new Product()._id.toString() })).status).toBe(404);
    await request(app).post('/api/wishlist/toggle').set(authHeader(mintTestAccessToken(a))).send({ productId: product.id }); expect((await request(app).get('/api/wishlist').set(authHeader(mintTestAccessToken(b)))).body).toEqual([]);
    const hidden = await Product.create(productFixture({ isPublished: false })); expect((await request(app).post('/api/wishlist/toggle').set(authHeader(mintTestAccessToken(a))).send({ productId: hidden.id })).status).toBe(404);
  });
});
