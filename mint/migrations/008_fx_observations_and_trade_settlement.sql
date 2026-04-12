ALTER TABLE fx_quote_snapshots
    ADD COLUMN observations_json TEXT NOT NULL DEFAULT '[]';

ALTER TABLE trade_quote_snapshots
    ADD COLUMN fx_quote_id TEXT NOT NULL DEFAULT '';

ALTER TABLE trade_quote_snapshots
    ADD COLUMN settlement_minor INTEGER NOT NULL DEFAULT 0;

ALTER TABLE trade_quote_snapshots
    ADD COLUMN settlement_msat INTEGER NOT NULL DEFAULT 0;

ALTER TABLE trade_quote_snapshots
    ADD COLUMN settlement_fee_msat INTEGER NOT NULL DEFAULT 0;

ALTER TABLE trade_quote_snapshots
    ADD COLUMN marginal_price_before_ppm INTEGER NOT NULL DEFAULT 0;

ALTER TABLE trade_quote_snapshots
    ADD COLUMN marginal_price_after_ppm INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_trade_quote_snapshots_fx_quote_id
    ON trade_quote_snapshots(fx_quote_id);
