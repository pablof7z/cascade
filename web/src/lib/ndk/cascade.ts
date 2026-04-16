import { NDKEvent, type NostrEvent } from '@nostr-dev-kit/ndk';

export const CASCADE_MAINNET_MARKET_KIND = 982;
export const CASCADE_MAINNET_TRADE_KIND = 983;
export const CASCADE_SIGNET_MARKET_KIND = 980;
export const CASCADE_SIGNET_TRADE_KIND = 981;
export const CASCADE_MARKET_KIND = CASCADE_MAINNET_MARKET_KIND;
export const CASCADE_TRADE_KIND = CASCADE_MAINNET_TRADE_KIND;
export const CASCADE_DISCUSSION_KIND = 1111;
export const CASCADE_BOOKMARK_KIND = 10003;
export const CASCADE_POSITION_KIND = 30078;

export type CascadeEventKinds = {
  market: number;
  trade: number;
};

export type CascadeEdition = 'mainnet' | 'signet';

function parseCascadeEdition(value: unknown): CascadeEdition | null {
  if (typeof value !== 'string') return null;
  const raw = value.toLowerCase().trim();
  if (raw === 'signet' || raw === 'paper' || raw === 'practice') return 'signet';
  if (raw === 'mainnet' || raw === 'live') return 'mainnet';
  return null;
}

function browserEditionCookie(): CascadeEdition | null {
  if (typeof document === 'undefined') return null;
  const prefix = 'cascade_edition=';
  const raw = document.cookie
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(prefix))
    ?.slice(prefix.length);
  if (!raw) return null;

  try {
    return parseCascadeEdition(decodeURIComponent(raw));
  } catch {
    return null;
  }
}

function resolveCascadeEdition(edition?: CascadeEdition | string | null): CascadeEdition {
  return parseCascadeEdition(edition) ?? browserEditionCookie() ?? 'mainnet';
}

export function getCascadeEventKinds(
  edition: CascadeEdition | string | null = resolveCascadeEdition()
): CascadeEventKinds {
  return resolveCascadeEdition(edition) === 'signet'
    ? { market: CASCADE_SIGNET_MARKET_KIND, trade: CASCADE_SIGNET_TRADE_KIND }
    : { market: CASCADE_MAINNET_MARKET_KIND, trade: CASCADE_MAINNET_TRADE_KIND };
}

export function getCascadeMarketKind(
  edition: CascadeEdition | string | null = resolveCascadeEdition()
): number {
  return getCascadeEventKinds(edition).market;
}

export function getCascadeTradeKind(
  edition: CascadeEdition | string | null = resolveCascadeEdition()
): number {
  return getCascadeEventKinds(edition).trade;
}

const USD_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export type MarketRecord = {
  id: string;
  pubkey: string;
  slug: string;
  title: string;
  description: string;
  body: string;
  categories: string[];
  topics: string[];
  mintUrl?: string;
  mintPubkey?: string;
  status: string;
  latestPricePpm: number | null;
  createdAt: number;
  rawEvent: NostrEvent;
};

export type TradeRecord = {
  id: string;
  pubkey: string;
  marketId: string;
  amount: number;
  unit: string;
  direction: 'long' | 'short';
  type: 'buy' | 'sell';
  pricePpm: number;
  probability: number;
  createdAt: number;
  rawEvent: NostrEvent;
};

export type MarketTradeSummary = {
  tradeCount: number;
  grossVolume: number;
  buyVolume: number;
  sellVolume: number;
  longVolume: number;
  shortVolume: number;
  latestTradeAt: number | null;
  latestPricePpm: number | null;
  latestDirection: 'long' | 'short' | null;
  latestType: 'buy' | 'sell' | null;
};

export type DiscussionRecord = {
  id: string;
  pubkey: string;
  marketId: string;
  rootId: string;
  replyTo?: string;
  subject?: string;
  content: string;
  createdAt: number;
  rawEvent: NostrEvent;
};

export type DiscussionThread = {
  post: DiscussionRecord;
  replies: DiscussionThread[];
  replyCount: number;
  lastActivityAt: number;
};

export function buildThreadReplyTags(
  marketId: string,
  threadId: string,
  edition: CascadeEdition | string | null = resolveCascadeEdition()
): string[][] {
  const marketKind = String(getCascadeMarketKind(edition));
  return [
    ['E', marketId, '', 'root'],
    ['K', marketKind],
    ['e', marketId, '', 'root'],
    ['k', marketKind],
    ['e', threadId, '', 'reply'],
    ['k', String(CASCADE_DISCUSSION_KIND)]
  ];
}

export type PositionRecord = {
  id: string;
  pubkey: string;
  marketId: string;
  marketTitle?: string;
  direction: 'long' | 'short';
  quantity: number;
  stakeSats: number;
  entryPrice: number;
  createdAt: number;
  rawEvent: NostrEvent;
};

export function rawEventOf(event: NDKEvent | NostrEvent): NostrEvent {
  return event instanceof NDKEvent ? (event.rawEvent() as NostrEvent) : event;
}

export function parseMarketEvent(
  event: NDKEvent | NostrEvent,
  edition: CascadeEdition | string | null = resolveCascadeEdition()
): MarketRecord | null {
  const raw = rawEventOf(event);
  if (raw.kind !== getCascadeMarketKind(edition) || !raw.id) return null;

  const slug = firstTagValue(raw.tags, 'd');
  if (!slug) return null;

  return {
    id: raw.id,
    pubkey: raw.pubkey,
    slug,
    title: firstTagValue(raw.tags, 'title') || slug,
    description: firstTagValue(raw.tags, 'description') || '',
    body: raw.content || '',
    categories: tagValues(raw.tags, 'c'),
    topics: tagValues(raw.tags, 't'),
    mintUrl: firstTagValue(raw.tags, 'mint') || undefined,
    mintPubkey:
      firstTagValue(raw.tags, 'mint-pubkey') ||
      firstTagValue(raw.tags, 'mint_pubkey') ||
      undefined,
    status: firstTagValue(raw.tags, 'status') || 'open',
    latestPricePpm: null,
    createdAt: raw.created_at || 0,
    rawEvent: raw
  };
}

export function parseTradeEvent(
  event: NDKEvent | NostrEvent,
  edition: CascadeEdition | string | null = resolveCascadeEdition()
): TradeRecord | null {
  const raw = rawEventOf(event);
  if (raw.kind !== getCascadeTradeKind(edition) || !raw.id) return null;

  const marketId = firstTagValue(raw.tags, 'e');
  const direction = firstTagValue(raw.tags, 'direction');
  const type = firstTagValue(raw.tags, 'type');
  const amount = integerTag(raw.tags, 'amount');
  const pricePpm = integerTag(raw.tags, 'price');

  if (!marketId) return null;
  if (direction !== 'long' && direction !== 'short') return null;
  if (type !== 'buy' && type !== 'sell') return null;
  if (!amount || !pricePpm) return null;

  return {
    id: raw.id,
    pubkey: raw.pubkey,
    marketId,
    amount,
    unit: firstTagValue(raw.tags, 'unit') || 'sat',
    direction,
    type,
    pricePpm,
    probability: pricePpm / 1_000_000,
    createdAt: raw.created_at || 0,
    rawEvent: raw
  };
}

export function parseDiscussionEvent(
  event: NDKEvent | NostrEvent,
  edition: CascadeEdition | string | null = resolveCascadeEdition()
): DiscussionRecord | null {
  const raw = rawEventOf(event);
  if (raw.kind !== CASCADE_DISCUSSION_KIND || !raw.id) return null;

  let rootId: string | undefined;
  let replyTo: string | undefined;

  for (const tag of raw.tags) {
    if (tag[0] !== 'e' || !tag[1]) continue;
    if (tag[3] === 'root') {
      rootId = tag[1];
    } else if (tag[3] === 'reply') {
      replyTo = tag[1];
    } else if (!replyTo) {
      replyTo = tag[1];
    }
  }

  const referencedKind = firstTagValue(raw.tags, 'k');
  const marketKind = String(getCascadeMarketKind(edition));
  const marketId =
    referencedKind === marketKind
      ? rootId
      : rootId && rootId !== raw.id
        ? rootId
        : undefined;

  if (!marketId || !rootId) return null;

  return {
    id: raw.id,
    pubkey: raw.pubkey,
    marketId,
    rootId,
    replyTo,
    subject: firstTagValue(raw.tags, 'subject') || undefined,
    content: raw.content || '',
    createdAt: raw.created_at || 0,
    rawEvent: raw
  };
}

export function parsePositionEvent(event: NDKEvent | NostrEvent): PositionRecord | null {
  const raw = rawEventOf(event);
  if (raw.kind !== CASCADE_POSITION_KIND || !raw.id) return null;

  const dTag = firstTagValue(raw.tags, 'd');
  const dTagParts = dTag?.startsWith('cascade:position:') ? dTag.split(':') : null;

  let payload: Record<string, unknown> = {};
  if (raw.content) {
    try {
      payload = JSON.parse(raw.content) as Record<string, unknown>;
    } catch {
      payload = {};
    }
  }

  const marketId =
    readString(payload.marketId) ||
    readString(tagRecord(raw.tags).market) ||
    (dTagParts && dTagParts.length >= 4 ? dTagParts.slice(2, -1).join(':') : undefined);
  const direction =
    readDirection(payload.direction) ||
    readDirection(tagRecord(raw.tags).direction) ||
    readDirection(dTagParts ? dTagParts[dTagParts.length - 1] : undefined);

  if (!marketId || !direction) return null;

  return {
    id: readString(payload.id) || raw.id,
    pubkey: raw.pubkey,
    marketId,
    marketTitle: readString(payload.marketTitle),
    direction,
    quantity: readNumber(payload.quantity) ?? readNumber(payload.shares) ?? 0,
    stakeSats:
      readNumber(payload.costBasis) ??
      readNumber(payload.amountSats) ??
      readNumber(tagRecord(raw.tags).amount) ??
      0,
    entryPrice:
      readNumber(payload.entryPrice) ??
      readNumber(payload.avgPrice) ??
      readNumber(tagRecord(raw.tags).avg_price) ??
      0,
    createdAt:
      readNumber(payload.timestamp) ??
      (raw.created_at ? raw.created_at * 1000 : 0),
    rawEvent: raw
  };
}

export function buildTradeSummary(trades: TradeRecord[]): MarketTradeSummary {
  if (trades.length === 0) {
    return {
      tradeCount: 0,
      grossVolume: 0,
      buyVolume: 0,
      sellVolume: 0,
      longVolume: 0,
      shortVolume: 0,
      latestTradeAt: null,
      latestPricePpm: null,
      latestDirection: null,
      latestType: null
    };
  }

  const ordered = [...trades].sort((left, right) => right.createdAt - left.createdAt);
  const latest = ordered[0];

  return {
    tradeCount: trades.length,
    grossVolume: trades.reduce((sum, trade) => sum + trade.amount, 0),
    buyVolume: trades.filter((trade) => trade.type === 'buy').reduce((sum, trade) => sum + trade.amount, 0),
    sellVolume: trades.filter((trade) => trade.type === 'sell').reduce((sum, trade) => sum + trade.amount, 0),
    longVolume: trades.filter((trade) => trade.direction === 'long').reduce((sum, trade) => sum + trade.amount, 0),
    shortVolume: trades.filter((trade) => trade.direction === 'short').reduce((sum, trade) => sum + trade.amount, 0),
    latestTradeAt: latest.createdAt,
    latestPricePpm: yesPricePpmFromTrade(latest),
    latestDirection: latest.direction,
    latestType: latest.type
  };
}

export function yesPricePpmFromTrade(trade: Pick<TradeRecord, 'direction' | 'pricePpm'>): number {
  return trade.direction === 'long' ? trade.pricePpm : 1_000_000 - trade.pricePpm;
}

export function buildDiscussionThreads(records: DiscussionRecord[], marketId: string): DiscussionThread[] {
  const relevant = records
    .filter((record) => record.marketId === marketId)
    .sort((left, right) => left.createdAt - right.createdAt);

  const nodeMap = new Map<string, DiscussionThread>();
  for (const record of relevant) {
    nodeMap.set(record.id, {
      post: record,
      replies: [],
      replyCount: 0,
      lastActivityAt: record.createdAt
    });
  }

  const roots: DiscussionThread[] = [];
  for (const record of relevant) {
    const node = nodeMap.get(record.id);
    if (!node) continue;

    const isRootPost =
      record.replyTo === undefined ||
      record.replyTo === record.marketId ||
      record.replyTo === record.rootId;

    if (isRootPost) {
      roots.push(node);
      continue;
    }

    const parent = record.replyTo ? nodeMap.get(record.replyTo) : undefined;
    if (parent) {
      parent.replies.push(node);
    } else {
      roots.push(node);
    }
  }

  for (const root of roots) {
    annotateThreadMeta(root);
  }

  return roots.sort((left, right) => right.lastActivityAt - left.lastActivityAt);
}

export function marketUrl(slug: string): string {
  return `/market/${encodeURIComponent(slug)}`;
}

export function marketDiscussionUrl(slug: string): string {
  return `${marketUrl(slug)}/discussion`;
}

export function marketChartsUrl(slug: string): string {
  return `${marketUrl(slug)}/charts`;
}

export function marketActivityUrl(slug: string): string {
  return `${marketUrl(slug)}/activity`;
}

export function threadUrl(slug: string, threadId: string): string {
  return `${marketDiscussionUrl(slug)}/${encodeURIComponent(threadId)}`;
}

export function formatSats(value: number | null | undefined): string {
  const amount = Math.max(0, value ?? 0);
  return USD_FORMATTER.format(amount / 100);
}

export function formatProbability(probability: number | null | undefined): string {
  if (probability === null || probability === undefined || Number.isNaN(probability)) return '—';
  return `${(probability * 100).toFixed(1)}%`;
}

export function formatRelativeTime(timestampSeconds: number | null | undefined): string {
  if (!timestampSeconds) return 'Unknown';
  const seconds = Math.max(1, Math.floor(Date.now() / 1000 - timestampSeconds));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)}d ago`;
  return `${Math.floor(seconds / 604_800)}w ago`;
}

export function truncateText(value: string, maxLength = 160): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

export function sanitizeMarketCopy(value: string): string {
  return value
    .replace(/resolution criteria/gi, 'trading context')
    .replace(/\bresolves based on whether\b/gi, 'tracks whether')
    .replace(/\bresolves based on\b/gi, 'tracks')
    .replace(/\bresolves if\b/gi, 'tracks if')
    .replace(/\bresolves when\b/gi, 'tracks when')
    .replace(/\bresolves on\b/gi, 'tracks on')
    .replace(/\bresolves to\b/gi, 'tracks to')
    .replace(/\bresolves\b/gi, 'tracks')
    .replace(/\bresolved\b/gi, 'priced')
    .replace(/\bresolution\b/gi, 'market state');
}

function annotateThreadMeta(node: DiscussionThread): { replyCount: number; lastActivityAt: number } {
  let replyCount = 0;
  let lastActivityAt = node.post.createdAt;

  for (const reply of node.replies) {
    const replyMeta = annotateThreadMeta(reply);
    replyCount += 1 + replyMeta.replyCount;
    lastActivityAt = Math.max(lastActivityAt, replyMeta.lastActivityAt);
  }

  node.replyCount = replyCount;
  node.lastActivityAt = lastActivityAt;
  node.replies.sort((left, right) => left.post.createdAt - right.post.createdAt);

  return { replyCount, lastActivityAt };
}

function firstTagValue(tags: string[][], name: string): string | undefined {
  return tags.find((tag) => tag[0] === name)?.[1];
}

function tagValues(tags: string[][], name: string): string[] {
  return tags.filter((tag) => tag[0] === name && tag[1]).map((tag) => tag[1]);
}

function integerTag(tags: string[][], name: string): number | undefined {
  const value = firstTagValue(tags, name);
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function tagRecord(tags: string[][]): Record<string, string> {
  return Object.fromEntries(tags.filter((tag) => tag[0] && tag[1]).map((tag) => [tag[0], tag[1]]));
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function readDirection(value: unknown): 'long' | 'short' | undefined {
  if (value === 'long' || value === 'short') return value;
  if (value === 'LONG') return 'long';
  if (value === 'SHORT') return 'short';
  return undefined;
}
