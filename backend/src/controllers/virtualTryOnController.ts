import type { Request, RequestHandler } from 'express';
import { validateImageUpload } from '../services/imageValidationService';
import type { VirtualTryOnDependencies } from '../services/virtualTryOnService';
import * as service from '../services/virtualTryOnService';
import { parseFeedback, parseGuestSession, parseIdempotencyKey, parseJobId, parseTryOnSubmission } from '../validators/virtualTryOn';

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
  const cancel: RequestHandler = async (req, res) => res.json(await service.cancelTryOnJob(
    parseJobId(param(req.params.jobId)), identity(req), req.get('X-VTO-Job-Token'), deps));
  const feedback: RequestHandler = async (req, res) => res.json(await service.saveTryOnFeedback(
    parseJobId(param(req.params.jobId)), parseFeedback(req.body).feedback, identity(req), req.get('X-VTO-Job-Token'), deps));
  return { eligible, product, submit, status, cancel, feedback };
}
