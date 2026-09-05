export interface PromoResult { valid: boolean; discount: number; message: string }
interface PromoRule { percentage: number; minimumSpend: number; active: boolean }
const rules: Readonly<Record<string, PromoRule>> = Object.freeze({
  VESTRA10: { percentage: 10, minimumSpend: 0, active: true },
  AUTUMN15: { percentage: 15, minimumSpend: 200, active: true },
  WELCOME: { percentage: 20, minimumSpend: 0, active: false },
});

export function evaluatePromo(code: string | undefined, subtotal: number): PromoResult {
  const rule = code ? rules[code] : undefined;
  if (!rule || !rule.active) return { valid: false, discount: 0, message: 'Invalid or expired promo code' };
  if (subtotal < rule.minimumSpend) return { valid: false, discount: 0, message: `A minimum spend of £${rule.minimumSpend.toFixed(2)} is required` };
  return { valid: true, discount: Number((subtotal * rule.percentage / 100).toFixed(2)), message: 'Promo code applied' };
}
