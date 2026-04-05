-- Cascade Mint Initial Schema
-- Migrations: 001-initial-schema.sql

-- Keysets table: stores derived keysets per market
CREATE TABLE IF NOT EXISTS keysets (
  id TEXT PRIMARY KEY,
  market_id TEXT NOT NULL UNIQUE,
  market_hash TEXT NOT NULL,
  long_pubkey TEXT NOT NULL,
  short_pubkey TEXT NOT NULL,
  long_privkey TEXT NOT NULL,
  short_privkey TEXT NOT NULL,
  reserve_sat INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  nostr_event_id TEXT
);

-- Quotes table: mint quotes for NUT-02
CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  amount INTEGER NOT NULL,
  unit TEXT NOT NULL DEFAULT 'sat',
  paid INTEGER NOT NULL DEFAULT 0,
  paid_at INTEGER,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  request TEXT,
  keyset_id TEXT NOT NULL REFERENCES keysets(id)
);

-- Proofs table: immutable log of all proofs
CREATE TABLE IF NOT EXISTS proofs (
  id TEXT PRIMARY KEY,
  keyset_id TEXT NOT NULL REFERENCES keysets(id),
  amount INTEGER NOT NULL,
  unit TEXT NOT NULL DEFAULT 'sat',
  secret TEXT NOT NULL,
  C TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'unspent',
  quote_id TEXT REFERENCES quotes(id),
  created_at INTEGER NOT NULL,
  spent_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_proofs_state ON proofs(state);
CREATE INDEX IF NOT EXISTS idx_proofs_keyset ON proofs(keyset_id);
CREATE INDEX IF NOT EXISTS idx_proofs_spent ON proofs(spent_at);

-- Spent proofs log: audit trail
CREATE TABLE IF NOT EXISTS spent_proofs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proof_id TEXT NOT NULL UNIQUE REFERENCES proofs(id),
  swap_txid TEXT,
  spent_at INTEGER NOT NULL,
  spent_by_pubkey TEXT
);

-- Database migrations table
CREATE TABLE IF NOT EXISTS migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  executed_at INTEGER NOT NULL,
  rollback_sql TEXT
);

-- DOWN: Rollback
-- DROP TABLE IF EXISTS spent_proofs;
-- DROP TABLE IF EXISTS proofs;
-- DROP TABLE IF EXISTS quotes;
-- DROP TABLE IF EXISTS keysets;
-- DROP TABLE IF EXISTS migrations;
