import { model, models, Schema, type Model } from 'mongoose'; import { frontendJson } from './serialization';
const schema = new Schema({ userId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true }, addedAt: { type: Date, default: Date.now } });
schema.index({ userId: 1, productId: 1 }, { unique: true }); schema.index({ userId: 1, addedAt: -1 }); frontendJson(schema);
export const WishlistItem: Model<any> = models.WishlistItem as Model<any> | undefined ?? model('WishlistItem', schema);
