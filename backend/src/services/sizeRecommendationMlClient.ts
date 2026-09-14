import { z } from 'zod';
import { env } from '../config/env';

const formFieldSchema = z.object({
  key: z.string().min(1).max(100),
  label: z.string().min(1).max(120),
  inputType: z.enum(['number', 'select', 'radio']),
  required: z.boolean(),
  min: z.number().finite().optional(),
  max: z.number().finite().optional(),
  unit: z.string().max(30).optional(),
  helpText: z.string().max(300).optional(),
  displayOrder: z.number().int(),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
}).strict();

const schemaResponseSchema = z.object({
  modelKey: z.string().min(1),
  modelVersion: z.string().min(1),
  fields: z.array(formFieldSchema).min(1).max(20),
}).strict();

const predictionResponseSchema = z.object({
  predictedSize: z.string().min(1).max(20),
  confidence: z.number().min(0).max(1),
  probabilities: z.record(z.string(), z.number().min(0).max(1)),
  modelVersion: z.string().min(1),
}).strict();

export type MlFormField = z.infer<typeof formFieldSchema>;
export type MlSchemaResponse = z.infer<typeof schemaResponseSchema>;
export type MlPredictionResponse = z.infer<typeof predictionResponseSchema>;

export interface SizeRecommendationMlClient {
  schema(modelKey: string): Promise<MlSchemaResponse>;
  predict(modelKey: string, measurements: Record<string, number | string>): Promise<MlPredictionResponse>;
}

export type MlClientErrorKind = 'configuration' | 'authentication' | 'not_found'
  | 'invalid_request' | 'unavailable' | 'invalid_response';

export class SizeRecommendationMlClientError extends Error {
  constructor(public readonly kind: MlClientErrorKind) {
    super('ML size recommendation service request failed.');
    this.name = 'SizeRecommendationMlClientError';
  }
}

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export class HttpSizeRecommendationMlClient implements SizeRecommendationMlClient {
  constructor(
    private readonly baseUrl = env.ML_SERVICE_URL,
    private readonly serviceKey = env.ML_SERVICE_KEY,
    private readonly timeoutMs = env.ML_SERVICE_TIMEOUT_MS,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  private async request(path: string, init: RequestInit): Promise<unknown> {
    if (!this.baseUrl || !this.serviceKey) throw new SizeRecommendationMlClientError('configuration');
    const url = `${this.baseUrl.replace(/\/$/, '')}${path}`;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        let response: Response;
        try {
          response = await this.fetchImpl(url, {
            ...init,
            headers: {
              Accept: 'application/json',
              'X-ML-Service-Key': this.serviceKey,
              ...(init.body ? { 'Content-Type': 'application/json' } : {}),
              ...init.headers,
            },
            signal: controller.signal,
            redirect: 'error',
          });
        } catch {
          if (attempt === 0) continue;
          throw new SizeRecommendationMlClientError('unavailable');
        }

        const text = await response.text();
        if (text.length > 64 * 1024) throw new SizeRecommendationMlClientError('invalid_response');
        let payload: unknown = {};
        try { payload = text ? JSON.parse(text) : {}; }
        catch { throw new SizeRecommendationMlClientError('invalid_response'); }

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            throw new SizeRecommendationMlClientError('authentication');
          }
          if (response.status === 404) throw new SizeRecommendationMlClientError('not_found');
          if (response.status === 400 || response.status === 422) {
            throw new SizeRecommendationMlClientError('invalid_request');
          }
          if (response.status === 429 || response.status >= 500) {
            if (attempt === 0) continue;
            throw new SizeRecommendationMlClientError('unavailable');
          }
          throw new SizeRecommendationMlClientError('invalid_response');
        }
        return payload;
      } finally {
        clearTimeout(timer);
      }
    }
    throw new SizeRecommendationMlClientError('unavailable');
  }

  async schema(modelKey: string): Promise<MlSchemaResponse> {
    const payload = await this.request(`/v1/models/${encodeURIComponent(modelKey)}/schema`, { method: 'GET' });
    const parsed = schemaResponseSchema.safeParse(payload);
    if (!parsed.success || parsed.data.modelKey !== modelKey) {
      throw new SizeRecommendationMlClientError('invalid_response');
    }
    return parsed.data;
  }

  async predict(modelKey: string, measurements: Record<string, number | string>): Promise<MlPredictionResponse> {
    const payload = await this.request('/v1/predict', {
      method: 'POST',
      body: JSON.stringify({ modelKey, measurements }),
    });
    const parsed = predictionResponseSchema.safeParse(payload);
    if (!parsed.success) throw new SizeRecommendationMlClientError('invalid_response');
    return parsed.data;
  }
}

export function createDefaultSizeRecommendationMlClient(): SizeRecommendationMlClient {
  return new HttpSizeRecommendationMlClient();
}
