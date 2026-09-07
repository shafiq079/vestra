import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { Types, type HydratedDocument } from 'mongoose';
import { env } from '../config/env';
import { Product, VirtualTryOnJob, type VirtualTryOnJobShape } from '../models';
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
const TERMINAL = new Set(['completed', 'failed', 'cancelled']);
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
function internalQuery(id: string) {
  return VirtualTryOnJob.findById(id).select('+ownerKey +guestCapabilityHash +idempotencyKey +requestFingerprint +garmentImageUrl +providerJobId +submissionState +temporaryAsset +sourceAccessExpiresAt +cleanupStatus +cleanupAttempts +cleanupNextAttemptAt +cleanedAt +quotaDay +reservationReleased');
}

function publicDto(job: JobDocument, guestToken?: string) {
  const createdAt = job.createdAt.toISOString();
  const dto = {
    id: job.id, status: job.status, productId: job.productId.toString(), productName: job.productName,
    productImage: job.productImage, colour: job.variantColour, createdAt, updatedAt: job.updatedAt.toISOString(),
    deadlineAt: job.deadlineAt.toISOString(), isDemo: false,
    ...(job.resultUrl && job.resultExpiresAt ? { resultImage: job.resultUrl, resultExpiresAt: job.resultExpiresAt.toISOString() } : {}),
    ...(job.errorCode ? { error: { code: job.errorCode, message: publicJobError(job.errorCode) } } : {}),
    ...(job.feedback ? { feedbackGiven: job.feedback } : {}),
    ...(guestToken ? { accessToken: guestToken } : {}),
  };
  return dto;
}

function publicJobError(code: string): string {
  if (code === 'VTO_SUBMISSION_UNCERTAIN') return 'The provider submission outcome could not be confirmed. This request was not resubmitted.';
  if (code === 'VTO_DEADLINE_EXCEEDED') return 'The Virtual Try-On did not finish before its processing deadline.';
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

async function releaseReservation(job: JobDocument, completed: boolean): Promise<void> {
  const claimed = await VirtualTryOnJob.findOneAndUpdate({ _id: job._id, reservationReleased: false },
    { $set: { reservationReleased: true } }, { new: true }).select('+ownerKey +quotaDay');
  if (claimed) await releaseQuota(claimed.ownerKey, claimed.quotaDay, completed);
}

async function cleanup(job: JobDocument, deps: VirtualTryOnDependencies, now: Date, dueOnly = false): Promise<void> {
  if (job.cleanupStatus === 'deleted' || (dueOnly && job.cleanupNextAttemptAt > now)) return;
  try {
    await deps.imageStorage.delete({ publicId: job.temporaryAsset.publicId, deliveryType: 'private' });
    job.cleanupStatus = 'deleted'; job.cleanedAt = now; job.cleanupAttempts += 1;
    await job.save();
  } catch {
    job.cleanupAttempts += 1;
    const delay = Math.min(60 * 60 * 1000, 30_000 * (2 ** Math.min(job.cleanupAttempts - 1, 7)));
    job.cleanupNextAttemptAt = new Date(now.getTime() + delay);
    await job.save();
  }
}

async function markTerminal(job: JobDocument, status: 'completed' | 'failed' | 'cancelled', deps: VirtualTryOnDependencies,
  values: { resultUrl?: string; resultExpiresAt?: Date; errorCode?: string } = {}) {
  if (!TERMINAL.has(job.status)) {
    job.status = status;
    if (values.resultUrl) job.resultUrl = values.resultUrl;
    if (values.resultExpiresAt) job.resultExpiresAt = values.resultExpiresAt;
    if (values.errorCode) job.errorCode = values.errorCode;
    await job.save();
  }
  await releaseReservation(job, status === 'completed');
  await cleanup(job, deps, deps.now());
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
  const existing = await VirtualTryOnJob.findOne({ ownerKey, idempotencyKey: input.idempotencyKey })
    .select('+ownerKey +guestCapabilityHash +requestFingerprint +providerJobId +submissionState +temporaryAsset +sourceAccessExpiresAt +cleanupStatus +cleanupAttempts +cleanupNextAttemptAt +quotaDay +reservationReleased');
  if (existing) {
    if (existing.requestFingerprint !== fingerprint) throw HttpError.conflict('The idempotency key was already used for a different Virtual Try-On request.');
    return publicDto(existing, identity.userId ? undefined : capability(ownerKey, existing.id));
  }

  const product = await productForTryOn(input.productId);
  const garmentImageUrl = resolveGarmentImage(product, input.variantColour);
  if (!garmentImageUrl) throw HttpError.badRequest('The selected colour is out of stock or has no suitable Virtual Try-On image.');
  const reservation = await reserveQuota(ownerKey, rateOwnerKey, now);
  let asset: StoredImageAsset | undefined;
  let job: JobDocument | undefined;
  try {
    asset = await deps.imageStorage.uploadTemporary(input.image);
    const sourceAccessExpiresAt = new Date(now.getTime() + env.VTO_SOURCE_URL_TTL_SECONDS * 1000);
    const id = new Types.ObjectId(); const guestToken = identity.userId ? undefined : capability(ownerKey, id.toString());
    try {
      job = await VirtualTryOnJob.create({ _id: id, ...(identity.userId ? { ownerUserId: identity.userId } : {}), ownerKey,
        ...(guestToken ? { guestCapabilityHash: digest(guestToken) } : {}), idempotencyKey: input.idempotencyKey,
        requestFingerprint: fingerprint, productId: product._id, productName: product.name,
        productImage: garmentImageUrl, variantColour: input.variantColour, garmentImageUrl,
        status: 'pending', submissionState: 'reserved', temporaryAsset: asset,
        sourceAccessExpiresAt, cleanupNextAttemptAt: sourceAccessExpiresAt, quotaDay: reservation.day,
        consent: { givenAt: now, privacyVersion: PRIVACY_VERSION },
        deadlineAt: new Date(now.getTime() + env.VTO_JOB_DEADLINE_SECONDS * 1000) });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        await deps.imageStorage.delete(asset).catch(() => undefined);
        await releaseQuota(ownerKey, reservation.day, false);
        const raced = await VirtualTryOnJob.findOne({ ownerKey, idempotencyKey: input.idempotencyKey })
          .select('+requestFingerprint +temporaryAsset +cleanupStatus +cleanupAttempts +cleanupNextAttemptAt +quotaDay +reservationReleased');
        if (raced && raced.requestFingerprint === fingerprint) {
          return publicDto(raced, identity.userId ? undefined : capability(ownerKey, raced.id));
        }
        throw HttpError.conflict('The idempotency key was already used for a different Virtual Try-On request.');
      }
      throw error;
    }
    const personImageUrl = deps.imageStorage.temporaryAccessUrl(asset, sourceAccessExpiresAt);
    try {
      const submitted = await deps.provider.submit({ personImageUrl, garmentImageUrl });
      job.providerJobId = submitted.providerJobId; job.submissionState = 'submitted';
      await job.save();
      return publicDto(job, guestToken);
    } catch (error) {
      if (error instanceof VirtualTryOnProviderError) {
        job.status = 'failed'; job.submissionState = error.uncertain ? 'uncertain' : 'reserved';
        job.errorCode = error.uncertain ? 'VTO_SUBMISSION_UNCERTAIN' : 'VTO_PROVIDER_REJECTED';
        if (!error.uncertain) job.cleanupNextAttemptAt = now;
        await job.save(); await releaseReservation(job, false);
        if (!error.uncertain) await cleanup(job, deps, now);
        throw error.uncertain
          ? new HttpError(503, 'VTO_SUBMISSION_UNCERTAIN', 'The provider submission outcome could not be confirmed. The request was not resubmitted.')
          : providerHttpError(error);
      }
      job.status = 'failed'; job.errorCode = 'VTO_PROCESSING_FAILED'; job.cleanupNextAttemptAt = now;
      await job.save().catch(() => undefined);
      await releaseReservation(job, false).catch(() => undefined);
      await cleanup(job, deps, now).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    if (!job) {
      if (asset) await deps.imageStorage.delete(asset).catch(() => undefined);
      await releaseQuota(ownerKey, reservation.day, false);
    }
    throw error;
  }
}

async function refresh(job: JobDocument, deps: VirtualTryOnDependencies): Promise<void> {
  if (TERMINAL.has(job.status)) { await cleanup(job, deps, deps.now(), true); return; }
  const now = deps.now();
  if (job.deadlineAt <= now) {
    if (job.providerJobId) await deps.provider.cancel(job.providerJobId).catch(() => undefined);
    await markTerminal(job, 'failed', deps, { errorCode: 'VTO_DEADLINE_EXCEEDED' });
    return;
  }
  if (!job.providerJobId) return;
  const providerStatus = await deps.provider.status(job.providerJobId);
  if (providerStatus.status === 'completed' && providerStatus.resultUrl) {
    await markTerminal(job, 'completed', deps, { resultUrl: providerStatus.resultUrl,
      resultExpiresAt: new Date(now.getTime() + PIXELCUT_RESULT_TTL_MS) });
  } else if (providerStatus.status === 'failed') {
    await markTerminal(job, 'failed', deps, { errorCode: 'VTO_PROCESSING_FAILED' });
  } else {
    job.status = providerStatus.status; await job.save();
  }
}

export async function getTryOnJob(jobId: string, identity: TryOnIdentity, suppliedCapability: string | undefined,
  deps: VirtualTryOnDependencies) {
  const owned = await ownedJob(jobId, identity, suppliedCapability);
  try { await refresh(owned.job, deps); }
  catch (error) {
    if (error instanceof VirtualTryOnProviderError) throw providerHttpError(error);
    throw error;
  }
  return publicDto(owned.job, owned.guestToken);
}

export async function cancelTryOnJob(jobId: string, identity: TryOnIdentity, suppliedCapability: string | undefined,
  deps: VirtualTryOnDependencies) {
  const owned = await ownedJob(jobId, identity, suppliedCapability); const { job } = owned;
  if (TERMINAL.has(job.status)) throw HttpError.conflict('This Virtual Try-On job has already finished.');
  if (job.providerJobId) {
    try { await deps.provider.cancel(job.providerJobId); }
    catch (error) {
      if (error instanceof VirtualTryOnProviderError && error.kind === 'already_finished') {
        await refresh(job, deps); return publicDto(job, owned.guestToken);
      }
      if (error instanceof VirtualTryOnProviderError) throw providerHttpError(error);
      throw error;
    }
  }
  await markTerminal(job, 'cancelled', deps);
  return publicDto(job, owned.guestToken);
}

export async function saveTryOnFeedback(jobId: string, feedback: 'helpful' | 'not_helpful', identity: TryOnIdentity,
  suppliedCapability: string | undefined, deps: VirtualTryOnDependencies) {
  const owned = await ownedJob(jobId, identity, suppliedCapability);
  if (owned.job.status !== 'completed') throw HttpError.conflict('Feedback can only be submitted for a completed Virtual Try-On.');
  owned.job.feedback = feedback; owned.job.feedbackUpdatedAt = deps.now(); await owned.job.save();
  return publicDto(owned.job, owned.guestToken);
}

export async function reconcileVirtualTryOnJobs(deps: VirtualTryOnDependencies): Promise<void> {
  const now = deps.now();
  const active = await VirtualTryOnJob.find({ status: { $in: ['pending', 'running'] } }).limit(50)
    .select('+providerJobId +temporaryAsset +cleanupStatus +cleanupAttempts +cleanupNextAttemptAt +quotaDay +ownerKey +reservationReleased');
  for (const job of active) {
    try { await refresh(job, deps); }
    catch { logger.warn(`Virtual Try-On reconciliation deferred for job ${job.id}.`); }
  }
  const cleanupDue = await VirtualTryOnJob.find({ cleanupStatus: 'pending', cleanupNextAttemptAt: { $lte: now } }).limit(50)
    .select('+temporaryAsset +cleanupStatus +cleanupAttempts +cleanupNextAttemptAt +quotaDay +ownerKey +reservationReleased');
  for (const job of cleanupDue) await cleanup(job, deps, now, true);
}
