import { getProductApiUrl } from '$lib/cascade/config';

type ApiErrorPayload = {
  error?: string;
};

export type ProductWalletPosition = {
  market_event_id: string;
  market_slug: string;
  market_title: string;
  direction: string;
  quantity: number;
  cost_basis_minor: number;
  current_price_ppm: number;
  market_value_minor: number;
  unrealized_pnl_minor: number;
};

export type ProductProof = {
  id: string;
  amount: number;
  secret: string;
  C: string;
  witness?: string | null;
  dleq?: {
    e: string;
    s: string;
    r: string;
  } | null;
};

export type ProductFundingEvent = {
  id: string;
  rail: string;
  amount_minor: number;
  status: string;
  risk_level?: string | null;
  created_at: number;
};

export type ProductFxObservation = {
  source: string;
  btc_usd_price: number;
  observed_at: number;
};

export type ProductWalletTopup = {
  id: string;
  rail: string;
  amount_minor: number;
  amount_msat?: number | null;
  status: string;
  invoice?: string | null;
  payment_hash?: string | null;
  checkout_url?: string | null;
  checkout_session_id?: string | null;
  checkout_expires_at?: number | null;
  fx_source?: string | null;
  btc_usd_price?: number | null;
  spread_bps?: number | null;
  fx_quote_id?: string | null;
  observations: ProductFxObservation[];
  risk_level?: string | null;
  issued_proofs?: ProductProof[] | null;
  created_at: number;
  expires_at: number;
};

export type ProductWalletTopupRequestStatus = {
  request_id: string;
  rail: string;
  amount_minor: number;
  status: string;
  error?: string | null;
  topup?: ProductWalletTopup | null;
};

export type ProductWallet = {
  pubkey: string;
  available_minor: number;
  pending_minor: number;
  total_deposited_minor: number;
  positions: ProductWalletPosition[];
  pending_topups: ProductWalletTopup[];
  funding_events: ProductFundingEvent[];
};

export type ProductMarketSummary = {
  event_id: string;
  slug: string;
  title: string;
  description: string;
  creator_pubkey: string;
  visibility: string;
  created_at: number;
  first_trade_at: number | null;
  price_yes_ppm: number;
  price_no_ppm: number;
  volume_minor: number;
  trade_count: number;
  reserve_minor: number;
  raw_event: unknown;
};

export type ProductTradeEvent = {
  id?: string;
  kind?: number;
  pubkey?: string;
  created_at?: number;
  content?: string;
  tags?: string[][];
  [key: string]: unknown;
};

export type ProductTradeSettlement = {
  id: string;
  trade_id: string;
  quote_id?: string | null;
  rail: string;
  mode: string;
  side: string;
  trade_type: string;
  settlement_minor: number;
  settlement_msat: number;
  settlement_fee_msat: number;
  fx_quote_id?: string | null;
  invoice?: string | null;
  payment_hash?: string | null;
  status: string;
  metadata?: Record<string, unknown> | null;
  created_at: number;
  settled_at?: number | null;
  completed_at?: number | null;
};

export type ProductTradeProofBundle = {
  unit: string;
  proofs: ProductProof[];
};

export type ProductTradeExecution = {
  wallet: ProductWallet;
  market: ProductMarketSummary;
  trade: ProductTradeEvent;
  settlement?: ProductTradeSettlement | null;
  issued?: ProductTradeProofBundle | null;
  change?: ProductTradeProofBundle | null;
};

export type ProductTradeQuote = {
  quote_id?: string | null;
  market_event_id: string;
  trade_type: string;
  side: string;
  fx_quote_id?: string | null;
  quantity: number;
  quantity_minor: number;
  spend_minor: number;
  fee_minor: number;
  net_minor: number;
  settlement_minor: number;
  settlement_msat: number;
  settlement_fee_msat: number;
  average_price_ppm: number;
  marginal_price_before_ppm: number;
  marginal_price_after_ppm: number;
  current_price_yes_ppm: number;
  current_price_no_ppm: number;
  fx_source?: string | null;
  btc_usd_price?: number | null;
  spread_bps?: number | null;
  fx_observations: ProductFxObservation[];
  created_at?: number | null;
  expires_at?: number | null;
  status?: string | null;
  trade_id?: string | null;
};

export type ProductTradeStatus = {
  market: ProductMarketSummary;
  trade: ProductTradeEvent;
  settlement?: ProductTradeSettlement | null;
};

export type ProductMarketDetail = {
  market: ProductMarketSummary;
  trades: ProductTradeEvent[];
};

export type ProductTradeRequestStatus = {
  request_id: string;
  status: string;
  error?: string | null;
  market?: ProductMarketSummary | null;
  trade?: ProductTradeEvent | null;
};

async function parseApiError(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
  return payload?.error || fallback;
}

export async function buyMarketPosition(input: {
  eventId: string;
  pubkey: string;
  side: 'yes' | 'no';
  spendMinor: number;
  proofs: ProductProof[];
  quoteId?: string;
  requestId?: string;
}): Promise<Response> {
  return fetch(`${getProductApiUrl()}/api/trades/buy`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      event_id: input.eventId,
      pubkey: input.pubkey,
      side: input.side,
      spend_minor: input.spendMinor,
      proofs: input.proofs,
      quote_id: input.quoteId,
      request_id: input.requestId
    })
  });
}

export async function sellMarketPosition(input: {
  eventId: string;
  pubkey: string;
  side: 'yes' | 'no';
  quantity: number;
  proofs: ProductProof[];
  quoteId?: string;
  requestId?: string;
}): Promise<Response> {
  return fetch(`${getProductApiUrl()}/api/trades/sell`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      event_id: input.eventId,
      pubkey: input.pubkey,
      side: input.side,
      quantity: input.quantity,
      proofs: input.proofs,
      quote_id: input.quoteId,
      request_id: input.requestId
    })
  });
}

export async function quoteBuyTrade(input: {
  eventId: string;
  side: 'yes' | 'no';
  spendMinor: number;
}): Promise<Response> {
  return fetch(`${getProductApiUrl()}/api/trades/quote`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      event_id: input.eventId,
      side: input.side,
      spend_minor: input.spendMinor
    })
  });
}

export async function quoteSellTrade(input: {
  eventId: string;
  side: 'yes' | 'no';
  quantity: number;
}): Promise<Response> {
  return fetch(`${getProductApiUrl()}/api/trades/sell/quote`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      event_id: input.eventId,
      side: input.side,
      quantity: input.quantity
    })
  });
}

export async function fetchTradeQuoteStatus(quoteId: string): Promise<Response> {
  return fetch(`${getProductApiUrl()}/api/trades/quotes/${quoteId}`);
}

export async function fetchPortfolioMirror(pubkey: string): Promise<Response> {
  const portfolioResponse = await fetch(`${getProductApiUrl()}/api/product/portfolio/${pubkey}`);
  if (portfolioResponse.status !== 404) {
    return portfolioResponse;
  }

  return fetch(`${getProductApiUrl()}/api/product/wallet/${pubkey}`);
}

export async function fetchMarketDetailBySlug(slug: string): Promise<Response> {
  return fetch(`${getProductApiUrl()}/api/product/markets/slug/${encodeURIComponent(slug)}`);
}

export async function createLightningTopupQuote(input: {
  pubkey: string;
  amountMinor: number;
  requestId?: string;
}): Promise<Response> {
  return fetch(`${getProductApiUrl()}/api/wallet/topups/lightning/quote`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      pubkey: input.pubkey,
      amount_minor: input.amountMinor,
      request_id: input.requestId
    })
  });
}

export async function createStripeTopup(input: {
  pubkey: string;
  amountMinor: number;
  requestId?: string;
}): Promise<Response> {
  return fetch(`${getProductApiUrl()}/api/wallet/topups/stripe`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      pubkey: input.pubkey,
      amount_minor: input.amountMinor,
      request_id: input.requestId
    })
  });
}

export async function fetchWalletTopupRequestStatus(requestId: string): Promise<Response> {
  return fetch(`${getProductApiUrl()}/api/wallet/topups/requests/${requestId}`);
}

export async function fetchWalletTopupStatus(topupId: string): Promise<Response> {
  return fetch(`${getProductApiUrl()}/api/wallet/topups/${topupId}`);
}

export async function fetchTradeStatus(tradeId: string): Promise<Response> {
  return fetch(`${getProductApiUrl()}/api/trades/${tradeId}`);
}

export async function fetchTradeRequestStatus(requestId: string): Promise<Response> {
  return fetch(`${getProductApiUrl()}/api/trades/requests/${requestId}`);
}

export function hasCompletedTradeSettlement(
  value:
    | {
        settlement?: ProductTradeSettlement | null;
      }
    | null
    | undefined
): boolean {
  return value?.settlement?.status === 'complete';
}

function isProductProofBundle(value: unknown): value is ProductTradeProofBundle {
  if (!value || typeof value !== 'object') return false;
  const bundle = value as { unit?: unknown; proofs?: unknown };
  return (
    typeof bundle.unit === 'string' &&
    Array.isArray(bundle.proofs) &&
    bundle.proofs.every(
      (proof) =>
        proof &&
        typeof proof === 'object' &&
        typeof (proof as { id?: unknown }).id === 'string' &&
        typeof (proof as { secret?: unknown }).secret === 'string' &&
        typeof (proof as { C?: unknown }).C === 'string' &&
        typeof (proof as { amount?: unknown }).amount === 'number'
    )
  );
}

export function extractTradeProofBundles(value: {
  settlement?: ProductTradeSettlement | null;
  issued?: ProductTradeProofBundle | null;
  change?: ProductTradeProofBundle | null;
}): {
  issued: ProductTradeProofBundle | null;
  change: ProductTradeProofBundle | null;
} {
  const directIssued = value.issued && isProductProofBundle(value.issued) ? value.issued : null;
  const directChange = value.change && isProductProofBundle(value.change) ? value.change : null;
  if (directIssued || directChange) {
    return {
      issued: directIssued,
      change: directChange
    };
  }

  const metadata = value.settlement?.metadata;
  return {
    issued: isProductProofBundle(metadata?.issued) ? metadata.issued : null,
    change: isProductProofBundle(metadata?.change) ? metadata.change : null
  };
}

export async function parseJson<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) {
    throw new Error(await parseApiError(response, fallback));
  }

  return (await response.json()) as T;
}

export async function expectOk(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  throw new Error(await parseApiError(response, fallback));
}
