CREATE TABLE IF NOT EXISTS market_launch_state (
    event_id TEXT PRIMARY KEY,
    raw_event_json TEXT NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'pending',
    first_trade_at INTEGER,
    public_visible_at INTEGER,
    volume_minor INTEGER NOT NULL DEFAULT 0,
    trade_count INTEGER NOT NULL DEFAULT 0,
    last_price_yes_ppm INTEGER NOT NULL DEFAULT 500000,
    last_price_no_ppm INTEGER NOT NULL DEFAULT 500000,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (event_id) REFERENCES markets(event_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS wallet_balances (
    pubkey TEXT PRIMARY KEY,
    available_minor INTEGER NOT NULL DEFAULT 0,
    pending_minor INTEGER NOT NULL DEFAULT 0,
    total_deposited_minor INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS wallet_funding_events (
    id TEXT PRIMARY KEY,
    pubkey TEXT NOT NULL,
    rail TEXT NOT NULL,
    amount_minor INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'complete',
    risk_level TEXT,
    metadata_json TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS market_trade_events (
    id TEXT PRIMARY KEY,
    market_event_id TEXT NOT NULL,
    market_slug TEXT NOT NULL,
    pubkey TEXT NOT NULL,
    direction TEXT NOT NULL,
    trade_type TEXT NOT NULL,
    amount_minor INTEGER NOT NULL,
    fee_minor INTEGER NOT NULL DEFAULT 0,
    quantity REAL NOT NULL,
    price_ppm INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    raw_event_json TEXT NOT NULL,
    FOREIGN KEY (market_event_id) REFERENCES markets(event_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS market_positions (
    pubkey TEXT NOT NULL,
    market_event_id TEXT NOT NULL,
    market_slug TEXT NOT NULL,
    direction TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 0,
    cost_basis_minor INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    PRIMARY KEY (pubkey, market_event_id, direction),
    FOREIGN KEY (market_event_id) REFERENCES markets(event_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_market_launch_visibility ON market_launch_state(visibility, public_visible_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_funding_pubkey ON wallet_funding_events(pubkey, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_trade_events_market ON market_trade_events(market_event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_trade_events_slug ON market_trade_events(market_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_positions_pubkey ON market_positions(pubkey, updated_at DESC);
