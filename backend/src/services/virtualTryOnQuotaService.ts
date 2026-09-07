import { env } from '../config/env';
import { VirtualTryOnQuota, VirtualTryOnRateLimit } from '../models';
import { HttpError } from '../utils/httpError';

export interface QuotaReservation {
  ownerKey: string;
  day: string;
}

const dayKey = (date: Date) => date.toISOString().slice(0, 10);

async function consumeRateLimit(ownerKey: string, now: Date): Promise<void> {
  const windowMs = env.VTO_RATE_LIMIT_WINDOW_SECONDS * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const expiresAt = new Date(windowStart.getTime() + windowMs * 2);
  const updated = await VirtualTryOnRateLimit.findOneAndUpdate(
    { ownerKey, windowStart, count: { $lt: env.VTO_RATE_LIMIT_MAX_REQUESTS } },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt } }, { new: true },
  );
  if (updated) return;
  try {
    await VirtualTryOnRateLimit.create({ ownerKey, windowStart, count: 1, expiresAt });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      // Another request created the same window concurrently. Atomically consume
      // the next slot instead of treating that harmless insert race as exhaustion.
      const raced = await VirtualTryOnRateLimit.findOneAndUpdate(
        { ownerKey, windowStart, count: { $lt: env.VTO_RATE_LIMIT_MAX_REQUESTS } },
        { $inc: { count: 1 } }, { new: true },
      );
      if (raced) return;
      throw new HttpError(429, 'VTO_RATE_LIMITED', 'Too many Virtual Try-On requests. Please wait before trying again.');
    }
    throw error;
  }
}

export async function reserveQuota(ownerKey: string, rateOwnerKey: string, now: Date): Promise<QuotaReservation> {
  await consumeRateLimit(rateOwnerKey, now);
  const day = dayKey(now);
  const updated = await VirtualTryOnQuota.findOneAndUpdate(
    { ownerKey, day, startedCount: { $lt: env.VTO_DAILY_QUOTA }, activeCount: { $lt: env.VTO_CONCURRENT_LIMIT } },
    { $inc: { startedCount: 1, activeCount: 1 } }, { new: true },
  );
  if (updated) return { ownerKey, day };
  try {
    await VirtualTryOnQuota.create({ ownerKey, day, startedCount: 1, activeCount: 1, completedCount: 0 });
    return { ownerKey, day };
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
  }
  const current = await VirtualTryOnQuota.findOne({ ownerKey, day });
  if (current && current.activeCount >= env.VTO_CONCURRENT_LIMIT) {
    throw new HttpError(409, 'VTO_CONCURRENT_LIMIT', 'Another Virtual Try-On is already processing for this session.');
  }
  throw new HttpError(429, 'VTO_DAILY_QUOTA_EXCEEDED', 'The daily Virtual Try-On limit has been reached.');
}

export async function releaseQuota(ownerKey: string, day: string, completed: boolean): Promise<void> {
  await VirtualTryOnQuota.updateOne({ ownerKey, day, activeCount: { $gt: 0 } }, {
    $inc: { activeCount: -1, ...(completed ? { completedCount: 1 } : {}) },
  });
}
