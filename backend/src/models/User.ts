import {
  model,
  models,
  Schema,
  type InferSchemaType,
  type Model,
} from 'mongoose';

import { USER_ROLES } from './enums';
import { frontendJson } from './serialization';

export const addressSchema = new Schema({
  label: { type: String, required: true, trim: true },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  line1: { type: String, required: true, trim: true },
  line2: { type: String, trim: true },
  city: { type: String, required: true, trim: true },
  county: { type: String, trim: true },
  postcode: { type: String, required: true, trim: true, uppercase: true },
  country: { type: String, required: true, trim: true },
  isDefault: { type: Boolean, default: false },
});

const userSchema = new Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, default: 'customer' },
    avatar: { type: String, trim: true },
    addresses: { type: [addressSchema], default: [] },
    isActive: { type: Boolean, default: true },
    marketingOptIn: { type: Boolean, default: false },
  },
  { timestamps: true },
);

userSchema.index({ email: 1 }, { unique: true });
frontendJson(userSchema, { omit: ['passwordHash'] });

export type UserShape = InferSchemaType<typeof userSchema>;
export const User: Model<UserShape> =
  (models.User as Model<UserShape> | undefined) ?? model<UserShape>('User', userSchema);
