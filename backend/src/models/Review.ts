import { model, models, Schema, type InferSchemaType, type Model } from 'mongoose';
import { FIT_FEEDBACK } from './enums';
import { frontendJson } from './serialization';

const reviewSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true, trim: true },
    isVerified: { type: Boolean, default: false },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    fitFeedback: { type: String, enum: FIT_FEEDBACK },
    helpfulCount: { type: Number, min: 0, default: 0 },
    isApproved: { type: Boolean, default: false },
    isReported: { type: Boolean, default: false },
  },
  { timestamps: true },
);
reviewSchema.index({ productId: 1, isApproved: 1, createdAt: -1 });
reviewSchema.index({ userId: 1, createdAt: -1 });
reviewSchema.index({ productId: 1, userId: 1 }, { unique: true });
frontendJson(reviewSchema);

export type ReviewShape = InferSchemaType<typeof reviewSchema>;
export const Review: Model<ReviewShape> =
  (models.Review as Model<ReviewShape> | undefined) ?? model('Review', reviewSchema);
