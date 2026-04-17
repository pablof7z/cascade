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

// Matches auto-generated E2E test market titles that embed Unix/JS timestamps
// (10–13 consecutive digits, e.g. "Public paper market 1776275085367-5049").
const TEST_MARKET_TITLE_PATTERN = /\b\d{10,13}\b/;

function isTestMarket(market: HomepageSearchMarket): boolean {
  return TEST_MARKET_TITLE_PATTERN.test(market.title);
}

function normalizeHomepageMarketSearch(query: string): string {
  return query.trim().toLocaleLowerCase();
}

export function filterLiveHomepageMarkets<T extends HomepageLiveMarket>(
  markets: T[],
  trades: readonly HomepageLiveTrade[]
): T[] {
  const liveMarketIds = new Set(trades.map((trade) => trade.marketId));
  return markets
    .filter((market) => liveMarketIds.has(market.id))
    .filter((market) => !isTestMarket(market));
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
