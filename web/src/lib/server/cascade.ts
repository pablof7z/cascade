import type { NDKFilter, NDKKind, NostrEvent } from '@nostr-dev-kit/ndk';
import {
  buildTradeSummary,
  parseDiscussionEvent,
  parseMarketEvent,
  parsePositionEvent,
  parseTradeEvent,
  type DiscussionRecord,
  type MarketRecord,
  type MarketTradeSummary,
  type PositionRecord,
  type TradeRecord
} from '../ndk/cascade.ts';

const MARKET_CACHE_TTL_MS = 60_000;
const DISCUSSION_CACHE_TTL_MS = 30_000;
const RELAY_FETCH_TIMEOUT_MS = 2_500;

let marketCache: MarketRecord[] = [];
let marketCacheUpdatedAt = 0;
let marketRefresh: Promise<void> | undefined;
let tradeCache: TradeRecord[] = [];
let tradeCacheUpdatedAt = 0;
let tradeRefresh: Promise<void> | undefined;

let discussionCache: DiscussionRecord[] = [];
let discussionCacheUpdatedAt = 0;
let discussionRefresh: Promise<void> | undefined;

type MarketDetailPayload = { market?: { raw_event?: NostrEvent } };

type FetchMarketBySlugDeps = {
  fetchProductJson?: typeof fetchProductJson;
  fetchRelayMarketBySlug?: typeof fetchRelayMarketBySlug;
};

export async function fetchRecentMarkets(limit = 80): Promise<MarketRecord[]> {
  const stale = Date.now() - marketCacheUpdatedAt > MARKET_CACHE_TTL_MS;
  const underfilled = marketCache.length < limit;

  if (stale || underfilled) {
    const refresh = refreshProductFeed(Math.max(limit, 80));
    if (marketCache.length === 0 || underfilled) {
      await refresh;
    }
  }

  return marketCache.slice(0, limit);
}

export async function fetchMarketBySlug(
  slug: string,
  deps: FetchMarketBySlugDeps = {}
): Promise<MarketRecord | null> {
  const payload = await (deps.fetchProductJson ?? fetchProductJson)<MarketDetailPayload>(
    `/api/product/markets/slug/${encodeURIComponent(slug)}`
  );
  const marketFromDetail = payload?.market?.raw_event ? parseMarketEvent(payload.market.raw_event) : null;
  if (marketFromDetail) return marketFromDetail;

  const rawMarket = await (deps.fetchRelayMarketBySlug ?? fetchRelayMarketBySlug)(slug);
  const marketFromRelay = rawMarket ? parseMarketEvent(rawMarket) : null;
  return marketFromRelay?.slug === slug ? marketFromRelay : null;
}

export async function fetchMarketsByAuthor(pubkey: string, limit = 48): Promise<MarketRecord[]> {
  const ndk = await getServerNdkClient();
  const events = await withRelayEventTimeout(
    ndk.fetchEvents(
      {
        kinds: [982 as NDKKind],
        authors: [pubkey],
        limit
      } satisfies NDKFilter,
      { closeOnEose: true }
    ),
    `fetchMarketsByAuthor(${pubkey})`
  );

  return Array.from(events)
    .map((event) => parseMarketEvent(event.rawEvent()))
    .filter((market): market is MarketRecord => Boolean(market))
    .filter((market) => market.pubkey === pubkey)
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, limit);
}

export async function fetchRecentDiscussions(limit = 80): Promise<DiscussionRecord[]> {
  const stale = Date.now() - discussionCacheUpdatedAt > DISCUSSION_CACHE_TTL_MS;
  const underfilled = discussionCache.length < limit;

  if (stale || underfilled) {
    const refresh = refreshRecentDiscussions(Math.max(limit, 80));
    if (discussionCache.length === 0 || underfilled) {
      await refresh;
    }
  }

  return discussionCache.slice(0, limit);
}

export async function fetchMarketDiscussions(marketId: string, limit = 200): Promise<DiscussionRecord[]> {
  const ndk = await getServerNdkClient();
  const events = await withRelayEventTimeout(
    ndk.fetchEvents(
      {
        kinds: [1111 as NDKKind],
        '#e': [marketId],
        limit
      } satisfies NDKFilter,
      { closeOnEose: true }
    ),
    `fetchMarketDiscussions(${marketId})`
  );

  return Array.from(events)
    .map(parseDiscussionEvent)
    .filter((record): record is DiscussionRecord => Boolean(record))
    .filter((record) => record.marketId === marketId)
    .sort((left, right) => right.createdAt - left.createdAt);
}

export async function fetchRecentTrades(limit = 200): Promise<TradeRecord[]> {
  const stale = Date.now() - tradeCacheUpdatedAt > MARKET_CACHE_TTL_MS;
  const underfilled = tradeCache.length < limit;

  if (stale || underfilled) {
    const refresh = refreshProductFeed(Math.max(Math.ceil(limit / 4), 80));
    if (tradeCache.length === 0 || underfilled) {
      await refresh;
    }
  }

  return tradeCache.slice(0, limit);
}

export async function fetchMarketTrades(market: MarketRecord, limit = 200): Promise<TradeRecord[]> {
  const payload = await fetchProductJson<{ trades?: NostrEvent[] }>(
    `/api/product/markets/slug/${encodeURIComponent(market.slug)}`
  );
  return (payload?.trades ?? [])
    .map(parseTradeEvent)
    .filter((trade): trade is TradeRecord => Boolean(trade))
    .slice(0, limit);
}

export async function fetchPositionsByPubkey(pubkey: string, limit = 120): Promise<PositionRecord[]> {
  const ndk = await getServerNdkClient();
  const events = await ndk.fetchEvents(
    {
      kinds: [30078 as NDKKind],
      authors: [pubkey],
      limit
    } satisfies NDKFilter,
    { closeOnEose: true }
  );

  return Array.from(events)
    .map(parsePositionEvent)
    .filter((position): position is PositionRecord => Boolean(position))
    .sort((left, right) => right.createdAt - left.createdAt);
}

export async function fetchProfileContext(identifier: string) {
  return (await import('./nostr.ts')).fetchUserWithProfile(identifier);
}

export async function fetchProfilesForPubkeys(pubkeys: readonly string[]) {
  try {
    return await (await import('./nostr.ts')).fetchProfilesByPubkeys(pubkeys);
  } catch (error) {
    console.warn('fetchProfilesForPubkeys failed', error);
    return {};
  }
}

export function groupTradesByMarket(trades: TradeRecord[]): Map<string, TradeRecord[]> {
  const map = new Map<string, TradeRecord[]>();
  for (const trade of trades) {
    const existing = map.get(trade.marketId);
    if (existing) {
      existing.push(trade);
    } else {
      map.set(trade.marketId, [trade]);
    }
  }
  return map;
}

export function summarizeTradesByMarket(trades: TradeRecord[]): Map<string, MarketTradeSummary> {
  const grouped = groupTradesByMarket(trades);
  const summaries = new Map<string, MarketTradeSummary>();

  for (const [marketId, marketTrades] of grouped) {
    summaries.set(marketId, buildTradeSummary(marketTrades));
  }

  return summaries;
}

async function refreshProductFeed(limit: number): Promise<void> {
  if (marketRefresh || tradeRefresh) return Promise.all([marketRefresh, tradeRefresh].filter(Boolean) as Promise<void>[])
      .then(() => undefined);

  const refresh = (async () => {
    const payload = await fetchProductJson<{ markets?: NostrEvent[]; trades?: NostrEvent[] }>(
      `/api/product/feed?market_limit=${Math.max(limit, 80)}&trade_limit=${Math.max(limit * 4, 240)}`
    );

    const nextMarkets = (payload?.markets ?? [])
      .map(parseMarketEvent)
      .filter((market): market is MarketRecord => Boolean(market))
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, limit);

    const nextTrades = (payload?.trades ?? [])
      .map(parseTradeEvent)
      .filter((trade): trade is TradeRecord => Boolean(trade))
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, Math.max(limit * 4, 240));

    marketCache = nextMarkets;
    tradeCache = nextTrades;
    marketCacheUpdatedAt = Date.now();
    tradeCacheUpdatedAt = Date.now();
  })();

  marketRefresh = refresh.finally(() => {
    marketRefresh = undefined;
  });
  tradeRefresh = refresh.finally(() => {
    tradeRefresh = undefined;
  });

  await refresh;
}

async function refreshRecentDiscussions(limit: number): Promise<void> {
  if (discussionRefresh) return discussionRefresh;

  discussionRefresh = (async () => {
    const ndk = await getServerNdkClient();
    const events = await withRelayEventTimeout(
      ndk.fetchEvents(
        {
          kinds: [1111 as NDKKind],
          limit
        } satisfies NDKFilter,
        { closeOnEose: true }
      ),
      `refreshRecentDiscussions(${limit})`
    );

    const next = Array.from(events)
      .map(parseDiscussionEvent)
      .filter((record): record is DiscussionRecord => Boolean(record))
      .sort((left, right) => right.createdAt - left.createdAt);

    if (next.length > 0 || discussionCache.length === 0) {
      discussionCache = next;
      discussionCacheUpdatedAt = Date.now();
    }
  })().finally(() => {
    discussionRefresh = undefined;
  });

  return discussionRefresh;
}

async function fetchRelayMarketBySlug(slug: string): Promise<NostrEvent | null> {
  const ndk = await getServerNdkClient();
  const directMatch = await withRelayEventTimeout(
    ndk.fetchEvents(
      {
        kinds: [982 as NDKKind],
        '#d': [slug],
        limit: 12
      } satisfies NDKFilter,
      { closeOnEose: true }
    ),
    `fetchRelayMarketBySlug:direct(${slug})`
  );

  const matchedDirectEvent = Array.from(directMatch)
    .map((event) => event.rawEvent() as NostrEvent)
    .find((event) => parseMarketEvent(event)?.slug === slug);
  if (matchedDirectEvent) return matchedDirectEvent;

  const recentEvents = await withRelayEventTimeout(
    ndk.fetchEvents(
      {
        kinds: [982 as NDKKind],
        limit: 120
      } satisfies NDKFilter,
      { closeOnEose: true }
    ),
    `fetchRelayMarketBySlug:recent(${slug})`
  );

  return (
    Array.from(recentEvents)
      .map((event) => event.rawEvent() as NostrEvent)
      .find((event) => parseMarketEvent(event)?.slug === slug) ?? null
  );
}

async function fetchProductJson<T>(path: string): Promise<T | null> {
  const response = await fetch(`${await getProductApiBaseUrl()}${path}`);
  if (!response.ok) return null;
  return (await response.json()) as T;
}

async function getProductApiBaseUrl(): Promise<string> {
  return (await import('../cascade/config.ts')).getProductApiUrl();
}

async function getServerNdkClient() {
  return (await import('./nostr.ts')).getServerNdk();
}

function withRelayEventTimeout<T>(
  promise: Promise<T>,
  label: string,
  timeoutMs = RELAY_FETCH_TIMEOUT_MS
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      timeoutHandle = setTimeout(() => {
        console.warn(`${label} timed out after ${timeoutMs}ms`);
        resolve(new Set() as T);
      }, timeoutMs);
    })
  ]).finally(() => {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  });
}
