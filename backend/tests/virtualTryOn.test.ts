import { createHmac, randomUUID } from 'node:crypto';
import request from 'supertest';
import type { Test } from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { env } from '../src/config/env';
import { Product, VirtualTryOnJob, VirtualTryOnQuota, VirtualTryOnRateLimit } from '../src/models';
import type { ImageStorage, StoredImageAsset } from '../src/services/cloudinaryImageStorage';
import { dashboard } from '../src/services/adminService';
import { reconcileVirtualTryOnJobs, type VirtualTryOnDependencies } from '../src/services/virtualTryOnService';
import { VirtualTryOnProviderError, type VirtualTryOnProvider } from '../src/services/virtualTryOnProvider';
import { productFixture } from './fixtures/models';
import { authHeader, createTestUser, mintTestAccessToken } from './helpers/auth';

function png(width = 100, height = 120): Buffer {
  const value = Buffer.alloc(33); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(value);
  value.writeUInt32BE(13, 8); value.write('IHDR', 12, 'ascii'); value.writeUInt32BE(width, 16); value.writeUInt32BE(height, 20);
  value[24] = 8; value[25] = 2; return value;
}

const asset: StoredImageAsset = { provider: 'cloudinary', assetId: 'temp-asset', publicId: 'vestra/vto-temporary/random',
  format: 'png', version: 1, deliveryType: 'private', secureUrl: 'https://res.cloudinary.com/test/private.png', width: 100, height: 120, bytes: 33 };

function doubles() {
  const provider: VirtualTryOnProvider = { submit: vi.fn().mockResolvedValue({ providerJobId: 'pixelcut-1' }),
    status: vi.fn().mockResolvedValue({ status: 'running' }), cancel: vi.fn().mockResolvedValue(undefined) };
  const imageStorage: ImageStorage = { uploadTemporary: vi.fn().mockResolvedValue(asset), uploadCatalogue: vi.fn().mockResolvedValue({ ...asset, deliveryType: 'upload', secureUrl: 'https://res.cloudinary.com/test/image/upload/catalogue.png' }),
    temporaryAccessUrl: vi.fn().mockReturnValue('https://api.cloudinary.com/v1_1/test/image/download?expires_at=1&signature=safe'), delete: vi.fn().mockResolvedValue(undefined) };
  let clock = new Date('2026-09-08T12:00:00.000Z');
  const deps: VirtualTryOnDependencies = { provider, imageStorage, now: () => new Date(clock) };
  return { deps, provider, imageStorage, advance: (milliseconds: number) => { clock = new Date(clock.getTime() + milliseconds); } };
}

async function readyProduct(overrides: Record<string, unknown> = {}) {
  return Product.create(productFixture({ tryOnEligible: true, isPublished: true, colours: ['Black', 'Red'], availableSizes: ['M'],
    images: [{ url: 'https://res.cloudinary.com/test/image/upload/garment-black.png', alt: 'Black garment', position: 0, isLifestyle: false, colour: 'Black', isTryOnReady: true }],
    variants: [{ sku: `VTO-${randomUUID()}`, colour: 'Black', colourHex: '#000000', size: 'M', stock: 2 }, { sku: `VTO-${randomUUID()}`, colour: 'Red', colourHex: '#ff0000', size: 'M', stock: 2 }], ...overrides }));
}

function guestPost(app: ReturnType<typeof createApp>, productId: string, session = randomUUID(), key = randomUUID(), consent = 'true', file = png()) {
  return request(app).post('/api/virtual-try-on').set('X-VTO-Session-Id', session).set('X-Idempotency-Key', key)
    .field('productId', productId).field('variantColour', 'Black').field('consentGiven', consent).attach('image', file, { filename: 'person.png', contentType: 'image/png' });
}

beforeEach(async () => {
  await Promise.all([VirtualTryOnJob.init(), VirtualTryOnQuota.init(), VirtualTryOnRateLimit.init()]);
  await Promise.all([VirtualTryOnJob.deleteMany({}), VirtualTryOnQuota.deleteMany({}), VirtualTryOnRateLimit.deleteMany({}), Product.deleteMany({})]);
});

describe('Phase 10 Virtual Try-On API', () => {
  it('lists only published, stocked products with an explicitly suitable garment image', async () => {
    const good = await readyProduct();
    await readyProduct({ slug: `bad-${randomUUID()}`, tryOnEligible: false });
    await readyProduct({ slug: `lifestyle-${randomUUID()}`, images: [{ url: 'https://images.example/item.png', alt: 'Lifestyle', position: 0, isLifestyle: true, isTryOnReady: true }] });
    const { deps } = doubles(); const response = await request(createApp({ virtualTryOn: deps })).get('/api/virtual-try-on/eligible');
    expect(response.status).toBe(200); expect(response.body.map((item: { id: string }) => item.id)).toEqual([good.id]);
  });

  it('returns one eligible product and rejects unknown, unpublished, or unsuitable products', async () => {
    const good = await readyProduct(); const { deps } = doubles(); const app = createApp({ virtualTryOn: deps });
    expect((await request(app).get(`/api/virtual-try-on/product/${good.id}`)).status).toBe(200);
    expect((await request(app).get(`/api/virtual-try-on/product/${new Product().id}`)).status).toBe(404);
  });

  it('enforces consent before storage and provider submission', async () => {
    const product = await readyProduct(); const { deps, provider, imageStorage } = doubles();
    const response = await guestPost(createApp({ virtualTryOn: deps }), product.id, randomUUID(), randomUUID(), 'false');
    expect(response.status).toBe(400); expect(response.body).toMatchObject({ code: 'BAD_REQUEST' });
    expect(imageStorage.uploadTemporary).not.toHaveBeenCalled(); expect(provider.submit).not.toHaveBeenCalled();
  });

  it.each([
    ['missing file', (builder: Test) => builder, 400],
    ['spoofed file signature', (builder: Test) => builder.attach('image', Buffer.from('not an image'), { filename: 'person.png', contentType: 'image/png' }), 400],
    ['wrong MIME type', (builder: Test) => builder.attach('image', png(), { filename: 'person.txt', contentType: 'text/plain' }), 400],
    ['invalid dimensions', (builder: Test) => builder.attach('image', png(10, 10), { filename: 'person.png', contentType: 'image/png' }), 400],
  ])('rejects %s without contacting storage', async (_label, attach, status) => {
    const product = await readyProduct(); const { deps, imageStorage } = doubles();
    const builder = request(createApp({ virtualTryOn: deps })).post('/api/virtual-try-on').set('X-VTO-Session-Id', randomUUID()).set('X-Idempotency-Key', randomUUID())
      .field('productId', product.id).field('variantColour', 'Black').field('consentGiven', 'true');
    const response = await attach(builder); expect(response.status).toBe(status); expect(imageStorage.uploadTemporary).not.toHaveBeenCalled();
  });

  it('rejects a file over 10 MB and more than one file with the stable error contract', async () => {
    const product = await readyProduct(); const { deps } = doubles(); const app = createApp({ virtualTryOn: deps });
    const large = await guestPost(app, product.id, randomUUID(), randomUUID(), 'true', Buffer.alloc(10 * 1024 * 1024 + 1));
    expect(large.status).toBe(413); expect(large.body).toEqual(expect.objectContaining({ code: 'PAYLOAD_TOO_LARGE', message: expect.any(String) }));
    const multiple = await request(app).post('/api/virtual-try-on').set('X-VTO-Session-Id', randomUUID()).set('X-Idempotency-Key', randomUUID())
      .field('productId', product.id).field('variantColour', 'Black').field('consentGiven', 'true')
      .attach('image', png(), { filename: 'one.png', contentType: 'image/png' }).attach('image', png(), { filename: 'two.png', contentType: 'image/png' });
    expect(multiple.status).toBe(400); expect(multiple.body.code).toBe('BAD_REQUEST');
  });

  it('uses MongoDB colour and stock authority and never accepts a browser garment URL', async () => {
    const product = await readyProduct(); const { deps, provider } = doubles(); const app = createApp({ virtualTryOn: deps });
    const rejected = await request(app).post('/api/virtual-try-on').set('X-VTO-Session-Id', randomUUID()).set('X-Idempotency-Key', randomUUID())
      .field('productId', product.id).field('variantColour', 'Red').field('consentGiven', 'true').field('garmentImageUrl', 'https://attacker.example/x.png')
      .attach('image', png(), { filename: 'person.png', contentType: 'image/png' });
    expect(rejected.status).toBe(400); expect(provider.submit).not.toHaveBeenCalled();
    const red = await guestPost(app, product.id).then((value) => value); expect(red.status, JSON.stringify(red.body)).toBe(202);
    expect(provider.submit).toHaveBeenCalledWith(expect.objectContaining({ garmentImageUrl: 'https://res.cloudinary.com/test/image/upload/garment-black.png' }));
  });

  it('creates one async provider job, persists no image bytes or signed source URL, and deduplicates retries', async () => {
    const product = await readyProduct(); const { deps, provider, imageStorage } = doubles(); const app = createApp({ virtualTryOn: deps });
    const session = randomUUID(); const key = randomUUID();
    const first = await guestPost(app, product.id, session, key); const retry = await guestPost(app, product.id, session, key);
    expect(first.status).toBe(202); expect(retry.status).toBe(202); expect(retry.body.id).toBe(first.body.id);
    expect(provider.submit).toHaveBeenCalledTimes(1); expect(imageStorage.uploadTemporary).toHaveBeenCalledTimes(1);
    const stored = await VirtualTryOnJob.findById(first.body.id).select('+temporaryAsset +garmentImageUrl +ownerKey +guestCapabilityHash');
    const persisted = JSON.stringify(stored?.toObject());
    expect(persisted).not.toContain('data:image'); expect(persisted).not.toContain('expires_at='); expect(persisted).not.toContain(png().toString('base64'));
    expect(JSON.stringify(first.body)).not.toContain('temp-asset'); expect(first.body).toMatchObject({ status: 'pending', isDemo: false, accessToken: expect.any(String) });
  });

  it('polls without generating again, completes with a one-hour result, releases quota, and deletes the source', async () => {
    const product = await readyProduct(); const test = doubles(); vi.mocked(test.provider.status).mockResolvedValue({ status: 'completed', resultUrl: 'https://assets.pixelcut.app/public/result/vto.jpg' });
    const app = createApp({ virtualTryOn: test.deps }); const session = randomUUID(); const created = await guestPost(app, product.id, session);
    const completed = await request(app).get(`/api/virtual-try-on/jobs/${created.body.id}`).set('X-VTO-Session-Id', session).set('X-VTO-Job-Token', created.body.accessToken);
    expect(completed.status).toBe(200); expect(completed.body).toMatchObject({ status: 'completed', resultImage: 'https://assets.pixelcut.app/public/result/vto.jpg', isDemo: false });
    expect(new Date(completed.body.resultExpiresAt).getTime() - test.deps.now().getTime()).toBe(60 * 60 * 1000);
    expect(test.provider.submit).toHaveBeenCalledTimes(1); expect(test.provider.status).toHaveBeenCalledTimes(1); expect(test.imageStorage.delete).toHaveBeenCalledTimes(1);
    expect((await VirtualTryOnQuota.findOne({ activeCount: 0 }))?.completedCount).toBe(1);
  });

  it('cancels a provider job once, cleans up, and rejects feedback before completion', async () => {
    const product = await readyProduct(); const test = doubles(); const app = createApp({ virtualTryOn: test.deps }); const session = randomUUID();
    const created = await guestPost(app, product.id, session); const feedback = await request(app).put(`/api/virtual-try-on/jobs/${created.body.id}/feedback`).set('X-VTO-Session-Id', session).set('X-VTO-Job-Token', created.body.accessToken).send({ feedback: 'helpful' });
    expect(feedback.status).toBe(409);
    const cancelled = await request(app).post(`/api/virtual-try-on/jobs/${created.body.id}/cancel`).set('X-VTO-Session-Id', session).set('X-VTO-Job-Token', created.body.accessToken);
    expect(cancelled.body.status).toBe('cancelled'); expect(test.provider.cancel).toHaveBeenCalledWith('pixelcut-1'); expect(test.imageStorage.delete).toHaveBeenCalledTimes(1);
  });

  it('isolates guest capabilities and authenticated owners, and rejects an invalid bearer token instead of becoming a guest', async () => {
    const product = await readyProduct(); const test = doubles(); const app = createApp({ virtualTryOn: test.deps }); const session = randomUUID();
    const guest = await guestPost(app, product.id, session);
    expect((await request(app).get(`/api/virtual-try-on/jobs/${guest.body.id}`).set('X-VTO-Session-Id', session).set('X-VTO-Job-Token', 'wrong-token')).status).toBe(404);
    expect((await request(app).get(`/api/virtual-try-on/jobs/${guest.body.id}`).set('Authorization', 'Bearer invalid').set('X-VTO-Session-Id', session).set('X-VTO-Job-Token', guest.body.accessToken)).status).toBe(401);
    const firstUser = await createTestUser({ email: 'vto-one@example.com' }); const secondUser = await createTestUser({ email: 'vto-two@example.com' });
    const firstToken = mintTestAccessToken(firstUser); const secondToken = mintTestAccessToken(secondUser);
    const owned = await request(app).post('/api/virtual-try-on').set(authHeader(firstToken)).set('X-Idempotency-Key', randomUUID()).field('productId', product.id).field('variantColour', 'Black').field('consentGiven', 'true').attach('image', png(), { filename: 'person.png', contentType: 'image/png' });
    expect(owned.body.accessToken).toBeUndefined();
    expect((await request(app).get(`/api/virtual-try-on/jobs/${owned.body.id}`).set(authHeader(secondToken))).status).toBe(404);
  });

  it('atomically enforces concurrent and daily quotas', async () => {
    const product = await readyProduct(); const test = doubles(); const app = createApp({ virtualTryOn: test.deps }); const session = randomUUID();
    const [a, b] = await Promise.all([guestPost(app, product.id, session, randomUUID()), guestPost(app, product.id, session, randomUUID())]);
    expect([a.status, b.status].sort()).toEqual([202, 409]); expect(test.imageStorage.uploadTemporary).toHaveBeenCalledTimes(1);
    await VirtualTryOnJob.deleteMany({}); await VirtualTryOnQuota.deleteMany({});
    const ownerKey = `guest:${createHmac('sha256', env.JWT_SECRET).update(session).digest('hex')}`;
    await VirtualTryOnQuota.create({ ownerKey, day: '2026-09-08', startedCount: env.VTO_DAILY_QUOTA, completedCount: 0, activeCount: 0 });
    const daily = await guestPost(app, product.id, session, randomUUID()); expect(daily.status).toBe(429); expect(daily.body.code).toBe('VTO_DAILY_QUOTA_EXCEEDED');
  });

  it('enforces the persistent fixed-window rate limit', async () => {
    const product = await readyProduct(); const test = doubles(); const app = createApp({ virtualTryOn: test.deps }); const session = randomUUID();
    const first = await guestPost(app, product.id, session); await request(app).post(`/api/virtual-try-on/jobs/${first.body.id}/cancel`).set('X-VTO-Session-Id', session).set('X-VTO-Job-Token', first.body.accessToken);
    await VirtualTryOnRateLimit.updateMany({}, { $set: { count: env.VTO_RATE_LIMIT_MAX_REQUESTS } });
    const response = await guestPost(app, product.id, session); expect(response.status).toBe(429); expect(response.body.code).toBe('VTO_RATE_LIMITED');
  });

  it('never resubmits an uncertain provider submission and defers cleanup until the source URL expires', async () => {
    const product = await readyProduct(); const test = doubles(); vi.mocked(test.provider.submit).mockRejectedValue(new VirtualTryOnProviderError('unavailable', true));
    const response = await guestPost(createApp({ virtualTryOn: test.deps }), product.id); expect(response.status).toBe(503); expect(response.body.code).toBe('VTO_SUBMISSION_UNCERTAIN');
    expect(test.provider.submit).toHaveBeenCalledTimes(1); expect(test.imageStorage.delete).not.toHaveBeenCalled();
    test.advance((env.VTO_SOURCE_URL_TTL_SECONDS + 1) * 1000); await reconcileVirtualTryOnJobs(test.deps);
    expect(test.provider.submit).toHaveBeenCalledTimes(1); expect(test.imageStorage.delete).toHaveBeenCalledTimes(1);
  });

  it('cancels at the overall deadline and retries failed Cloudinary deletion during reconciliation', async () => {
    const product = await readyProduct(); const test = doubles(); vi.mocked(test.imageStorage.delete).mockRejectedValueOnce(new Error('delete unavailable')).mockResolvedValue(undefined);
    const app = createApp({ virtualTryOn: test.deps }); const session = randomUUID(); const created = await guestPost(app, product.id, session);
    test.advance((env.VTO_JOB_DEADLINE_SECONDS + 1) * 1000);
    const status = await request(app).get(`/api/virtual-try-on/jobs/${created.body.id}`).set('X-VTO-Session-Id', session).set('X-VTO-Job-Token', created.body.accessToken);
    expect(status.body).toMatchObject({ status: 'failed', error: { code: 'VTO_DEADLINE_EXCEEDED' } }); expect(test.provider.cancel).toHaveBeenCalledTimes(1);
    test.advance(31_000); await reconcileVirtualTryOnJobs(test.deps); expect(test.imageStorage.delete).toHaveBeenCalledTimes(2);
    expect((await VirtualTryOnJob.findById(created.body.id).select('+cleanupStatus'))?.cleanupStatus).toBe('deleted');
  });

  it('persists repeatable feedback and reports completed usage/helpful rate while size ML remains zero', async () => {
    const product = await readyProduct(); const test = doubles(); vi.mocked(test.provider.status).mockResolvedValue({ status: 'completed', resultUrl: 'https://assets.pixelcut.app/public/result/f.jpg' });
    const app = createApp({ virtualTryOn: test.deps }); const session = randomUUID(); const created = await guestPost(app, product.id, session);
    await request(app).get(`/api/virtual-try-on/jobs/${created.body.id}`).set('X-VTO-Session-Id', session).set('X-VTO-Job-Token', created.body.accessToken);
    const path = `/api/virtual-try-on/jobs/${created.body.id}/feedback`;
    expect((await request(app).put(path).set('X-VTO-Session-Id', session).set('X-VTO-Job-Token', created.body.accessToken).send({ feedback: 'not_helpful' })).status).toBe(200);
    expect((await request(app).put(path).set('X-VTO-Session-Id', session).set('X-VTO-Job-Token', created.body.accessToken).send({ feedback: 'helpful' })).body.feedbackGiven).toBe('helpful');
    const metrics = await dashboard(test.deps.now()); expect(metrics.vtoUsage).toEqual({ total: 1, helpfulRate: 100 }); expect(metrics.sizeRecUsage).toEqual({ total: 0, successRate: 0 });
  });

  it('supports authenticated Cloudinary catalogue upload without exposing credentials', async () => {
    const test = doubles(); const app = createApp({ virtualTryOn: test.deps }); const admin = await createTestUser({ email: 'vto-admin@example.com', role: 'admin' });
    const response = await request(app).post('/api/admin/images').set(authHeader(mintTestAccessToken(admin))).attach('image', png(), { filename: 'catalogue.png', contentType: 'image/png' });
    expect(response.status).toBe(201); expect(response.body).toMatchObject({ url: 'https://res.cloudinary.com/test/image/upload/catalogue.png', cloudinaryAssetId: 'temp-asset', isTryOnReady: false });
    expect(JSON.stringify(response.body)).not.toContain(env.CLOUDINARY_API_SECRET); expect(test.imageStorage.uploadCatalogue).toHaveBeenCalledTimes(1);
  });
});
