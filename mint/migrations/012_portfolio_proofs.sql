CREATE TABLE IF NOT EXISTS portfolio_proofs (
    secret TEXT PRIMARY KEY,
    keyset_id TEXT NOT NULL,
    unit TEXT NOT NULL,
    amount INTEGER NOT NULL,
    commitment TEXT NOT NULL UNIQUE,
    market_event_id TEXT,
    direction TEXT,
    source TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    spent_trade_id TEXT,
    spent_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_portfolio_proofs_unit ON portfolio_proofs(unit);
CREATE INDEX IF NOT EXISTS idx_portfolio_proofs_market_side ON portfolio_proofs(market_event_id, direction);
CREATE INDEX IF NOT EXISTS idx_portfolio_proofs_spent_at ON portfolio_proofs(spent_at);
