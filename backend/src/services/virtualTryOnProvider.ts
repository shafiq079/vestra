import { env } from '../config/env';
import { safeExternalHttpsUrl } from '../utils/safeUrl';

export type ProviderJobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface ProviderStatusResult {
  status: ProviderJobStatus;
  resultUrl?: string;
  errorCode?: string;
}

export interface VirtualTryOnProvider {
  submit(input: { personImageUrl: string; garmentImageUrl: string }): Promise<{ providerJobId: string }>;
  status(providerJobId: string): Promise<ProviderStatusResult>;
  cancel(providerJobId: string): Promise<void>;
}

export type ProviderErrorKind = 'authentication' | 'credits' | 'rate_limit' | 'not_found'
  | 'already_finished' | 'invalid_request' | 'unavailable' | 'invalid_response';

export class VirtualTryOnProviderError extends Error {
  constructor(public readonly kind: ProviderErrorKind, public readonly uncertain: boolean) {
    super('Virtual Try-On provider request failed.');
    this.name = 'VirtualTryOnProviderError';
  }
}

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type ProviderPayload = { job_id?: unknown; status?: unknown; result_url?: unknown;
  error_code?: unknown; error?: unknown; message?: unknown };
const STATUSES = new Set<ProviderJobStatus>(['pending', 'running', 'completed', 'failed']);

export class PixelcutVirtualTryOnProvider implements VirtualTryOnProvider {
  private readonly baseUrl = 'https://api.developer.pixelcut.ai/v1/try-on';

  constructor(private readonly apiKey = env.PIXELCUT_API_KEY,
    private readonly timeoutMs = env.VTO_PROVIDER_TIMEOUT_MS, private readonly fetchImpl: FetchLike = fetch) {}

  private async request(path: string, method: 'GET' | 'POST', body?: Record<string, string>): Promise<ProviderPayload> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      let response: Response;
      try {
        response = await this.fetchImpl(`${this.baseUrl}${path}`, {
          method, headers: { 'X-API-Key': this.apiKey, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
          ...(body ? { body: JSON.stringify(body) } : {}), signal: controller.signal, redirect: 'error',
        });
      } catch {
        throw new VirtualTryOnProviderError('unavailable', method === 'POST');
      }
      const text = await response.text();
      if (text.length > 64 * 1024) throw new VirtualTryOnProviderError('invalid_response', method === 'POST');
      let payload: ProviderPayload = {};
      try { payload = text ? JSON.parse(text) as ProviderPayload : {}; }
      catch { throw new VirtualTryOnProviderError('invalid_response', method === 'POST'); }
      if (!response.ok) {
        const code = typeof payload.error_code === 'string' ? payload.error_code : '';
        if (response.status === 401) throw new VirtualTryOnProviderError('authentication', false);
        if (response.status === 403 && code === 'insufficient_api_credits') throw new VirtualTryOnProviderError('credits', false);
        if (response.status === 429) throw new VirtualTryOnProviderError('rate_limit', false);
        if (response.status === 404) throw new VirtualTryOnProviderError('not_found', false);
        if (response.status === 409 && code === 'job_finished') throw new VirtualTryOnProviderError('already_finished', false);
        if (response.status >= 400 && response.status < 500) throw new VirtualTryOnProviderError('invalid_request', false);
        throw new VirtualTryOnProviderError('unavailable', method === 'POST');
      }
      return payload;
    } finally { clearTimeout(timer); }
  }

  async submit(input: { personImageUrl: string; garmentImageUrl: string }): Promise<{ providerJobId: string }> {
    const payload = await this.request('', 'POST', {
      person_image_url: input.personImageUrl, garment_image_url: input.garmentImageUrl,
      preprocess_garment: 'true', remove_background: 'false', wait_for_result: 'false',
    });
    if (typeof payload.job_id !== 'string' || !payload.job_id) throw new VirtualTryOnProviderError('invalid_response', true);
    return { providerJobId: payload.job_id };
  }

  async status(providerJobId: string): Promise<ProviderStatusResult> {
    const payload = await this.request(`/job/${encodeURIComponent(providerJobId)}`, 'GET');
    if (typeof payload.status !== 'string' || !STATUSES.has(payload.status as ProviderJobStatus)) {
      throw new VirtualTryOnProviderError('invalid_response', false);
    }
    const status = payload.status as ProviderJobStatus;
    if (status === 'completed') {
      const resultUrl = typeof payload.result_url === 'string'
        ? safeExternalHttpsUrl(payload.result_url, ['assets.pixelcut.app']) : null;
      if (!resultUrl) throw new VirtualTryOnProviderError('invalid_response', false);
      return { status, resultUrl };
    }
    const error = payload.error && typeof payload.error === 'object' ? payload.error as { error_code?: unknown } : undefined;
    const errorCode = typeof error?.error_code === 'string' ? error.error_code.slice(0, 100) : undefined;
    return { status, ...(errorCode ? { errorCode } : {}) };
  }

  async cancel(providerJobId: string): Promise<void> {
    await this.request(`/job/${encodeURIComponent(providerJobId)}/cancel`, 'POST');
  }
}
