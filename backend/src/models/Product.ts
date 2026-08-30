import { model, models, Schema, type Model, type Types } from 'mongoose';
import { GENDER_COLLECTIONS, PRODUCT_BADGES, STOCK_STATUSES } from './enums';
import { frontendJson } from './serialization';

export const productImageSchema = new Schema({ url: { type: String, required: true, trim: true }, alt: { type: String, required: true, trim: true }, position: { type: Number, required: true, min: 0 }, isLifestyle: { type: Boolean, default: false } });
export const productVariantSchema = new Schema({ sku: { type: String, required: true, trim: true }, colour: { type: String, required: true, trim: true }, colourHex: { type: String, required: true, trim: true }, size: { type: String, required: true, trim: true }, stock: { type: Number, required: true, min: 0 }, image: { type: String, trim: true } });

const productSchema = new Schema({
  slug: { type: String, required: true, trim: true, lowercase: true }, name: { type: String, required: true, trim: true }, brand: { type: String, required: true, trim: true },
  shortDescription: { type: String, required: true, trim: true }, fullDescription: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true, lowercase: true }, subcategory: { type: String, trim: true, lowercase: true }, collection: { type: String, trim: true, lowercase: true },
  genderCollection: { type: String, enum: GENDER_COLLECTIONS, required: true }, price: { type: Number, required: true, min: 0 }, salePrice: { type: Number, min: 0 }, currency: { type: String, required: true, trim: true, uppercase: true, default: 'GBP' },
  images: { type: [productImageSchema], default: [] }, lifestyleImages: { type: [productImageSchema], default: [] }, colours: { type: [String], default: [] }, variants: { type: [productVariantSchema], default: [] }, availableSizes: { type: [String], default: [] }, materials: { type: [String], default: [] }, careInstructions: { type: [String], default: [] },
  fitDescription: { type: String, required: true, trim: true }, modelInformation: { type: String, trim: true }, rating: { type: Number, min: 0, max: 5, default: 0 }, reviewCount: { type: Number, min: 0, default: 0 }, stockStatus: { type: String, enum: STOCK_STATUSES, default: 'out_of_stock' }, badges: { type: [{ type: String, enum: PRODUCT_BADGES }], default: [] },
  tryOnEligible: { type: Boolean, default: false }, sizeRecommendationEligible: { type: Boolean, default: false }, sizeModelKey: { type: String, trim: true }, recommendationTags: { type: [String], default: [] }, relatedProductIds: { type: [{ type: Schema.Types.ObjectId, ref: 'Product' }], default: [] }, isPublished: { type: Boolean, default: false },
}, { timestamps: true, suppressReservedKeysWarning: true });
productSchema.path('salePrice').validate(function (this: { price?: number }, value?: number) { return value === undefined || (this.price !== undefined && value < this.price); }, 'Sale price must be lower than price');
productSchema.index({ slug: 1 }, { unique: true });
productSchema.index({ name: 'text', shortDescription: 'text', category: 'text', recommendationTags: 'text' });
productSchema.index({ isPublished: 1, genderCollection: 1, category: 1, createdAt: -1 });
productSchema.index({ isPublished: 1, collection: 1, rating: -1 });
productSchema.index({ isPublished: 1, price: 1 });
productSchema.index({ 'variants.sku': 1 }, { unique: true, sparse: true });
frontendJson(productSchema);
export const Product: Model<any> = models.Product as Model<any> | undefined ?? model('Product', productSchema);
export type ProductReference = Types.ObjectId;
