import { HttpError } from '../utils/httpError';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MIN_IMAGE_DIMENSION = 64;
export const MAX_IMAGE_DIMENSION = 6000;

export interface ValidatedImage {
  buffer: Buffer;
  format: 'jpg' | 'png';
  contentType: 'image/jpeg' | 'image/png';
  width: number;
  height: number;
  bytes: number;
}

const invalidImage = (message: string): never => {
  throw HttpError.badRequest('Invalid image upload.', { image: [message] });
};

function pngDimensions(buffer: Buffer): { width: number; height: number } | null {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(signature)) return null;
  if (buffer.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function jpegDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8
    || buffer[buffer.length - 2] !== 0xff || buffer[buffer.length - 1] !== 0xd9) return null;
  let offset = 2;
  while (offset + 3 < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    while (buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset++]!;
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 1 >= buffer.length) return null;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) return null;
    const isStartOfFrame = (marker >= 0xc0 && marker <= 0xc3)
      || (marker >= 0xc5 && marker <= 0xc7)
      || (marker >= 0xc9 && marker <= 0xcb)
      || (marker >= 0xcd && marker <= 0xcf);
    if (isStartOfFrame) {
      if (length < 7) return null;
      return { height: buffer.readUInt16BE(offset + 3), width: buffer.readUInt16BE(offset + 5) };
    }
    offset += length;
  }
  return null;
}

export function validateImageUpload(file: Express.Multer.File | undefined): ValidatedImage {
  if (!file) throw HttpError.badRequest('Invalid image upload.', { image: ['Exactly one JPEG or PNG file is required.'] });
  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) invalidImage('The image must be no larger than 10 MB.');
  if (!['image/jpeg', 'image/png'].includes(file.mimetype)) invalidImage('Only JPEG and PNG images are accepted.');

  const png = pngDimensions(file.buffer);
  const jpeg = png ? null : jpegDimensions(file.buffer);
  const dimensions = png ?? jpeg;
  if (!dimensions) throw HttpError.badRequest('Invalid image upload.', { image: ['The file contents are not a valid JPEG or PNG image.'] });

  const format = png ? 'png' : 'jpg';
  const expectedMime = format === 'png' ? 'image/png' : 'image/jpeg';
  if (file.mimetype !== expectedMime) invalidImage('The declared image type does not match the file contents.');
  if (dimensions.width < MIN_IMAGE_DIMENSION || dimensions.height < MIN_IMAGE_DIMENSION
    || dimensions.width > MAX_IMAGE_DIMENSION || dimensions.height > MAX_IMAGE_DIMENSION) {
    invalidImage(`Image dimensions must be between ${MIN_IMAGE_DIMENSION}x${MIN_IMAGE_DIMENSION} and ${MAX_IMAGE_DIMENSION}x${MAX_IMAGE_DIMENSION} pixels.`);
  }

  return { buffer: file.buffer, format, contentType: expectedMime, width: dimensions.width,
    height: dimensions.height, bytes: file.size };
}
