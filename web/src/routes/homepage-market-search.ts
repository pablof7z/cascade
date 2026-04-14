export type HomepageSearchMarket = {
  title: string;
  description: string;
  body?: string;
};

function normalizeHomepageMarketSearch(query: string): string {
  return query.trim().toLocaleLowerCase();
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
