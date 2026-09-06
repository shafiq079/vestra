import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { Product, User } from '../src/models';
import { seedCatalogue } from '../src/seed/catalogueSeed';
import { RECOMMENDATION_TYPES } from '../src/validators/recommendation';
import { authHeader, createTestUser, mintTestAccessToken } from './helpers/auth';

const app = createApp({ enableDiagnostics: false });
beforeAll(async () => { await Product.createIndexes(); });
beforeEach(async () => { await Promise.all([Product.deleteMany({}), User.deleteMany({})]); await seedCatalogue(); });
afterAll(async () => { await Promise.all([Product.deleteMany({}), User.deleteMany({})]); });

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
    expect(item.product).not.toHaveProperty('userId'); expect(item.product).not.toHaveProperty('email');
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

  it('filters placement and enforces result caps', async () => {
    const response = await request(app).get('/api/recommendations?placement=homepage&limit=8').expect(200);
    expect(response.body.map((group: { type: string }) => group.type)).toEqual(['recommended_for_you', 'new_arrivals_you_may_like', 'trending']);
    response.body.forEach(assertGroup);
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
});
