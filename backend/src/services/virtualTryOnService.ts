import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { Types, type HydratedDocument } from 'mongoose';
import { env } from '../config/env';
import { Product, VirtualTryOnAssetCleanup, VirtualTryOnJob, type VirtualTryOnJobShape } from '../models';
import { HttpError } from '../utils/httpError';
import { logger } from '../utils/logger';
import { safeExternalHttpsUrl } from '../utils/safeUrl';
import type { ImageStorage, StoredImageAsset } from './cloudinaryImageStorage';
import { CloudinaryImageStorage } from './cloudinaryImageStorage';
import type { ValidatedImage } from './imageValidationService';
import { PixelcutVirtualTryOnProvider, VirtualTryOnProviderError, type VirtualTryOnProvider } from './virtualTryOnProvider';
import { releaseQuota, reserveQuota } from './virtualTryOnQuotaService';

const PRIVACY_VERSION = 'vto-2026-09-08';
const PIXELCUT_RESULT_TTL_MS = 60 * 60 * 1000;
const CLEANUP_LEASE_MS = 60 * 1000;
const TERMINAL = new Set(['completed', 'failed', 'cancelled']);
const ACTIVE = ['pending', 'running'] as const;
const INTERNAL_SELECT = '+ownerKey +guestCapabilityHash +idempotencyKey +requestFingerprint +garmentImageUrl +providerJobId +providerSubmittedAt +submissionState +temporaryAsset +sourceAccessExpiresAt +quotaDay +reservationReleased';
type JobDocument = HydratedDocument<VirtualTryOnJobShape>;

export interface VirtualTryOnDependencies {
  provider: VirtualTryOnProvider;
  imageStorage: ImageStorage;
  now: () => Date;
}

export function createDefaultVirtualTryOnDependencies(): VirtualTryOnDependencies {
  return { provider: new PixelcutVirtualTryOnProvider(), imageStorage: new CloudinaryImageStorage(), now: () => new Date() };
}

export interface TryOnIdentity {
  userId?: string;
  guestSessionId?: string;
  ip: string;
}

export interface SubmitTryOnInput {
  productId: string;
  variantColour: string;
  idempotencyKey: string;
  image: ValidatedImage;
}

function digest(value: string): string { return createHash('sha256').update(value).digest('hex'); }
function ownerContext(identity: TryOnIdentity) {
  if (identity.userId) return { ownerKey: `user:${identity.userId}`, rateOwnerKey: `user:${identity.userId}` };
  if (!identity.guestSessionId) throw HttpError.badRequest('A guest Virtual Try-On session is required.');
  return {
    ownerKey: `guest:${createHmac('sha256', env.JWT_SECRET).update(identity.guestSessionId).digest('hex')}`,
    rateOwnerKey: `ip:${createHmac('sha256', env.JWT_SECRET).update(identity.ip).digest('hex')}`,
  };
}
function capability(ownerKey: string, jobId: string): string {
  return createHmac('sha256', env.JWT_SECRET).update(`vto-capability:${ownerKey}:${jobId}`).digest('base64url');
}
function sameDigest(left: string, right: string): boolean {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
function internalQuery(id: string | Types.ObjectId) {
  return VirtualTryOnJob.findById(id).select(INTERNAL_SELECT);
}

function publicDto(job: JobDocument, now: Date, guestToken?: string) {
  const resultUsable = !!job.resultUrl && !!job.resultExpiresAt && job.resultExpiresAt > now;
  const resultExpired = job.status === 'completed' && !!job.resultExpiresAt && job.resultExpiresAt <= now;
  const errorCode = resultExpired ? 'VTO_RESULT_EXPIRED' : job.errorCode;
  return {
    id: job.id, status: job.status, productId: job.productId.toString(), productName: job.productName,
    productImage: job.productImage, colour: job.variantColour, createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(), deadlineAt: job.deadlineAt.toISOString(), isDemo: false,
    ...(resultUsable ? { resultImage: job.resultUrl, resultExpiresAt: job.resultExpiresAt!.toISOString() } : {}),
    ...(errorCode ? { error: { code: errorCode, message: publicJobError(errorCode) } } : {}),
    ...(job.feedback ? { feedbackGiven: job.feedback } : {}),
    ...(guestToken ? { accessToken: guestToken } : {}),
  };
}

function publicJobError(code: string): string {
  if (code === 'VTO_SUBMISSION_UNCERTAIN') return 'The provider submission outcome could not be confirmed. This request was not resubmitted.';
  if (code === 'VTO_DEADLINE_EXCEEDED') return 'The Virtual Try-On did not finish before its processing deadline.';
  if (code === 'VTO_RESULT_EXPIRED') return 'This temporary Virtual Try-On preview has expired.';
  return 'The Virtual Try-On could not be completed for this image.';
}

function providerHttpError(error: VirtualTryOnProviderError): HttpError {
  if (error.kind === 'authentication') return new HttpError(502, 'VTO_PROVIDER_AUTHENTICATION_FAILED', 'Virtual Try-On is temporarily unavailable.');
  if (error.kind === 'credits') return new HttpError(503, 'VTO_PROVIDER_CREDITS_UNAVAILABLE', 'Virtual Try-On is temporarily unavailable because provider capacity is exhausted.');
  if (error.kind === 'rate_limit') return new HttpError(503, 'VTO_PROVIDER_RATE_LIMITED', 'Virtual Try-On is busy. Please try again later.');
  if (error.kind === 'invalid_request') return new HttpError(422, 'VTO_PROVIDER_REJECTED_INPUT', 'The provider could not process this image.');
  return new HttpError(503, 'VTO_PROVIDER_UNAVAILABLE', 'Virtual Try-On is temporarily unavailable.');
}

function safeGarmentUrl(value: string): string | null { return safeExternalHttpsUrl(value); }
function resolveGarmentImage(product: InstanceType<typeof Product>, colour: string): string | null {
  const stocked = product.variants.filter((variant) => variant.colour === colour && variant.stock > 0);
  if (!stocked.length) return null;
  const ready = product.images.filter((image) => image.isTryOnReady && !image.isLifestyle && safeGarmentUrl(image.url));
  const variantUrl = stocked.map((variant) => variant.image).find((url): url is string =>
    !!url && ready.some((image) => image.url === url && (!image.colour || image.colour === colour)));
  if (variantUrl) return safeGarmentUrl(variantUrl);
  const exact = ready.find((image) => image.colour === colour);
  const neutral = ready.find((image) => !image.colour);
  return safeGarmentUrl((exact ?? neutral)?.url ?? '');
}

function productHasReadyImage(product: InstanceType<typeof Product>): boolean {
  return product.colours.some((colour) => resolveGarmentImage(product, colour));
}

export async function eligibleProducts() {
  const products = await Product.find({ isPublished: true, tryOnEligible: true,
    variants: { $elemMatch: { stock: { $gt: 0 } } }, images: { $elemMatch: { isTryOnReady: true, isLifestyle: false } } }).sort({ createdAt: -1, _id: 1 });
  return products.filter(productHasReadyImage);
}

export async function productForTryOn(productId: string) {
  const product = await Product.findOne({ _id: productId, isPublished: true, tryOnEligible: true });
  if (!product || !productHasReadyImage(product)) throw HttpError.notFound('Virtual Try-On product not found.');
  return product;
}

async function markCleanupQuotaReleased(jobId: Types.ObjectId): Promise<void> {
  await VirtualTryOnAssetCleanup.updateOne({ jobId }, { $set: { quotaReleased: true } });
}

async function releaseTrackedQuota(ownerKey: string, quotaDay: string, jobId: Types.ObjectId, completed: boolean): Promise<void> {
  await releaseQuota(ownerKey, quotaDay, jobId, completed);
  await markCleanupQuotaReleased(jobId);
}

async function releaseReservation(job: JobDocument): Promise<void> {
  if (job.reservationReleased || !TERMINAL.has(job.status)) return;
  await releaseTrackedQuota(job.ownerKey, job.quotaDay, job._id, job.status === 'completed');
  await VirtualTryOnJob.updateOne({ _id: job._id, reservationReleased: false }, { $set: { reservationReleased: true } });
}

async function cleanupAsset(jobId: Types.ObjectId, deps: VirtualTryOnDependencies, now: Date, dueOnly = false): Promise<void> {
  const pending = dueOnly ? { status: 'pending', nextAttemptAt: { $lte: now } } : { status: 'pending' };
  const claimed = await VirtualTryOnAssetCleanup.findOneAndUpdate({ jobId, $or: [pending,
    { status: 'deleting', leaseUntil: { $lte: now } }] }, {
    $set: { status: 'deleting', leaseUntil: new Date(now.getTime() + CLEANUP_LEASE_MS) }, $inc: { attempts: 1 },
  }, { new: true });
  if (!claimed) return;
  try {
    await deps.imageStorage.delete({ publicId: claimed.publicId, deliveryType: 'private' });
    await VirtualTryOnAssetCleanup.updateOne({ _id: claimed._id, status: 'deleting' }, {
      $set: { status: 'deleted', cleanedAt: now }, $unset: { leaseUntil: 1 },
    });
  } catch {
    const delay = Math.min(60 * 60 * 1000, 30_000 * (2 ** Math.min(claimed.attempts - 1, 7)));
    await VirtualTryOnAssetCleanup.updateOne({ _id: claimed._id, status: 'deleting' }, {
      $set: { status: 'pending', nextAttemptAt: new Date(now.getTime() + delay) }, $unset: { leaseUntil: 1 },
    });
  }
}

async function recoverTerminal(job: JobDocument, deps: VirtualTryOnDependencies, now: Date, cleanupDueOnly = false): Promise<void> {
  try { await releaseReservation(job); }
  catch { logger.warn(`Virtual Try-On quota release deferred for job ${job.id}.`); }
  try { await cleanupAsset(job._id, deps, now, cleanupDueOnly); }
  catch { logger.warn(`Virtual Try-On asset cleanup deferred for job ${job.id}.`); }
}

interface TerminalValues {
  resultUrl?: string;
  resultExpiresAt?: Date;
  errorCode?: string;
  submissionState?: 'reserved' | 'submitted' | 'uncertain';
  clearResult?: boolean;
}

async function transitionTerminal(jobId: Types.ObjectId, status: 'completed' | 'failed' | 'cancelled',
  deps: VirtualTryOnDependencies, values: TerminalValues = {}, cleanupDueOnly = false): Promise<JobDocument> {
  const set: Record<string, unknown> = { status };
  if (values.resultUrl) set.resultUrl = values.resultUrl;
  if (values.resultExpiresAt) set.resultExpiresAt = values.resultExpiresAt;
  if (values.errorCode) set.errorCode = values.errorCode;
  if (values.submissionState) set.submissionState = values.submissionState;
  const update = values.clearResult || status !== 'completed'
    ? { $set: set, $unset: status === 'completed' ? { resultUrl: 1 } : { resultUrl: 1, resultExpiresAt: 1 } }
    : { $set: set };
  const transitioned = await VirtualTryOnJob.findOneAndUpdate({ _id: jobId, status: { $in: ACTIVE } }, update, { new: true })
    .select(INTERNAL_SELECT);
  const current = transitioned ?? await internalQuery(jobId);
  if (!current) throw HttpError.notFound('Virtual Try-On job not found.');
  if (TERMINAL.has(current.status)) await recoverTerminal(current, deps, deps.now(), cleanupDueOnly);
  return current;
}

async function expireCompletedResult(job: JobDocument, now: Date): Promise<JobDocument> {
  if (job.status !== 'completed' || !job.resultExpiresAt || job.resultExpiresAt > now || !job.resultUrl) return job;
  return await VirtualTryOnJob.findOneAndUpdate({ _id: job._id, status: 'completed', resultExpiresAt: { $lte: now } }, {
    $set: { errorCode: 'VTO_RESULT_EXPIRED' }, $unset: { resultUrl: 1 },
  }, { new: true }).select(INTERNAL_SELECT) ?? job;
}

async function ownedJob(jobId: string, identity: TryOnIdentity, suppliedCapability?: string): Promise<{ job: JobDocument; guestToken?: string }> {
  const job = await internalQuery(jobId);
  if (!job) throw HttpError.notFound('Virtual Try-On job not found.');
  if (identity.userId) {
    if (!job.ownerUserId || job.ownerUserId.toString() !== identity.userId) throw HttpError.notFound('Virtual Try-On job not found.');
    return { job };
  }
  const { ownerKey } = ownerContext(identity);
  const expected = capability(ownerKey, job.id);
  if (job.ownerKey !== ownerKey || !job.guestCapabilityHash || !suppliedCapability
    || !sameDigest(job.guestCapabilityHash, digest(suppliedCapability)) || !sameDigest(expected, suppliedCapability)) {
    throw HttpError.notFound('Virtual Try-On job not found.');
  }
  return { job, guestToken: suppliedCapability };
}

export async function submitTryOn(input: SubmitTryOnInput, identity: TryOnIdentity, deps: VirtualTryOnDependencies) {
  const now = deps.now(); const { ownerKey, rateOwnerKey } = ownerContext(identity);
  const fingerprint = digest(`${input.productId}\n${input.variantColour}\n${input.image.bytes}\n${digest(input.image.buffer.toString('base64'))}`);
  const existing = await VirtualTryOnJob.findOne({ ownerKey, idempotencyKey: input.idempotencyKey }).select(INTERNAL_SELECT);
  if (existing) {
    if (existing.requestFingerprint !== fingerprint) throw HttpError.conflict('The idempotency key was already used for a different Virtual Try-On request.');
    return publicDto(existing, now, identity.userId ? undefined : capability(ownerKey, existing.id));
  }

  const product = await productForTryOn(input.productId);
  const garmentImageUrl = resolveGarmentImage(product, input.variantColour);
  if (!garmentImageUrl) throw HttpError.badRequest('The selected colour is out of stock or has no suitable Virtual Try-On image.');

  const id = new Types.ObjectId();
  const publicId = `vestra/vto-temporary/${randomUUID()}`;
  const sourceAccessExpiresAt = new Date(now.getTime() + env.VTO_SOURCE_URL_TTL_SECONDS * 1000);
  const quotaDay = now.toISOString().slice(0, 10);
  await VirtualTryOnAssetCleanup.create({ jobId: id, publicId, deliveryType: 'private', ownerKey, quotaDay,
    quotaReleased: false, status: 'pending', nextAttemptAt: sourceAccessExpiresAt });

  let reservationMade = false;
  let uploadAttempted = false;
  let orphanSettled = false;
  let asset: StoredImageAsset | undefined;
  let job: JobDocument | undefined;
  try {
    const reservation = await reserveQuota(ownerKey, rateOwnerKey, now, id);
    reservationMade = true;
    uploadAttempted = true;
    asset = await deps.imageStorage.uploadTemporary(input.image, publicId);
    const guestToken = identity.userId ? undefined : capability(ownerKey, id.toString());
    try {
      job = await VirtualTryOnJob.create({ _id: id, ...(identity.userId ? { ownerUserId: identity.userId } : {}), ownerKey,
        ...(guestToken ? { guestCapabilityHash: digest(guestToken) } : {}), idempotencyKey: input.idempotencyKey,
        requestFingerprint: fingerprint, productId: product._id, productName: product.name,
        productImage: garmentImageUrl, variantColour: input.variantColour, garmentImageUrl,
        status: 'pending', submissionState: 'reserved', temporaryAsset: asset,
        sourceAccessExpiresAt, quotaDay: reservation.day,
        consent: { givenAt: now, privacyVersion: PRIVACY_VERSION },
        deadlineAt: new Date(now.getTime() + env.VTO_JOB_DEADLINE_SECONDS * 1000) });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        orphanSettled = true;
        await cleanupAsset(id, deps, deps.now()).catch(() => undefined);
        await releaseTrackedQuota(ownerKey, reservation.day, id, false).catch(() => undefined);
        const raced = await VirtualTryOnJob.findOne({ ownerKey, idempotencyKey: input.idempotencyKey }).select(INTERNAL_SELECT);
        if (raced && raced.requestFingerprint === fingerprint) {
          return publicDto(raced, deps.now(), identity.userId ? undefined : capability(ownerKey, raced.id));
        }
        throw HttpError.conflict('The idempotency key was already used for a different Virtual Try-On request.');
      }
      throw error;
    }

    const personImageUrl = deps.imageStorage.temporaryAccessUrl(asset, sourceAccessExpiresAt);
    const providerSubmittedAt = deps.now();
    try {
      const submitted = await deps.provider.submit({ personImageUrl, garmentImageUrl });
      const submittedJob = await VirtualTryOnJob.findOneAndUpdate({ _id: id, status: { $in: ACTIVE } }, {
        $set: { providerJobId: submitted.providerJobId, providerSubmittedAt, submissionState: 'submitted' },
      }, { new: true }).select(INTERNAL_SELECT);
      if (!submittedJob) {
        await deps.provider.cancel(submitted.providerJobId).catch(() => undefined);
        const current = await internalQuery(id);
        if (!current) throw HttpError.notFound('Virtual Try-On job not found.');
        await recoverTerminal(current, deps, deps.now());
        return publicDto(current, deps.now(), guestToken);
      }
      return publicDto(submittedJob, deps.now(), guestToken);
    } catch (error) {
      if (error instanceof VirtualTryOnProviderError) {
        await transitionTerminal(id, 'failed', deps, {
          submissionState: error.uncertain ? 'uncertain' : 'reserved',
          errorCode: error.uncertain ? 'VTO_SUBMISSION_UNCERTAIN' : 'VTO_PROVIDER_REJECTED', clearResult: true,
        }, error.uncertain);
        throw error.uncertain
          ? new HttpError(503, 'VTO_SUBMISSION_UNCERTAIN', 'The provider submission outcome could not be confirmed. The request was not resubmitted.')
          : providerHttpError(error);
      }
      await transitionTerminal(id, 'failed', deps, { errorCode: 'VTO_PROCESSING_FAILED', clearResult: true });
      throw error;
    }
  } catch (error) {
    if (!job && !orphanSettled) {
      if (uploadAttempted) await cleanupAsset(id, deps, deps.now()).catch(() => undefined);
      else await VirtualTryOnAssetCleanup.updateOne({ jobId: id }, {
        $set: { status: 'deleted', cleanedAt: deps.now(), quotaReleased: true },
      }).catch(() => undefined);
      if (reservationMade) await releaseTrackedQuota(ownerKey, quotaDay, id, false).catch(() => undefined);
    }
    throw error;
  }
}

async function refresh(job: JobDocument, deps: VirtualTryOnDependencies): Promise<JobDocument> {
  const now = deps.now();
  if (TERMINAL.has(job.status)) {
    await recoverTerminal(job, deps, now, true);
    return expireCompletedResult(job, now);
  }
  if (job.deadlineAt <= now) {
    if (job.providerJobId) await deps.provider.cancel(job.providerJobId).catch(() => undefined);
    return transitionTerminal(job._id, 'failed', deps, { errorCode: 'VTO_DEADLINE_EXCEEDED', clearResult: true });
  }
  if (!job.providerJobId) return job;
  const providerStatus = await deps.provider.status(job.providerJobId);
  if (providerStatus.status === 'completed' && providerStatus.resultUrl) {
    const resultExpiresAt = new Date((job.providerSubmittedAt ?? job.createdAt).getTime() + PIXELCUT_RESULT_TTL_MS);
    return transitionTerminal(job._id, 'completed', deps, now >= resultExpiresAt
      ? { resultExpiresAt, errorCode: 'VTO_RESULT_EXPIRED', clearResult: true }
      : { resultUrl: providerStatus.resultUrl, resultExpiresAt });
  }
  if (providerStatus.status === 'failed') {
    return transitionTerminal(job._id, 'failed', deps, { errorCode: 'VTO_PROCESSING_FAILED', clearResult: true });
  }
  const updated = await VirtualTryOnJob.findOneAndUpdate({ _id: job._id, status: { $in: ACTIVE } }, {
    $set: { status: providerStatus.status },
  }, { new: true }).select(INTERNAL_SELECT);
  return updated ?? await internalQuery(job._id) ?? job;
}

export async function getTryOnJob(jobId: string, identity: TryOnIdentity, suppliedCapability: string | undefined,
  deps: VirtualTryOnDependencies) {
  const owned = await ownedJob(jobId, identity, suppliedCapability);
  let current: JobDocument;
  try { current = await refresh(owned.job, deps); }
  catch (error) {
    if (error instanceof VirtualTryOnProviderError) throw providerHttpError(error);
    throw error;
  }
  return publicDto(current, deps.now(), owned.guestToken);
}

export async function cancelTryOnJob(jobId: string, identity: TryOnIdentity, suppliedCapability: string | undefined,
  deps: VirtualTryOnDependencies) {
  const owned = await ownedJob(jobId, identity, suppliedCapability); const { job } = owned;
  if (TERMINAL.has(job.status)) throw HttpError.conflict('This Virtual Try-On job has already finished.');
  if (job.providerJobId) {
    try { await deps.provider.cancel(job.providerJobId); }
    catch (error) {
      if (error instanceof VirtualTryOnProviderError && error.kind === 'already_finished') {
        const current = await refresh(job, deps); return publicDto(current, deps.now(), owned.guestToken);
      }
      if (error instanceof VirtualTryOnProviderError) throw providerHttpError(error);
      throw error;
    }
  }
  const current = await transitionTerminal(job._id, 'cancelled', deps, { clearResult: true });
  return publicDto(current, deps.now(), owned.guestToken);
}

export async function saveTryOnFeedback(jobId: string, feedback: 'helpful' | 'not_helpful', identity: TryOnIdentity,
  suppliedCapability: string | undefined, deps: VirtualTryOnDependencies) {
  const owned = await ownedJob(jobId, identity, suppliedCapability);
  if (owned.job.status !== 'completed') throw HttpError.conflict('Feedback can only be submitted for a completed Virtual Try-On.');
  const current = await VirtualTryOnJob.findOneAndUpdate({ _id: owned.job._id, status: 'completed' }, {
    $set: { feedback, feedbackUpdatedAt: deps.now() },
  }, { new: true }).select(INTERNAL_SELECT);
  if (!current) throw HttpError.conflict('Feedback can only be submitted for a completed Virtual Try-On.');
  return publicDto(current, deps.now(), owned.guestToken);
}

export async function reconcileVirtualTryOnJobs(deps: VirtualTryOnDependencies): Promise<void> {
  const now = deps.now();
  const active = await VirtualTryOnJob.find({ status: { $in: ACTIVE } }).limit(50).select(INTERNAL_SELECT);
  for (const job of active) {
    try { await refresh(job, deps); }
    catch { logger.warn(`Virtual Try-On reconciliation deferred for job ${job.id}.`); }
  }

  const terminalPending = await VirtualTryOnJob.find({ status: { $in: [...TERMINAL] }, reservationReleased: false })
    .limit(50).select(INTERNAL_SELECT);
  for (const job of terminalPending) await recoverTerminal(job, deps, now, true);

  const cleanupDue = await VirtualTryOnAssetCleanup.find({ status: { $in: ['pending', 'deleting'] },
    nextAttemptAt: { $lte: now } }).limit(50);
  for (const record of cleanupDue) await cleanupAsset(record.jobId, deps, now, true);

  const orphanReservations = await VirtualTryOnAssetCleanup.find({ quotaReleased: false })
    .limit(50).select('+ownerKey +quotaDay +quotaReleased');
  for (const record of orphanReservations) {
    const job = await internalQuery(record.jobId);
    try {
      if (!job && record.nextAttemptAt <= now) await releaseTrackedQuota(record.ownerKey, record.quotaDay, record.jobId, false);
      else if (job && TERMINAL.has(job.status)) {
        // The quota write may have succeeded even if a later marker write failed.
        // Reconcile the durable cleanup marker without double-counting completion.
        if (job.reservationReleased) await markCleanupQuotaReleased(record.jobId);
        else await releaseReservation(job);
      }
    } catch { logger.warn(`Virtual Try-On orphan quota release deferred for reservation ${record.jobId.toString()}.`); }
  }
}
