import { storageKey } from '$lib/cascade/config';
import type { ProductProof } from '$lib/cascade/api';
import type { PendingOutputPreparation } from '$lib/wallet/cashuMint';

export type PendingTopupRecord = {
  id: string;
  requestId?: string;
  topupId?: string;
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

export type LocalTopupHistoryRecord = {
  id: string;
  topupId?: string;
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
  side: 'yes' | 'no';
  spentUnit?: string;
  spentProofs?: ProductProof[];
  issuedPreparation?: PendingOutputPreparation;
  changePreparation?: PendingOutputPreparation;
  createdAt: number;
};

const PENDING_TOPUPS_KEY = storageKey('cascade_pending_topups');
const TRADE_RECEIPTS_KEY = storageKey('cascade_trade_receipts');
const TOPUP_HISTORY_KEY = storageKey('cascade_topup_history');
const MAX_PENDING_TOPUPS = 32;
const MAX_TRADE_RECEIPTS = 32;
const MAX_TOPUP_HISTORY = 64;

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

export function patchPendingTopup(
  id: string,
  patch: Partial<
    Pick<
      PendingTopupRecord,
      | 'topupId'
      | 'status'
      | 'invoice'
      | 'paymentHash'
      | 'checkoutUrl'
      | 'checkoutSessionId'
      | 'checkoutExpiresAt'
    >
  >
): void {
  const records = loadRecords<PendingTopupRecord>(PENDING_TOPUPS_KEY);
  const index = records.findIndex((record) => record.id === id);
  if (index === -1) return;
  records[index] = { ...records[index], ...patch };
  saveRecords(PENDING_TOPUPS_KEY, records);
}

export function attachPendingTopupMintPreparation(
  id: string,
  preparation: NonNullable<PendingTopupRecord['mintPreparation']>
): void {
  const records = loadRecords<PendingTopupRecord>(PENDING_TOPUPS_KEY);
  const index = records.findIndex((record) => record.id === id);
  if (index === -1) return;
  records[index] = { ...records[index], mintPreparation: preparation };
  saveRecords(PENDING_TOPUPS_KEY, records);
}

export function clearPendingTopup(id: string): void {
  const records = loadRecords<PendingTopupRecord>(PENDING_TOPUPS_KEY).filter(
    (record) => record.id !== id
  );
  saveRecords(PENDING_TOPUPS_KEY, records);
}

export function recordTopupHistory(
  entry: Omit<LocalTopupHistoryRecord, 'updatedAt'>
): void {
  const records = loadRecords<LocalTopupHistoryRecord>(TOPUP_HISTORY_KEY).filter(
    (record) => record.id !== entry.id
  );

  records.unshift({
    ...entry,
    updatedAt: Date.now()
  });

  if (records.length > MAX_TOPUP_HISTORY) records.splice(MAX_TOPUP_HISTORY);
  saveRecords(TOPUP_HISTORY_KEY, records);
}

export function listTopupHistory(pubkey: string): LocalTopupHistoryRecord[] {
  return loadRecords<LocalTopupHistoryRecord>(TOPUP_HISTORY_KEY).filter(
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

export function clearTradeReceipt(id: string): void {
  const records = loadRecords<TradeReceiptRecord>(TRADE_RECEIPTS_KEY).filter(
    (record) => record.id !== id
  );
  saveRecords(TRADE_RECEIPTS_KEY, records);
}
