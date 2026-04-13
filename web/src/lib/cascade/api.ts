import { getCascadeEdition, getProductApiUrl } from '$lib/cascade/config';

type ApiErrorPayload = {
  error?: string;
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

export type ProductFxObservation = {
  source: string;
  btc_usd_price: number;
  observed_at: number;
};

export type ProductPortfolioFunding = {
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
  created_at: number;
  expires_at: number;
};

export type ProductPortfolioFundingRequestStatus = {
  request_id: string;
  rail: string;
  amount_minor: number;
  status: string;
  error?: string | null;
  funding?: ProductPortfolioFunding | null;
};

export type ProductRuntimeRail = {
  available: boolean;
  reason?: string | null;
};

export type ProductRuntime = {
  edition: 'mainnet' | 'signet' | string;
  network: string;
  mint_url: string;
  proof_custody: string;
  request_edition_header: string;
  funding: {
    lightning: ProductRuntimeRail;
    stripe: ProductRuntimeRail;
    usdc?: ProductRuntimeRail;
  };
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

export type BlindedMessageInput = {
  amount: number;
  id: string;
  b_: string;
};

export type TokenOutput = {
  amount: number;
  id: string;
  c_: string;
};

export type ProductTradeBlindSignatureBundle = {
  unit: string;
  signatures: TokenOutput[];
};

export type ProductTradeExecution = {
  market: ProductMarketSummary;
  trade: ProductTradeEvent;
  settlement?: ProductTradeSettlement | null;
  issued?: ProductTradeBlindSignatureBundle | null;
  change?: ProductTradeBlindSignatureBundle | null;
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

export type ProductFeed = {
  markets: Array<{
    raw_event?: ProductTradeEvent;
  } | ProductTradeEvent>;
  trades: ProductTradeEvent[];
  next_market_offset?: number | null;
  next_trade_offset?: number | null;
};

export type ProductActivityItem = {
  kind: 'market' | 'trade' | string;
  created_at: number;
  market: ProductMarketSummary;
  trade?: ProductTradeEvent | null;
};

export type ProductActivity = {
  items: ProductActivityItem[];
  next_offset?: number | null;
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

function productUrl(path: string): string {
  return `${getProductApiUrl()}${path}`;
}

function cascadeHeaders(headers?: HeadersInit): Headers {
  const merged = new Headers(headers);
  merged.set('x-cascade-edition', getCascadeEdition());
  return merged;
}

function productFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(productUrl(path), {
    ...init,
    cache: init?.cache ?? 'no-store',
    headers: cascadeHeaders(init?.headers)
  });
}

export async function buyMarketPosition(input: {
  eventId: string;
  pubkey: string;
  side: 'yes' | 'no';
  spendMinor: number;
  proofs: ProductProof[];
  issuedOutputs: BlindedMessageInput[];
  changeOutputs: BlindedMessageInput[];
  quoteId?: string;
  requestId?: string;
}): Promise<Response> {
  return productFetch('/api/trades/buy', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      event_id: input.eventId,
      pubkey: input.pubkey,
      side: input.side,
      spend_minor: input.spendMinor,
      proofs: input.proofs,
      issued_outputs: input.issuedOutputs,
      change_outputs: input.changeOutputs,
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
  issuedOutputs: BlindedMessageInput[];
  changeOutputs: BlindedMessageInput[];
  quoteId?: string;
  requestId?: string;
}): Promise<Response> {
  return productFetch('/api/trades/sell', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      event_id: input.eventId,
      pubkey: input.pubkey,
      side: input.side,
      quantity: input.quantity,
      proofs: input.proofs,
      issued_outputs: input.issuedOutputs,
      change_outputs: input.changeOutputs,
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
  return productFetch('/api/trades/quote', {
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
  return productFetch('/api/trades/sell/quote', {
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
  return productFetch(`/api/trades/quotes/${quoteId}`);
}

export async function fetchProductRuntime(): Promise<Response> {
  return productFetch('/api/product/runtime');
}

export async function fetchMarketDetailBySlug(slug: string): Promise<Response> {
  return productFetch(`/api/product/markets/slug/${encodeURIComponent(slug)}`);
}

export async function fetchCreatorMarkets(pubkey: string): Promise<Response> {
  return productFetch(`/api/product/markets/creator/${encodeURIComponent(pubkey)}`);
}

export async function fetchProductFeed(input?: {
  marketLimit?: number;
  marketOffset?: number;
  tradeLimit?: number;
  tradeOffset?: number;
}): Promise<Response> {
  const search = new URLSearchParams();
  if (typeof input?.marketLimit === 'number') search.set('market_limit', String(input.marketLimit));
  if (typeof input?.marketOffset === 'number') search.set('market_offset', String(input.marketOffset));
  if (typeof input?.tradeLimit === 'number') search.set('trade_limit', String(input.tradeLimit));
  if (typeof input?.tradeOffset === 'number') search.set('trade_offset', String(input.tradeOffset));

  const suffix = search.size ? `?${search.toString()}` : '';
  return productFetch(`/api/product/feed${suffix}`);
}

export async function createProductMarket(input: {
  eventId: string;
  title: string;
  description: string;
  slug: string;
  body: string;
  creatorPubkey: string;
  rawEvent: unknown;
  b?: number;
}): Promise<Response> {
  return productFetch('/api/product/markets', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      event_id: input.eventId,
      title: input.title,
      description: input.description,
      slug: input.slug,
      body: input.body,
      creator_pubkey: input.creatorPubkey,
      raw_event: input.rawEvent,
      b: input.b ?? 10
    })
  });
}

export async function createStripeFunding(input: {
  pubkey: string;
  amountMinor: number;
  requestId?: string;
}): Promise<Response> {
  return productFetch('/api/portfolio/funding/stripe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      pubkey: input.pubkey,
      amount_minor: input.amountMinor,
      request_id: input.requestId
    })
  });
}

export async function fetchPortfolioFundingRequestStatus(requestId: string): Promise<Response> {
  return productFetch(`/api/portfolio/funding/requests/${requestId}`);
}

export async function fetchPortfolioFundingStatus(fundingId: string): Promise<Response> {
  return productFetch(`/api/portfolio/funding/${fundingId}`);
}

export async function fetchTradeStatus(tradeId: string): Promise<Response> {
  return productFetch(`/api/trades/${tradeId}`);
}

export async function fetchTradeRequestStatus(requestId: string): Promise<Response> {
  return productFetch(`/api/trades/requests/${requestId}`);
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

function isBlindSignatureBundle(value: unknown): value is ProductTradeBlindSignatureBundle {
  if (!value || typeof value !== 'object') return false;
  const bundle = value as { unit?: unknown; signatures?: unknown };
  return (
    typeof bundle.unit === 'string' &&
    Array.isArray(bundle.signatures) &&
    bundle.signatures.every(
      (signature) =>
        signature &&
        typeof signature === 'object' &&
        typeof (signature as { id?: unknown }).id === 'string' &&
        typeof (signature as { c_?: unknown }).c_ === 'string' &&
        typeof (signature as { amount?: unknown }).amount === 'number'
    )
  );
}

export function extractTradeBlindSignatureBundles(value: {
  issued?: ProductTradeBlindSignatureBundle | null;
  change?: ProductTradeBlindSignatureBundle | null;
}): {
  issued: ProductTradeBlindSignatureBundle | null;
  change: ProductTradeBlindSignatureBundle | null;
} {
  return {
    issued: value.issued && isBlindSignatureBundle(value.issued) ? value.issued : null,
    change: value.change && isBlindSignatureBundle(value.change) ? value.change : null
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
