import { model, models, Schema, type Model } from 'mongoose'; import { frontendJson } from './serialization';
export const deliveryOptionSnapshotSchema = new Schema({ name: { type: String, required: true, trim: true }, description: { type: String, required: true, trim: true }, price: { type: Number, required: true, min: 0 }, estimatedDays: { type: String, required: true, trim: true } });
const schema = deliveryOptionSnapshotSchema.clone(); schema.add({ isActive: { type: Boolean, default: true }, displayOrder: { type: Number, min: 0, default: 0 } }); schema.index({ isActive: 1, displayOrder: 1 }); frontendJson(schema);
export const DeliveryOption: Model<any> = models.DeliveryOption as Model<any> | undefined ?? model('DeliveryOption', schema);
