import { model, models, Schema, type InferSchemaType, type Model } from 'mongoose';

const virtualTryOnQuotaSchema = new Schema({
  ownerKey: { type: String, required: true },
  day: { type: String, required: true },
  startedCount: { type: Number, required: true, min: 0, default: 0 },
  completedCount: { type: Number, required: true, min: 0, default: 0 },
  activeCount: { type: Number, required: true, min: 0, default: 0 },
  activeJobIds: { type: [Schema.Types.ObjectId], required: true, default: [], select: false },
  releasedJobIds: { type: [Schema.Types.ObjectId], required: true, default: [], select: false },
}, { timestamps: true });
virtualTryOnQuotaSchema.index({ ownerKey: 1, day: 1 }, { unique: true });

const virtualTryOnRateLimitSchema = new Schema({
  ownerKey: { type: String, required: true },
  windowStart: { type: Date, required: true },
  count: { type: Number, required: true, min: 0, default: 0 },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });
virtualTryOnRateLimitSchema.index({ ownerKey: 1, windowStart: 1 }, { unique: true });
virtualTryOnRateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type VirtualTryOnQuotaShape = InferSchemaType<typeof virtualTryOnQuotaSchema>;
export type VirtualTryOnRateLimitShape = InferSchemaType<typeof virtualTryOnRateLimitSchema>;
export const VirtualTryOnQuota: Model<VirtualTryOnQuotaShape> =
  (models.VirtualTryOnQuota as Model<VirtualTryOnQuotaShape> | undefined)
  ?? model('VirtualTryOnQuota', virtualTryOnQuotaSchema);
export const VirtualTryOnRateLimit: Model<VirtualTryOnRateLimitShape> =
  (models.VirtualTryOnRateLimit as Model<VirtualTryOnRateLimitShape> | undefined)
  ?? model('VirtualTryOnRateLimit', virtualTryOnRateLimitSchema);
