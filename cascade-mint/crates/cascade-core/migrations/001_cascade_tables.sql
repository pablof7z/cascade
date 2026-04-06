-- Cascade Mint Schema
-- Migration 001: Initial schema for markets, trades, proofs, and keysets

-- Markets table: LMSR prediction markets
CREATE TABLE IF NOT EXISTS markets (
    id TEXT PRIMARY KEY,                      -- UUID or slug for market identity
    slug TEXT NOT NULL UNIQUE,                -- URL-safe identifier (d-tag for Nostr)
    title TEXT NOT NULL,                      -- Market question/title
    description TEXT NOT NULL,                -- Detailed description
    mint TEXT NOT NULL,                       -- Mint URL for sat deposits
    image TEXT,                               -- Optional image URL
    creator_pubkey TEXT NOT NULL,             -- Nostr pubkey of creator
    
    -- LMSR parameters
    b REAL NOT NULL DEFAULT 0.0001,            -- Liquidity sensitivity parameter
    q_long REAL NOT NULL DEFAULT 0,           -- Outstanding YES shares
    q_short REAL NOT NULL DEFAULT 0,          -- Outstanding NO shares
    reserve_sats INTEGER NOT NULL DEFAULT 0,   -- Reserve pool in sats
    
    -- Status and resolution
    status TEXT NOT NULL DEFAULT 'open',       -- open, resolved, cancelled
    outcome TEXT,                             -- yes, no (only when resolved)
    resolved_at TEXT,                          -- ISO 8601 timestamp
    end_date TEXT,                             -- Optional market end date
    
    -- Timestamps
    created_at TEXT NOT NULL,                  -- ISO 8601 timestamp
    updated_at TEXT NOT NULL                   -- ISO 8601 timestamp
);

-- Index for active markets query
CREATE INDEX idx_markets_status ON markets(status);
CREATE INDEX idx_markets_created_at ON markets(created_at DESC);

-- Trades table: Record of all market trades
CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY,                      -- Trade UUID
    market_id TEXT NOT NULL,                  -- Foreign key to markets.id
    user_pubkey TEXT NOT NULL,                -- Nostr pubkey of trader
    
    -- Trade details
    side TEXT NOT NULL,                       -- long, short
    amount_sats INTEGER NOT NULL,             -- Sats spent (before fee)
    fee_sats INTEGER NOT NULL DEFAULT 0,      -- Platform fee (1%)
    tokens_issued REAL NOT NULL,              -- Shares received (float for precision)
    
    -- LMSR state at trade time (for audit)
    price_at_trade REAL NOT NULL,             -- Price per share at execution
    q_long_before REAL NOT NULL,              -- q_long before trade
    q_short_before REAL NOT NULL,             -- q_short before trade
    
    -- Timestamps
    executed_at TEXT NOT NULL                -- ISO 8601 timestamp
    
    REFERENCES markets(id) ON DELETE CASCADE
);

-- Index for market trades query
CREATE INDEX idx_trades_market_id ON trades(market_id);
CREATE INDEX idx_trades_user_pubkey ON trades(user_pubkey);
CREATE INDEX idx_trades_executed_at ON trades(executed_at DESC);

-- Proofs table: Cashu token proofs for double-spend prevention
CREATE TABLE IF NOT EXISTS proofs (
    id TEXT PRIMARY KEY,                      -- Proof UUID
    market_id TEXT NOT NULL,                  -- Foreign key to markets.id (which keyset)
    keyset_id TEXT NOT NULL,                  -- Keyset this proof belongs to
    
    -- Proof details
    secret_hash TEXT NOT NULL UNIQUE,         -- SHA256 hash of secret (for lookup)
    amount INTEGER NOT NULL,                   -- Token amount in sats
    
    -- State tracking
    spent INTEGER NOT NULL DEFAULT 0,         -- 0 = unspent, 1 = spent
    spent_at TEXT,                             -- ISO 8601 timestamp when spent
    spent_by TEXT,                             -- Pubkey of who spent it
    
    -- Keyset info
    unit TEXT NOT NULL DEFAULT 'sat',          -- Token unit (sat for sats)
    
    -- Timestamps
    created_at TEXT NOT NULL                  -- ISO 8601 timestamp
);

-- Index for unspent proofs lookup (critical for double-spend check)
CREATE UNIQUE INDEX idx_proofs_secret_hash ON proofs(secret_hash);
CREATE INDEX idx_proofs_market_id ON proofs(market_id);
CREATE INDEX idx_proofs_keyset_id ON proofs(keyset_id);
CREATE INDEX idx_proofs_spent ON proofs(spent) WHERE spent = 0;

-- Keyset states table: Per-market keysets (YES/NO pairs)
CREATE TABLE IF NOT EXISTS keyset_states (
    id TEXT PRIMARY KEY,                      -- Keyset UUID
    market_id TEXT NOT NULL,                  -- Foreign key to markets.id
    
    -- Keyset definition
    unit TEXT NOT NULL DEFAULT 'sat',          -- Token unit
    pubkey TEXT NOT NULL,                     -- Public key for verification
    short_pubkey TEXT,                        -- Short-form pubkey (for display)
    
    -- Keyset state
    active INTEGER NOT NULL DEFAULT 1,         -- 1 = active, 0 = deactivated
    active_from TEXT,                          -- ISO 8601 timestamp when activated
    deactivated_at TEXT,                       -- ISO 8601 timestamp when deactivated
    
    -- Resolution info (which outcome this keyset represents)
    outcome TEXT NOT NULL,                     -- long (YES), short (NO), or sat
    
    -- Timestamps
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Index for market keysets lookup
CREATE INDEX idx_keyset_states_market_id ON keyset_states(market_id);
CREATE INDEX idx_keyset_states_active ON keyset_states(active) WHERE active = 1;

-- Fees table: Track fee accumulation
CREATE TABLE IF NOT EXISTS fees (
    id TEXT PRIMARY KEY,
    market_id TEXT,                           -- NULL for mint-wide fees
    trade_id TEXT NOT NULL,                   -- Foreign key to trades.id
    
    amount_sats INTEGER NOT NULL,             -- Fee amount
    collected_at TEXT NOT NULL                -- ISO 8601 timestamp
    
    REFERENCES trades(id) ON DELETE CASCADE
);

-- Index for fee queries
CREATE INDEX idx_fees_market_id ON fees(market_id);
CREATE INDEX idx_fees_collected_at ON fees(collected_at DESC);

-- Ensure all foreign keys are properly enforced
PRAGMA foreign_keys = ON;