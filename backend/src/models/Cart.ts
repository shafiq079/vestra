import { model, models, Schema, type InferSchemaType, type Model } from 'mongoose';
import { frontendJson } from './serialization';

export const cartItemSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  colour: { type: String, required: true, trim: true },
  size: { type: String, required: true, trim: true },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 },
});
const cartSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    guestId: { type: String, trim: true },
    items: { type: [cartItemSchema], default: [] },
    subtotal: { type: Number, min: 0, default: 0 },
    discount: { type: Number, min: 0, default: 0 },
    promoCode: { type: String, trim: true, uppercase: true },
    deliveryOptionId: { type: Schema.Types.ObjectId, ref: 'DeliveryOption' },
    estimatedTotal: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true },
);
cartSchema.pre('validate', function validateOwner() {
  if ((!this.userId && !this.guestId) || (this.userId && this.guestId)) {
    this.invalidate('userId', 'Cart must have exactly one owner');
  }
});
cartSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { userId: { $type: 'objectId' } } },
);
cartSchema.index(
  { guestId: 1 },
  { unique: true, partialFilterExpression: { guestId: { $type: 'string' } } },
);
frontendJson(cartSchema);

export type CartShape = InferSchemaType<typeof cartSchema>;
export const Cart: Model<CartShape> =
  (models.Cart as Model<CartShape> | undefined) ?? model('Cart', cartSchema);
