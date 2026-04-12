import { storageKey } from '$lib/cascade/config';

export type TransactionType = 'deposit' | 'withdrawal' | 'receive';
export type TransactionStatus = 'pending' | 'complete' | 'failed';

export interface WalletTransaction {
  id: string;
  type: TransactionType;
  amount: number;
  fee?: number;
  status: TransactionStatus;
  timestamp: number;
  destination?: string;
}

const STORAGE_KEY = storageKey('cascade_wallet_history');
const MAX_TRANSACTIONS = 500;

function loadHistory(): WalletTransaction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as WalletTransaction[];
  } catch {
    return [];
  }
}

function saveHistory(history: WalletTransaction[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // Ignore storage issues in unsupported contexts.
  }
}

export function addTransaction(
  tx: Omit<WalletTransaction, 'id' | 'timestamp'>
): WalletTransaction {
  const entry: WalletTransaction = {
    ...tx,
    id: crypto.randomUUID(),
    timestamp: Math.floor(Date.now() / 1000)
  };

  const updated = [entry, ...loadHistory()];
  if (updated.length > MAX_TRANSACTIONS) updated.splice(MAX_TRANSACTIONS);
  saveHistory(updated);
  return entry;
}

export function updateTransaction(
  id: string,
  updates: Partial<Omit<WalletTransaction, 'id'>>
): boolean {
  const history = loadHistory();
  const index = history.findIndex((item) => item.id === id);
  if (index === -1) return false;
  history[index] = { ...history[index], ...updates };
  saveHistory(history);
  return true;
}

export function getTransactions(): WalletTransaction[] {
  return loadHistory();
}
