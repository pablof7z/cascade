mod config;

use anyhow::{Context, Result};
use cascade_api::build_server;
use cascade_core::{
    db::CascadeDatabase, market_manager::MarketManager, trade::TradeExecutor, LmsrEngine, LndConfig,
};
use cdk::mint::{MintBuilder, UnitConfig};
use cdk_common::nuts::CurrencyUnit;
use cdk_sqlite::MintSqliteDatabase;
use clap::Parser;
use config::MintConfig;
use std::sync::Arc;
use tokio::net::TcpListener;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

/// Load seed from file or generate a new one.
/// Supports raw hex (32 bytes) or BIP-39 mnemonic.
fn load_or_generate_seed(path: &str) -> Result<[u8; 32]> {
    let path = std::path::Path::new(path);

    if path.exists() {
        let contents = std::fs::read_to_string(path)?;
        let trimmed = contents.trim();

        // Try BIP-39 mnemonic first
        if trimmed.contains(' ') {
            let mnemonic = bip39::Mnemonic::parse(trimmed)
                .context("Failed to parse BIP-39 mnemonic from seed file")?;
            let seed = mnemonic.to_seed("");
            let mut result = [0u8; 32];
            result.copy_from_slice(&seed[..32]);
            tracing::info!("Loaded seed from BIP-39 mnemonic");
            return Ok(result);
        } else {
            // Hex-encoded
            let decoded = hex::decode(trimmed).context("Failed to decode hex seed")?;
            if decoded.len() < 32 {
                anyhow::bail!(
                    "Seed file must contain at least 32 bytes (got {} bytes)",
                    decoded.len()
                );
            }
            let mut result = [0u8; 32];
            result.copy_from_slice(&decoded[..32]);
            tracing::info!("Loaded seed from hex file");
            return Ok(result);
        }
    }

    // Generate new BIP-39 mnemonic
    let mnemonic = bip39::Mnemonic::generate(24).context("Failed to generate BIP-39 mnemonic")?;

    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    std::fs::write(path, mnemonic.to_string())?;

    // Set restrictive permissions (user read/write only)
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(path)?.permissions();
        perms.set_mode(0o600);
        std::fs::set_permissions(path, perms)?;
    }

    tracing::warn!(
        "Generated new mint seed at {}. BACK THIS UP SECURELY!",
        path.display()
    );

    let seed = mnemonic.to_seed("");
    let mut result = [0u8; 32];
    result.copy_from_slice(&seed[..32]);
    Ok(result)
}

#[tokio::main]
async fn main() -> Result<()> {
    // 1. Initialize logging
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));
    tracing_subscriber::registry()
        .with(filter)
        .with(tracing_subscriber::fmt::layer().with_target(true))
        .init();

    tracing::info!("Cascade Cashu Mint starting...");

    // 2. Load configuration
    dotenvy::dotenv().ok();
    let args = config::Args::parse();
    let config = MintConfig::load(&args)?;

    tracing::info!("Configuration loaded:");
    tracing::info!("  Mint URL: {}", config.mint.url);
    tracing::info!("  Mint Description: {}", config.mint.description);
    tracing::info!("  Database: {}", config.database.path);
    tracing::info!("  Network: {}", config.network.network_type);
    tracing::info!("  Server: {}:{}", config.server.host, config.server.port);

    // 3. Ensure data directory exists
    std::fs::create_dir_all("./data")?;

    // 4. Load or generate master seed
    let seed = load_or_generate_seed(&config.seed.path)?;
    tracing::info!("Seed loaded successfully");

    // 5. Initialize CDK SQLite database
    let cdk_db = MintSqliteDatabase::new(config.database.path.as_str())
        .await
        .context("Failed to initialize CDK SQLite database")?;
    let cdk_db = Arc::new(cdk_db);
    tracing::info!("CDK database initialized");

    // 6. Initialize Cascade-specific tables
    let cascade_db = CascadeDatabase::connect(&config.database.path)
        .await
        .context("Failed to initialize Cascade database")?;
    cascade_db
        .run_migrations()
        .await
        .context("Failed to run Cascade migrations")?;
    tracing::info!("Cascade database initialized");

    // 7. Load existing markets for in-memory market state
    let existing_markets = cascade_db
        .list_markets()
        .await
        .context("Failed to load existing markets")?;
    tracing::info!("Loaded {} existing markets", existing_markets.len(),);

    // 8. Build CDK Mint using MintBuilder
    //    MintBuilder::new takes DynMintDatabase = Arc<dyn Database<Error> + Send + Sync>
    //    Arc<MintSqliteDatabase> implements this via MintDatabase<Error>
    let mut builder = MintBuilder::new(cdk_db.clone());

    // Configure SAT unit with standard denominations
    let sat_amounts: Vec<u64> = (0..20).map(|i| 2_u64.pow(i)).collect();
    builder.configure_unit(
        CurrencyUnit::Sat,
        UnitConfig {
            amounts: sat_amounts,
            input_fee_ppk: 0,
        },
    )?;

    // Configure USD minor units (1 = $0.01) for the wallet side of the product.
    let usd_amounts: Vec<u64> = (0..20).map(|i| 2_u64.pow(i)).collect();
    builder.configure_unit(
        CurrencyUnit::Usd,
        UnitConfig {
            amounts: usd_amounts,
            input_fee_ppk: 0,
        },
    )?;

    // Build with seed — this creates the signatory internally via DbSignatory
    // keystore = Arc<dyn MintKeysDatabase> — MintSqliteDatabase implements this
    let mint = builder
        .build_with_seed(cdk_db.clone(), &seed)
        .await
        .context("Failed to build CDK mint")?;

    let _mint = Arc::new(mint);
    tracing::info!("CDK Mint initialized");

    // 9. Create LMSR engine (b=10.0 liquidity parameter)
    let lmsr_engine = LmsrEngine::new(10.0).context("Failed to create LMSR engine")?;

    // 10. Create MarketManager
    let market_manager = Arc::new(MarketManager::new(lmsr_engine.clone()));
    for market in existing_markets {
        market_manager.load_market(market).await;
    }
    tracing::info!("Market manager initialized");

    // 11. Create TradeExecutor
    let fee_bps: u16 = (config.fees.trade_fee_percent as u16) * 100;
    let _trade_executor = Arc::new(TradeExecutor::new(lmsr_engine, fee_bps));
    tracing::info!("Trade executor initialized");

    // 12. Create LndConfig for cascade-api
    let lnd_config = LndConfig {
        host: format!("{}:{}", config.lnd.host, config.lnd.port),
        cert_path: Some(config.lnd.cert_path.clone()),
        macaroon_path: Some(config.lnd.macaroon_path.clone()),
        tls_domain: None,
        network: Some(config.network.network_type.clone()),
        cli_path: config.lnd.cli_path.clone(),
    };

    // 13. Build HTTP server (CDK standard + Cascade custom routes)
    let cascade_db = Arc::new(cascade_db);
    let app = build_server(
        market_manager.clone(),
        lnd_config,
        config
            .stripe
            .is_enabled()
            .then(|| cascade_api::stripe::StripeConfig {
                secret_key: config.stripe.secret_key.clone(),
                webhook_secret: config.stripe.webhook_secret.clone(),
                success_url: config.stripe.success_url.clone(),
                cancel_url: config.stripe.cancel_url.clone(),
                base_url: config.stripe.base_url.clone(),
                checkout_expiry_seconds: config.stripe.checkout_expiry_seconds,
                product_name: config.stripe.product_name.clone(),
                max_topup_minor: config.stripe.max_topup_minor,
                window_limit_minor: config.stripe.window_limit_minor,
                window_seconds: config.stripe.window_seconds,
                allowed_risk_levels: config.stripe.allowed_risk_levels.clone(),
            }),
        _mint.clone(),
        cascade_db,
        &config.network.network_type,
    )
    .await
    .map_err(|e| anyhow::anyhow!("Failed to build HTTP server: {}", e))?;

    // 14. Start listening
    let addr = format!("{}:{}", config.server.host, config.server.port);
    let listener = TcpListener::bind(&addr)
        .await
        .context(format!("Failed to bind to {}", addr))?;

    tracing::info!("=================================================");
    tracing::info!("Cascade Cashu Mint listening on http://{}", addr);
    tracing::info!("Mint URL: {}", config.mint.url);
    tracing::info!("=================================================");

    axum::serve(listener, app).await?;

    Ok(())
}
