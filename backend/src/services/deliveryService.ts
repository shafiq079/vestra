import { HttpError } from '../utils/httpError';

export const FREE_DELIVERY_THRESHOLD = 75;

export interface CanonicalDeliveryOption {
  id: string;
  name: string;
  description: string;
  price: number;
  estimatedDays: string;
  maximumWorkingDays: number;
}

const options: Readonly<Record<string, CanonicalDeliveryOption>> = Object.freeze({
  del1: { id: 'del1', name: 'Standard Delivery', description: '3-5 working days', price: 0, estimatedDays: '3-5 working days', maximumWorkingDays: 5 },
  del2: { id: 'del2', name: 'Express Delivery', description: '1-2 working days', price: 7.95, estimatedDays: '1-2 working days', maximumWorkingDays: 2 },
  del3: { id: 'del3', name: 'Next Day Delivery', description: 'Next working day', price: 12.95, estimatedDays: 'Next working day', maximumWorkingDays: 1 },
});

export function resolveDeliveryOption(id: string): CanonicalDeliveryOption {
  const option = options[id];
  if (!option) throw HttpError.badRequest('Invalid delivery option.');
  return option;
}

export const deliveryCost = (option: CanonicalDeliveryOption, subtotal: number) =>
  subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : option.price;

/** Adds working days (Monday-Friday), making checkout delivery estimates deterministic. */
export function estimatedDelivery(option: CanonicalDeliveryOption, now = new Date()): string {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  let remaining = option.maximumWorkingDays;
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) remaining -= 1;
  }
  return date.toISOString().slice(0, 10);
}
