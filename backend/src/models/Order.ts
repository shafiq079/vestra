import { model, models, Schema, type InferSchemaType, type Model } from 'mongoose';
import { deliveryOptionSnapshotSchema } from './DeliveryOption';
import { ORDER_STATUSES, PAYMENT_STATUSES } from './enums';
import { frontendJson } from './serialization';
import { addressSchema } from './User';

export const orderItemSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String, required: true, trim: true },
  productImage: { type: String, required: true, trim: true },
  brand: { type: String, required: true, trim: true },
  colour: { type: String, required: true, trim: true },
  size: { type: String, required: true, trim: true },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 },
});
const orderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, trim: true, uppercase: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    guestEmail: { type: String, trim: true, lowercase: true },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: [(items: unknown[]) => items.length > 0, 'Order requires at least one item'],
    },
    shippingAddress: { type: addressSchema, required: true },
    deliveryOption: { type: deliveryOptionSnapshotSchema, required: true },
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, min: 0, default: 0 },
    deliveryCost: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    promoCode: { type: String, trim: true, uppercase: true },
    status: { type: String, enum: ORDER_STATUSES, default: 'pending' },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'pending' },
    estimatedDelivery: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);
orderSchema.pre('validate', function validateIdentity() {
  if ((!this.userId && !this.guestEmail) || (this.userId && this.guestEmail)) {
    this.invalidate('userId', 'Order must identify either a user or guest email');
  }
});
orderSchema.index({ orderNumber: 1 }, { unique: true });
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ guestEmail: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
frontendJson(orderSchema);

export type OrderShape = InferSchemaType<typeof orderSchema>;
export const Order: Model<OrderShape> =
  (models.Order as Model<OrderShape> | undefined) ?? model('Order', orderSchema);
