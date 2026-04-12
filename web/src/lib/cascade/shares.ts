export const SHARE_MINOR_SCALE = 10_000;

export function shareMinorToQuantity(amount: number): number {
  return amount / SHARE_MINOR_SCALE;
}

export function quantityToShareMinor(quantity: number): number {
  return Math.round(quantity * SHARE_MINOR_SCALE);
}
