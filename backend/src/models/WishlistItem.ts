import { model, models, Schema, type InferSchemaType, type Model } from 'mongoose';
import { frontendJson } from './serialization';

const wishlistItemSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  addedAt: { type: Date, default: Date.now },
});
wishlistItemSchema.index({ userId: 1, productId: 1 }, { unique: true });
wishlistItemSchema.index({ userId: 1, addedAt: -1 });
frontendJson(wishlistItemSchema);

export type WishlistItemShape = InferSchemaType<typeof wishlistItemSchema>;
export const WishlistItem: Model<WishlistItemShape> =
  (models.WishlistItem as Model<WishlistItemShape> | undefined) ??
  model('WishlistItem', wishlistItemSchema);
