#[derive(Debug, Clone)]
pub struct UsdcConfig {
    pub network: String,
    pub asset: String,
    pub treasury_address: String,
    pub deposit_intent_expiry_seconds: u64,
    pub withdrawals_enabled: bool,
}

#[derive(Debug, Clone)]
pub struct UsdcWallet {
    config: UsdcConfig,
}

const USDC_ASSET_UNITS_PER_WALLET_MINOR: u64 = 10_000;

impl UsdcWallet {
    pub fn new(config: UsdcConfig) -> Result<Self, String> {
        let network = config.network.trim().to_ascii_lowercase();
        if network.is_empty() {
            return Err("usdc_network_required".to_string());
        }

        let asset = config.asset.trim().to_ascii_uppercase();
        if asset != "USDC" {
            return Err("usdc_asset_must_be_usdc".to_string());
        }

        let treasury_address = config.treasury_address.trim();
        if treasury_address.is_empty() {
            return Err("usdc_treasury_address_required".to_string());
        }

        if network == "base" && !is_valid_evm_address(treasury_address) {
            return Err("usdc_treasury_address_invalid_for_base".to_string());
        }

        if config.deposit_intent_expiry_seconds == 0 {
            return Err("usdc_deposit_intent_expiry_seconds_invalid".to_string());
        }

        Ok(Self {
            config: UsdcConfig {
                network,
                asset,
                treasury_address: treasury_address.to_string(),
                deposit_intent_expiry_seconds: config.deposit_intent_expiry_seconds,
                withdrawals_enabled: config.withdrawals_enabled,
            },
        })
    }

    pub fn network(&self) -> &str {
        &self.config.network
    }

    pub fn asset(&self) -> &str {
        &self.config.asset
    }

    pub fn treasury_address(&self) -> &str {
        &self.config.treasury_address
    }

    pub fn deposit_intent_expiry_seconds(&self) -> u64 {
        self.config.deposit_intent_expiry_seconds
    }

    pub fn withdrawals_enabled(&self) -> bool {
        self.config.withdrawals_enabled
    }

    pub fn validate_destination_address(&self, value: &str) -> Result<String, String> {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            return Err("destination_address_is_required".to_string());
        }

        if self.network() == "base" && !is_valid_evm_address(trimmed) {
            return Err("destination_address_invalid_for_base".to_string());
        }

        Ok(trimmed.to_string())
    }

    pub fn asset_units_from_wallet_minor(&self, wallet_amount_minor: u64) -> Result<u64, String> {
        wallet_amount_minor
            .checked_mul(USDC_ASSET_UNITS_PER_WALLET_MINOR)
            .ok_or_else(|| "usdc_asset_units_overflow".to_string())
    }
}

fn is_valid_evm_address(value: &str) -> bool {
    let trimmed = value.trim();
    trimmed.len() == 42
        && trimmed.starts_with("0x")
        && trimmed
            .chars()
            .skip(2)
            .all(|character| character.is_ascii_hexdigit())
}
