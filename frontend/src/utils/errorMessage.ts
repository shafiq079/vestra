import type { ApiError } from '@/types';

export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as ApiError).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}
