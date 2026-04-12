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
