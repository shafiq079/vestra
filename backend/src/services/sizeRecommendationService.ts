import { Types } from 'mongoose';
import { Product, type ProductShape } from '../models';
import { HttpError } from '../utils/httpError';
import {
  SizeRecommendationMlClientError, type MlFormField, type MlPredictionResponse,
  type SizeRecommendationMlClient,
} from './sizeRecommendationMlClient';

const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] as const;
const KG_PER_LB = 0.45359237;
const CM_PER_INCH = 2.54;
const DISCLAIMER = 'Size recommendations are guidance only and cannot guarantee fit. Fit can vary by style, fabric and personal preference.';

export type UnitSystem = 'metric' | 'imperial';
export type PreferredFit = 'fitted' | 'regular' | 'relaxed';

export interface SizeRecommendationRequestInput {
  productId: string;
  measurements: Record<string, number | string>;
  preferredFit?: PreferredFit;
  unitSystem: UnitSystem;
}

function serviceError(error: unknown): HttpError {
  if (error instanceof SizeRecommendationMlClientError) {
    if (error.kind === 'invalid_request') {
      return new HttpError(422, 'SIZE_RECOMMENDATION_INVALID_MEASUREMENTS', 'The measurements could not be processed.');
    }
    if (error.kind === 'not_found') {
      return new HttpError(422, 'SIZE_RECOMMENDATION_MODEL_UNAVAILABLE', 'Size recommendation is not available for this product.');
    }
    return new HttpError(503, 'SIZE_RECOMMENDATION_UNAVAILABLE', 'Size recommendation is temporarily unavailable. Please select a size manually.');
  }
  return new HttpError(503, 'SIZE_RECOMMENDATION_UNAVAILABLE', 'Size recommendation is temporarily unavailable. Please select a size manually.');
}

async function productForRecommendation(productId: string): Promise<InstanceType<typeof Product>> {
  if (!Types.ObjectId.isValid(productId)) {
    throw HttpError.badRequest('Invalid size recommendation request.', { productId: ['Must be a valid MongoDB ObjectId.'] });
  }
  const product = await Product.findOne({ _id: productId, isPublished: true, sizeRecommendationEligible: true });
  if (!product || !product.sizeModelKey) throw HttpError.notFound('Size recommendation is not available for this product.');
  return product;
}

function modelUnitValue(field: MlFormField, value: number, unitSystem: UnitSystem): number {
  if (unitSystem === 'metric') return value;
  if (field.unit === 'kg') return value * KG_PER_LB;
  if (field.unit === 'cm') return value * CM_PER_INCH;
  return value;
}

function displayUnit(field: MlFormField, unitSystem: UnitSystem): string | undefined {
  if (unitSystem === 'imperial' && field.unit === 'kg') return 'lb';
  if (unitSystem === 'imperial' && field.unit === 'cm') return 'in';
  return field.unit;
}

function parseMeasurements(fields: MlFormField[], supplied: Record<string, number | string>, unitSystem: UnitSystem) {
  const expected = new Set(fields.map((field) => field.key));
  const details: Record<string, string[]> = {};
  const modelMeasurements: Record<string, number | string> = {};
  const summary: Record<string, string> = {};

  for (const key of Object.keys(supplied)) {
    if (!expected.has(key)) details[key] = ['This field is not used by the active size model.'];
  }

  for (const field of fields) {
    const raw = supplied[field.key];
    if (raw === undefined || raw === '') {
      if (field.required) details[field.key] = ['This field is required.'];
      continue;
    }

    if (field.inputType === 'number') {
      const numeric = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isFinite(numeric)) {
        details[field.key] = ['Enter a valid number.'];
        continue;
      }
      const converted = modelUnitValue(field, numeric, unitSystem);
      if (field.min !== undefined && converted < field.min) {
        details[field.key] = [`Must be at least ${field.min} ${field.unit ?? ''}.`.trim()];
        continue;
      }
      if (field.max !== undefined && converted > field.max) {
        details[field.key] = [`Must be at most ${field.max} ${field.unit ?? ''}.`.trim()];
        continue;
      }
      modelMeasurements[field.key] = converted;
      const unit = displayUnit(field, unitSystem);
      summary[field.label] = `${numeric}${unit ? ` ${unit}` : ''}`;
      continue;
    }

    if (typeof raw !== 'string') {
      details[field.key] = ['Select a valid value.'];
      continue;
    }
    if (field.options && !field.options.some((option) => option.value === raw)) {
      details[field.key] = ['Select one of the available options.'];
      continue;
    }
    modelMeasurements[field.key] = raw;
    summary[field.label] = field.options?.find((option) => option.value === raw)?.label ?? raw;
  }

  if (Object.keys(details).length > 0) {
    throw HttpError.badRequest('Invalid size recommendation request.', details);
  }
  return { modelMeasurements, summary };
}

function productSizes(product: InstanceType<typeof Product>): string[] {
  const source = product.availableSizes.length > 0 ? product.availableSizes : product.variants.map((variant) => variant.size);
  return [...new Set(source.map((size) => size.trim().toUpperCase()).filter(Boolean))];
}

function sizeRank(size: string): number | undefined {
  const index = SIZE_ORDER.indexOf(size.toUpperCase() as typeof SIZE_ORDER[number]);
  return index >= 0 ? index : undefined;
}

function closestAvailableSize(predicted: string, available: string[]): string {
  const exact = available.find((size) => size === predicted.toUpperCase());
  if (exact) return exact;
  const predictedRank = sizeRank(predicted);
  if (predictedRank === undefined) return available[0] ?? predicted.toUpperCase();
  const ranked = available
    .map((size) => ({ size, rank: sizeRank(size) }))
    .filter((item): item is { size: string; rank: number } => item.rank !== undefined)
    .sort((left, right) => Math.abs(left.rank - predictedRank) - Math.abs(right.rank - predictedRank));
  return ranked[0]?.size ?? available[0] ?? predicted.toUpperCase();
}

function alternativeSize(prediction: MlPredictionResponse, available: string[], recommended: string): string | undefined {
  const ranked = Object.entries(prediction.probabilities).sort((left, right) => right[1] - left[1]);
  for (const [candidate] of ranked) {
    const mapped = closestAvailableSize(candidate, available);
    if (mapped !== recommended) return mapped;
  }
  const recommendedRank = sizeRank(recommended);
  if (recommendedRank === undefined) return undefined;
  return available
    .map((size) => ({ size, rank: sizeRank(size) }))
    .filter((item): item is { size: string; rank: number } => item.rank !== undefined && item.size !== recommended)
    .sort((left, right) => Math.abs(left.rank - recommendedRank) - Math.abs(right.rank - recommendedRank))[0]?.size;
}

function confidenceLabel(percent: number): 'High' | 'Medium' | 'Low' {
  if (percent >= 70) return 'High';
  if (percent >= 45) return 'Medium';
  return 'Low';
}

export async function sizeFormSchema(productId: string, client: SizeRecommendationMlClient) {
  const product = await productForRecommendation(productId);
  try {
    const schema = await client.schema(product.sizeModelKey!);
    return { productId: product.id, sizeModelKey: product.sizeModelKey!, fields: schema.fields };
  } catch (error) {
    throw serviceError(error);
  }
}

export async function recommendSize(input: SizeRecommendationRequestInput, client: SizeRecommendationMlClient) {
  const product = await productForRecommendation(input.productId);
  let fields: MlFormField[];
  try {
    fields = (await client.schema(product.sizeModelKey!)).fields;
  } catch (error) {
    throw serviceError(error);
  }

  const { modelMeasurements, summary } = parseMeasurements(fields, input.measurements, input.unitSystem);
  let prediction: MlPredictionResponse;
  try {
    prediction = await client.predict(product.sizeModelKey!, modelMeasurements);
  } catch (error) {
    throw serviceError(error);
  }

  const available = productSizes(product);
  if (available.length === 0) throw HttpError.notFound('Size recommendation is not available for this product.');
  const rawPrediction = prediction.predictedSize.trim().toUpperCase();
  const recommended = closestAvailableSize(rawPrediction, available);
  const confidencePercent = Math.max(0, Math.min(100, Math.round(prediction.confidence * 100)));
  const mapped = recommended !== rawPrediction;
  const alternative = alternativeSize(prediction, available, recommended);
  const expectedFit = input.preferredFit ?? 'regular';

  return {
    productId: product.id,
    recommendedSize: recommended,
    confidencePercent,
    confidenceLabel: confidenceLabel(confidencePercent),
    expectedFit,
    explanation: mapped
      ? `The Decision Tree model predicted ${rawPrediction}. ${recommended} is the closest size offered for this product.`
      : `The Decision Tree model matched your measurements most closely with size ${recommended}.`,
    ...(alternative ? { alternativeSize: alternative } : {}),
    ...(mapped ? { productNote: `This product does not offer ${rawPrediction}; the closest listed size is ${recommended}.` } : {}),
    measurementSummary: summary,
    disclaimer: DISCLAIMER,
  };
}

export function sizeRecommendationProductFields(product: ProductShape) {
  return { eligible: product.sizeRecommendationEligible, modelKey: product.sizeModelKey };
}
