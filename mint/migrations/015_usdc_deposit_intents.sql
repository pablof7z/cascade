CREATE TABLE IF NOT EXISTS usdc_deposit_intents (
    id TEXT PRIMARY KEY,
    pubkey TEXT NOT NULL,
    provider TEXT,
    provider_session_id TEXT,
    provider_redirect_url TEXT,
    network TEXT NOT NULL,
    asset TEXT NOT NULL,
    destination_address TEXT NOT NULL,
    requested_wallet_amount_minor INTEGER,
    received_asset_units INTEGER,
    onchain_tx_id TEXT,
    status TEXT NOT NULL,
    metadata_json TEXT,
    created_at INTEGER NOT NULL,
    expires_at INTEGER,
    confirmed_at INTEGER,
    credited_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_usdc_deposit_intents_pubkey
    ON usdc_deposit_intents(pubkey, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usdc_deposit_intents_status
    ON usdc_deposit_intents(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usdc_deposit_intents_provider_session_id
    ON usdc_deposit_intents(provider_session_id)
    WHERE provider_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_usdc_deposit_intents_onchain_tx_id
    ON usdc_deposit_intents(onchain_tx_id)
    WHERE onchain_tx_id IS NOT NULL;
