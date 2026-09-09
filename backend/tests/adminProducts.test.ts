import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { AdminAuditLog, Product } from '../src/models';
import { productFixture } from './fixtures/models';
import { createTestUser, mintTestAccessToken } from './helpers/auth';

const base = (overrides: Record<string, unknown> = {}) => ({ slug: 'admin-coat', name: 'Admin Coat', brand: 'VESTRA', shortDescription: '', fullDescription: '', fitDescription: '', category: 'outerwear', genderCollection: 'women', price: 100, currency: 'gbp', images: [{ id: 'client-image', url: '/coat.jpg', alt: '', position: 0, isLifestyle: false }], lifestyleImages: [], variants: [{ id: 'client-variant', sku: 'ADMIN-SKU', colour: 'Black', colourHex: '#000000', size: 'M', stock: 2 }], materials: [], careInstructions: [], badges: [], recommendationTags: [], relatedProductIds: [], isPublished: true, ...overrides });

describe('admin products and shared catalogue', () => {
  let token: string; let actorId: string;
  beforeAll(async () => { const actor=await createTestUser({ email: 'product-admin@example.com', role: 'admin' }); actorId=actor.id; token = mintTestAccessToken(actor); });
  beforeEach(async () => { await Promise.all([Product.deleteMany({}), AdminAuditLog.deleteMany({})]); });
  const api = () => ({ get: (p: string) => request(app).get(p).set('Authorization', `Bearer ${token}`), post: (p: string) => request(app).post(p).set('Authorization', `Bearer ${token}`), put: (p: string) => request(app).put(p).set('Authorization', `Bearer ${token}`), patch: (p: string) => request(app).patch(p).set('Authorization', `Bearer ${token}`), delete: (p: string) => request(app).delete(p).set('Authorization', `Bearer ${token}`) });

  it('creates normalized products visible publicly and audits safely', async () => {
    const response = await api().post('/api/admin/products').send(base());
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ colours: ['Black'], availableSizes: ['M'], stockStatus: 'low_stock', shortDescription: 'Admin Coat', fullDescription: 'Admin Coat', fitDescription: 'Fit information not provided.', currency: 'GBP' });
    expect(response.body.images[0].alt).toBe('Admin Coat');
    expect(response.body.images[0].id).toMatch(/^[a-f\d]{24}$/);
    expect(response.body.images[0].id).not.toBe('client-image');
    expect(response.body.variants[0].id).not.toBe('client-variant');
    expect((await request(app).get('/api/products/admin-coat')).status).toBe(200);
    const audit = await AdminAuditLog.findOne({ action: 'product.create' }).lean();
    expect(audit?.actorUserId.toString()).toBe(actorId);
    expect(JSON.stringify(audit)).not.toMatch(/password|authorization|bearer|card|cvc|shipping|email/i);
  });

  it('allows a zero-variant draft and derives empty/out-of-stock fields', async () => {
    const response = await api().post('/api/admin/products').send(base({ slug: 'empty-draft', variants: [], isPublished: false }));
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ colours: [], availableSizes: [], stockStatus: 'out_of_stock' });
  });

  it('lists unpublished products and gets by id with clean id errors', async () => {
    const product = await Product.create(productFixture({ isPublished: false }));
    expect((await api().get('/api/admin/products')).body.map((p: { id: string }) => p.id)).toContain(product.id);
    expect((await api().get(`/api/admin/products/${product.id}`)).body.id).toBe(product.id);
    expect((await api().get('/api/admin/products/bad')).status).toBe(400);
    expect((await api().get('/api/admin/products/000000000000000000000001')).status).toBe(404);
  });

  it('rejects duplicate slugs, SKUs, and invalid sale prices', async () => {
    await api().post('/api/admin/products').send(base());
    expect((await api().post('/api/admin/products').send(base({ variants: [{ sku: 'OTHER', colour: 'Blue', colourHex: '#00f', size: 'S', stock: 8 }] }))).status).toBe(409);
    expect((await api().post('/api/admin/products').send(base({ slug: 'other' }))).status).toBe(409);
    expect((await api().post('/api/admin/products').send(base({ slug: 'sale-bad', variants: [], salePrice: 100 }))).status).toBe(400);
  });

  it('partially updates while preserving createdAt and existing embedded identity', async () => {
    const created = (await api().post('/api/admin/products').send(base({ badges: ['new'], materials: ['Wool'], tryOnEligible: true }))).body;
    const update = await api().put(`/api/admin/products/${created.id}`).send({ name: 'Changed', price: 80, createdAt: '2000-01-01' });
    expect(update.status).toBe(400);
    const variant = created.variants[0];
    const good = await api().put(`/api/admin/products/${created.id}`).send({ name: 'Changed', price: 80, variants: [{ ...variant, stock: 9 }, { id: 'new-client', sku: 'NEW-SKU', colour: 'Blue', colourHex: '#00f', size: 'L', stock: 1 }] });
    expect(good.status).toBe(200);
    expect(good.body.createdAt).toBe(created.createdAt);
    expect(good.body).toMatchObject({ isPublished: true, badges: ['new'], materials: ['Wool'], tryOnEligible: true, images: created.images });
    expect(good.body.variants[0].id).toBe(variant.id);
    expect(good.body.variants[1].id).toMatch(/^[a-f\d]{24}$/);
    expect(good.body.variants[1].id).not.toBe('new-client');
    expect((await request(app).get('/api/products/admin-coat')).body).toMatchObject({ name: 'Changed', price: 80 });
    expect((await api().put(`/api/admin/products/${created.id}`).send({ id: created.id })).status).toBe(400);
  });

  it('publishes, unpublishes, republishes, and deletes in the public catalogue', async () => {
    const created = (await api().post('/api/admin/products').send(base())).body;
    expect((await api().patch(`/api/admin/products/${created.id}/published`).send({ isPublished: false })).status).toBe(200);
    expect((await request(app).get('/api/products/admin-coat')).status).toBe(404);
    await api().patch(`/api/admin/products/${created.id}/published`).send({ isPublished: true });
    expect((await request(app).get('/api/products/admin-coat')).status).toBe(200);
    expect((await api().delete(`/api/admin/products/${created.id}`)).status).toBe(204);
    expect((await request(app).get('/api/products/admin-coat')).status).toBe(404);
  });

  it('duplicates with deterministic slug suffixes and globally unique SKUs', async () => {
    const source = (await api().post('/api/admin/products').send(base())).body;
    const first = await api().post(`/api/admin/products/${source.id}/duplicate`);
    const second = await api().post(`/api/admin/products/${source.id}/duplicate`);
    expect(first.body).toMatchObject({ slug: 'admin-coat-copy', isPublished: false, badges: [], rating: 0, reviewCount: 0 });
    expect(second.body.slug).toBe('admin-coat-copy-2');
    expect(new Set([source.variants[0].sku, first.body.variants[0].sku, second.body.variants[0].sku]).size).toBe(3);
  });
});
