CREATE TABLE IF NOT EXISTS trade_settlements (
    id TEXT PRIMARY KEY,
    trade_id TEXT NOT NULL UNIQUE,
    quote_id TEXT,
    pubkey TEXT NOT NULL,
    market_event_id TEXT NOT NULL,
    trade_type TEXT NOT NULL,
    side TEXT NOT NULL,
    rail TEXT NOT NULL,
    mode TEXT NOT NULL,
    settlement_minor INTEGER NOT NULL,
    settlement_msat INTEGER NOT NULL,
    settlement_fee_msat INTEGER NOT NULL DEFAULT 0,
    fx_quote_id TEXT,
    invoice TEXT,
    payment_hash TEXT,
    status TEXT NOT NULL DEFAULT 'complete',
    metadata_json TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    settled_at INTEGER,
    completed_at INTEGER,
    FOREIGN KEY (trade_id) REFERENCES market_trade_events(id) ON DELETE CASCADE,
    FOREIGN KEY (market_event_id) REFERENCES markets(event_id) ON DELETE CASCADE,
    FOREIGN KEY (quote_id) REFERENCES trade_quote_snapshots(id) ON DELETE SET NULL,
    FOREIGN KEY (fx_quote_id) REFERENCES fx_quote_snapshots(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_trade_settlements_quote_id
    ON trade_settlements(quote_id);

CREATE INDEX IF NOT EXISTS idx_trade_settlements_market
    ON trade_settlements(market_event_id, created_at DESC);
