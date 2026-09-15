import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { Product, VirtualTryOnAssetCleanup, VirtualTryOnJob, VirtualTryOnQuota, VirtualTryOnRateLimit } from '../src/models';
import type { ImageStorage, StoredImageAsset } from '../src/services/cloudinaryImageStorage';
import type { VirtualTryOnDependencies } from '../src/services/virtualTryOnService';
import type { VirtualTryOnProvider } from '../src/services/virtualTryOnProvider';
import { productFixture } from './fixtures/models';

function png(width = 100, height = 120): Buffer {
  const value = Buffer.alloc(33); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(value);
  value.writeUInt32BE(13, 8); value.write('IHDR', 12, 'ascii'); value.writeUInt32BE(width, 16); value.writeUInt32BE(height, 20);
  value[24] = 8; value[25] = 2; return value;
}

const sourceAsset: StoredImageAsset = {
  provider: 'cloudinary', assetId: 'source-asset', publicId: 'vestra/vto-temporary/11111111-1111-4111-8111-111111111111',
  format: 'png', version: 1, deliveryType: 'private', secureUrl: 'https://res.cloudinary.com/test/private-source.png',
  width: 100, height: 120, bytes: 33,
};

function dependencies() {
  const provider: VirtualTryOnProvider = {
    submit: vi.fn().mockResolvedValue({ providerJobId: 'pixelcut-chain-1' }),
    status: vi.fn().mockResolvedValue({ status: 'completed', resultUrl: 'https://assets.pixelcut.app/public/result/chain.jpg' }),
    cancel: vi.fn().mockResolvedValue(undefined),
  };
  const imageStorage: ImageStorage = {
    uploadTemporary: vi.fn().mockResolvedValue(sourceAsset),
    uploadCatalogue: vi.fn().mockResolvedValue({ ...sourceAsset, deliveryType: 'upload' }),
    uploadTemporaryFromUrl: vi.fn().mockImplementation(async (_sourceUrl: string, publicId: string) => ({
      ...sourceAsset,
      assetId: `result-${publicId}`,
      publicId,
      secureUrl: `https://res.cloudinary.com/test/image/private/${publicId}.png`,
    })),
    temporaryAccessUrl: vi.fn().mockImplementation((asset: { publicId: string }) =>
      `https://res.cloudinary.com/test/image/private/signed/${encodeURIComponent(asset.publicId)}.png`),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  const now = new Date('2026-09-15T00:00:00.000Z');
  const deps: VirtualTryOnDependencies = { provider, imageStorage, now: () => new Date(now) };
  return { deps, provider, imageStorage };
}

async function readyProduct() {
  return Product.create(productFixture({
    tryOnEligible: true, isPublished: true, colours: ['Black'], availableSizes: ['M'],
    images: [{ url: 'https://res.cloudinary.com/test/image/upload/garment-black.png', alt: 'Black garment', position: 0, isLifestyle: false, colour: 'Black', isTryOnReady: true }],
    variants: [{ sku: `CHAIN-${randomUUID()}`, colour: 'Black', colourHex: '#000000', size: 'M', stock: 2 }],
  }));
}

beforeEach(async () => {
  await Promise.all([VirtualTryOnJob.init(), VirtualTryOnAssetCleanup.init(), VirtualTryOnQuota.init(), VirtualTryOnRateLimit.init()]);
  await Promise.all([
    VirtualTryOnJob.deleteMany({}), VirtualTryOnAssetCleanup.deleteMany({}), VirtualTryOnQuota.deleteMany({}),
    VirtualTryOnRateLimit.deleteMany({}), Product.deleteMany({}),
  ]);
});

describe('cumulative Virtual Try-On Cloudinary chaining', () => {
  it('stores a completed Pixelcut result in Cloudinary and uses that hosted result for the next product', async () => {
    const product = await readyProduct();
    const { deps, provider, imageStorage } = dependencies();
    const app = createApp({ virtualTryOn: deps });
    const session = randomUUID();

    const created = await request(app).post('/api/virtual-try-on')
      .set('X-VTO-Session-Id', session).set('X-Idempotency-Key', randomUUID())
      .field('productId', product.id).field('variantColour', 'Black').field('consentGiven', 'true')
      .attach('image', png(), { filename: 'person.png', contentType: 'image/png' });
    expect(created.status).toBe(202);

    const completed = await request(app).get(`/api/virtual-try-on/jobs/${created.body.id}`)
      .set('X-VTO-Session-Id', session).set('X-VTO-Job-Token', created.body.accessToken);
    expect(completed.status).toBe(200);
    expect(completed.body.status).toBe('completed');
    expect(completed.body.resultImage).toContain('res.cloudinary.com');
    expect(imageStorage.uploadTemporaryFromUrl).toHaveBeenCalledWith(
      'https://assets.pixelcut.app/public/result/chain.jpg',
      `vestra/vto-results/${created.body.id}`,
    );

    const chained = await request(app).post('/api/virtual-try-on')
      .set('X-VTO-Session-Id', session)
      .set('X-VTO-Source-Token', created.body.accessToken)
      .set('X-Idempotency-Key', randomUUID())
      .field('productId', product.id)
      .field('variantColour', 'Black')
      .field('consentGiven', 'true')
      .field('sourceJobId', created.body.id);
    expect(chained.status).toBe(202);

    expect(provider.submit).toHaveBeenCalledTimes(2);
    expect(provider.submit).toHaveBeenNthCalledWith(2, expect.objectContaining({
      personImageUrl: expect.stringContaining(encodeURIComponent(`vestra/vto-results/${created.body.id}`)),
      garmentImageUrl: 'https://res.cloudinary.com/test/image/upload/garment-black.png',
    }));

    const wrongSession = await request(app).post('/api/virtual-try-on')
      .set('X-VTO-Session-Id', randomUUID())
      .set('X-VTO-Source-Token', created.body.accessToken)
      .set('X-Idempotency-Key', randomUUID())
      .field('productId', product.id)
      .field('variantColour', 'Black')
      .field('consentGiven', 'true')
      .field('sourceJobId', created.body.id);
    expect(wrongSession.status).toBe(404);
    expect(provider.submit).toHaveBeenCalledTimes(2);
  });
});
