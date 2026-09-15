import type { RequestHandler } from 'express';
import multer from 'multer';
import { HttpError } from '../utils/httpError';
import { MAX_UPLOAD_BYTES } from '../services/imageValidationService';

const upload = multer({
  storage: multer.memoryStorage(),
  // A chained VTO request adds sourceJobId to the original three documented fields.
  // Keep one spare multipart boundary while still allowing at most one image file.
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 4, parts: 6, fieldSize: 1024, headerPairs: 50 },
});

export const singleImageUpload: RequestHandler = (req, res, next) => {
  upload.single('image')(req, res, (error: unknown) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') return next(new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Image must be no larger than 10 MB.'));
      return next(HttpError.badRequest('Invalid multipart upload.', { image: ['At most one image and the documented fields are permitted.'] }));
    }
    return next(error);
  });
};
