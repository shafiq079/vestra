import { evaluatePromo, type PromoResult } from './promoService';

export interface PricedCartLine { price: number; quantity: number }
export interface CartTotals {
  subtotal: number;
  discount: number;
  estimatedTotal: number;
  promo: PromoResult;
}
export type PromoEvaluator = (code: string | undefined, subtotal: number) => PromoResult;

const money = (value: number) => Number(value.toFixed(2));

/** Pure calculation shared by persisted cart recalculation and focused unit tests. */
export function calculateCartTotals(
  lines: readonly PricedCartLine[],
  promoCode?: string,
  promoEvaluator: PromoEvaluator = evaluatePromo,
): CartTotals {
  const subtotal = money(lines.reduce((total, line) => total + line.price * line.quantity, 0));
  const promo = promoEvaluator(promoCode, subtotal);
  const discount = promo.valid ? money(promo.discount) : 0;
  return { subtotal, discount, estimatedTotal: money(Math.max(0, subtotal - discount)), promo };
}
