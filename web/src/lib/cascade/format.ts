import { isPaperEdition } from '$lib/cascade/config';

const USD_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const INT_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0
});

export function formatUsdMinor(value: number | null | undefined): string {
  const amount = Math.max(0, value ?? 0);
  return USD_FORMATTER.format(amount / 100);
}

export function formatProductAmount(
  value: number | null | undefined,
  unit: string | null | undefined = null
): string {
  if (unit?.toLowerCase() === 'usd' || isPaperEdition()) {
    return formatUsdMinor(value);
  }

  const amount = value ?? 0;
  if (!amount || Number.isNaN(amount)) return '0';
  return INT_FORMATTER.format(amount);
}

export function productUnitLabel(unit: string | null | undefined = null): string {
  if (unit?.toLowerCase() === 'usd' || isPaperEdition()) {
    return 'USD';
  }
  return 'sats';
}
