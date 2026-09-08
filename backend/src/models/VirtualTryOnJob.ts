import { model, models, Schema, type InferSchemaType, type Model } from 'mongoose';

export const VTO_JOB_STATUSES = ['pending', 'running', 'completed', 'failed', 'cancelled'] as const;
export const VTO_FEEDBACK = ['helpful', 'not_helpful'] as const;

const temporaryAssetSchema = new Schema({
  assetId: { type: String, required: true },
  publicId: { type: String, required: true },
  format: { type: String, required: true },
  version: { type: Number, required: true },
  deliveryType: { type: String, enum: ['private'], required: true },
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  bytes: { type: Number, required: true },
}, { _id: false });

const virtualTryOnJobSchema = new Schema({
  ownerUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  ownerKey: { type: String, required: true, select: false },
  guestCapabilityHash: { type: String, select: false },
  idempotencyKey: { type: String, required: true, select: false },
  requestFingerprint: { type: String, required: true, select: false },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String, required: true },
  productImage: { type: String, required: true },
  variantColour: { type: String, required: true },
  garmentImageUrl: { type: String, required: true, select: false },
  provider: { type: String, enum: ['pixelcut'], required: true, default: 'pixelcut' },
  providerJobId: { type: String, select: false },
  providerSubmittedAt: { type: Date, select: false },
  submissionState: { type: String, enum: ['reserved', 'submitted', 'uncertain'], required: true, default: 'reserved', select: false },
  status: { type: String, enum: VTO_JOB_STATUSES, required: true, default: 'pending' },
  resultUrl: { type: String },
  resultExpiresAt: { type: Date },
  errorCode: { type: String },
  temporaryAsset: { type: temporaryAssetSchema, required: true, select: false },
  sourceAccessExpiresAt: { type: Date, required: true, select: false },
  quotaDay: { type: String, required: true, select: false },
  reservationReleased: { type: Boolean, required: true, default: false, select: false },
  consent: {
    givenAt: { type: Date, required: true },
    privacyVersion: { type: String, required: true },
  },
  deadlineAt: { type: Date, required: true },
  feedback: { type: String, enum: VTO_FEEDBACK },
  feedbackUpdatedAt: { type: Date },
}, { timestamps: true });

virtualTryOnJobSchema.index({ ownerKey: 1, idempotencyKey: 1 }, { unique: true });
virtualTryOnJobSchema.index({ status: 1, deadlineAt: 1 });
virtualTryOnJobSchema.index({ ownerUserId: 1, createdAt: -1 });

export type VirtualTryOnJobShape = InferSchemaType<typeof virtualTryOnJobSchema>;
export const VirtualTryOnJob: Model<VirtualTryOnJobShape> =
  (models.VirtualTryOnJob as Model<VirtualTryOnJobShape> | undefined)
  ?? model('VirtualTryOnJob', virtualTryOnJobSchema);
