import { storageKey } from '$lib/cascade/config';
import type { ProductProof } from '$lib/cascade/api';

type PendingTopupRecord = {
  id: string;
  requestId?: string;
  topupId?: string;
  pubkey: string;
  amountMinor: number;
  rail: 'lightning';
  pendingNotified: boolean;
  createdAt: number;
};

type TradeReceiptRecord = {
  id: string;
  tradeId?: string;
  quoteId?: string;
  pubkey: string;
  eventId: string;
  marketSlug: string;
  action: 'buy' | 'sell' | 'seed';
  side: 'yes' | 'no';
  spentUnit?: string;
  spentProofs?: ProductProof[];
  createdAt: number;
};

const PENDING_TOPUPS_KEY = storageKey('cascade_pending_topups');
const TRADE_RECEIPTS_KEY = storageKey('cascade_trade_receipts');
const MAX_PENDING_TOPUPS = 32;
const MAX_TRADE_RECEIPTS = 32;

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

export function trackPendingTopup(entry: Omit<PendingTopupRecord, 'pendingNotified' | 'createdAt'>): void {
  const records = loadRecords<PendingTopupRecord>(PENDING_TOPUPS_KEY).filter(
    (record) => record.id !== entry.id
  );

  records.unshift({
    ...entry,
    pendingNotified: false,
    createdAt: Date.now()
  });

  if (records.length > MAX_PENDING_TOPUPS) records.splice(MAX_PENDING_TOPUPS);
  saveRecords(PENDING_TOPUPS_KEY, records);
}

export function listPendingTopups(pubkey: string): PendingTopupRecord[] {
  return loadRecords<PendingTopupRecord>(PENDING_TOPUPS_KEY).filter((record) => record.pubkey === pubkey);
}

export function markPendingTopupNotified(id: string): void {
  const records = loadRecords<PendingTopupRecord>(PENDING_TOPUPS_KEY);
  const index = records.findIndex((record) => record.id === id);
  if (index === -1) return;
  records[index] = { ...records[index], pendingNotified: true };
  saveRecords(PENDING_TOPUPS_KEY, records);
}

export function attachPendingTopupId(id: string, topupId: string): void {
  const records = loadRecords<PendingTopupRecord>(PENDING_TOPUPS_KEY);
  const index = records.findIndex((record) => record.id === id);
  if (index === -1) return;
  records[index] = { ...records[index], topupId };
  saveRecords(PENDING_TOPUPS_KEY, records);
}

export function clearPendingTopup(id: string): void {
  const records = loadRecords<PendingTopupRecord>(PENDING_TOPUPS_KEY).filter(
    (record) => record.id !== id
  );
  saveRecords(PENDING_TOPUPS_KEY, records);
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

export function listTradeReceipts(pubkey: string, eventId?: string): TradeReceiptRecord[] {
  return loadRecords<TradeReceiptRecord>(TRADE_RECEIPTS_KEY).filter((record) => {
    if (record.pubkey !== pubkey) return false;
    if (eventId && record.eventId !== eventId) return false;
    return true;
  });
}

export function clearTradeReceipt(id: string): void {
  const records = loadRecords<TradeReceiptRecord>(TRADE_RECEIPTS_KEY).filter(
    (record) => record.id !== id
  );
  saveRecords(TRADE_RECEIPTS_KEY, records);
}
