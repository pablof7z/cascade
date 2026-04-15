import {
  marketUrl,
  sanitizeMarketCopy,
  threadUrl,
  truncateText,
  type DiscussionRecord,
  type MarketRecord,
  type PositionRecord
} from '../ndk/cascade.ts';

const QUANTITY_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2
});

export type PublicProfilePositionStats = {
  total: number;
  longCount: number;
  shortCount: number;
  splitLabel: string;
  averageEntryPrice: number | null;
};

export type PublicProfileDiscussionEntry = {
  id: string;
  title: string;
  marketLabel: string;
  marketHref: string | null;
  threadHref: string | null;
  createdAt: number;
  preview: string | null;
};

export function buildPublicProfilePositionStats(
  positions: ReadonlyArray<Pick<PositionRecord, 'direction' | 'entryPrice'>>
): PublicProfilePositionStats {
  const total = positions.length;
  const longCount = positions.filter((position) => position.direction === 'long').length;
  const shortCount = positions.filter((position) => position.direction === 'short').length;

  return {
    total,
    longCount,
    shortCount,
    splitLabel: `LONG ${longCount} · SHORT ${shortCount}`,
    averageEntryPrice:
      total > 0 ? positions.reduce((sum, position) => sum + position.entryPrice, 0) / total : null
  };
}

export function formatProfileProbability(probability: number | null | undefined): string {
  if (probability === null || probability === undefined || Number.isNaN(probability)) return '—';
  return `${(probability * 100).toFixed(1).replace(/\.0$/, '')}%`;
}

export function formatProfilePositionSummary(
  position: Pick<PositionRecord, 'direction' | 'quantity' | 'entryPrice'>
): string {
  return `${position.direction === 'long' ? 'LONG' : 'SHORT'} · ${QUANTITY_FORMATTER.format(position.quantity)} units @ ${formatProfileProbability(position.entryPrice)}`;
}

export function buildPublicProfileDiscussionEntries(
  discussions: ReadonlyArray<DiscussionRecord>,
  markets: ReadonlyArray<MarketRecord>
): PublicProfileDiscussionEntry[] {
  const marketById = new Map(markets.map((market) => [market.id, market]));

  return discussions
    .filter(isStartedThread)
    .sort((left, right) => right.createdAt - left.createdAt)
    .map((discussion) => {
      const market = marketById.get(discussion.marketId);
      const subject = discussion.subject?.trim();
      const content = discussion.content.trim();

      return {
        id: discussion.id,
        title: subject || truncateText(content, 96) || 'Untitled thread',
        marketLabel: market ? sanitizeMarketCopy(market.title) : discussion.marketId,
        marketHref: market ? marketUrl(market.slug) : null,
        threadHref: market ? threadUrl(market.slug, discussion.id) : null,
        createdAt: discussion.createdAt,
        preview: subject && content ? truncateText(content, 96) : null
      };
    });
}

function isStartedThread(discussion: DiscussionRecord): boolean {
  return (
    discussion.replyTo === undefined ||
    discussion.replyTo === discussion.marketId ||
    discussion.replyTo === discussion.rootId
  );
}
