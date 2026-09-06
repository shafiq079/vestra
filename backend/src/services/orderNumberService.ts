import { randomBytes } from 'node:crypto';

/** Generates a non-sequential, human-readable order number; uniqueness is enforced by MongoDB. */
export function generateOrderNumber(now = new Date()): string {
  return `VST-${now.getUTCFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;
}
