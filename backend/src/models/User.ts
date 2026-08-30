import { model, models, Schema, type Model, type Types } from 'mongoose';
import { PREFERRED_FITS, UNIT_SYSTEMS, USER_ROLES } from './enums';
import { frontendJson } from './serialization';

export const addressSchema = new Schema({
  label: { type: String, required: true, trim: true }, firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true }, line1: { type: String, required: true, trim: true },
  line2: { type: String, trim: true }, city: { type: String, required: true, trim: true }, county: { type: String, trim: true },
  postcode: { type: String, required: true, trim: true, uppercase: true }, country: { type: String, required: true, trim: true },
  isDefault: { type: Boolean, default: false },
});

export const measurementProfileSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  height: { type: Number, min: 0 }, weight: { type: Number, min: 0 }, chest: { type: Number, min: 0 },
  waist: { type: Number, min: 0 }, hips: { type: Number, min: 0 }, inseam: { type: Number, min: 0 },
  ageRange: { type: String, trim: true }, bodyProfile: { type: String, trim: true },
  preferredFit: { type: String, enum: PREFERRED_FITS }, unitSystem: { type: String, enum: UNIT_SYSTEMS, required: true },
  lastUpdated: { type: Date, default: Date.now },
});

export interface UserDocumentShape { email: string; firstName: string; lastName: string; role: typeof USER_ROLES[number]; passwordHash: string; avatar?: string; addresses: unknown[]; measurementProfile?: unknown; wishlistIds: Types.ObjectId[]; isActive: boolean; marketingOptIn: boolean }
const userSchema = new Schema<UserDocumentShape>({
  email: { type: String, required: true, trim: true, lowercase: true }, firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true }, passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: USER_ROLES, default: 'customer' }, avatar: { type: String, trim: true },
  addresses: { type: [addressSchema], default: [] }, measurementProfile: measurementProfileSchema,
  wishlistIds: { type: [{ type: Schema.Types.ObjectId, ref: 'Product' }], default: [] },
  isActive: { type: Boolean, default: true }, marketingOptIn: { type: Boolean, default: false },
}, { timestamps: true });
userSchema.index({ email: 1 }, { unique: true });
frontendJson(userSchema);
export const User: Model<any> = models.User as Model<any> | undefined ?? model<UserDocumentShape>('User', userSchema);
