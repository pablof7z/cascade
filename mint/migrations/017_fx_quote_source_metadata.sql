ALTER TABLE fx_quote_snapshots
    ADD COLUMN reference_btc_usd_price REAL NOT NULL DEFAULT 0;

ALTER TABLE fx_quote_snapshots
    ADD COLUMN metadata_json TEXT NOT NULL DEFAULT '{}';

UPDATE fx_quote_snapshots
SET reference_btc_usd_price = btc_usd_price
WHERE reference_btc_usd_price <= 0;
