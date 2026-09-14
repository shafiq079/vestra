import type { Request, RequestHandler } from 'express';
import { MAX_UPLOAD_BYTES, validateImageUpload } from '../services/imageValidationService';
import type { VirtualTryOnDependencies } from '../services/virtualTryOnService';
import * as service from '../services/virtualTryOnService';
import { parseFeedback, parseGuestSession, parseIdempotencyKey, parseJobId, parseTryOnSubmission } from '../validators/virtualTryOn';
import { HttpError } from '../utils/httpError';
import { safeExternalHttpsUrl } from '../utils/safeUrl';

const param = (value: string | string[] | undefined) => Array.isArray(value) ? value[0]! : value!;
function identity(req: Request): service.TryOnIdentity {
  if (req.auth) return { userId: req.auth.userId, ip: req.ip ?? '' };
  return { guestSessionId: parseGuestSession(req.get('X-VTO-Session-Id')), ip: req.ip ?? '' };
}

export function createVirtualTryOnController(deps: VirtualTryOnDependencies) {
  const eligible: RequestHandler = async (_req, res) => res.json(await service.eligibleProducts());
  const product: RequestHandler = async (req, res) => res.json(await service.productForTryOn(parseJobId(param(req.params.productId))));
  const submit: RequestHandler = async (req, res) => {
    // Consent and the bounded multipart field set are validated before Cloudinary or Pixelcut is called.
    const body = parseTryOnSubmission(req.body);
    const image = validateImageUpload(req.file);
    const result = await service.submitTryOn({ ...body, image,
      idempotencyKey: parseIdempotencyKey(req.get('X-Idempotency-Key')) }, identity(req), deps);
    res.status(202).json(result);
  };
  const status: RequestHandler = async (req, res) => res.json(await service.getTryOnJob(
    parseJobId(param(req.params.jobId)), identity(req), req.get('X-VTO-Job-Token'), deps));
  const sourceImage: RequestHandler = async (req, res) => {
    const job = await service.getTryOnJob(
      parseJobId(param(req.params.jobId)), identity(req), req.get('X-VTO-Job-Token'), deps);
    if (job.status !== 'completed' || !job.resultImage) {
      throw HttpError.conflict('Only a completed Virtual Try-On preview can be used for another try-on.');
    }
    const sourceUrl = safeExternalHttpsUrl(job.resultImage, ['assets.pixelcut.app']);
    if (!sourceUrl) throw new HttpError(502, 'VTO_RESULT_UNAVAILABLE', 'The previous Virtual Try-On preview is unavailable.');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      let response: Response;
      try { response = await fetch(sourceUrl, { signal: controller.signal, redirect: 'error' }); }
      catch { throw new HttpError(502, 'VTO_RESULT_UNAVAILABLE', 'The previous Virtual Try-On preview is unavailable.'); }
      if (!response.ok) throw new HttpError(502, 'VTO_RESULT_UNAVAILABLE', 'The previous Virtual Try-On preview is unavailable.');

      const declaredLength = Number(response.headers.get('content-length') ?? 0);
      if (declaredLength > MAX_UPLOAD_BYTES) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'The previous Virtual Try-On preview is too large to reuse.');
      const contentType = (response.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(contentType)) {
        throw new HttpError(502, 'VTO_RESULT_UNAVAILABLE', 'The previous Virtual Try-On preview has an unsupported image format.');
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      if (!buffer.length || buffer.length > MAX_UPLOAD_BYTES) {
        throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'The previous Virtual Try-On preview is too large to reuse.');
      }
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'no-store, private');
      res.setHeader('Content-Disposition', 'inline');
      res.send(buffer);
    } finally { clearTimeout(timeout); }
  };
  const cancel: RequestHandler = async (req, res) => res.json(await service.cancelTryOnJob(
    parseJobId(param(req.params.jobId)), identity(req), req.get('X-VTO-Job-Token'), deps));
  const feedback: RequestHandler = async (req, res) => res.json(await service.saveTryOnFeedback(
    parseJobId(param(req.params.jobId)), parseFeedback(req.body).feedback, identity(req), req.get('X-VTO-Job-Token'), deps));
  return { eligible, product, submit, status, sourceImage, cancel, feedback };
}
