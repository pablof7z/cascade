CREATE TABLE IF NOT EXISTS trade_quote_snapshots (
    id TEXT PRIMARY KEY,
    market_event_id TEXT NOT NULL,
    trade_type TEXT NOT NULL,
    side TEXT NOT NULL,
    spend_minor INTEGER NOT NULL,
    fee_minor INTEGER NOT NULL,
    net_minor INTEGER NOT NULL,
    quantity REAL NOT NULL,
    average_price_ppm INTEGER NOT NULL,
    current_price_yes_ppm INTEGER NOT NULL,
    current_price_no_ppm INTEGER NOT NULL,
    snapshot_q_long REAL NOT NULL,
    snapshot_q_short REAL NOT NULL,
    snapshot_reserve_minor INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    expires_at INTEGER NOT NULL,
    executed_trade_id TEXT,
    executed_at INTEGER,
    FOREIGN KEY (market_event_id) REFERENCES markets(event_id) ON DELETE CASCADE,
    FOREIGN KEY (executed_trade_id) REFERENCES market_trade_events(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_trade_quote_snapshots_market
    ON trade_quote_snapshots(market_event_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trade_quote_snapshots_expires_at
    ON trade_quote_snapshots(expires_at ASC);
