import {
  buildDiscussionThreads,
  type DiscussionRecord,
  type DiscussionThread,
  type MarketRecord,
  type TradeRecord
} from '../ndk/cascade.ts';

export type MarketThreadSurfaceData = {
  market: MarketRecord | null;
  trades: TradeRecord[];
  discussions: DiscussionRecord[];
  relatedMarkets: MarketRecord[];
  profiles: Record<string, unknown>;
};

export async function resolveMarketThread(
  data: MarketThreadSurfaceData,
  threadId: string,
  loadFreshDiscussions: () => Promise<DiscussionRecord[]> = async () => []
): Promise<{ discussions: DiscussionRecord[]; thread: DiscussionThread | null }> {
  if (!data.market) {
    return {
      discussions: data.discussions,
      thread: null
    };
  }

  let thread = findThread(data.discussions, data.market.id, threadId);
  if (thread) {
    return {
      discussions: data.discussions,
      thread
    };
  }

  const mergedDiscussions = mergeDiscussionRecords(data.discussions, await loadFreshDiscussions());
  thread = findThread(mergedDiscussions, data.market.id, threadId);

  return {
    discussions: mergedDiscussions,
    thread
  };
}

function findThread(
  discussions: DiscussionRecord[],
  marketId: string,
  threadId: string
): DiscussionThread | null {
  return buildDiscussionThreads(discussions, marketId).find((candidate) => candidate.post.id === threadId) ?? null;
}

function mergeDiscussionRecords(
  seeded: DiscussionRecord[],
  fresh: DiscussionRecord[]
): DiscussionRecord[] {
  const merged = new Map<string, DiscussionRecord>();

  for (const discussion of fresh) {
    merged.set(discussion.id, discussion);
  }

  for (const discussion of seeded) {
    if (!merged.has(discussion.id)) {
      merged.set(discussion.id, discussion);
    }
  }

  return [...merged.values()].sort((left, right) => right.createdAt - left.createdAt);
}
