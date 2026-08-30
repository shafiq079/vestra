import { model, models, Schema, type InferSchemaType, type Model } from 'mongoose';
import { frontendJson } from './serialization';

export const deliveryOptionSnapshotSchema = new Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  estimatedDays: { type: String, required: true, trim: true },
});
const deliveryOptionSchema = deliveryOptionSnapshotSchema.clone();
deliveryOptionSchema.add({
  isActive: { type: Boolean, default: true },
  displayOrder: { type: Number, min: 0, default: 0 },
});
deliveryOptionSchema.index({ isActive: 1, displayOrder: 1 });
frontendJson(deliveryOptionSchema);

export type DeliveryOptionShape = InferSchemaType<typeof deliveryOptionSchema>;
export const DeliveryOption: Model<DeliveryOptionShape> =
  (models.DeliveryOption as Model<DeliveryOptionShape> | undefined) ??
  model('DeliveryOption', deliveryOptionSchema);
