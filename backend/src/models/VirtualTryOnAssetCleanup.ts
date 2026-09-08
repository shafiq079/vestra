import { model, models, Schema, type InferSchemaType, type Model } from 'mongoose';

const virtualTryOnAssetCleanupSchema = new Schema({
  jobId: { type: Schema.Types.ObjectId, required: true },
  publicId: { type: String, required: true },
  deliveryType: { type: String, enum: ['private'], required: true, default: 'private' },
  ownerKey: { type: String, required: true, select: false },
  quotaDay: { type: String, required: true, select: false },
  quotaReleased: { type: Boolean, required: true, default: false, select: false },
  status: { type: String, enum: ['pending', 'deleting', 'deleted'], required: true, default: 'pending' },
  attempts: { type: Number, required: true, default: 0, min: 0 },
  nextAttemptAt: { type: Date, required: true },
  leaseUntil: { type: Date },
  cleanedAt: { type: Date },
}, { timestamps: true });

virtualTryOnAssetCleanupSchema.index({ jobId: 1 }, { unique: true });
virtualTryOnAssetCleanupSchema.index({ publicId: 1 }, { unique: true });
virtualTryOnAssetCleanupSchema.index({ status: 1, nextAttemptAt: 1 });
virtualTryOnAssetCleanupSchema.index({ quotaReleased: 1, nextAttemptAt: 1 });

export type VirtualTryOnAssetCleanupShape = InferSchemaType<typeof virtualTryOnAssetCleanupSchema>;
export const VirtualTryOnAssetCleanup: Model<VirtualTryOnAssetCleanupShape> =
  (models.VirtualTryOnAssetCleanup as Model<VirtualTryOnAssetCleanupShape> | undefined)
  ?? model('VirtualTryOnAssetCleanup', virtualTryOnAssetCleanupSchema);
