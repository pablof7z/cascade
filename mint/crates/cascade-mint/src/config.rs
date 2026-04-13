use anyhow::{Context, Result};
use clap::Parser;
use serde::Deserialize;
use std::fs;
use std::path::Path;

/// Mint command line arguments
#[derive(Debug, Parser)]
#[command(name = "cascade-mint")]
pub struct Args {
    /// Path to configuration file
    #[arg(long, default_value = "config.toml")]
    config: String,

    /// Override database path
    #[arg(long)]
    db_path: Option<String>,

    /// Override listen address (host:port)
    #[arg(long)]
    listen: Option<String>,

    /// Override network (signet | testnet | mainnet)
    #[arg(long)]
    network: Option<String>,

    /// Generate a new seed and exit
    #[arg(long)]
    generate_seed: bool,
}

/// Top-level configuration loaded from config.toml + env vars
#[derive(Debug, Clone, Deserialize)]
pub struct MintConfig {
    pub mint: MintSettings,
    pub database: DatabaseSettings,
    pub seed: SeedSettings,
    pub lnd: LndSettings,
    #[serde(default)]
    pub fx: FxSettings,
    #[serde(default)]
    pub stripe: StripeSettings,
    #[serde(default)]
    pub usdc: UsdcSettings,
    pub network: NetworkSettings,
    pub server: ServerSettings,
    pub fees: FeeSettings,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MintSettings {
    #[serde(default = "default_mint_url")]
    pub url: String,
    #[serde(default = "default_mint_name")]
    pub name: String,
    #[serde(default = "default_mint_description")]
    pub description: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DatabaseSettings {
    pub path: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SeedSettings {
    pub path: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct LndSettings {
    pub host: String,
    pub port: u16,
    pub cert_path: String,
    pub macaroon_path: String,
    #[serde(default)]
    pub cli_path: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NetworkSettings {
    pub network_type: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct FxSettings {
    #[serde(default = "default_fx_quote_ttl_seconds")]
    pub quote_ttl_seconds: i64,
    #[serde(default = "default_fx_max_provider_spread_bps")]
    pub max_provider_spread_bps: u64,
    #[serde(default = "default_fx_max_observation_age_seconds")]
    pub max_observation_age_seconds: i64,
    #[serde(default = "default_fx_min_provider_count")]
    pub min_provider_count: usize,
    #[serde(default = "default_fx_usd_to_msat_spread_bps")]
    pub usd_to_msat_spread_bps: u64,
    #[serde(default = "default_fx_msat_to_usd_spread_bps")]
    pub msat_to_usd_spread_bps: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct StripeSettings {
    #[serde(default)]
    pub secret_key: String,
    #[serde(default)]
    pub webhook_secret: String,
    #[serde(default)]
    pub success_url: String,
    #[serde(default)]
    pub cancel_url: String,
    #[serde(default = "default_stripe_base_url")]
    pub base_url: String,
    #[serde(default = "default_stripe_checkout_expiry_seconds")]
    pub checkout_expiry_seconds: u64,
    #[serde(default = "default_stripe_product_name")]
    pub product_name: String,
    #[serde(
        default = "default_stripe_max_funding_minor",
        alias = "max_topup_minor"
    )]
    pub max_funding_minor: u64,
    #[serde(default = "default_stripe_window_limit_minor")]
    pub window_limit_minor: u64,
    #[serde(default = "default_stripe_window_seconds")]
    pub window_seconds: i64,
    #[serde(default = "default_stripe_allowed_risk_levels")]
    pub allowed_risk_levels: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UsdcSettings {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub withdrawals_enabled: bool,
    #[serde(default = "default_usdc_network")]
    pub network: String,
    #[serde(default = "default_usdc_asset")]
    pub asset: String,
    #[serde(default)]
    pub treasury_address: String,
    #[serde(default = "default_usdc_deposit_intent_expiry_seconds")]
    pub deposit_intent_expiry_seconds: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ServerSettings {
    pub host: String,
    pub port: u16,
}

#[derive(Debug, Clone, Deserialize)]
pub struct FeeSettings {
    #[serde(default = "default_trade_fee_percent")]
    pub trade_fee_percent: u64,
}

// Defaults
fn default_mint_url() -> String {
    "https://mint.f7z.io".to_string()
}

fn default_mint_name() -> String {
    "Cascade Markets Mint".to_string()
}

fn default_mint_description() -> String {
    "Cashu mint for Cascade prediction markets".to_string()
}

fn default_trade_fee_percent() -> u64 {
    1
}

fn default_fx_quote_ttl_seconds() -> i64 {
    15 * 60
}

fn default_fx_max_provider_spread_bps() -> u64 {
    500
}

fn default_fx_max_observation_age_seconds() -> i64 {
    60
}

fn default_fx_min_provider_count() -> usize {
    2
}

fn default_fx_usd_to_msat_spread_bps() -> u64 {
    100
}

fn default_fx_msat_to_usd_spread_bps() -> u64 {
    100
}

fn default_stripe_base_url() -> String {
    "https://api.stripe.com".to_string()
}

fn default_stripe_checkout_expiry_seconds() -> u64 {
    30 * 60
}

fn default_stripe_product_name() -> String {
    "Cascade Portfolio Funding".to_string()
}

fn default_stripe_max_funding_minor() -> u64 {
    10_000
}

fn default_stripe_window_limit_minor() -> u64 {
    25_000
}

fn default_stripe_window_seconds() -> i64 {
    24 * 60 * 60
}

fn default_stripe_allowed_risk_levels() -> Vec<String> {
    vec!["normal".to_string()]
}

fn default_usdc_network() -> String {
    "base".to_string()
}

fn default_usdc_asset() -> String {
    "USDC".to_string()
}

fn default_usdc_deposit_intent_expiry_seconds() -> u64 {
    24 * 60 * 60
}

impl MintConfig {
    /// Load configuration from file and environment variables
    pub fn load(args: &Args) -> Result<Self> {
        // Load from TOML file if it exists
        let config_path = Path::new(&args.config);
        let mut config: MintConfig = if config_path.exists() {
            let contents = fs::read_to_string(config_path)
                .with_context(|| format!("Failed to read config file: {}", args.config))?;
            toml::from_str(&contents).context("Failed to parse config file")?
        } else {
            tracing::warn!("Config file '{}' not found, using defaults", args.config);
            MintConfig::default()
        };

        // Apply CLI overrides
        if let Some(db_path) = &args.db_path {
            config.database.path = db_path.clone();
        }

        if let Some(listen) = &args.listen {
            if let Some((host, port)) = listen.split_once(':') {
                config.server.host = host.to_string();
                config.server.port = port.parse().context("Invalid port in --listen")?;
            }
        }

        if let Some(network) = &args.network {
            config.network.network_type = network.clone();
        }

        // Apply environment variable overrides
        if let Ok(url) = std::env::var("MINT_URL") {
            config.mint.url = url;
        }
        if let Ok(name) = std::env::var("MINT_NAME") {
            config.mint.name = name;
        }
        if let Ok(db_path) = std::env::var("DATABASE_PATH") {
            config.database.path = db_path;
        }
        if let Ok(seed_path) = std::env::var("SEED_PATH") {
            config.seed.path = seed_path;
        }
        if let Ok(host) = std::env::var("LND_HOST") {
            config.lnd.host = host;
        }
        if let Ok(port) = std::env::var("LND_PORT") {
            config.lnd.port = port.parse().unwrap_or(config.lnd.port);
        }
        if let Ok(cert_path) = std::env::var("LND_CERT_PATH") {
            config.lnd.cert_path = cert_path;
        }
        if let Ok(macaroon_path) = std::env::var("LND_MACAROON_PATH") {
            config.lnd.macaroon_path = macaroon_path;
        }
        if let Ok(cli_path) = std::env::var("LND_CLI_PATH") {
            config.lnd.cli_path = Some(cli_path);
        }
        if let Ok(network) = std::env::var("NETWORK") {
            config.network.network_type = network;
        }
        if let Ok(quote_ttl_seconds) = std::env::var("FX_QUOTE_TTL_SECONDS") {
            config.fx.quote_ttl_seconds = quote_ttl_seconds
                .parse()
                .unwrap_or(config.fx.quote_ttl_seconds);
        }
        if let Ok(max_provider_spread_bps) = std::env::var("FX_MAX_PROVIDER_SPREAD_BPS") {
            config.fx.max_provider_spread_bps = max_provider_spread_bps
                .parse()
                .unwrap_or(config.fx.max_provider_spread_bps);
        }
        if let Ok(max_observation_age_seconds) = std::env::var("FX_MAX_OBSERVATION_AGE_SECONDS") {
            config.fx.max_observation_age_seconds = max_observation_age_seconds
                .parse()
                .unwrap_or(config.fx.max_observation_age_seconds);
        }
        if let Ok(min_provider_count) = std::env::var("FX_MIN_PROVIDER_COUNT") {
            config.fx.min_provider_count = min_provider_count
                .parse()
                .unwrap_or(config.fx.min_provider_count);
        }
        if let Ok(usd_to_msat_spread_bps) = std::env::var("FX_USD_TO_MSAT_SPREAD_BPS") {
            config.fx.usd_to_msat_spread_bps = usd_to_msat_spread_bps
                .parse()
                .unwrap_or(config.fx.usd_to_msat_spread_bps);
        }
        if let Ok(msat_to_usd_spread_bps) = std::env::var("FX_MSAT_TO_USD_SPREAD_BPS") {
            config.fx.msat_to_usd_spread_bps = msat_to_usd_spread_bps
                .parse()
                .unwrap_or(config.fx.msat_to_usd_spread_bps);
        }
        if let Ok(secret_key) = std::env::var("STRIPE_SECRET_KEY") {
            config.stripe.secret_key = secret_key;
        }
        if let Ok(webhook_secret) = std::env::var("STRIPE_WEBHOOK_SECRET") {
            config.stripe.webhook_secret = webhook_secret;
        }
        if let Ok(success_url) = std::env::var("STRIPE_SUCCESS_URL") {
            config.stripe.success_url = success_url;
        }
        if let Ok(cancel_url) = std::env::var("STRIPE_CANCEL_URL") {
            config.stripe.cancel_url = cancel_url;
        }
        if let Ok(base_url) = std::env::var("STRIPE_BASE_URL") {
            config.stripe.base_url = base_url;
        }
        if let Ok(expiry_seconds) = std::env::var("STRIPE_CHECKOUT_EXPIRY_SECONDS") {
            config.stripe.checkout_expiry_seconds = expiry_seconds
                .parse()
                .unwrap_or(config.stripe.checkout_expiry_seconds);
        }
        if let Ok(product_name) = std::env::var("STRIPE_PRODUCT_NAME") {
            config.stripe.product_name = product_name;
        }
        if let Ok(max_funding_minor) = std::env::var("STRIPE_MAX_FUNDING_MINOR") {
            config.stripe.max_funding_minor = max_funding_minor
                .parse()
                .unwrap_or(config.stripe.max_funding_minor);
        } else if let Ok(max_topup_minor) = std::env::var("STRIPE_MAX_TOPUP_MINOR") {
            config.stripe.max_funding_minor = max_topup_minor
                .parse()
                .unwrap_or(config.stripe.max_funding_minor);
        }
        if let Ok(window_limit_minor) = std::env::var("STRIPE_WINDOW_LIMIT_MINOR") {
            config.stripe.window_limit_minor = window_limit_minor
                .parse()
                .unwrap_or(config.stripe.window_limit_minor);
        }
        if let Ok(window_seconds) = std::env::var("STRIPE_WINDOW_SECONDS") {
            config.stripe.window_seconds = window_seconds
                .parse()
                .unwrap_or(config.stripe.window_seconds);
        }
        if let Ok(allowed_risk_levels) = std::env::var("STRIPE_ALLOWED_RISK_LEVELS") {
            config.stripe.allowed_risk_levels = allowed_risk_levels
                .split(',')
                .map(|value| value.trim().to_ascii_lowercase())
                .filter(|value| !value.is_empty())
                .collect();
        }
        if let Ok(enabled) = std::env::var("USDC_ENABLED") {
            config.usdc.enabled = matches!(
                enabled.trim().to_ascii_lowercase().as_str(),
                "1" | "true" | "yes"
            );
        }
        if let Ok(enabled) = std::env::var("USDC_WITHDRAWALS_ENABLED") {
            config.usdc.withdrawals_enabled = matches!(
                enabled.trim().to_ascii_lowercase().as_str(),
                "1" | "true" | "yes"
            );
        }
        if let Ok(network) = std::env::var("USDC_NETWORK") {
            config.usdc.network = network;
        }
        if let Ok(asset) = std::env::var("USDC_ASSET") {
            config.usdc.asset = asset;
        }
        if let Ok(treasury_address) = std::env::var("USDC_TREASURY_ADDRESS") {
            config.usdc.treasury_address = treasury_address;
        }
        if let Ok(expiry_seconds) = std::env::var("USDC_DEPOSIT_INTENT_EXPIRY_SECONDS") {
            config.usdc.deposit_intent_expiry_seconds = expiry_seconds
                .parse()
                .unwrap_or(config.usdc.deposit_intent_expiry_seconds);
        }
        if let Ok(host) = std::env::var("LISTEN_HOST") {
            config.server.host = host;
        }
        if let Ok(port) = std::env::var("LISTEN_PORT") {
            config.server.port = port.parse().unwrap_or(config.server.port);
        }
        if let Ok(fee) = std::env::var("TRADE_FEE_PERCENT") {
            config.fees.trade_fee_percent = fee.parse().unwrap_or(config.fees.trade_fee_percent);
        }

        // Validate
        config.validate()?;

        Ok(config)
    }

    fn validate(&self) -> Result<()> {
        if self.database.path.is_empty() {
            anyhow::bail!("database.path is required");
        }
        if self.seed.path.is_empty() {
            anyhow::bail!("seed.path is required");
        }
        if self.lnd.host.is_empty() {
            anyhow::bail!("lnd.host is required");
        }
        if self.lnd.cert_path.is_empty() {
            anyhow::bail!("lnd.cert_path is required");
        }
        if self.lnd.macaroon_path.is_empty() {
            anyhow::bail!("lnd.macaroon_path is required");
        }
        if self.network.network_type != "signet"
            && self.network.network_type != "testnet"
            && self.network.network_type != "mainnet"
        {
            anyhow::bail!("network.network_type must be 'signet', 'testnet', or 'mainnet'");
        }
        if self.fx.quote_ttl_seconds <= 0 {
            anyhow::bail!("fx.quote_ttl_seconds must be greater than zero");
        }
        if self.fx.max_observation_age_seconds <= 0 {
            anyhow::bail!("fx.max_observation_age_seconds must be greater than zero");
        }
        if self.fx.min_provider_count == 0 {
            anyhow::bail!("fx.min_provider_count must be greater than zero");
        }
        if self.fx.max_provider_spread_bps == 0 {
            anyhow::bail!("fx.max_provider_spread_bps must be greater than zero");
        }
        if self.fx.usd_to_msat_spread_bps >= 10_000 || self.fx.msat_to_usd_spread_bps >= 10_000 {
            anyhow::bail!("fx execution spreads must be below 10000 bps");
        }
        if self.stripe.is_partially_configured() && !self.stripe.is_enabled() {
            anyhow::bail!(
                "stripe must set secret_key, webhook_secret, success_url, and cancel_url together"
            );
        }
        if self.stripe.is_enabled() {
            if self.stripe.max_funding_minor == 0 || self.stripe.window_limit_minor == 0 {
                anyhow::bail!(
                    "stripe.max_funding_minor and stripe.window_limit_minor must be greater than zero"
                );
            }
            if self.stripe.window_seconds <= 0 {
                anyhow::bail!("stripe.window_seconds must be greater than zero");
            }
            if self.stripe.allowed_risk_levels.is_empty() {
                anyhow::bail!("stripe.allowed_risk_levels must contain at least one value");
            }
        }
        if self.usdc.is_enabled() {
            if self.network.network_type != "mainnet" {
                anyhow::bail!("usdc wallet support is mainnet-only");
            }
            if self.usdc.treasury_address.trim().is_empty() {
                anyhow::bail!("usdc.treasury_address is required when usdc is enabled");
            }
            if self.usdc.asset.trim().to_ascii_uppercase() != "USDC" {
                anyhow::bail!("usdc.asset must be USDC");
            }
            if self.usdc.deposit_intent_expiry_seconds == 0 {
                anyhow::bail!("usdc.deposit_intent_expiry_seconds must be greater than zero");
            }
        }
        if self.usdc.withdrawals_enabled && !self.usdc.is_enabled() {
            anyhow::bail!("usdc.withdrawals_enabled requires usdc.enabled");
        }
        Ok(())
    }
}

impl Default for MintConfig {
    fn default() -> Self {
        MintConfig {
            mint: MintSettings {
                url: default_mint_url(),
                name: default_mint_name(),
                description: default_mint_description(),
            },
            database: DatabaseSettings {
                path: "./data/cascade_mint.db".to_string(),
            },
            seed: SeedSettings {
                path: "./data/mint_seed.key".to_string(),
            },
            lnd: LndSettings {
                host: "127.0.0.1".to_string(),
                port: 10009,
                cert_path: "/path/to/tls.cert".to_string(),
                macaroon_path: "/path/to/admin.macaroon".to_string(),
                cli_path: None,
            },
            fx: FxSettings::default(),
            stripe: StripeSettings::default(),
            usdc: UsdcSettings::default(),
            network: NetworkSettings {
                network_type: "testnet".to_string(),
            },
            server: ServerSettings {
                host: "127.0.0.1".to_string(),
                port: 3338,
            },
            fees: FeeSettings {
                trade_fee_percent: default_trade_fee_percent(),
            },
        }
    }
}

impl StripeSettings {
    pub fn is_enabled(&self) -> bool {
        !self.secret_key.trim().is_empty()
            && !self.webhook_secret.trim().is_empty()
            && !self.success_url.trim().is_empty()
            && !self.cancel_url.trim().is_empty()
    }

    fn is_partially_configured(&self) -> bool {
        !self.secret_key.trim().is_empty()
            || !self.webhook_secret.trim().is_empty()
            || !self.success_url.trim().is_empty()
            || !self.cancel_url.trim().is_empty()
    }
}

impl Default for FxSettings {
    fn default() -> Self {
        Self {
            quote_ttl_seconds: default_fx_quote_ttl_seconds(),
            max_provider_spread_bps: default_fx_max_provider_spread_bps(),
            max_observation_age_seconds: default_fx_max_observation_age_seconds(),
            min_provider_count: default_fx_min_provider_count(),
            usd_to_msat_spread_bps: default_fx_usd_to_msat_spread_bps(),
            msat_to_usd_spread_bps: default_fx_msat_to_usd_spread_bps(),
        }
    }
}

impl Default for StripeSettings {
    fn default() -> Self {
        Self {
            secret_key: String::new(),
            webhook_secret: String::new(),
            success_url: String::new(),
            cancel_url: String::new(),
            base_url: default_stripe_base_url(),
            checkout_expiry_seconds: default_stripe_checkout_expiry_seconds(),
            product_name: default_stripe_product_name(),
            max_funding_minor: default_stripe_max_funding_minor(),
            window_limit_minor: default_stripe_window_limit_minor(),
            window_seconds: default_stripe_window_seconds(),
            allowed_risk_levels: default_stripe_allowed_risk_levels(),
        }
    }
}

impl UsdcSettings {
    pub fn is_enabled(&self) -> bool {
        self.enabled
    }
}

impl Default for UsdcSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            withdrawals_enabled: false,
            network: default_usdc_network(),
            asset: default_usdc_asset(),
            treasury_address: String::new(),
            deposit_intent_expiry_seconds: default_usdc_deposit_intent_expiry_seconds(),
        }
    }
}
