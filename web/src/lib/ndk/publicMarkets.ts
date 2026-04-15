import { NDKSubscriptionCacheUsage, type NDKFilter, type NDKKind, type NostrEvent } from '@nostr-dev-kit/ndk';
import { buildTradeSummary, parseMarketEvent, parseTradeEvent, type MarketRecord, type TradeRecord } from './cascade.ts';
import { ensureClientNdk, ndk } from './client';

const CLIENT_RELAY_TIMEOUT_MS = 2_500;

export type PublicMarketSnapshot = {
  market: MarketRecord;
  trades: TradeRecord[];
  yesPricePpm: number;
};

export async function fetchPublicMarketSnapshotBySlug(
  slug: string
): Promise<PublicMarketSnapshot | null> {
  await ensureClientNdk();

  const rawMarket = await fetchRelayMarketBySlug(slug);
  const market = rawMarket ? parseMarketEvent(rawMarket) : null;
  if (!market || market.slug !== slug) return null;

  const trades = await fetchRelayTradesForMarket(market.id, 40);
  if (trades.length === 0) return null;

  const summary = buildTradeSummary(trades);
  if (summary.latestPricePpm === null) return null;

  return {
    market: {
      ...market,
      latestPricePpm: summary.latestPricePpm
    },
    trades,
    yesPricePpm: summary.latestPricePpm
  };
}

async function fetchRelayMarketBySlug(slug: string): Promise<NostrEvent | null> {
  const directMatch = await collectRelayRawEvents(
    {
      kinds: [982 as NDKKind],
      '#d': [slug],
      limit: 12
    } satisfies NDKFilter,
    `fetchRelayMarketBySlug:direct(${slug})`,
    {
      stopWhen: (seen, rawEvent) => parseMarketEvent(rawEvent)?.slug === slug
    }
  );

  const matchedDirectEvent = directMatch.find((event) => parseMarketEvent(event)?.slug === slug);
  if (matchedDirectEvent) return matchedDirectEvent;

  const recentEvents = await collectRelayRawEvents(
    {
      kinds: [982 as NDKKind],
      limit: 120
    } satisfies NDKFilter,
    `fetchRelayMarketBySlug:recent(${slug})`,
    {
      stopWhen: (seen, rawEvent) => parseMarketEvent(rawEvent)?.slug === slug
    }
  );

  return recentEvents.find((event) => parseMarketEvent(event)?.slug === slug) ?? null;
}

async function fetchRelayTradesForMarket(marketId: string, limit: number): Promise<TradeRecord[]> {
  const events = await collectRelayRawEvents(
    {
      kinds: [983 as NDKKind],
      '#e': [marketId],
      limit
    } satisfies NDKFilter,
    `fetchRelayTradesForMarket(${marketId})`,
    {
      stopWhen: (seen) => seen.size >= limit
    }
  );

  return events
    .map((event) => parseTradeEvent(event))
    .filter((trade): trade is TradeRecord => Boolean(trade))
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, limit);
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
  await ensureClientNdk();
  const timeoutMs = options.timeoutMs ?? CLIENT_RELAY_TIMEOUT_MS;

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
