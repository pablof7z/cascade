export type ProductTradeSide = 'long' | 'short';

export function normalizeProductTradeSide(
  value: string | null | undefined,
  fallback: ProductTradeSide
): ProductTradeSide {
  if (value === 'long' || value === 'yes') return 'long';
  if (value === 'short' || value === 'no') return 'short';
  return fallback;
}
