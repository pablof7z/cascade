import type { NDKFilter, NDKKind, NostrEvent } from '@nostr-dev-kit/ndk';
import { getProductApiUrl, isPaperEdition } from '$lib/cascade/config';
import { fetchProfilesByPubkeys, fetchUserWithProfile, getServerNdk } from '$lib/server/nostr';
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
} from '$lib/ndk/cascade';

const MARKET_CACHE_TTL_MS = 60_000;
const DISCUSSION_CACHE_TTL_MS = 30_000;

let marketCache: MarketRecord[] = [];
let marketCacheUpdatedAt = 0;
let marketRefresh: Promise<void> | undefined;
let tradeCache: TradeRecord[] = [];
let tradeCacheUpdatedAt = 0;
let tradeRefresh: Promise<void> | undefined;

let discussionCache: DiscussionRecord[] = [];
let discussionCacheUpdatedAt = 0;
let discussionRefresh: Promise<void> | undefined;

export async function fetchRecentMarkets(limit = 80): Promise<MarketRecord[]> {
  if (isPaperEdition()) {
    const stale = Date.now() - marketCacheUpdatedAt > MARKET_CACHE_TTL_MS;
    const underfilled = marketCache.length < limit;

    if (stale || underfilled) {
      const refresh = refreshPaperFeed(Math.max(limit, 80));
      if (marketCache.length === 0 || underfilled) {
        await refresh;
      }
    }

    return marketCache.slice(0, limit);
  }

  const stale = Date.now() - marketCacheUpdatedAt > MARKET_CACHE_TTL_MS;
  const underfilled = marketCache.length < limit;

  if (stale || underfilled) {
    const refresh = refreshRecentMarkets(Math.max(limit, 80));
    if (marketCache.length === 0 || underfilled) {
      await refresh;
    }
  }

  return marketCache.slice(0, limit);
}

export async function fetchMarketBySlug(slug: string): Promise<MarketRecord | null> {
  if (isPaperEdition()) {
    const payload = await fetchProductJson<{ market?: { raw_event?: NostrEvent } }>(
      `/api/product/markets/slug/${encodeURIComponent(slug)}`
    );
    const rawMarket = payload?.market?.raw_event;
    return rawMarket ? parseMarketEvent(rawMarket) : null;
  }

  const ndk = await getServerNdk();
  const events = await ndk.fetchEvents(
    {
      kinds: [982 as NDKKind],
      '#d': [slug],
      limit: 12
    } satisfies NDKFilter,
    { closeOnEose: true }
  );

  const markets = Array.from(events)
    .map(parseMarketEvent)
    .filter((market): market is MarketRecord => Boolean(market))
    .sort((left, right) => right.createdAt - left.createdAt);

  return markets[0] ?? null;
}

export async function fetchMarketsByAuthor(pubkey: string, limit = 48): Promise<MarketRecord[]> {
  if (isPaperEdition()) {
    const payload = await fetchProductJson<{ markets?: Array<{ raw_event?: NostrEvent }> }>(
      `/api/product/markets/creator/${encodeURIComponent(pubkey)}`
    );
    return (payload?.markets ?? [])
      .map((market) => market.raw_event)
      .filter((event): event is NostrEvent => Boolean(event))
      .map(parseMarketEvent)
      .filter((market): market is MarketRecord => Boolean(market))
      .slice(0, limit);
  }

  const ndk = await getServerNdk();
  const events = await ndk.fetchEvents(
    {
      kinds: [982 as NDKKind],
      authors: [pubkey],
      limit
    } satisfies NDKFilter,
    { closeOnEose: true }
  );

  return Array.from(events)
    .map(parseMarketEvent)
    .filter((market): market is MarketRecord => Boolean(market))
    .sort((left, right) => right.createdAt - left.createdAt);
}

export async function fetchRecentDiscussions(limit = 80): Promise<DiscussionRecord[]> {
  if (isPaperEdition()) {
    return [];
  }

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
  if (isPaperEdition()) {
    return [];
  }

  const ndk = await getServerNdk();
  const events = await ndk.fetchEvents(
    {
      kinds: [1111 as NDKKind],
      '#e': [marketId],
      limit
    } satisfies NDKFilter,
    { closeOnEose: true }
  );

  return Array.from(events)
    .map(parseDiscussionEvent)
    .filter((record): record is DiscussionRecord => Boolean(record))
    .filter((record) => record.marketId === marketId)
    .sort((left, right) => right.createdAt - left.createdAt);
}

export async function fetchRecentTrades(limit = 200): Promise<TradeRecord[]> {
  if (isPaperEdition()) {
    const stale = Date.now() - tradeCacheUpdatedAt > MARKET_CACHE_TTL_MS;
    const underfilled = tradeCache.length < limit;

    if (stale || underfilled) {
      const refresh = refreshPaperFeed(Math.max(limit, 240));
      if (tradeCache.length === 0 || underfilled) {
        await refresh;
      }
    }

    return tradeCache.slice(0, limit);
  }

  const ndk = await getServerNdk();
  const events = await ndk.fetchEvents(
    {
      kinds: [983 as NDKKind],
      limit
    } satisfies NDKFilter,
    { closeOnEose: true }
  );

  return Array.from(events)
    .map(parseTradeEvent)
    .filter((trade): trade is TradeRecord => Boolean(trade))
    .sort((left, right) => right.createdAt - left.createdAt);
}

export async function fetchMarketTrades(market: MarketRecord, limit = 200): Promise<TradeRecord[]> {
  if (isPaperEdition()) {
    const payload = await fetchProductJson<{ trades?: NostrEvent[] }>(
      `/api/product/markets/slug/${encodeURIComponent(market.slug)}`
    );

    return (payload?.trades ?? [])
      .map(parseTradeEvent)
      .filter((trade): trade is TradeRecord => Boolean(trade))
      .slice(0, limit);
  }

  const ndk = await getServerNdk();
  const events = await ndk.fetchEvents(
    {
      kinds: [983 as NDKKind],
      '#e': [market.id],
      limit
    } satisfies NDKFilter,
    { closeOnEose: true }
  );

  return Array.from(events)
    .map(parseTradeEvent)
    .filter((trade): trade is TradeRecord => {
      if (!trade || trade.marketId !== market.id) return false;
      if (!market.mintPubkey) return true;
      return trade.pubkey === market.mintPubkey;
    })
    .sort((left, right) => right.createdAt - left.createdAt);
}

export async function fetchPositionsByPubkey(pubkey: string, limit = 120): Promise<PositionRecord[]> {
  const ndk = await getServerNdk();
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
  return fetchUserWithProfile(identifier);
}

export async function fetchProfilesForPubkeys(pubkeys: readonly string[]) {
  if (isPaperEdition()) {
    return {};
  }

  return fetchProfilesByPubkeys(pubkeys);
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

async function refreshRecentMarkets(limit: number): Promise<void> {
  if (marketRefresh) return marketRefresh;

  marketRefresh = (async () => {
    const ndk = await getServerNdk();
    const events = await ndk.fetchEvents(
      {
        kinds: [982 as NDKKind],
        limit
      } satisfies NDKFilter,
      { closeOnEose: true }
    );

    const next = Array.from(events)
      .map(parseMarketEvent)
      .filter((market): market is MarketRecord => Boolean(market))
      .sort((left, right) => right.createdAt - left.createdAt);

    if (next.length > 0 || marketCache.length === 0) {
      marketCache = next;
      marketCacheUpdatedAt = Date.now();
    }
  })().finally(() => {
    marketRefresh = undefined;
  });

  return marketRefresh;
}

async function refreshPaperFeed(limit: number): Promise<void> {
  if (marketRefresh || tradeRefresh) return Promise.all([marketRefresh, tradeRefresh].filter(Boolean) as Promise<void>[])
      .then(() => undefined);

  const refresh = (async () => {
    const payload = await fetchProductJson<{ markets?: NostrEvent[]; trades?: NostrEvent[] }>(
      '/api/product/feed'
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
    const ndk = await getServerNdk();
    const events = await ndk.fetchEvents(
      {
        kinds: [1111 as NDKKind],
        limit
      } satisfies NDKFilter,
      { closeOnEose: true }
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

async function fetchProductJson<T>(path: string): Promise<T | null> {
  const response = await fetch(`${getProductApiUrl()}${path}`);
  if (!response.ok) return null;
  return (await response.json()) as T;
}
