export type WalletErrorCode =
	| 'MINT_UNREACHABLE'
	| 'MINT_ERROR'
	| 'INSUFFICIENT_BALANCE'
	| 'INVOICE_EXPIRED'
	| 'INVOICE_INVALID'
	| 'LIGHTNING_ADDRESS_UNREACHABLE'
	| 'MELT_FAILED'
	| 'MINT_TOKENS_FAILED'
	| 'TOKEN_ALREADY_SPENT'
	| 'NETWORK_ERROR'
	| 'UNKNOWN';

export class WalletError extends Error {
	code: WalletErrorCode;
	userMessage: string;
	recoverable: boolean;

	constructor(code: WalletErrorCode, userMessage: string, recoverable: boolean, cause?: unknown) {
		super(userMessage, cause !== undefined ? { cause } : undefined);
		this.name = 'WalletError';
		this.code = code;
		this.userMessage = userMessage;
		this.recoverable = recoverable;
	}
}

export function classifyError(err: unknown): WalletError {
	if (err instanceof WalletError) {
		return err;
	}

	const message =
		err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unknown error';
	const lower = message.toLowerCase();

	// Most specific checks first
	if (lower.includes('lightning address') || lower.includes('domain unreachable') || lower.includes('address not found') || lower.includes('lnurlp')) {
		return new WalletError('LIGHTNING_ADDRESS_UNREACHABLE', 'Lightning address unreachable', true, err);
	}
	if (lower.includes('already spent')) {
		return new WalletError('TOKEN_ALREADY_SPENT', 'Token already spent', false, err);
	}
	if (lower.includes('mint tokens') || lower.includes('minting')) {
		return new WalletError('MINT_TOKENS_FAILED', 'Failed to mint tokens', true, err);
	}
	if (lower.includes('insufficient') || lower.includes('balance')) {
		return new WalletError('INSUFFICIENT_BALANCE', 'Insufficient balance', false, err);
	}
	if (lower.includes('expired')) {
		return new WalletError('INVOICE_EXPIRED', 'Invoice has expired', false, err);
	}
	if (lower.includes('invoice') || lower.includes('bolt11') || lower.includes('payment request')) {
		return new WalletError('INVOICE_INVALID', 'Invalid invoice', false, err);
	}
	if (lower.includes('melt')) {
		return new WalletError('MELT_FAILED', 'Payment failed', true, err);
	}
	if (lower.includes('fetch failed') || lower.includes('econnrefused') || lower.includes('connection refused')) {
		return new WalletError('MINT_UNREACHABLE', 'Mint is unreachable', true, err);
	}
	if (lower.includes('network') || lower.includes('timeout') || lower.includes('timed out') || lower.includes('offline')) {
		return new WalletError('NETWORK_ERROR', 'Network error', true, err);
	}
	if (lower.includes('mint')) {
		return new WalletError('MINT_ERROR', 'Mint error', true, err);
	}

	return new WalletError('UNKNOWN', message || 'Unknown error', false, err);
}
