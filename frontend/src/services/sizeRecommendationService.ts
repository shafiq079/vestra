import { USE_MOCK_API } from './apiClient';
// Phase 13 has not shipped: real mode reports the feature as unavailable.
import type { SizeRecommendationFormSchema, SizeRecommendationRequest, SizeRecommendationResult } from '../types';

export async function getSizeFormSchema(productId: string, sizeModelKey: string): Promise<SizeRecommendationFormSchema> {
  if (USE_MOCK_API) {
    await new Promise((r) => setTimeout(r, 300));
    return {
      productId,
      sizeModelKey,
      fields: [
        { key: 'height', label: 'Height', inputType: 'number', required: true, min: 140, max: 210, unit: 'cm', helpText: 'Your height in centimetres', displayOrder: 1 },
        { key: 'weight', label: 'Weight', inputType: 'number', required: true, min: 35, max: 150, unit: 'kg', helpText: 'Your weight in kilograms', displayOrder: 2 },
        { key: 'chest', label: 'Chest', inputType: 'number', required: true, min: 70, max: 140, unit: 'cm', helpText: 'Measure around the fullest part of your chest', displayOrder: 3 },
        { key: 'waist', label: 'Waist', inputType: 'number', required: true, min: 50, max: 130, unit: 'cm', helpText: 'Measure around your natural waistline', displayOrder: 4 },
        { key: 'hips', label: 'Hips', inputType: 'number', required: false, min: 70, max: 140, unit: 'cm', helpText: 'Measure around the fullest part of your hips', displayOrder: 5 },
        { key: 'inseam', label: 'Inseam', inputType: 'number', required: false, min: 60, max: 95, unit: 'cm', helpText: 'Measure from crotch to ankle', displayOrder: 6 },
        { key: 'ageRange', label: 'Age Range', inputType: 'select', required: false, displayOrder: 7, options: [
          { value: '18-24', label: '18-24' },
          { value: '25-34', label: '25-34' },
          { value: '35-44', label: '35-44' },
          { value: '45-54', label: '45-54' },
          { value: '55+', label: '55+' },
        ] },
        { key: 'preferredFit', label: 'Preferred Fit', inputType: 'radio', required: false, displayOrder: 8, options: [
          { value: 'fitted', label: 'Fitted' },
          { value: 'regular', label: 'Regular' },
          { value: 'relaxed', label: 'Relaxed' },
        ] },
      ],
    };
  }
  throw new Error('Size recommendation is not available.');
}

export async function submitSizeRecommendation(request: SizeRecommendationRequest): Promise<SizeRecommendationResult> {
  if (USE_MOCK_API) {
    await new Promise((r) => setTimeout(r, 2000));

    const { height, chest, waist } = request.measurements;
    const heightNum = Number(height) || 170;
    const chestNum = Number(chest) || 90;
    const waistNum = Number(waist) || 75;

    let recommendedSize = 'M';
    let confidencePercent = 85;
    let expectedFit: 'fitted' | 'regular' | 'relaxed' = 'regular';

    if (heightNum < 160 && chestNum < 85) { recommendedSize = 'XS'; confidencePercent = 88; }
    else if (heightNum < 170 && chestNum < 90) { recommendedSize = 'S'; confidencePercent = 86; }
    else if (heightNum >= 170 && heightNum < 180 && chestNum >= 90 && chestNum < 100) { recommendedSize = 'M'; confidencePercent = 87; }
    else if (heightNum >= 180 && chestNum >= 100 && chestNum < 110) { recommendedSize = 'L'; confidencePercent = 84; }
    else if (chestNum >= 110 || waistNum >= 100) { recommendedSize = 'XL'; confidencePercent = 82; }
    else { recommendedSize = 'M'; confidencePercent = 79; }

    if (request.preferredFit === 'fitted') expectedFit = 'fitted';
    else if (request.preferredFit === 'relaxed') { expectedFit = 'relaxed'; recommendedSize = recommendedSize === 'XS' ? 'XS' : sizeUp(recommendedSize); }

    const confidenceLabel = confidencePercent >= 85 ? 'High' : confidencePercent >= 70 ? 'Medium' : 'Low';
    const alternativeSize = sizeUp(recommendedSize);

    return {
      productId: request.productId,
      recommendedSize,
      confidencePercent,
      confidenceLabel,
      expectedFit,
      explanation: `Based on your measurements and this product's fit profile, size ${recommendedSize} should provide a ${expectedFit} fit. Choose ${alternativeSize} for a more relaxed fit.`,
      alternativeSize,
      productNote: 'This garment is designed with a slightly relaxed silhouette. If you are between sizes, consider sizing down for a closer fit.',
      measurementSummary: {
        Height: `${heightNum} cm`,
        Chest: `${chestNum} cm`,
        Waist: `${waistNum} cm`,
      },
      disclaimer: 'This is a recommendation based on your measurements and the product\'s fit model, not a guarantee of fit. Fit preferences vary by individual. Please use the size guide for detailed measurements.',
    };
  }
  throw new Error('Size recommendation is not available.');
}

function sizeUp(size: string): string {
  const order = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  const idx = order.indexOf(size);
  if (idx === -1 || idx === order.length - 1) return size;
  return order[idx + 1];
}
