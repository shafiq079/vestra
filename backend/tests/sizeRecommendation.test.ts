import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { Product } from '../src/models';
import {
  SizeRecommendationMlClientError, type MlPredictionResponse, type MlSchemaResponse,
  type SizeRecommendationMlClient,
} from '../src/services/sizeRecommendationMlClient';
import { productFixture } from './fixtures/models';

const measurementSchema: MlSchemaResponse = {
  modelKey: 'tops_women',
  modelVersion: '1.0.0',
  fields: [
    { key: 'weight', label: 'Weight', inputType: 'number', required: true, min: 22, max: 136, unit: 'kg', displayOrder: 1 },
    { key: 'height', label: 'Height', inputType: 'number', required: true, min: 137, max: 194, unit: 'cm', displayOrder: 2 },
    { key: 'age', label: 'Age', inputType: 'number', required: true, min: 16, max: 80, unit: 'years', displayOrder: 3 },
  ],
};

const prediction: MlPredictionResponse = {
  predictedSize: 'M', confidence: 0.64, modelVersion: '1.0.0',
  probabilities: { XXS: 0.02, S: 0.18, M: 0.64, L: 0.12, XL: 0.04 },
};

function clientDoubles(): { client: SizeRecommendationMlClient; schema: ReturnType<typeof vi.fn>; predict: ReturnType<typeof vi.fn> } {
  const schema = vi.fn(async (modelKey: string) => ({ ...measurementSchema, modelKey }));
  const predict = vi.fn(async () => prediction);
  return { client: { schema, predict }, schema, predict };
}

async function eligibleProduct(overrides: Record<string, unknown> = {}) {
  return Product.create(productFixture({
    slug: `size-${randomUUID()}`,
    isPublished: true,
    sizeRecommendationEligible: true,
    sizeModelKey: 'tops_women',
    availableSizes: ['XS', 'S', 'M', 'L', 'XL'],
    variants: [
      { sku: `SIZE-${randomUUID()}`, colour: 'Black', colourHex: '#000000', size: 'S', stock: 2 },
      { sku: `SIZE-${randomUUID()}`, colour: 'Black', colourHex: '#000000', size: 'M', stock: 2 },
      { sku: `SIZE-${randomUUID()}`, colour: 'Black', colourHex: '#000000', size: 'L', stock: 2 },
    ],
    ...overrides,
  }));
}

beforeEach(async () => {
  await Product.deleteMany({});
});

describe('Phase 13 ML Size Recommendation API', () => {
  it('returns the active model schema for an eligible product', async () => {
    const product = await eligibleProduct(); const { client } = clientDoubles();
    const response = await request(createApp({ sizeRecommendation: client }))
      .get(`/api/size-recommendation/schema/${product.id}`);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ productId: product.id, sizeModelKey: 'tops_women' });
    expect(response.body.fields.map((field: { key: string }) => field.key)).toEqual(['weight', 'height', 'age']);
  });

  it('is schema-driven rather than hard-coding one field set', async () => {
    const first = await eligibleProduct({ sizeModelKey: 'tops_women' });
    const second = await eligibleProduct({ sizeModelKey: 'shirts_men' });
    const dynamicClient: SizeRecommendationMlClient = {
      schema: vi.fn(async (modelKey: string) => modelKey === 'shirts_men'
        ? { modelKey, modelVersion: '2', fields: [{ key: 'chest', label: 'Chest', inputType: 'number' as const, required: true, min: 60, max: 160, unit: 'cm', displayOrder: 1 }] }
        : measurementSchema),
      predict: vi.fn(async () => prediction),
    };
    const app = createApp({ sizeRecommendation: dynamicClient });
    const one = await request(app).get(`/api/size-recommendation/schema/${first.id}`);
    const two = await request(app).get(`/api/size-recommendation/schema/${second.id}`);
    expect(one.body.fields.map((field: { key: string }) => field.key)).toEqual(['weight', 'height', 'age']);
    expect(two.body.fields.map((field: { key: string }) => field.key)).toEqual(['chest']);
  });

  it('maps a real model-style prediction to the frontend result contract', async () => {
    const product = await eligibleProduct(); const { client } = clientDoubles();
    const response = await request(createApp({ sizeRecommendation: client })).post('/api/size-recommendation').send({
      productId: product.id,
      measurements: { weight: 62, height: 172.72, age: 28 },
      preferredFit: 'regular',
      unitSystem: 'metric',
    });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      productId: product.id,
      recommendedSize: 'M',
      confidencePercent: 64,
      confidenceLabel: 'Medium',
      expectedFit: 'regular',
      alternativeSize: 'S',
      measurementSummary: { Weight: '62 kg', Height: '172.72 cm', Age: '28 years' },
      disclaimer: expect.stringContaining('guidance only'),
    });
  });

  it('converts imperial values to the metric units declared by the model schema', async () => {
    const product = await eligibleProduct(); const { client, predict } = clientDoubles();
    const response = await request(createApp({ sizeRecommendation: client })).post('/api/size-recommendation').send({
      productId: product.id,
      measurements: { weight: 136.687, height: 68, age: 28 },
      unitSystem: 'imperial',
    });
    expect(response.status).toBe(200);
    const measurements = predict.mock.calls[0]?.[1] as Record<string, number>;
    expect(measurements.weight).toBeCloseTo(62, 1);
    expect(measurements.height).toBeCloseTo(172.72, 1);
    expect(response.body.measurementSummary).toMatchObject({ Weight: '136.687 lb', Height: '68 in' });
  });

  it('rejects undeclared and out-of-range measurements before prediction', async () => {
    const product = await eligibleProduct(); const { client, predict } = clientDoubles(); const app = createApp({ sizeRecommendation: client });
    const extra = await request(app).post('/api/size-recommendation').send({
      productId: product.id,
      measurements: { weight: 62, height: 172.72, age: 28, waist: 70 },
      unitSystem: 'metric',
    });
    expect(extra.status).toBe(400); expect(extra.body.details.waist).toBeDefined();
    const outside = await request(app).post('/api/size-recommendation').send({
      productId: product.id,
      measurements: { weight: 500, height: 172.72, age: 28 },
      unitSystem: 'metric',
    });
    expect(outside.status).toBe(400); expect(outside.body.details.weight).toBeDefined();
    expect(predict).not.toHaveBeenCalled();
  });

  it('maps a model size that the product does not sell to the nearest listed size', async () => {
    const product = await eligibleProduct({ availableSizes: ['XS', 'S', 'M', 'L', 'XL'] });
    const { client, predict } = clientDoubles();
    predict.mockResolvedValueOnce({
      predictedSize: 'XXS', confidence: 0.58, modelVersion: '1.0.0',
      probabilities: { XXS: 0.58, S: 0.22, M: 0.10, L: 0.06, XL: 0.04 },
    });
    const response = await request(createApp({ sizeRecommendation: client })).post('/api/size-recommendation').send({
      productId: product.id,
      measurements: { weight: 45, height: 155, age: 24 },
      unitSystem: 'metric',
    });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ recommendedSize: 'XS', productNote: expect.stringContaining('XXS') });
  });

  it('degrades safely when the ML service is unavailable and exposes no internal configuration', async () => {
    const product = await eligibleProduct();
    const client: SizeRecommendationMlClient = {
      schema: vi.fn(async () => { throw new SizeRecommendationMlClientError('unavailable'); }),
      predict: vi.fn(async () => prediction),
    };
    const response = await request(createApp({ sizeRecommendation: client }))
      .get(`/api/size-recommendation/schema/${product.id}`);
    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ code: 'SIZE_RECOMMENDATION_UNAVAILABLE' });
    const rendered = JSON.stringify(response.body);
    expect(rendered).not.toContain('ML_SERVICE_KEY');
    expect(rendered).not.toContain('ML_SERVICE_URL');
    expect(rendered).not.toContain('http://');
  });

  it('rejects unpublished or ineligible products without calling the ML service', async () => {
    const product = await eligibleProduct({ sizeRecommendationEligible: false });
    const { client, schema } = clientDoubles();
    const response = await request(createApp({ sizeRecommendation: client }))
      .get(`/api/size-recommendation/schema/${product.id}`);
    expect(response.status).toBe(404);
    expect(schema).not.toHaveBeenCalled();
  });
});
