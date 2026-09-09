import { apiClient } from './apiClient';
import type { ApiError, Product, VirtualTryOnJob, VirtualTryOnRequest, VirtualTryOnResult } from '../types';

const VTO_SESSION_KEY = 'vestra-vto-session-id';
function sessionId(): string {
  let value = sessionStorage.getItem(VTO_SESSION_KEY);
  if (!value) { value = crypto.randomUUID(); sessionStorage.setItem(VTO_SESSION_KEY, value); }
  return value;
}
function headers(accessToken?: string) {
  return { 'X-VTO-Session-Id': sessionId(), ...(accessToken ? { 'X-VTO-Job-Token': accessToken } : {}) };
}
const isNotFound = (error: unknown) => ['NOT_FOUND', 'HTTP_404'].includes((error as ApiError)?.code);

export async function getEligibleProducts(): Promise<Product[]> { return (await apiClient.get<Product[]>('/virtual-try-on/eligible')).data; }
export async function getProductForTryOn(productId: string): Promise<Product | null> {
  try { return (await apiClient.get<Product>(`/virtual-try-on/product/${productId}`)).data; }
  catch (error) { if (isNotFound(error)) return null; throw error; }
}
export async function submitTryOn(request: VirtualTryOnRequest, idempotencyKey: string): Promise<VirtualTryOnJob> {
  const data = new FormData(); data.append('productId', request.productId); data.append('variantColour', request.variantColour);
  data.append('consentGiven', String(request.consentGiven)); data.append('image', request.imageFile);
  return (await apiClient.post<VirtualTryOnJob>('/virtual-try-on', data, {
    headers: { ...headers(), 'X-Idempotency-Key': idempotencyKey, 'Content-Type': 'multipart/form-data' }, timeout: 30_000,
  })).data;
}
export async function getTryOnJob(jobId: string, accessToken?: string): Promise<VirtualTryOnJob> {
  return (await apiClient.get<VirtualTryOnJob>(`/virtual-try-on/jobs/${jobId}`, { headers: headers(accessToken), timeout: 15_000 })).data;
}
export async function cancelTryOnJob(jobId: string, accessToken?: string): Promise<VirtualTryOnJob> {
  return (await apiClient.post<VirtualTryOnJob>(`/virtual-try-on/jobs/${jobId}/cancel`, undefined, { headers: headers(accessToken), timeout: 15_000 })).data;
}
export async function submitTryOnFeedback(jobId: string, feedback: 'helpful' | 'not_helpful', accessToken?: string): Promise<VirtualTryOnJob> {
  return (await apiClient.put<VirtualTryOnJob>(`/virtual-try-on/jobs/${jobId}/feedback`, { feedback }, { headers: headers(accessToken) })).data;
}
export function resultFromJob(job: VirtualTryOnJob): VirtualTryOnResult | null {
  if (job.status !== 'completed' || !job.resultImage) return null;
  return { id: job.id, productId: job.productId, productName: job.productName, productImage: job.productImage,
    resultImage: job.resultImage, colour: job.colour, createdAt: job.createdAt, isDemo: false,
    ...(job.feedbackGiven ? { feedbackGiven: job.feedbackGiven } : {}) };
}
export const vtoProcessingMessages = ['Securing your photo', 'Creating your Pixelcut preview', 'Finishing your preview'];
