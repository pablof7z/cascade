import type { ProductTradeEvent, ProductTradeExecution, ProductTradeStatus } from '$lib/cascade/api';
import { storageKey } from '$lib/cascade/config';
import { quantityToShareMinor } from '$lib/cascade/shares';

export type LocalPositionBookEntry = {
  mintUrl: string;
  marketEventId: string;
  marketSlug: string;
  marketTitle: string;
  side: 'long' | 'short';
  quantityMinor: number;
  costBasisMinor: number;
  updatedAt: number;
};

type LocalPositionBookState = {
  version: 1;
  entries: LocalPositionBookEntry[];
  appliedTradeIds: string[];
};

type LocalPositionTradeInput = {
  mintUrl: string;
  tradeId: string;
  marketEventId: string;
  marketSlug: string;
  marketTitle: string;
  side: 'long' | 'short';
  action: 'buy' | 'sell' | 'seed';
  quantityMinor: number;
  amountMinor: number;
};

const POSITION_BOOK_KEY = storageKey('cascade_position_book');
const MAX_APPLIED_TRADE_IDS = 512;

function emptyState(): LocalPositionBookState {
  return {
    version: 1,
    entries: [],
    appliedTradeIds: []
  };
}

function loadState(): LocalPositionBookState {
  try {
    const raw = localStorage.getItem(POSITION_BOOK_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<LocalPositionBookState>;
    const entries = Array.isArray(parsed.entries)
      ? parsed.entries
          .map((entry) => {
            if (!entry || typeof entry !== 'object') return null;
            const candidate = entry as Partial<LocalPositionBookEntry>;
            if (
              typeof candidate.mintUrl !== 'string' ||
              typeof candidate.marketEventId !== 'string' ||
              typeof candidate.marketSlug !== 'string' ||
              (candidate.side !== 'long' && candidate.side !== 'short') ||
              typeof candidate.quantityMinor !== 'number' ||
              typeof candidate.costBasisMinor !== 'number'
            ) {
              return null;
            }

            return {
              mintUrl: candidate.mintUrl,
              marketEventId: candidate.marketEventId,
              marketSlug: candidate.marketSlug,
              marketTitle:
                typeof candidate.marketTitle === 'string' && candidate.marketTitle.trim()
                  ? candidate.marketTitle
                  : candidate.marketSlug,
              side: candidate.side,
              quantityMinor: candidate.quantityMinor,
              costBasisMinor: candidate.costBasisMinor,
              updatedAt:
                typeof candidate.updatedAt === 'number' ? candidate.updatedAt : Date.now()
            } satisfies LocalPositionBookEntry;
          })
          .filter((entry): entry is LocalPositionBookEntry => entry !== null)
      : [];
    return {
      version: 1,
      entries,
      appliedTradeIds: Array.isArray(parsed.appliedTradeIds) ? parsed.appliedTradeIds : []
    };
  } catch {
    return emptyState();
  }
}

function saveState(state: LocalPositionBookState): void {
  try {
    localStorage.setItem(POSITION_BOOK_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage failures in unsupported contexts.
  }
}

function entryKey(entry: Pick<LocalPositionBookEntry, 'mintUrl' | 'marketEventId' | 'side'>): string {
  return `${entry.mintUrl}:${entry.marketEventId}:${entry.side}`;
}

function parseTradeTagValue(
  tags: unknown,
  tagName: string
): string | null {
  if (!Array.isArray(tags)) return null;

  for (const tag of tags) {
    if (!Array.isArray(tag) || tag.length < 2) continue;
    if (tag[0] !== tagName) continue;
    const value = tag[1];
    return typeof value === 'string' ? value : null;
  }

  return null;
}

function normalizedTradeInputAction(value: string | null, fallback: 'buy' | 'sell' | 'seed'): 'buy' | 'sell' | 'seed' {
  if (value === 'buy' || value === 'sell') return value;
  return fallback;
}

function normalizedTradeInputSide(
  value: string | null,
  fallback: 'long' | 'short'
): 'long' | 'short' | null {
  if (value === null) return fallback;
  if (value === 'long' || value === 'short') return value;
  return null;
}

export function listLocalPositionBook(mintUrl: string): LocalPositionBookEntry[] {
  return loadState().entries.filter((entry) => entry.mintUrl === mintUrl);
}

export function applyLocalPositionTrade(input: LocalPositionTradeInput): boolean {
  const state = loadState();

  if (state.appliedTradeIds.includes(input.tradeId)) {
    return false;
  }

  const key = entryKey(input);
  const index = state.entries.findIndex((entry) => entryKey(entry) === key);
  const current = index === -1 ? null : state.entries[index];
  const now = Date.now();
  const action = input.action === 'seed' ? 'buy' : input.action;

  if (action === 'buy') {
    const next: LocalPositionBookEntry = current
      ? {
          ...current,
          marketSlug: input.marketSlug,
          marketTitle: input.marketTitle,
          quantityMinor: current.quantityMinor + input.quantityMinor,
          costBasisMinor: current.costBasisMinor + input.amountMinor,
          updatedAt: now
        }
      : {
          mintUrl: input.mintUrl,
          marketEventId: input.marketEventId,
          marketSlug: input.marketSlug,
          marketTitle: input.marketTitle,
          side: input.side,
          quantityMinor: input.quantityMinor,
          costBasisMinor: input.amountMinor,
          updatedAt: now
        };

    if (index === -1) {
      state.entries.push(next);
    } else {
      state.entries[index] = next;
    }
  } else if (current) {
    const soldRatio = current.quantityMinor > 0
      ? Math.min(1, input.quantityMinor / current.quantityMinor)
      : 1;
    const releasedCostBasis = Math.round(current.costBasisMinor * soldRatio);
    const remainingQuantityMinor = Math.max(0, current.quantityMinor - input.quantityMinor);
    const remainingCostBasisMinor = Math.max(0, current.costBasisMinor - releasedCostBasis);

    if (remainingQuantityMinor > 0) {
      state.entries[index] = {
        ...current,
        marketSlug: input.marketSlug,
        marketTitle: input.marketTitle,
        quantityMinor: remainingQuantityMinor,
        costBasisMinor: remainingCostBasisMinor,
        updatedAt: now
      };
    } else {
      state.entries.splice(index, 1);
    }
  }

  state.appliedTradeIds.unshift(input.tradeId);
  if (state.appliedTradeIds.length > MAX_APPLIED_TRADE_IDS) {
    state.appliedTradeIds.splice(MAX_APPLIED_TRADE_IDS);
  }
  saveState(state);
  return true;
}

export function applyLocalPositionTradeFromPayload(
  mintUrl: string,
  payload: ProductTradeExecution | ProductTradeStatus,
  fallbackAction: 'buy' | 'sell' | 'seed',
  fallbackSide: 'long' | 'short'
): boolean {
  const trade = payload.trade as ProductTradeEvent | undefined;
  const tradeId = typeof trade?.id === 'string' ? trade.id : null;
  if (!tradeId) return false;

  const tradeType = normalizedTradeInputAction(
    parseTradeTagValue(trade?.tags, 'type'),
    fallbackAction
  );
  const side = normalizedTradeInputSide(
    parseTradeTagValue(trade?.tags, 'direction'),
    fallbackSide
  );
  if (!side) return false;
  const quantity = Number.parseFloat(parseTradeTagValue(trade?.tags, 'quantity') || '');
  const amountMinor = Number.parseInt(parseTradeTagValue(trade?.tags, 'amount') || '', 10);

  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(amountMinor) || amountMinor < 0) {
    return false;
  }

  return applyLocalPositionTrade({
    mintUrl,
    tradeId,
    marketEventId: payload.market.event_id,
    marketSlug: payload.market.slug,
    marketTitle: payload.market.title,
    side,
    action: tradeType,
    quantityMinor: quantityToShareMinor(quantity),
    amountMinor
  });
}
