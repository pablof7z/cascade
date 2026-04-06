-- Lightning Escrow Tables
-- Phase 5a: Escrow system for Lightning payment integration

-- Escrow accounts table
CREATE TABLE IF NOT EXISTS escrow_accounts (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    market_slug TEXT NOT NULL,
    side TEXT NOT NULL,
    amount_sats INTEGER NOT NULL,
    payment_hash TEXT UNIQUE NOT NULL,
    invoice TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'Pending',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    expires_at INTEGER NOT NULL,
    settled_at INTEGER,
    refunded_at INTEGER,
    preimage TEXT,
    check_count INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (market_slug) REFERENCES markets(slug)
);

-- Lightning orders table
CREATE TABLE IF NOT EXISTS lightning_orders (
    id TEXT PRIMARY KEY,
    market_slug TEXT NOT NULL,
    side TEXT NOT NULL,
    amount_sats INTEGER NOT NULL,
    fee_sats INTEGER NOT NULL,
    total_sats INTEGER NOT NULL,
    escrow_id TEXT NOT NULL,
    invoice TEXT NOT NULL,
    payment_hash TEXT UNIQUE NOT NULL,
    state TEXT NOT NULL DEFAULT 'InvoicePending',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    expires_at INTEGER NOT NULL,
    fulfilled_at INTEGER,
    preimage TEXT,
    nip47_request_id TEXT,
    user_pubkey TEXT,
    FOREIGN KEY (market_slug) REFERENCES markets(slug),
    FOREIGN KEY (escrow_id) REFERENCES escrow_accounts(id)
);

-- HTLC tracking table (for NUT-05 HTLC support)
CREATE TABLE IF NOT EXISTS htlcs (
    id TEXT PRIMARY KEY,
    payment_hash TEXT UNIQUE NOT NULL,
    amount_msat INTEGER NOT NULL,
    cltv_expiry INTEGER,
    status TEXT NOT NULL DEFAULT 'Pending',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    settled_at INTEGER,
    refunded_at INTEGER,
    preimage TEXT
);

-- LND connection config (for multi-mint support)
CREATE TABLE IF NOT EXISTS lnd_configs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    host TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 10009,
    tls_cert_path TEXT,
    macaroon_path TEXT,
    tls_domain TEXT,
    is_active INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Payment history for audit trail
CREATE TABLE IF NOT EXISTS payment_history (
    id TEXT PRIMARY KEY,
    order_id TEXT,
    escrow_id TEXT,
    payment_hash TEXT NOT NULL,
    amount_sats INTEGER NOT NULL,
    fee_sats INTEGER NOT NULL DEFAULT 0,
    state TEXT NOT NULL,
    source TEXT NOT NULL,  -- 'lightning', 'onchain', 'ecash'
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    settled_at INTEGER,
    FOREIGN KEY (order_id) REFERENCES lightning_orders(id),
    FOREIGN KEY (escrow_id) REFERENCES escrow_accounts(id)
);

-- NIP-47 requests log (for Lightning address support)
CREATE TABLE IF NOT EXISTS nip47_requests (
    id TEXT PRIMARY KEY,
    pubkey TEXT NOT NULL,
    method TEXT NOT NULL,
    params TEXT,  -- JSON
    result TEXT,  -- JSON
    error TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    completed_at INTEGER
);

-- Indexes for Lightning tables
CREATE INDEX IF NOT EXISTS idx_escrow_payment_hash ON escrow_accounts(payment_hash);
CREATE INDEX IF NOT EXISTS idx_escrow_state ON escrow_accounts(state);
CREATE INDEX IF NOT EXISTS idx_escrow_expires ON escrow_accounts(expires_at);
CREATE INDEX IF NOT EXISTS idx_escrow_market ON escrow_accounts(market_slug);

CREATE INDEX IF NOT EXISTS idx_orders_payment_hash ON lightning_orders(payment_hash);
CREATE INDEX IF NOT EXISTS idx_orders_state ON lightning_orders(state);
CREATE INDEX IF NOT EXISTS idx_orders_pubkey ON lightning_orders(user_pubkey);

CREATE INDEX IF NOT EXISTS idx_htlcs_payment_hash ON htlcs(payment_hash);
CREATE INDEX IF NOT EXISTS idx_htlcs_status ON htlcs(status);

CREATE INDEX IF NOT EXISTS idx_payment_history_hash ON payment_history(payment_hash);
CREATE INDEX IF NOT EXISTS idx_payment_history_order ON payment_history(order_id);

CREATE INDEX IF NOT EXISTS idx_nip47_pubkey ON nip47_requests(pubkey);
CREATE INDEX IF NOT EXISTS idx_nip47_created ON nip47_requests(created_at);
