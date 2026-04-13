export type AuthoredCreatorMarket = {
  eventId: string;
  slug: string;
  title: string;
  createdAt: number;
};

export type PendingCreatorMarket = {
  eventId: string;
  pubkey: string;
  slug: string;
  title: string;
  createdAt: number;
};

export type BuilderCreatorMarket = {
  event_id: string;
  slug: string;
  title: string;
  visibility: 'public' | 'pending';
  created_at: number;
};

export function mergeCreatorMarkets(
  authored: AuthoredCreatorMarket[],
  pending: PendingCreatorMarket[]
): BuilderCreatorMarket[] {
  const merged = new Map<string, BuilderCreatorMarket>();

  for (const market of authored) {
    merged.set(market.eventId, {
      event_id: market.eventId,
      slug: market.slug,
      title: market.title,
      visibility: 'public',
      created_at: market.createdAt
    });
  }

  for (const market of pending) {
    merged.set(market.eventId, {
      event_id: market.eventId,
      slug: market.slug,
      title: market.title,
      visibility: 'pending',
      created_at: market.createdAt
    });
  }

  return [...merged.values()].sort(
    (left, right) => right.created_at - left.created_at || left.title.localeCompare(right.title)
  );
}

export function prunePendingCreatorMarkets(
  pending: PendingCreatorMarket[],
  publicMarketIds: ReadonlySet<string>
): {
  remaining: PendingCreatorMarket[];
  removed: string[];
} {
  const remaining: PendingCreatorMarket[] = [];
  const removed: string[] = [];

  for (const market of pending) {
    if (publicMarketIds.has(market.eventId)) {
      removed.push(market.eventId);
      continue;
    }

    remaining.push(market);
  }

  return { remaining, removed };
}
