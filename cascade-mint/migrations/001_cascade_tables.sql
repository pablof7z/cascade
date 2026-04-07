-- Cascade Market Tables
-- Initial schema for prediction markets with Cashu ecash

-- Users table (pubkey-based, no password)
CREATE TABLE IF NOT EXISTS users (
    pubkey TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    last_login_at INTEGER
);

-- Keyset table (CDK keysets for mint)
CREATE TABLE IF NOT EXISTS keysets (
    id TEXT PRIMARY KEY,
    public_key TEXT NOT NULL,
    valid_from INTEGER NOT NULL,
    valid_to INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Markets table
CREATE TABLE IF NOT EXISTS markets (
    event_id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    b REAL NOT NULL DEFAULT 10.0,
    q_long REAL NOT NULL DEFAULT 0.0,
    q_short REAL NOT NULL DEFAULT 0.0,
    reserve_sats INTEGER NOT NULL DEFAULT 0,
    long_keyset_id TEXT,
    short_keyset_id TEXT,
    status TEXT NOT NULL DEFAULT 'Active',
    resolution_outcome TEXT,
    creator_pubkey TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    resolved_at INTEGER
);

-- Trades table
CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY,
    market_slug TEXT NOT NULL,
    side TEXT NOT NULL,
    direction TEXT NOT NULL,
    quantity REAL NOT NULL,
    cost_sats INTEGER NOT NULL,
    fee_sats INTEGER NOT NULL DEFAULT 0,
    buyer_pubkey TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (market_slug) REFERENCES markets(slug)
);

-- Proofs table (ecash proofs)
CREATE TABLE IF NOT EXISTS proofs (
    id TEXT PRIMARY KEY,
    market_slug TEXT NOT NULL,
    side TEXT NOT NULL,
    amount INTEGER NOT NULL,
    secret TEXT UNIQUE NOT NULL,
    c TEXT NOT NULL,
    bob TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    spent INTEGER NOT NULL DEFAULT 0,
    spent_at INTEGER,
    FOREIGN KEY (market_slug) REFERENCES markets(slug)
);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    market_slug TEXT NOT NULL,
    amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    request_id TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    paid_at INTEGER
);

-- LMSR snapshots for price history
CREATE TABLE IF NOT EXISTS lmsr_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    market_slug TEXT NOT NULL,
    q_long REAL NOT NULL,
    q_short REAL NOT NULL,
    price_long REAL NOT NULL,
    price_short REAL NOT NULL,
    reserve_sats INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (market_slug) REFERENCES markets(slug)
);

-- Payouts table
CREATE TABLE IF NOT EXISTS payouts (
    id TEXT PRIMARY KEY,
    market_slug TEXT NOT NULL,
    recipient_pubkey TEXT NOT NULL,
    winning_side TEXT NOT NULL,
    winning_tokens REAL NOT NULL,
    payout_sats INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Tokens table (issued ecash tokens)
CREATE TABLE IF NOT EXISTS tokens (
    id TEXT PRIMARY KEY,
    keyset_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_markets_status ON markets(status);
CREATE INDEX IF NOT EXISTS idx_markets_slug ON markets(slug);
CREATE INDEX IF NOT EXISTS idx_trades_market ON trades(market_slug);
CREATE INDEX IF NOT EXISTS idx_proofs_market ON proofs(market_slug);
CREATE INDEX IF NOT EXISTS idx_proofs_spent ON proofs(spent);