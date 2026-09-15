import { randomUUID } from 'node:crypto';
import { v2 as cloudinary, type UploadApiOptions, type UploadApiResponse } from 'cloudinary';
import { env } from '../config/env';
import type { ValidatedImage } from './imageValidationService';

export type CloudinaryDeliveryType = 'upload' | 'private';

export interface StoredImageAsset<T extends CloudinaryDeliveryType = 'private'> {
  provider: 'cloudinary';
  assetId: string;
  publicId: string;
  format: string;
  version: number;
  deliveryType: T;
  secureUrl: string;
  width: number;
  height: number;
  bytes: number;
}

export type PrivateImageAssetRef = Pick<StoredImageAsset<'private'>, 'publicId' | 'format' | 'deliveryType'>;

export interface ImageStorage {
  uploadTemporary(image: ValidatedImage, publicId: string): Promise<StoredImageAsset<'private'>>;
  uploadCatalogue(image: ValidatedImage): Promise<StoredImageAsset<'upload'>>;
  uploadTemporaryFromUrl?(sourceUrl: string, publicId: string): Promise<StoredImageAsset<'private'>>;
  temporaryAccessUrl(asset: PrivateImageAssetRef, expiresAt: Date): string;
  delete(asset: Pick<StoredImageAsset<CloudinaryDeliveryType>, 'publicId' | 'deliveryType'>): Promise<void>;
}

export interface CloudinaryTransport {
  upload(buffer: Buffer, options: UploadApiOptions): Promise<UploadApiResponse>;
  uploadRemote?(sourceUrl: string, options: UploadApiOptions): Promise<UploadApiResponse>;
  privateDownloadUrl(publicId: string, format: string, options: {
    resource_type: 'image'; type: 'private'; expires_at: number; attachment: boolean;
  }): string;
  destroy(publicId: string, options: { resource_type: 'image'; type: CloudinaryDeliveryType; invalidate: boolean }): Promise<unknown>;
}

function defaultTransport(): CloudinaryTransport {
  cloudinary.config({ cloud_name: env.CLOUDINARY_CLOUD_NAME, api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET, secure: true });
  return {
    upload: (buffer, options) => new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
        if (error || !result) reject(error ?? new Error('Cloudinary upload returned no result.'));
        else resolve(result);
      });
      stream.end(buffer);
    }),
    uploadRemote: (sourceUrl, options) => cloudinary.uploader.upload(sourceUrl, options),
    privateDownloadUrl: (publicId, format, options) => cloudinary.utils.private_download_url(publicId, format, options),
    destroy: (publicId, options) => cloudinary.uploader.destroy(publicId, options),
  };
}

function assetFrom<T extends CloudinaryDeliveryType>(result: UploadApiResponse, deliveryType: T): StoredImageAsset<T> {
  if (!result.asset_id || !result.public_id || !result.format || !result.secure_url) {
    throw new Error('Cloudinary returned incomplete asset metadata.');
  }
  return { provider: 'cloudinary', assetId: result.asset_id, publicId: result.public_id,
    format: result.format, version: result.version, deliveryType, secureUrl: result.secure_url,
    width: result.width, height: result.height, bytes: result.bytes };
}

export class CloudinaryImageStorage implements ImageStorage {
  constructor(private readonly transport: CloudinaryTransport = defaultTransport()) {}

  private async upload<T extends CloudinaryDeliveryType>(image: ValidatedImage, folder: string, deliveryType: T) {
    const result = await this.transport.upload(image.buffer, {
      resource_type: 'image', type: deliveryType, folder, public_id: randomUUID(),
      overwrite: false, unique_filename: false, use_filename: false,
    });
    return assetFrom(result, deliveryType);
  }

  async uploadTemporary(image: ValidatedImage, publicId: string) {
    if (!/^vestra\/vto-temporary\/[0-9a-f-]{36}$/i.test(publicId)) {
      throw new Error('Temporary uploads require a VESTRA-generated public ID.');
    }
    const result = await this.transport.upload(image.buffer, {
      resource_type: 'image', type: 'private', public_id: publicId,
      overwrite: false, unique_filename: false, use_filename: false,
    });
    const stored = assetFrom(result, 'private');
    if (stored.publicId !== publicId) throw new Error('Cloudinary returned an unexpected temporary public ID.');
    return stored;
  }

  async uploadTemporaryFromUrl(sourceUrl: string, publicId: string) {
    if (!/^vestra\/vto-results\/[0-9a-f]{24}$/i.test(publicId)) {
      throw new Error('VTO result uploads require a VESTRA-generated result public ID.');
    }
    if (!this.transport.uploadRemote) throw new Error('Remote Cloudinary upload is not configured.');
    const result = await this.transport.uploadRemote(sourceUrl, {
      resource_type: 'image', type: 'private', public_id: publicId,
      overwrite: true, unique_filename: false, use_filename: false,
    });
    const stored = assetFrom(result, 'private');
    if (stored.publicId !== publicId) throw new Error('Cloudinary returned an unexpected VTO result public ID.');
    return stored;
  }

  uploadCatalogue(image: ValidatedImage) {
    return this.upload(image, 'vestra/catalogue', 'upload');
  }

  temporaryAccessUrl(asset: PrivateImageAssetRef, expiresAt: Date): string {
    if (asset.deliveryType !== 'private') throw new Error('Temporary access requires a private asset.');
    return this.transport.privateDownloadUrl(asset.publicId, asset.format, {
      resource_type: 'image', type: 'private', expires_at: Math.floor(expiresAt.getTime() / 1000), attachment: false,
    });
  }

  async delete(asset: Pick<StoredImageAsset<CloudinaryDeliveryType>, 'publicId' | 'deliveryType'>): Promise<void> {
    const result = await this.transport.destroy(asset.publicId, {
      resource_type: 'image', type: asset.deliveryType, invalidate: true,
    }) as { result?: string } | undefined;
    if (result?.result !== 'ok' && result?.result !== 'not found') throw new Error('Cloudinary deletion was not confirmed.');
  }
}
