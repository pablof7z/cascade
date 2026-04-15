export type HomepageSearchMarket = {
  title: string;
  description: string;
  body?: string;
};

export type HomepageLiveMarket = HomepageSearchMarket & {
  id: string;
};

export type HomepageLiveTrade = {
  marketId: string;
};

function normalizeHomepageMarketSearch(query: string): string {
  return query.trim().toLocaleLowerCase();
}

export function filterLiveHomepageMarkets<T extends HomepageLiveMarket>(
  markets: T[],
  trades: readonly HomepageLiveTrade[]
): T[] {
  const liveMarketIds = new Set(trades.map((trade) => trade.marketId));
  return markets.filter((market) => liveMarketIds.has(market.id));
}

export function filterHomepageMarkets<T extends HomepageSearchMarket>(markets: T[], query: string): T[] {
  const normalizedQuery = normalizeHomepageMarketSearch(query);
  if (!normalizedQuery) return markets;

  return markets.filter((market) => {
    const searchableText = [market.title, market.description || market.body || '']
      .join(' ')
      .toLocaleLowerCase();

    return searchableText.includes(normalizedQuery);
  });
}

export function formatHomepageMarketMatchCount(count: number): string {
  return `${count} market${count === 1 ? '' : 's'} matched`;
}
