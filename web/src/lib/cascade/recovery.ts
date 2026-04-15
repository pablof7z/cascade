import { storageKey } from '$lib/cascade/config';
import type { ProductProof } from '$lib/cascade/api';
import type { PendingOutputPreparation } from '$lib/wallet/cashuMint';

export type PendingFundingRecord = {
  id: string;
  requestId?: string;
  fundingId?: string;
  pubkey: string;
  amountMinor: number;
  rail: 'lightning' | 'stripe';
  status?: string;
  invoice?: string;
  paymentHash?: string;
  checkoutUrl?: string;
  checkoutSessionId?: string;
  checkoutExpiresAt?: number;
  mintPreparation?: {
    counterStart: number;
    keysetId: string;
    outputCount?: number;
  };
  pendingNotified: boolean;
  createdAt: number;
};

export type LocalFundingHistoryRecord = {
  id: string;
  fundingId?: string;
  pubkey: string;
  amountMinor: number;
  rail: 'lightning' | 'stripe';
  status: string;
  invoice?: string;
  paymentHash?: string;
  checkoutUrl?: string;
  checkoutSessionId?: string;
  checkoutExpiresAt?: number;
  createdAt: number;
  updatedAt: number;
};

type TradeReceiptRecord = {
  id: string;
  tradeId?: string;
  quoteId?: string;
  pubkey: string;
  eventId: string;
  marketSlug: string;
  action: 'buy' | 'sell' | 'seed';
  side: 'long' | 'short';
  spentUnit?: string;
  spentProofs?: ProductProof[];
  issuedPreparation?: PendingOutputPreparation;
  changePreparation?: PendingOutputPreparation;
  createdAt: number;
};

export type PendingCreatorMarketRecord = {
  eventId: string;
  pubkey: string;
  slug: string;
  title: string;
  createdAt: number;
  rawEvent?: unknown;
};

const PENDING_FUNDINGS_KEY = storageKey('cascade_pending_fundings');
const TRADE_RECEIPTS_KEY = storageKey('cascade_trade_receipts');
const FUNDING_HISTORY_KEY = storageKey('cascade_funding_history');
const PENDING_CREATOR_MARKETS_KEY = storageKey('cascade_pending_creator_markets');
const MAX_PENDING_FUNDINGS = 32;
const MAX_TRADE_RECEIPTS = 32;
const MAX_FUNDING_HISTORY = 64;
const MAX_PENDING_CREATOR_MARKETS = 64;

function loadRecords<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

function saveRecords<T>(key: string, records: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(records));
  } catch {
    // Ignore storage issues in unsupported contexts.
  }
}

export function trackPendingFunding(entry: Omit<PendingFundingRecord, 'pendingNotified' | 'createdAt'>): void {
  const records = loadRecords<PendingFundingRecord>(PENDING_FUNDINGS_KEY).filter(
    (record) => record.id !== entry.id
  );

  records.unshift({
    ...entry,
    pendingNotified: false,
    createdAt: Date.now()
  });

  if (records.length > MAX_PENDING_FUNDINGS) records.splice(MAX_PENDING_FUNDINGS);
  saveRecords(PENDING_FUNDINGS_KEY, records);
}

export function listPendingFundings(pubkey: string): PendingFundingRecord[] {
  return loadRecords<PendingFundingRecord>(PENDING_FUNDINGS_KEY).filter((record) => record.pubkey === pubkey);
}

export function markPendingFundingNotified(id: string): void {
  const records = loadRecords<PendingFundingRecord>(PENDING_FUNDINGS_KEY);
  const index = records.findIndex((record) => record.id === id);
  if (index === -1) return;
  records[index] = { ...records[index], pendingNotified: true };
  saveRecords(PENDING_FUNDINGS_KEY, records);
}

export function attachPendingFundingId(id: string, fundingId: string): void {
  const records = loadRecords<PendingFundingRecord>(PENDING_FUNDINGS_KEY);
  const index = records.findIndex((record) => record.id === id);
  if (index === -1) return;
  records[index] = { ...records[index], fundingId };
  saveRecords(PENDING_FUNDINGS_KEY, records);
}

export function patchPendingFunding(
  id: string,
  patch: Partial<
    Pick<
      PendingFundingRecord,
      | 'fundingId'
      | 'status'
      | 'invoice'
      | 'paymentHash'
      | 'checkoutUrl'
      | 'checkoutSessionId'
      | 'checkoutExpiresAt'
    >
  >
): void {
  const records = loadRecords<PendingFundingRecord>(PENDING_FUNDINGS_KEY);
  const index = records.findIndex((record) => record.id === id);
  if (index === -1) return;
  records[index] = { ...records[index], ...patch };
  saveRecords(PENDING_FUNDINGS_KEY, records);
}

export function attachPendingFundingMintPreparation(
  id: string,
  preparation: NonNullable<PendingFundingRecord['mintPreparation']>
): void {
  const records = loadRecords<PendingFundingRecord>(PENDING_FUNDINGS_KEY);
  const index = records.findIndex((record) => record.id === id);
  if (index === -1) return;
  records[index] = { ...records[index], mintPreparation: preparation };
  saveRecords(PENDING_FUNDINGS_KEY, records);
}

export function clearPendingFunding(id: string): void {
  const records = loadRecords<PendingFundingRecord>(PENDING_FUNDINGS_KEY).filter(
    (record) => record.id !== id
  );
  saveRecords(PENDING_FUNDINGS_KEY, records);
}

export function recordFundingHistory(
  entry: Omit<LocalFundingHistoryRecord, 'updatedAt'>
): void {
  const records = loadRecords<LocalFundingHistoryRecord>(FUNDING_HISTORY_KEY).filter(
    (record) => record.id !== entry.id
  );

  records.unshift({
    ...entry,
    updatedAt: Date.now()
  });

  if (records.length > MAX_FUNDING_HISTORY) records.splice(MAX_FUNDING_HISTORY);
  saveRecords(FUNDING_HISTORY_KEY, records);
}

export function listFundingHistory(pubkey: string): LocalFundingHistoryRecord[] {
  return loadRecords<LocalFundingHistoryRecord>(FUNDING_HISTORY_KEY).filter(
    (record) => record.pubkey === pubkey
  );
}

export function trackTradeReceipt(entry: Omit<TradeReceiptRecord, 'createdAt'>): void {
  const records = loadRecords<TradeReceiptRecord>(TRADE_RECEIPTS_KEY).filter(
    (record) => record.id !== entry.id
  );

  records.unshift({
    ...entry,
    createdAt: Date.now()
  });

  if (records.length > MAX_TRADE_RECEIPTS) records.splice(MAX_TRADE_RECEIPTS);
  saveRecords(TRADE_RECEIPTS_KEY, records);
}

export function markTradeReceiptTradeId(id: string, tradeId: string): void {
  const records = loadRecords<TradeReceiptRecord>(TRADE_RECEIPTS_KEY);
  const index = records.findIndex((record) => record.id === id);
  if (index === -1) return;
  records[index] = { ...records[index], tradeId };
  saveRecords(TRADE_RECEIPTS_KEY, records);
}

export function attachTradeReceiptQuoteId(id: string, quoteId: string): void {
  const records = loadRecords<TradeReceiptRecord>(TRADE_RECEIPTS_KEY);
  const index = records.findIndex((record) => record.id === id);
  if (index === -1) return;
  records[index] = { ...records[index], quoteId };
  saveRecords(TRADE_RECEIPTS_KEY, records);
}

export function attachTradeReceiptPreparations(
  id: string,
  preparations: Pick<TradeReceiptRecord, 'issuedPreparation' | 'changePreparation'>
): void {
  const records = loadRecords<TradeReceiptRecord>(TRADE_RECEIPTS_KEY);
  const index = records.findIndex((record) => record.id === id);
  if (index === -1) return;
  records[index] = { ...records[index], ...preparations };
  saveRecords(TRADE_RECEIPTS_KEY, records);
}

export function listTradeReceipts(pubkey: string, eventId?: string): TradeReceiptRecord[] {
  return loadRecords<TradeReceiptRecord>(TRADE_RECEIPTS_KEY).filter((record) => {
    if (record.pubkey !== pubkey) return false;
    if (eventId && record.eventId !== eventId) return false;
    return true;
  });
}

export function trackPendingCreatorMarket(entry: PendingCreatorMarketRecord): void {
  const records = loadRecords<PendingCreatorMarketRecord>(PENDING_CREATOR_MARKETS_KEY).filter(
    (record) => !(record.eventId === entry.eventId && record.pubkey === entry.pubkey)
  );

  records.unshift(entry);

  if (records.length > MAX_PENDING_CREATOR_MARKETS) records.splice(MAX_PENDING_CREATOR_MARKETS);
  saveRecords(PENDING_CREATOR_MARKETS_KEY, records);
}

export function listPendingCreatorMarkets(pubkey: string): PendingCreatorMarketRecord[] {
  return loadRecords<PendingCreatorMarketRecord>(PENDING_CREATOR_MARKETS_KEY).filter(
    (record) => record.pubkey === pubkey
  );
}

export function clearPendingCreatorMarket(eventId: string, pubkey?: string): void {
  const records = loadRecords<PendingCreatorMarketRecord>(PENDING_CREATOR_MARKETS_KEY).filter(
    (record) => {
      if (record.eventId !== eventId) return true;
      if (pubkey && record.pubkey !== pubkey) return true;
      return false;
    }
  );
  saveRecords(PENDING_CREATOR_MARKETS_KEY, records);
}

export function clearTradeReceipt(id: string): void {
  const records = loadRecords<TradeReceiptRecord>(TRADE_RECEIPTS_KEY).filter(
    (record) => record.id !== id
  );
  saveRecords(TRADE_RECEIPTS_KEY, records);
}
