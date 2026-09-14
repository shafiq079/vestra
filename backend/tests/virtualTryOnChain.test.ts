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

const asset: StoredImageAsset = {
  provider: 'cloudinary', assetId: 'temp-asset', publicId: 'vestra/vto-temporary/random', format: 'png', version: 1,
  deliveryType: 'private', secureUrl: 'https://res.cloudinary.com/test/private.png', width: 100, height: 120, bytes: 33,
};

function dependencies() {
  const provider: VirtualTryOnProvider = {
    submit: vi.fn().mockResolvedValue({ providerJobId: 'pixelcut-chain-1' }),
    status: vi.fn().mockResolvedValue({ status: 'completed', resultUrl: 'https://assets.pixelcut.app/public/result/chain.jpg' }),
    cancel: vi.fn().mockResolvedValue(undefined),
  };
  const imageStorage: ImageStorage = {
    uploadTemporary: vi.fn().mockResolvedValue(asset),
    uploadCatalogue: vi.fn().mockResolvedValue({ ...asset, deliveryType: 'upload' }),
    temporaryAccessUrl: vi.fn().mockReturnValue('https://api.cloudinary.com/v1_1/test/image/download?expires_at=1&signature=safe'),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  const now = new Date('2026-09-15T00:00:00.000Z');
  const deps: VirtualTryOnDependencies = { provider, imageStorage, now: () => new Date(now) };
  return { deps, provider };
}

async function readyProduct() {
  return Product.create(productFixture({
    tryOnEligible: true, isPublished: true, colours: ['Black'], availableSizes: ['M'],
    images: [{ url: 'https://res.cloudinary.com/test/image/upload/garment-black.png', alt: 'Black garment', position: 0, isLifestyle: false, colour: 'Black', isTryOnReady: true }],
    variants: [{ sku: `CHAIN-${randomUUID()}`, colour: 'Black', colourHex: '#000000', size: 'M', stock: 2 }],
  }));
}

beforeEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all([VirtualTryOnJob.init(), VirtualTryOnAssetCleanup.init(), VirtualTryOnQuota.init(), VirtualTryOnRateLimit.init()]);
  await Promise.all([
    VirtualTryOnJob.deleteMany({}), VirtualTryOnAssetCleanup.deleteMany({}), VirtualTryOnQuota.deleteMany({}),
    VirtualTryOnRateLimit.deleteMany({}), Product.deleteMany({}),
  ]);
});

describe('cumulative Virtual Try-On source image', () => {
  it('returns only an owned completed preview as a reusable image source', async () => {
    const product = await readyProduct();
    const { deps } = dependencies();
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

    const sourceBytes = png();
    const fetchMock = vi.fn().mockResolvedValue(new Response(sourceBytes, {
      status: 200,
      headers: { 'Content-Type': 'image/png', 'Content-Length': String(sourceBytes.length) },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const source = await request(app).get(`/api/virtual-try-on/jobs/${created.body.id}/source-image`)
      .set('X-VTO-Session-Id', session).set('X-VTO-Job-Token', created.body.accessToken);
    expect(source.status).toBe(200);
    expect(source.headers['content-type']).toContain('image/png');
    expect(source.headers['cache-control']).toContain('no-store');
    expect(fetchMock).toHaveBeenCalledWith('https://assets.pixelcut.app/public/result/chain.jpg', expect.objectContaining({ redirect: 'error' }));

    const wrongSession = await request(app).get(`/api/virtual-try-on/jobs/${created.body.id}/source-image`)
      .set('X-VTO-Session-Id', randomUUID()).set('X-VTO-Job-Token', created.body.accessToken);
    expect(wrongSession.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
