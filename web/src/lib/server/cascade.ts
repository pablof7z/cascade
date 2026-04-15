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
const DEFAULT_PRODUCT_API_URL = 'https://mint.f7z.io';

let marketCache: MarketRecord[] = [];
let marketCacheUpdatedAt = 0;
let marketRefresh: Promise<void> | undefined;
let tradeCache: TradeRecord[] = [];
let tradeCacheUpdatedAt = 0;
let tradeRefresh: Promise<void> | undefined;

let discussionCache: DiscussionRecord[] = [];
let discussionCacheUpdatedAt = 0;
let discussionRefresh: Promise<void> | undefined;

type FetchMarketBySlugDeps = {
  fetchProductMarketDetailBySlug?: typeof fetchProductMarketDetailBySlug;
  fetchRelayMarketBySlug?: typeof fetchRelayMarketBySlug;
  fetchRelayTradesForMarket?: typeof fetchRelayTradesForMarket;
};

type FetchSitemapMarketsDeps = {
  fetchRecentMarkets?: typeof fetchRecentMarkets;
  fetchRecentRelayMarkets?: typeof fetchRecentRelayMarkets;
};

export async function fetchRecentMarkets(limit = 80): Promise<MarketRecord[]> {
  const stale = Date.now() - marketCacheUpdatedAt > MARKET_CACHE_TTL_MS;
  const underfilled = marketCache.length < limit;

  if (stale || underfilled) {
    const refresh = refreshRelayDiscovery(Math.max(limit, 80));
    if (marketCache.length === 0 || underfilled) {
      await refresh;
    }
  }

  return marketCache.slice(0, limit);
}

export async function fetchSitemapMarkets(
  limit = 80,
  deps: FetchSitemapMarketsDeps = {}
): Promise<MarketRecord[]> {
  const markets = await (deps.fetchRecentMarkets ?? fetchRecentMarkets)(limit);
  if (markets.length > 0) return markets;

  console.warn(`fetchSitemapMarkets fell back to relays because product feed returned no markets`);
  return (deps.fetchRecentRelayMarkets ?? fetchRecentRelayMarkets)(limit);
}

export async function fetchMarketBySlug(
  slug: string,
  deps: FetchMarketBySlugDeps = {}
): Promise<MarketRecord | null> {
  const productMarket = await (deps.fetchProductMarketDetailBySlug ?? fetchProductMarketDetailBySlug)(
    slug
  );
  if (productMarket) {
    return withLatestPrice(productMarket.market, productMarket.trades);
  }

  const rawMarket = await (deps.fetchRelayMarketBySlug ?? fetchRelayMarketBySlug)(slug);
  const marketFromRelay = rawMarket ? parseMarketEvent(rawMarket) : null;
  if (!marketFromRelay || marketFromRelay.slug !== slug) return null;

  const trades = await (deps.fetchRelayTradesForMarket ?? fetchRelayTradesForMarket)(
    marketFromRelay.id,
    40
  );
  if (trades.length === 0) return null;
  return withLatestPrice(marketFromRelay, trades);
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

export async function fetchMarketsByIds(marketIds: readonly string[]): Promise<MarketRecord[]> {
  const ids = [...new Set(marketIds.filter(Boolean))];
  if (ids.length === 0) return [];

  const ndk = await getServerNdkClient();
  const events = await withRelayEventTimeout(
    ndk.fetchEvents(
      {
        kinds: [982 as NDKKind],
        ids,
        limit: ids.length
      } satisfies NDKFilter,
      { closeOnEose: true }
    ),
    `fetchMarketsByIds(${ids.length})`
  );

  return Array.from(events)
    .map((event) => parseMarketEvent(event.rawEvent()))
    .filter((market): market is MarketRecord => Boolean(market))
    .sort((left, right) => right.createdAt - left.createdAt);
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

export async function fetchDiscussionsByPubkey(pubkey: string, limit = 50): Promise<DiscussionRecord[]> {
  const ndk = await getServerNdkClient();
  const events = await withRelayEventTimeout(
    ndk.fetchEvents(
      {
        kinds: [1111 as NDKKind],
        authors: [pubkey],
        limit
      } satisfies NDKFilter,
      { closeOnEose: true }
    ),
    `fetchDiscussionsByPubkey(${pubkey})`
  );

  return Array.from(events)
    .map(parseDiscussionEvent)
    .filter((record): record is DiscussionRecord => Boolean(record))
    .filter((record) => record.pubkey === pubkey)
    .sort((left, right) => right.createdAt - left.createdAt);
}

export async function fetchRecentTrades(limit = 200): Promise<TradeRecord[]> {
  const stale = Date.now() - tradeCacheUpdatedAt > MARKET_CACHE_TTL_MS;
  const underfilled = tradeCache.length < limit;

  if (stale || underfilled) {
    const refresh = refreshRelayDiscovery(Math.max(Math.ceil(limit / 4), 80));
    if (tradeCache.length === 0 || underfilled) {
      await refresh;
    }
  }

  return tradeCache.slice(0, limit);
}

export async function fetchMarketTrades(market: MarketRecord, limit = 200): Promise<TradeRecord[]> {
  return fetchRelayTradesForMarket(market.id, limit);
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

function withLatestPrice(market: MarketRecord, trades: TradeRecord[]): MarketRecord {
  const summary = buildTradeSummary(trades);
  return {
    ...market,
    latestPricePpm: summary.latestPricePpm
  };
}

async function refreshRelayDiscovery(limit: number): Promise<void> {
  if (marketRefresh || tradeRefresh) return Promise.all([marketRefresh, tradeRefresh].filter(Boolean) as Promise<void>[])
      .then(() => undefined);

  const refresh = (async () => {
    const nextTrades = await fetchRecentRelayTrades(Math.max(limit * 4, 240));
    const marketIds = [...new Set(nextTrades.map((trade) => trade.marketId))];
    const tradeSummaries = summarizeTradesByMarket(nextTrades);
    const nextMarkets = (await fetchMarketsByIds(marketIds))
      .map((market) => ({
        ...market,
        latestPricePpm: tradeSummaries.get(market.id)?.latestPricePpm ?? market.latestPricePpm
      }))
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, limit);

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

async function fetchRecentRelayMarkets(limit: number): Promise<MarketRecord[]> {
  const ndk = await getServerNdkClient();
  const events = await withRelayEventTimeout(
    ndk.fetchEvents(
      {
        kinds: [982 as NDKKind],
        limit
      } satisfies NDKFilter,
      { closeOnEose: true }
    ),
    `fetchRecentRelayMarkets(${limit})`
  );

  return Array.from(events)
    .map((event) => parseMarketEvent(event.rawEvent()))
    .filter((market): market is MarketRecord => Boolean(market))
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, limit);
}

async function fetchProductMarketDetailBySlug(
  slug: string
): Promise<{ market: MarketRecord; trades: TradeRecord[] } | null> {
  const response = await fetch(
    `${getServerProductApiUrl()}/api/product/markets/slug/${encodeURIComponent(slug)}`,
    { cache: 'no-store' }
  ).catch(() => null);
  if (!response?.ok) return null;

  const payload = (await response.json().catch(() => null)) as
    | {
        market?: { raw_event?: NostrEvent | null } | null;
        trades?: NostrEvent[] | null;
      }
    | null;
  const market = payload?.market?.raw_event ? parseMarketEvent(payload.market.raw_event) : null;
  if (!market || market.slug !== slug) return null;

  const trades = (payload?.trades ?? [])
    .map((event) => parseTradeEvent(event))
    .filter((trade): trade is TradeRecord => Boolean(trade));

  return { market, trades };
}

function getServerProductApiUrl(): string {
  return (
    process.env.PUBLIC_CASCADE_API_URL ||
    process.env.PUBLIC_CASCADE_MINT_URL ||
    DEFAULT_PRODUCT_API_URL
  ).replace(/\/+$/, '');
}

async function fetchRecentRelayTrades(limit: number): Promise<TradeRecord[]> {
  const ndk = await getServerNdkClient();
  const events = await withRelayEventTimeout(
    ndk.fetchEvents(
      {
        kinds: [983 as NDKKind],
        limit
      } satisfies NDKFilter,
      { closeOnEose: true }
    ),
    `fetchRecentRelayTrades(${limit})`
  );

  return Array.from(events)
    .map((event) => parseTradeEvent(event.rawEvent()))
    .filter((trade): trade is TradeRecord => Boolean(trade))
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, limit);
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

async function fetchRelayTradesForMarket(marketId: string, limit: number): Promise<TradeRecord[]> {
  const ndk = await getServerNdkClient();
  const events = await withRelayEventTimeout(
    ndk.fetchEvents(
      {
        kinds: [983 as NDKKind],
        '#e': [marketId],
        limit
      } satisfies NDKFilter,
      { closeOnEose: true }
    ),
    `fetchRelayTradesForMarket(${marketId})`
  );

  return Array.from(events)
    .map((event) => parseTradeEvent(event.rawEvent()))
    .filter((trade): trade is TradeRecord => Boolean(trade))
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, limit);
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
