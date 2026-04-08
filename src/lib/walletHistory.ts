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
	memo?: string;
	metadata?: Record<string, unknown>;
}

const STORAGE_KEY = 'cascade_wallet_history';
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

function saveHistory(txs: WalletTransaction[]): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(txs));
	} catch {
		// Silently fail — SSR or storage quota
	}
}

export function addTransaction(
	tx: Omit<WalletTransaction, 'id' | 'timestamp'>
): WalletTransaction {
	const newTx: WalletTransaction = {
		...tx,
		id: crypto.randomUUID(),
		timestamp: Math.floor(Date.now() / 1000)
	};

	const history = loadHistory();
	const updated = [newTx, ...history];

	if (updated.length > MAX_TRANSACTIONS) {
		updated.splice(MAX_TRANSACTIONS);
	}

	saveHistory(updated);
	return newTx;
}

export function updateTransaction(
	id: string,
	updates: Partial<Omit<WalletTransaction, 'id'>>
): boolean {
	const history = loadHistory();
	const index = history.findIndex((tx) => tx.id === id);

	if (index === -1) return false;

	history[index] = { ...history[index], ...updates };
	saveHistory(history);
	return true;
}

export function getTransactions(): WalletTransaction[] {
	return loadHistory();
}

export function clearHistory(): void {
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch {
		// Silently fail — SSR safety
	}
}
