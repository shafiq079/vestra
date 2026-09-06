export const LOW_STOCK_THRESHOLD = 5;

/** Product status is based on aggregate remaining variant units after checkout. */
export function deriveStockStatus(stocks: readonly number[]): 'in_stock' | 'low_stock' | 'out_of_stock' {
  const remaining = stocks.reduce((total, stock) => total + stock, 0);
  if (remaining === 0) return 'out_of_stock';
  return remaining <= LOW_STOCK_THRESHOLD ? 'low_stock' : 'in_stock';
}
