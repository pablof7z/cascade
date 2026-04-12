CREATE TABLE IF NOT EXISTS wallet_topup_requests (
    request_id TEXT PRIMARY KEY,
    pubkey TEXT NOT NULL,
    rail TEXT NOT NULL,
    amount_minor INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    error_message TEXT,
    topup_quote_id TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    completed_at INTEGER,
    FOREIGN KEY (topup_quote_id) REFERENCES wallet_topup_quotes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_wallet_topup_requests_pubkey
    ON wallet_topup_requests(pubkey, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_topup_requests_rail
    ON wallet_topup_requests(rail, created_at DESC);
