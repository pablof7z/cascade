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

export type ProductFundingEvent = {
  id: string;
  rail: string;
  amount_minor: number;
  status: string;
  risk_level?: string | null;
  created_at: number;
};

export type ProductWalletTopup = {
  id: string;
  rail: string;
  amount_minor: number;
  amount_msat: number;
  status: string;
  invoice?: string | null;
  payment_hash?: string | null;
  fx_source: string;
  btc_usd_price: number;
  spread_bps: number;
  created_at: number;
  expires_at: number;
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

export type ProductTradeExecution = {
  wallet: ProductWallet;
  market: ProductMarketSummary;
  trade: ProductTradeEvent;
};

export type ProductTradeStatus = {
  market: ProductMarketSummary;
  trade: ProductTradeEvent;
};

export type ProductWalletTopupExecution = {
  topup: ProductWalletTopup;
  wallet: ProductWallet;
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
}): Promise<Response> {
  return fetch(`${getProductApiUrl()}/api/trades/buy`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      event_id: input.eventId,
      pubkey: input.pubkey,
      side: input.side,
      spend_minor: input.spendMinor
    })
  });
}

export async function sellMarketPosition(input: {
  eventId: string;
  pubkey: string;
  side: 'yes' | 'no';
  quantity: number;
}): Promise<Response> {
  return fetch(`${getProductApiUrl()}/api/trades/sell`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      event_id: input.eventId,
      pubkey: input.pubkey,
      side: input.side,
      quantity: input.quantity
    })
  });
}

export async function fetchPaperWallet(pubkey: string): Promise<Response> {
  return fetch(`${getProductApiUrl()}/api/product/wallet/${pubkey}`);
}

export async function createLightningTopupQuote(input: {
  pubkey: string;
  amountMinor: number;
}): Promise<Response> {
  return fetch(`${getProductApiUrl()}/api/wallet/topups/lightning/quote`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      pubkey: input.pubkey,
      amount_minor: input.amountMinor
    })
  });
}

export async function fetchWalletTopupStatus(topupId: string): Promise<Response> {
  return fetch(`${getProductApiUrl()}/api/wallet/topups/${topupId}`);
}

export async function settleLightningTopupQuote(topupId: string): Promise<Response> {
  return fetch(`${getProductApiUrl()}/api/wallet/topups/lightning/${topupId}/settle`, {
    method: 'POST'
  });
}

export async function fetchTradeStatus(tradeId: string): Promise<Response> {
  return fetch(`${getProductApiUrl()}/api/trades/${tradeId}`);
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
