export type WalletInputType = 'bolt11' | 'lightning_address' | 'lnurl' | 'invalid';

export function detectInputType(input: string): WalletInputType {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();

  if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed)) {
    return 'lightning_address';
  }

  if (
    lower.startsWith('lnbc') ||
    lower.startsWith('lntbs') ||
    lower.startsWith('lntb') ||
    lower.startsWith('lnbcrt')
  ) {
    return 'bolt11';
  }

  if (lower.startsWith('lnurl1')) {
    return 'lnurl';
  }

  return 'invalid';
}

export function extractAmountFromBolt11(invoice: string): number | null {
  const match = invoice
    .trim()
    .toLowerCase()
    .match(/^ln(?:bc|tbs|tb|bcrt)(\d+)([munp])?1[ac-hj-np-z02-9]/);

  if (!match) return null;

  const num = Number.parseInt(match[1], 10);
  const suffix = match[2];
  const multipliers: Record<string, number> = {
    m: 0.001,
    u: 0.000001,
    n: 0.000000001,
    p: 0.000000000001
  };

  const multiplier = suffix ? multipliers[suffix] : 1;
  if (multiplier === undefined) return null;
  if (suffix === 'p' && num % 10000 !== 0) return null;

  const sats = Math.floor(num * multiplier * 1e8);
  return sats > 0 ? sats : null;
}

export async function resolveLightningAddress(
  address: string,
  amountMsats: number
): Promise<string> {
  const parts = address.trim().split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error('Invalid Lightning address.');
  }

  const [user, domain] = parts;
  const metaResponse = await fetch(`https://${domain}/.well-known/lnurlp/${user}`);
  if (!metaResponse.ok) {
    throw new Error('Lightning address unreachable.');
  }

  const metadata = (await metaResponse.json()) as {
    callback?: string;
    minSendable?: number;
    maxSendable?: number;
    tag?: string;
    status?: string;
    reason?: string;
  };

  if (metadata.status === 'ERROR') {
    throw new Error(metadata.reason || 'Lightning address rejected the request.');
  }

  if (!metadata.callback || metadata.tag !== 'payRequest') {
    throw new Error('Invalid Lightning address response.');
  }

  if (
    metadata.minSendable === undefined ||
    metadata.maxSendable === undefined ||
    amountMsats < metadata.minSendable ||
    amountMsats > metadata.maxSendable
  ) {
    throw new Error('Requested amount is outside the allowed range.');
  }

  const callbackUrl = new URL(metadata.callback);
  callbackUrl.searchParams.set('amount', String(amountMsats));

  const invoiceResponse = await fetch(callbackUrl.toString());
  if (!invoiceResponse.ok) {
    throw new Error('Failed to fetch invoice from Lightning address.');
  }

  const invoiceData = (await invoiceResponse.json()) as { pr?: string; reason?: string };
  if (!invoiceData.pr) {
    throw new Error(invoiceData.reason || 'Lightning address did not return an invoice.');
  }

  const expectedSats = amountMsats / 1000;
  const invoiceSats = extractAmountFromBolt11(invoiceData.pr);
  if (invoiceSats === null || invoiceSats !== expectedSats) {
    throw new Error('Returned invoice amount does not match the requested amount.');
  }

  return invoiceData.pr;
}

export async function estimateMeltFee(amountSats: number): Promise<{ fee: number; total: number }> {
  const fee = Math.max(1, Math.round(amountSats * 0.005));
  return { fee, total: amountSats + fee };
}
