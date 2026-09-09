import { describe, expect, it } from 'vitest';
import { calculateCartTotals, type PromoEvaluator } from '../src/services/cartTotals';

describe('cart totals calculation', () => {
  it('returns zero totals for an empty cart without a promo', () => {
    expect(calculateCartTotals([])).toMatchObject({ subtotal: 0, discount: 0, estimatedTotal: 0 });
  });

  it('sums multiple lines without a promo', () => {
    expect(calculateCartTotals([{ price: 25, quantity: 2 }, { price: 12.5, quantity: 3 }]))
      .toMatchObject({ subtotal: 87.5, discount: 0, estimatedTotal: 87.5 });
  });

  it('rounds decimal money values to currency precision', () => {
    expect(calculateCartTotals([{ price: 19.999, quantity: 1 }, { price: 0.1, quantity: 3 }]))
      .toMatchObject({ subtotal: 20.3, discount: 0, estimatedTotal: 20.3 });
  });

  it('calculates the currency discount for a valid percentage promo', () => {
    expect(calculateCartTotals([{ price: 99.99, quantity: 1 }], 'VESTRA10'))
      .toMatchObject({ subtotal: 99.99, discount: 10, estimatedTotal: 89.99,
        promo: { valid: true } });
  });

  it('does not discount a cart below the promo minimum spend', () => {
    expect(calculateCartTotals([{ price: 199.99, quantity: 1 }], 'AUTUMN15'))
      .toMatchObject({ subtotal: 199.99, discount: 0, estimatedTotal: 199.99,
        promo: { valid: false } });
  });

  it('never permits estimatedTotal to fall below zero', () => {
    const excessiveDiscount: PromoEvaluator = () => ({ valid: true, discount: 500, message: 'Test promotion' });
    expect(calculateCartTotals([{ price: 20, quantity: 1 }], 'TEST', excessiveDiscount))
      .toMatchObject({ subtotal: 20, discount: 500, estimatedTotal: 0 });
  });
});
