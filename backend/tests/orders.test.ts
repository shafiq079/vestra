import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { Cart, Order, Product, User } from '../src/models';
import { deriveStockStatus } from '../src/services/inventoryService';
import { estimatedDelivery, resolveDeliveryOption } from '../src/services/deliveryService';
import * as orderNumbers from '../src/services/orderNumberService';
import { authHeader, createTestUser, mintTestAccessToken } from './helpers/auth';
import { productFixture } from './fixtures/models';

const address = { id: 'client-only', label: 'Home', firstName: 'Ada', lastName: 'Lovelace',
  line1: '1 High Street', city: 'London', postcode: 'sw1a 1aa', country: 'United Kingdom', isDefault: true };
const compatibleBody = (overrides: Record<string, unknown> = {}) => ({ shippingAddress: address,
  deliveryOption: { id: 'del2', name: 'Hacked', description: 'Instant', price: -10, estimatedDays: 'now' },
  items: [{ productName: 'Fake', price: 0, quantity: 999 }], subtotal: 0, discount: 999,
  deliveryCost: -10, total: 0, promoCode: 'FAKE', estimatedDelivery: '1900-01-01', ...overrides });

async function productAndCart(owner: { userId?: unknown; guestId?: string }, stock = 10, price = 40, salePrice?: number) {
  const product = await Product.create(productFixture({ price, salePrice, isPublished: true,
    images: [{ url: '/later.jpg', alt: 'Later', position: 2 }, { url: '/primary.jpg', alt: 'Primary', position: 0 }],
    variants: [{ sku: `ONE-${Math.random()}`, colour: 'Black', colourHex: '#000', size: 'M', stock },
      { sku: `TWO-${Math.random()}`, colour: 'Blue', colourHex: '#00f', size: 'L', stock: 8 }] }));
  await Cart.create({ ...owner, items: [{ productId: product._id, variantId: product.variants[0]!._id,
    colour: 'stale', size: 'stale', quantity: 1, price: 0 }], subtotal: 0, estimatedTotal: 0 });
  return product;
}

beforeEach(async () => { vi.restoreAllMocks(); await Promise.all([Cart.deleteMany({}), Order.deleteMany({}), Product.deleteMany({}), User.deleteMany({})]); });

describe('Phase 6 order checkout', () => {
  it('creates an authenticated server-authoritative snapshot, charges delivery, and consumes the cart', async () => {
    const user = await createTestUser(); const token = mintTestAccessToken(user);
    const product = await productAndCart({ userId: user._id }, 10, 50, 40);
    const response = await request(app).post('/api/orders').set(authHeader(token)).send(compatibleBody({ userId: user.id }));
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ userId: user.id, subtotal: 40, discount: 0, deliveryCost: 7.95,
      total: 47.95, status: 'confirmed', paymentStatus: 'paid', shippingAddress: { postcode: 'SW1A 1AA' },
      deliveryOption: { id: 'del2', name: 'Express Delivery', price: 7.95 },
      items: [{ productName: product.name, productImage: '/primary.jpg', brand: product.brand,
        colour: 'Black', size: 'M', quantity: 1, price: 40 }] });
    expect(response.body.estimatedDelivery).not.toBe('1900-01-01');
    expect(response.body.orderNumber).toMatch(/^VST-\d{4}-[A-F0-9]{8}$/);
    expect(await Cart.countDocuments()).toBe(0);
    const fresh = await Product.findById(product._id);
    expect(fresh!.variants[0]!.stock).toBe(9); expect(fresh!.variants[1]!.stock).toBe(8);
    expect((await request(app).post('/api/orders').set(authHeader(token)).send(compatibleBody())).status).toBe(409);
    expect((await Product.findById(product._id))!.variants[0]!.stock).toBe(9);
  });

  it('creates a guest order and consumes its UUID cart', async () => {
    const guestId = '123e4567-e89b-42d3-a456-426614174000'; await productAndCart({ guestId }, 2, 80);
    const response = await request(app).post('/api/orders').set('X-Guest-Cart-Id', guestId)
      .send(compatibleBody({ guestEmail: 'GUEST@EXAMPLE.COM', deliveryOption: { id: 'del3' } }));
    expect(response.status).toBe(201); expect(response.body).toMatchObject({ guestEmail: 'guest@example.com', deliveryCost: 0, total: 80 });
    expect(await Cart.countDocuments()).toBe(0);
  });

  it('rejects identity, address, delivery, unknown/card fields, and invalid bearer input', async () => {
    const user = await createTestUser(); const other = await createTestUser({ email: 'other@example.com' }); const token = mintTestAccessToken(user);
    expect((await request(app).post('/api/orders').set(authHeader(token)).send(compatibleBody({ userId: other.id }))).status).toBe(403);
    expect((await request(app).post('/api/orders').set(authHeader(token)).send(compatibleBody({ shippingAddress: { firstName: '' } }))).status).toBe(400);
    expect((await request(app).post('/api/orders').set(authHeader(token)).send(compatibleBody({ deliveryOption: { id: 'overnight' } }))).status).toBe(400);
    expect((await request(app).post('/api/orders').set(authHeader(token)).send({ ...compatibleBody(), cardNumber: '4111111111111111' })).status).toBe(400);
    expect((await request(app).post('/api/orders').set('Authorization', 'Bearer invalid').send(compatibleBody())).status).toBe(401);
    expect((await request(app).post('/api/orders').set('X-Guest-Cart-Id', 'bad').send(compatibleBody({ guestEmail: 'guest@example.com' }))).status).toBe(400);
    expect((await request(app).post('/api/orders').set('X-Guest-Cart-Id', '123e4567-e89b-42d3-a456-426614174000').send(compatibleBody())).status).toBe(400);
  });

  it('recalculates a valid persisted promo and free delivery from current prices', async () => {
    const user = await createTestUser(); const token = mintTestAccessToken(user); await productAndCart({ userId: user._id }, 10, 100);
    await Cart.updateOne({ userId: user._id }, { promoCode: 'VESTRA10', discount: 999 });
    const response = await request(app).post('/api/orders').set(authHeader(token)).send(compatibleBody());
    expect(response.body).toMatchObject({ subtotal: 100, discount: 10, deliveryCost: 0, total: 90, promoCode: 'VESTRA10' });
  });

  it('rolls inventory and cart state back when order persistence fails', async () => {
    const user = await createTestUser(); const token = mintTestAccessToken(user); const product = await productAndCart({ userId: user._id }, 2);
    vi.spyOn(Order, 'create').mockRejectedValueOnce(new Error('simulated persistence failure'));
    expect((await request(app).post('/api/orders').set(authHeader(token)).send(compatibleBody())).status).toBe(500);
    expect((await Product.findById(product._id))!.variants[0]!.stock).toBe(2);
    expect(await Cart.countDocuments({ userId: user._id })).toBe(1); expect(await Order.countDocuments()).toBe(0);
  });

  it('permits only one concurrent checkout for the final unit', async () => {
    const a = await createTestUser(); const b = await createTestUser({ email: 'b@example.com' });
    const product = await productAndCart({ userId: a._id }, 1);
    await Cart.create({ userId: b._id, items: [{ productId: product._id, variantId: product.variants[0]!._id,
      colour: 'Black', size: 'M', quantity: 1, price: 40 }] });
    const responses = await Promise.all([a, b].map((u) => request(app).post('/api/orders').set(authHeader(mintTestAccessToken(u))).send(compatibleBody())));
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await Order.countDocuments()).toBe(1); expect((await Product.findById(product._id))!.variants[0]!.stock).toBe(0);
  });

  it('retries a deterministic order-number collision in a fresh transaction exactly once', async () => {
    const user = await createTestUser(); const token = mintTestAccessToken(user);
    const product = await productAndCart({ userId: user._id }); await Order.init();
    const collision = 'VST-2026-AAAAAAAA'; const fresh = 'VST-2026-BBBBBBBB';
    await Order.create({ orderNumber: collision, userId: user._id,
      items: [{ productId: new Product(productFixture())._id, productName: 'Existing', productImage: '/existing.jpg', brand: 'VESTRA', colour: 'Black', size: 'M', quantity: 1, price: 1 }],
      shippingAddress: address, deliveryOption: { name: 'Standard Delivery', description: '3-5 working days', price: 0, estimatedDays: '3-5 working days' },
      subtotal: 1, deliveryCost: 0, total: 1, estimatedDelivery: '2026-09-11' });
    const generator = vi.spyOn(orderNumbers, 'generateOrderNumber').mockReturnValueOnce(collision).mockReturnValueOnce(fresh);
    const response = await request(app).post('/api/orders').set(authHeader(token)).send(compatibleBody());
    expect(response.status).toBe(201); expect(response.body.orderNumber).toBe(fresh);
    expect(generator).toHaveBeenCalledTimes(2);
    expect(await Order.countDocuments({ orderNumber: fresh })).toBe(1);
    expect((await Product.findById(product._id))!.variants[0]!.stock).toBe(9);
  });

  it.each([{ stock: 6, expected: 'low_stock' }, { stock: 1, expected: 'out_of_stock' }])(
    'persists $expected after checkout changes aggregate inventory from $stock', async ({ stock, expected }) => {
      const user = await createTestUser(); const token = mintTestAccessToken(user);
      const product = await Product.create(productFixture({ isPublished: true, stockStatus: stock === 1 ? 'low_stock' : 'in_stock',
        variants: [{ sku: `STATUS-${stock}`, colour: 'Black', colourHex: '#000', size: 'M', stock }] }));
      await Cart.create({ userId: user._id, items: [{ productId: product._id, variantId: product.variants[0]!._id,
        colour: 'Black', size: 'M', quantity: 1, price: product.price }] });
      const response = await request(app).post('/api/orders').set(authHeader(token)).send(compatibleBody());
      expect(response.status).toBe(201);
      expect((await Product.findById(product._id))!.stockStatus).toBe(expected);
    },
  );
});

describe('order ownership and pure rules', () => {
  it('lists newest owned orders and prevents cross-account lookup', async () => {
    const a = await createTestUser(); const b = await createTestUser({ email: 'b@example.com' });
    const tokenA = mintTestAccessToken(a); await productAndCart({ userId: a._id });
    const made = await request(app).post('/api/orders').set(authHeader(tokenA)).send(compatibleBody());
    expect((await request(app).get('/api/orders')).status).toBe(401);
    expect((await request(app).get('/api/orders').set(authHeader(tokenA))).body).toHaveLength(1);
    expect((await request(app).get(`/api/orders?userId=${a.id}`).set(authHeader(tokenA))).status).toBe(200);
    expect((await request(app).get(`/api/orders?userId=${b.id}`).set(authHeader(tokenA))).status).toBe(403);
    expect((await request(app).get(`/api/orders/${made.body.id}`).set(authHeader(mintTestAccessToken(b)))).status).toBe(404);
    expect((await request(app).get('/api/orders/not-an-id').set(authHeader(tokenA))).status).toBe(400);
    expect((await request(app).get('/api/orders/507f1f77bcf86cd799439011').set(authHeader(tokenA))).status).toBe(404);
  });
  it('derives stock transitions, delivery dates and unique readable numbers', () => {
    expect(deriveStockStatus([6])).toBe('in_stock'); expect(deriveStockStatus([5])).toBe('low_stock'); expect(deriveStockStatus([0, 0])).toBe('out_of_stock');
    expect(estimatedDelivery(resolveDeliveryOption('del1'), new Date('2026-09-04T10:00:00Z'))).toBe('2026-09-11');
    const numbers = new Set(Array.from({ length: 100 }, () => orderNumbers.generateOrderNumber(new Date('2026-01-01'))));
    expect(numbers.size).toBe(100); expect([...numbers][0]).toMatch(/^VST-2026-[A-F0-9]{8}$/);
  });
});
