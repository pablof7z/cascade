CREATE TABLE IF NOT EXISTS fx_quote_snapshots (
    id TEXT PRIMARY KEY,
    amount_minor INTEGER NOT NULL,
    amount_msat INTEGER NOT NULL,
    btc_usd_price REAL NOT NULL,
    source TEXT NOT NULL,
    spread_bps INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS wallet_topup_quotes (
    id TEXT PRIMARY KEY,
    pubkey TEXT NOT NULL,
    rail TEXT NOT NULL,
    amount_minor INTEGER NOT NULL,
    amount_msat INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'invoice_pending',
    invoice TEXT,
    payment_hash TEXT,
    fx_quote_id TEXT NOT NULL,
    funding_event_id TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    expires_at INTEGER NOT NULL,
    settled_at INTEGER,
    completed_at INTEGER,
    FOREIGN KEY (fx_quote_id) REFERENCES fx_quote_snapshots(id) ON DELETE RESTRICT,
    FOREIGN KEY (funding_event_id) REFERENCES wallet_funding_events(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_fx_quote_expires_at ON fx_quote_snapshots(expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_topup_quotes_pubkey ON wallet_topup_quotes(pubkey, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_topup_quotes_status ON wallet_topup_quotes(status, expires_at ASC);
CREATE INDEX IF NOT EXISTS idx_wallet_topup_quotes_payment_hash ON wallet_topup_quotes(payment_hash);
