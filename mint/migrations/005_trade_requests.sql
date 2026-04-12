CREATE TABLE IF NOT EXISTS trade_execution_requests (
    request_id TEXT PRIMARY KEY,
    pubkey TEXT NOT NULL,
    market_event_id TEXT NOT NULL,
    trade_type TEXT NOT NULL,
    side TEXT NOT NULL,
    spend_minor INTEGER,
    quantity REAL,
    status TEXT NOT NULL DEFAULT 'pending',
    error_message TEXT,
    trade_id TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_trade_execution_requests_pubkey
    ON trade_execution_requests(pubkey, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trade_execution_requests_market
    ON trade_execution_requests(market_event_id, created_at DESC);

