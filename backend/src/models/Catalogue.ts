import { model, models, Schema, type InferSchemaType, type Model } from 'mongoose';
import { frontendJson } from './serialization';

const categorySchema = new Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, trim: true, lowercase: true },
  parentId: { type: Schema.Types.ObjectId, ref: 'Category' },
  image: { type: String, trim: true },
  description: { type: String, trim: true },
  isActive: { type: Boolean, default: true },
  displayOrder: { type: Number, min: 0, default: 0 },
});
categorySchema.index({ slug: 1 }, { unique: true });
categorySchema.index({ parentId: 1, isActive: 1, displayOrder: 1 });
frontendJson(categorySchema);

const collectionSchema = new Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, trim: true, lowercase: true },
  description: { type: String, required: true, trim: true },
  image: { type: String, required: true, trim: true },
  season: { type: String, trim: true },
  isActive: { type: Boolean, default: true },
});
collectionSchema.index({ slug: 1 }, { unique: true });
collectionSchema.index({ isActive: 1, name: 1 });
frontendJson(collectionSchema);

export type CategoryShape = InferSchemaType<typeof categorySchema>;
export type CollectionShape = InferSchemaType<typeof collectionSchema>;
export const Category: Model<CategoryShape> =
  (models.Category as Model<CategoryShape> | undefined) ?? model('Category', categorySchema);
export const Collection: Model<CollectionShape> =
  (models.Collection as Model<CollectionShape> | undefined) ?? model('Collection', collectionSchema);
