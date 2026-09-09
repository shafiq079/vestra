import {
  model,
  models,
  Schema,
  type InferSchemaType,
  type Model,
} from 'mongoose';

import { PREFERRED_FITS, UNIT_SYSTEMS } from './enums';
import { frontendJson } from './serialization';

const measurementProfileSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  height: { type: Number, min: 0 },
  weight: { type: Number, min: 0 },
  chest: { type: Number, min: 0 },
  waist: { type: Number, min: 0 },
  hips: { type: Number, min: 0 },
  inseam: { type: Number, min: 0 },
  ageRange: { type: String, trim: true },
  bodyProfile: { type: String, trim: true },
  preferredFit: { type: String, enum: PREFERRED_FITS },
  unitSystem: { type: String, enum: UNIT_SYSTEMS, required: true },
  lastUpdated: { type: Date, default: Date.now },
});

measurementProfileSchema.index({ userId: 1 }, { unique: true });
frontendJson(measurementProfileSchema);

export type MeasurementProfileShape = InferSchemaType<typeof measurementProfileSchema>;
export const MeasurementProfile: Model<MeasurementProfileShape> =
  (models.MeasurementProfile as Model<MeasurementProfileShape> | undefined) ??
  model<MeasurementProfileShape>('MeasurementProfile', measurementProfileSchema);
