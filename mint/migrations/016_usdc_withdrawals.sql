CREATE TABLE IF NOT EXISTS usdc_withdrawals (
    id TEXT PRIMARY KEY,
    request_id TEXT,
    pubkey TEXT NOT NULL,
    provider TEXT,
    provider_payout_id TEXT,
    network TEXT NOT NULL,
    asset TEXT NOT NULL,
    destination_address TEXT NOT NULL,
    wallet_amount_minor INTEGER NOT NULL,
    asset_units INTEGER NOT NULL,
    onchain_tx_id TEXT,
    status TEXT NOT NULL,
    error_message TEXT,
    change_signatures_json TEXT,
    metadata_json TEXT,
    created_at INTEGER NOT NULL,
    submitted_at INTEGER,
    completed_at INTEGER,
    failed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_usdc_withdrawals_pubkey
    ON usdc_withdrawals(pubkey, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usdc_withdrawals_status
    ON usdc_withdrawals(status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_usdc_withdrawals_request_id
    ON usdc_withdrawals(request_id)
    WHERE request_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_usdc_withdrawals_provider_payout_id
    ON usdc_withdrawals(provider_payout_id)
    WHERE provider_payout_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_usdc_withdrawals_onchain_tx_id
    ON usdc_withdrawals(onchain_tx_id)
    WHERE onchain_tx_id IS NOT NULL;
