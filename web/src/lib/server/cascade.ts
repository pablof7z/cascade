import { NDKSubscriptionCacheUsage, type NDKFilter, type NDKKind, type NostrEvent } from '@nostr-dev-kit/ndk';
import {
  buildTradeSummary,
  getCascadeEventKinds,
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

type CascadeEdition = 'mainnet' | 'signet';

type CascadeEditionOption = {
  edition?: CascadeEdition | string | null;
};

type RelayDiscoveryCache = {
  marketCache: MarketRecord[];
  marketCacheUpdatedAt: number;
  marketRefresh?: Promise<void>;
  tradeCache: TradeRecord[];
  tradeCacheUpdatedAt: number;
  tradeRefresh?: Promise<void>;
  discussionCache: DiscussionRecord[];
  discussionCacheUpdatedAt: number;
  discussionRefresh?: Promise<void>;
};

const relayCaches = new Map<CascadeEdition, RelayDiscoveryCache>();

function selectedEdition(edition: CascadeEdition | string | null | undefined): CascadeEdition {
  if (edition === 'signet' || edition === 'paper' || edition === 'practice') return 'signet';
  return 'mainnet';
}

function relayCache(edition: CascadeEdition): RelayDiscoveryCache {
  const existing = relayCaches.get(edition);
  if (existing) return existing;

  const next: RelayDiscoveryCache = {
    marketCache: [],
    marketCacheUpdatedAt: 0,
    tradeCache: [],
    tradeCacheUpdatedAt: 0,
    discussionCache: [],
    discussionCacheUpdatedAt: 0
  };
  relayCaches.set(edition, next);
  return next;
}

type FetchMarketBySlugDeps = CascadeEditionOption & {
  fetchRelayMarketBySlug?: typeof fetchRelayMarketBySlug;
  fetchRelayTradesForMarket?: typeof fetchRelayTradesForMarket;
};

type FetchSitemapMarketsDeps = CascadeEditionOption & {
  fetchRecentMarkets?: typeof fetchRecentMarkets;
  fetchRecentRelayMarkets?: typeof fetchRecentRelayMarkets;
};

export async function fetchRecentMarkets(
  limit = 80,
  options: CascadeEditionOption = {}
): Promise<MarketRecord[]> {
  const edition = selectedEdition(options.edition);
  const cache = relayCache(edition);
  const stale = Date.now() - cache.marketCacheUpdatedAt > MARKET_CACHE_TTL_MS;
  const underfilled = cache.marketCache.length < limit;

  if (stale || underfilled) {
    const refresh = refreshRelayDiscovery(Math.max(limit, 80), edition);
    if (cache.marketCache.length === 0 || underfilled) {
      await refresh;
    }
  }

  return cache.marketCache.slice(0, limit);
}

export async function fetchSitemapMarkets(
  limit = 80,
  deps: FetchSitemapMarketsDeps = {}
): Promise<MarketRecord[]> {
  const edition = selectedEdition(deps.edition);
  const markets = await (deps.fetchRecentMarkets ?? fetchRecentMarkets)(limit, { edition });
  if (markets.length > 0) return markets;

  console.warn('fetchSitemapMarkets fell back to a direct relay fetch because the cache was empty');
  return (deps.fetchRecentRelayMarkets ?? fetchRecentRelayMarkets)(limit, edition);
}

export async function fetchMarketBySlug(
  slug: string,
  deps: FetchMarketBySlugDeps = {}
): Promise<MarketRecord | null> {
  const edition = selectedEdition(deps.edition);
  const rawMarket = await (deps.fetchRelayMarketBySlug ?? fetchRelayMarketBySlug)(slug, edition);
  const marketFromRelay = rawMarket ? parseMarketEvent(rawMarket, edition) : null;
  if (!marketFromRelay || marketFromRelay.slug !== slug) return null;

  const trades = await (deps.fetchRelayTradesForMarket ?? fetchRelayTradesForMarket)(
    marketFromRelay.id,
    40,
    edition
  );
  return withLatestPrice(marketFromRelay, trades);
}

export async function fetchMarketsByAuthor(
  pubkey: string,
  limit = 48,
  options: CascadeEditionOption = {}
): Promise<MarketRecord[]> {
  const edition = selectedEdition(options.edition);
  const kinds = getCascadeEventKinds(edition);
  const ndk = await getServerNdkClient();
  const events = await withRelayEventTimeout(
    ndk.fetchEvents(
      {
        kinds: [kinds.market as NDKKind],
        authors: [pubkey],
        limit
      } satisfies NDKFilter,
      { closeOnEose: true }
    ),
    `fetchMarketsByAuthor(${pubkey})`
  );

  return Array.from(events)
    .map((event) => parseMarketEvent(event.rawEvent(), edition))
    .filter((market): market is MarketRecord => Boolean(market))
    .filter((market) => market.pubkey === pubkey)
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, limit);
}

export async function fetchMarketsByIds(
  marketIds: readonly string[],
  options: CascadeEditionOption = {}
): Promise<MarketRecord[]> {
  const edition = selectedEdition(options.edition);
  const ids = [...new Set(marketIds.filter(Boolean))];
  if (ids.length === 0) return [];

  const kinds = getCascadeEventKinds(edition);
  const ndk = await getServerNdkClient();
  const events = await withRelayEventTimeout(
    ndk.fetchEvents(
      {
        kinds: [kinds.market as NDKKind],
        ids,
        limit: ids.length
      } satisfies NDKFilter,
      { closeOnEose: true }
    ),
    `fetchMarketsByIds(${ids.length})`
  );

  return Array.from(events)
    .map((event) => parseMarketEvent(event.rawEvent(), edition))
    .filter((market): market is MarketRecord => Boolean(market))
    .sort((left, right) => right.createdAt - left.createdAt);
}

export async function fetchRecentDiscussions(
  limit = 80,
  options: CascadeEditionOption = {}
): Promise<DiscussionRecord[]> {
  const edition = selectedEdition(options.edition);
  const cache = relayCache(edition);
  const stale = Date.now() - cache.discussionCacheUpdatedAt > DISCUSSION_CACHE_TTL_MS;
  const underfilled = cache.discussionCache.length < limit;

  if (stale || underfilled) {
    const refresh = refreshRecentDiscussions(Math.max(limit, 80), edition);
    if (cache.discussionCache.length === 0 || underfilled) {
      await refresh;
    }
  }

  return cache.discussionCache.slice(0, limit);
}

export async function fetchMarketDiscussions(
  marketId: string,
  limit = 200,
  options: CascadeEditionOption = {}
): Promise<DiscussionRecord[]> {
  const edition = selectedEdition(options.edition);
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
    .map((event) => parseDiscussionEvent(event, edition))
    .filter((record): record is DiscussionRecord => Boolean(record))
    .filter((record) => record.marketId === marketId)
    .sort((left, right) => right.createdAt - left.createdAt);
}

export async function fetchThreadRootDiscussion(
  marketId: string,
  threadId: string,
  options: CascadeEditionOption = {}
): Promise<DiscussionRecord[]> {
  const edition = selectedEdition(options.edition);
  const events = await collectRelayRawEvents(
    {
      kinds: [1111 as NDKKind],
      ids: [threadId],
      limit: 1
    } satisfies NDKFilter,
    `fetchThreadRootDiscussion(${marketId}, ${threadId})`,
    {
      stopWhen: (seen, rawEvent) => rawEvent.id === threadId
    }
  );

  return events
    .map((event) => parseDiscussionEvent(event, edition))
    .filter((record): record is DiscussionRecord => Boolean(record))
    .filter((record) => record.id === threadId && record.marketId === marketId)
    .sort((left, right) => right.createdAt - left.createdAt);
}

export async function fetchDiscussionsByPubkey(
  pubkey: string,
  limit = 50,
  options: CascadeEditionOption = {}
): Promise<DiscussionRecord[]> {
  const edition = selectedEdition(options.edition);
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
    .map((event) => parseDiscussionEvent(event, edition))
    .filter((record): record is DiscussionRecord => Boolean(record))
    .filter((record) => record.pubkey === pubkey)
    .sort((left, right) => right.createdAt - left.createdAt);
}

export async function fetchRecentTrades(
  limit = 200,
  options: CascadeEditionOption = {}
): Promise<TradeRecord[]> {
  const edition = selectedEdition(options.edition);
  const cache = relayCache(edition);
  const stale = Date.now() - cache.tradeCacheUpdatedAt > MARKET_CACHE_TTL_MS;
  const underfilled = cache.tradeCache.length < limit;

  if (stale || underfilled) {
    const refresh = refreshRelayDiscovery(Math.max(Math.ceil(limit / 4), 80), edition);
    if (cache.tradeCache.length === 0 || underfilled) {
      await refresh;
    }
  }

  return cache.tradeCache.slice(0, limit);
}

export async function fetchMarketTrades(
  market: MarketRecord,
  limit = 200,
  options: CascadeEditionOption = {}
): Promise<TradeRecord[]> {
  return fetchRelayTradesForMarket(market.id, limit, selectedEdition(options.edition));
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

async function refreshRelayDiscovery(limit: number, edition: CascadeEdition): Promise<void> {
  const cache = relayCache(edition);
  if (cache.marketRefresh || cache.tradeRefresh) return Promise.all([cache.marketRefresh, cache.tradeRefresh].filter(Boolean) as Promise<void>[])
      .then(() => undefined);

  const refresh = (async () => {
    const nextTrades = await fetchRecentRelayTrades(Math.max(limit * 4, 240), edition);
    const marketIds = [...new Set(nextTrades.map((trade) => trade.marketId))];
    const tradeSummaries = summarizeTradesByMarket(nextTrades);
    const nextMarkets = (await fetchMarketsByIds(marketIds, { edition }))
      .map((market) => ({
        ...market,
        latestPricePpm: tradeSummaries.get(market.id)?.latestPricePpm ?? market.latestPricePpm
      }))
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, limit);

    cache.marketCache = nextMarkets;
    cache.tradeCache = nextTrades;
    cache.marketCacheUpdatedAt = Date.now();
    cache.tradeCacheUpdatedAt = Date.now();
  })();

  cache.marketRefresh = refresh.finally(() => {
    cache.marketRefresh = undefined;
  });
  cache.tradeRefresh = refresh.finally(() => {
    cache.tradeRefresh = undefined;
  });

  await refresh;
}

async function refreshRecentDiscussions(limit: number, edition: CascadeEdition): Promise<void> {
  const cache = relayCache(edition);
  if (cache.discussionRefresh) return cache.discussionRefresh;

  cache.discussionRefresh = (async () => {
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
      .map((event) => parseDiscussionEvent(event, edition))
      .filter((record): record is DiscussionRecord => Boolean(record))
      .sort((left, right) => right.createdAt - left.createdAt);

    if (next.length > 0 || cache.discussionCache.length === 0) {
      cache.discussionCache = next;
      cache.discussionCacheUpdatedAt = Date.now();
    }
  })().finally(() => {
    cache.discussionRefresh = undefined;
  });

  return cache.discussionRefresh;
}

async function fetchRecentRelayMarkets(
  limit: number,
  edition: CascadeEdition = 'mainnet'
): Promise<MarketRecord[]> {
  const kinds = getCascadeEventKinds(edition);
  const events = await collectRelayRawEvents(
    {
      kinds: [kinds.market as NDKKind],
      limit
    } satisfies NDKFilter,
    `fetchRecentRelayMarkets(${limit})`,
    {
      stopWhen: (seen) => seen.size >= limit
    }
  );

  return events
    .map((event) => parseMarketEvent(event, edition))
    .filter((market): market is MarketRecord => Boolean(market))
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, limit);
}

async function fetchRecentRelayTrades(
  limit: number,
  edition: CascadeEdition = 'mainnet'
): Promise<TradeRecord[]> {
  const kinds = getCascadeEventKinds(edition);
  const events = await collectRelayRawEvents(
    {
      kinds: [kinds.trade as NDKKind],
      limit
    } satisfies NDKFilter,
    `fetchRecentRelayTrades(${limit})`,
    {
      stopWhen: (seen) => seen.size >= limit
    }
  );

  return events
    .map((event) => parseTradeEvent(event, edition))
    .filter((trade): trade is TradeRecord => Boolean(trade))
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, limit);
}

async function fetchRelayMarketBySlug(
  slug: string,
  edition: CascadeEdition = 'mainnet'
): Promise<NostrEvent | null> {
  const kinds = getCascadeEventKinds(edition);
  const directMatch = await collectRelayRawEvents(
    {
      kinds: [kinds.market as NDKKind],
      '#d': [slug],
      limit: 12
    } satisfies NDKFilter,
    `fetchRelayMarketBySlug:direct(${slug})`,
    {
      stopWhen: (seen, rawEvent) => parseMarketEvent(rawEvent, edition)?.slug === slug
    }
  );

  const matchedDirectEvent = directMatch.find((event) => parseMarketEvent(event, edition)?.slug === slug);
  if (matchedDirectEvent) return matchedDirectEvent;

  const recentEvents = await collectRelayRawEvents(
    {
      kinds: [kinds.market as NDKKind],
      limit: 120
    } satisfies NDKFilter,
    `fetchRelayMarketBySlug:recent(${slug})`,
    {
      stopWhen: (seen, rawEvent) => parseMarketEvent(rawEvent, edition)?.slug === slug
    }
  );

  return recentEvents.find((event) => parseMarketEvent(event, edition)?.slug === slug) ?? null;
}

async function fetchRelayTradesForMarket(
  marketId: string,
  limit: number,
  edition: CascadeEdition = 'mainnet'
): Promise<TradeRecord[]> {
  const kinds = getCascadeEventKinds(edition);
  const events = await collectRelayRawEvents(
    {
      kinds: [kinds.trade as NDKKind],
      '#e': [marketId],
      limit
    } satisfies NDKFilter,
    `fetchRelayTradesForMarket(${marketId})`,
    {
      stopWhen: (seen) => seen.size >= limit
    }
  );

  return events
    .map((event) => parseTradeEvent(event, edition))
    .filter((trade): trade is TradeRecord => Boolean(trade))
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, limit);
}

async function getServerNdkClient() {
  return (await import('./nostr.ts')).getServerNdk();
}

type CollectRelayRawEventsOptions = {
  timeoutMs?: number;
  stopWhen?: (seen: ReadonlyMap<string, NostrEvent>, rawEvent: NostrEvent) => boolean;
};

async function collectRelayRawEvents(
  filter: NDKFilter,
  label: string,
  options: CollectRelayRawEventsOptions = {}
): Promise<NostrEvent[]> {
  const ndk = await getServerNdkClient();
  const timeoutMs = options.timeoutMs ?? RELAY_FETCH_TIMEOUT_MS;

  return new Promise((resolve) => {
    const seen = new Map<string, NostrEvent>();
    let resolved = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    const finish = () => {
      if (resolved) return;
      resolved = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
      subscription.stop();
      resolve([...seen.values()]);
    };

    const subscription = ndk.subscribe(filter, {
      closeOnEose: true,
      cacheUsage: NDKSubscriptionCacheUsage.ONLY_RELAY,
      groupable: false,
      onEvent: (event) => {
        const rawEvent = event.rawEvent() as NostrEvent;
        if (!rawEvent.id) return;
        seen.set(rawEvent.id, rawEvent);
        if (options.stopWhen?.(seen, rawEvent)) {
          finish();
        }
      },
      onEose: () => {
        finish();
      }
    });

    timeoutHandle = setTimeout(() => {
      console.warn(`${label} timed out after ${timeoutMs}ms`);
      finish();
    }, timeoutMs);
  });
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
