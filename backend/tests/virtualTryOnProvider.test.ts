import { describe, expect, it, vi } from 'vitest';
import { CloudinaryImageStorage, type CloudinaryTransport } from '../src/services/cloudinaryImageStorage';
import { PixelcutVirtualTryOnProvider } from '../src/services/virtualTryOnProvider';
import type { ValidatedImage } from '../src/services/imageValidationService';

const response = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('Pixelcut provider adapter', () => {
  it('maps VESTRA input to the documented async Pixelcut request without unsupported fields', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(202, { job_id: 'pixelcut-job-1' }));
    const provider = new PixelcutVirtualTryOnProvider('private-test-key', 1000, fetcher);
    await expect(provider.submit({ personImageUrl: 'https://api.cloudinary.com/source', garmentImageUrl: 'https://res.cloudinary.com/garment' }))
      .resolves.toEqual({ providerJobId: 'pixelcut-job-1' });
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe('https://api.developer.pixelcut.ai/v1/try-on');
    expect(init.headers).toMatchObject({ 'X-API-Key': 'private-test-key', 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body)).toEqual({ person_image_url: 'https://api.cloudinary.com/source', garment_image_url: 'https://res.cloudinary.com/garment', preprocess_garment: 'true', remove_background: 'false', wait_for_result: 'false' });
  });

  it('maps pending, running, completed, and failed status responses and validates the result host', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response(200, { job_id: 'j', status: 'pending' }))
      .mockResolvedValueOnce(response(200, { job_id: 'j', status: 'running' }))
      .mockResolvedValueOnce(response(200, { job_id: 'j', status: 'completed', result_url: 'https://assets.pixelcut.app/public/result/a.jpg' }))
      .mockResolvedValueOnce(response(200, { job_id: 'j', status: 'failed', error: { error_code: 'content_filter_error' } }))
      .mockResolvedValueOnce(response(200, { job_id: 'j', status: 'completed', result_url: 'http://localhost/result.jpg' }));
    const provider = new PixelcutVirtualTryOnProvider('key', 1000, fetcher);
    await expect(provider.status('j')).resolves.toEqual({ status: 'pending' });
    await expect(provider.status('j')).resolves.toEqual({ status: 'running' });
    await expect(provider.status('j')).resolves.toEqual({ status: 'completed', resultUrl: 'https://assets.pixelcut.app/public/result/a.jpg' });
    await expect(provider.status('j')).resolves.toEqual({ status: 'failed', errorCode: 'content_filter_error' });
    await expect(provider.status('j')).rejects.toMatchObject({ kind: 'invalid_response' });
  });

  it.each([[401, 'invalid_auth_token', 'authentication'], [403, 'insufficient_api_credits', 'credits'], [429, 'rate_limit_exceeded', 'rate_limit']])
  ('maps HTTP %s safely to %s', async (status, code, kind) => {
    const provider = new PixelcutVirtualTryOnProvider('key', 1000, vi.fn().mockResolvedValue(response(Number(status), { error: 'secret detail', error_code: code })));
    await expect(provider.submit({ personImageUrl: 'https://a.example/source', garmentImageUrl: 'https://a.example/garment' }))
      .rejects.toMatchObject({ kind, uncertain: false, message: 'Virtual Try-On provider request failed.' });
  });

  it('marks an indeterminate submission timeout as uncertain and never retries it', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('socket timeout'));
    const provider = new PixelcutVirtualTryOnProvider('key', 1000, fetcher);
    await expect(provider.submit({ personImageUrl: 'https://a.example/source', garmentImageUrl: 'https://a.example/garment' }))
      .rejects.toMatchObject({ kind: 'unavailable', uncertain: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('uses the documented status and cancellation paths', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response(200, { job_id: 'a/b', status: 'running' })).mockResolvedValueOnce(response(200, { message: 'Job cancelled' }));
    const provider = new PixelcutVirtualTryOnProvider('key', 1000, fetcher);
    await provider.status('a/b'); await provider.cancel('a/b');
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      'https://api.developer.pixelcut.ai/v1/try-on/job/a%2Fb',
      'https://api.developer.pixelcut.ai/v1/try-on/job/a%2Fb/cancel',
    ]);
  });
});

describe('Cloudinary storage adapter', () => {
  const image: ValidatedImage = { buffer: Buffer.from('image'), format: 'png', contentType: 'image/png', width: 100, height: 120, bytes: 5 };
  const uploadResult = { asset_id: 'asset', public_id: 'vestra/id', format: 'png', secure_url: 'https://res.cloudinary.com/test/image/upload/v1/id.png', version: 1, width: 100, height: 120, bytes: 5 } as never;
  it('separates private temporary uploads from public catalogue uploads and generates an expiring private download URL', async () => {
    const transport: CloudinaryTransport = { upload: vi.fn().mockResolvedValue(uploadResult), privateDownloadUrl: vi.fn().mockReturnValue('https://api.cloudinary.com/timed'), destroy: vi.fn().mockResolvedValue({ result: 'ok' }) };
    const storage = new CloudinaryImageStorage(transport);
    const temporary = await storage.uploadTemporary(image); const catalogue = await storage.uploadCatalogue(image);
    const expiresAt = new Date('2026-09-08T12:15:00Z');
    expect(storage.temporaryAccessUrl(temporary, expiresAt)).toBe('https://api.cloudinary.com/timed');
    expect(transport.upload).toHaveBeenNthCalledWith(1, image.buffer, expect.objectContaining({ type: 'private', folder: 'vestra/vto-temporary', overwrite: false }));
    expect(transport.upload).toHaveBeenNthCalledWith(2, image.buffer, expect.objectContaining({ type: 'upload', folder: 'vestra/catalogue', overwrite: false }));
    expect(transport.privateDownloadUrl).toHaveBeenCalledWith(temporary.publicId, 'png', { resource_type: 'image', type: 'private', expires_at: 1788869700, attachment: false });
    expect(catalogue.deliveryType).toBe('upload');
  });
});
