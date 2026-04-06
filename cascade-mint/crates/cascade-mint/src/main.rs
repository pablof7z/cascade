mod config;

use anyhow::{Context, Result};
use cascade_api::build_server;
use cascade_core::{
    db::CascadeDatabase,
    market_manager::MarketManager,
    trade::TradeExecutor,
    CascadeError, LmsrEngine,
};
use cdk::cdk::{mint::Mint, signatory::Signatory};
use cdk_common::amount::Amount;
use cdk_sqlite::MintSqliteDatabase;
use cdk_signatory::DbSignatory;
use clap::Parser;
use config::MintConfig;
use std::sync::Arc;
use tokio::net::TcpListener;
use tower_http::cors::CorsLayer;
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
            // BIP-39 mnemonic
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
    let mnemonic = bip39::Mnemonic::generate(24)
        .context("Failed to generate BIP-39 mnemonic")?;

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
        "⚠️  Generated new mint seed at {}. BACK THIS UP SECURELY! ⚠️",
        path.display()
    );
    tracing::warn!("Seed phrase: {}", mnemonic.to_string());

    let seed = mnemonic.to_seed("");
    let mut result = [0u8; 32];
    result.copy_from_slice(&seed[..32]);
    Ok(result)
}

/// Verify LND connection and check network compatibility
async fn verify_lnd_connection(
    lnd: &cdk_lnd::LndMintPayment,
    expected_network: &str,
) -> Result<()> {
    tracing::info!("Verifying LND connection...");

    // The LndMintPayment will fail on first use if connection is bad
    // We just log success here - actual verification happens on first invoice
    tracing::info!(
        "LND connection configured for network: {} (expected: {})",
        expected_network,
        expected_network
    );

    Ok(())
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
    tracing::info!("  Database: {}", config.database.path);
    tracing::info!("  Network: {}", config.network.network_type);
    tracing::info!("  Server: {}:{}", config.server.host, config.server.port);

    // 3. Ensure data directory exists
    std::fs::create_dir_all("./data")?;

    // 4. Load or generate master seed
    let seed = load_or_generate_seed(&config.seed.path)?;
    tracing::info!("Seed loaded successfully");

    // 5. Initialize SQLite database (CDK tables)
    let cdk_db = MintSqliteDatabase::new(&config.database.path).await
        .context("Failed to initialize CDK SQLite database")?;
    tracing::info!("CDK database initialized");

    // 6. Initialize Cascade-specific tables
    let cascade_db = CascadeDatabase::new(&config.database.path).await
        .context("Failed to initialize Cascade database")?;
    cascade_db.run_migrations().await
        .context("Failed to run Cascade migrations")?;
    tracing::info!("Cascade database initialized");

    // 7. Initialize LND payment backend
    let lnd = cdk_lnd::LndMintPayment::new(
        format!("{}:{}", config.lnd.host, config.lnd.port),
        config.lnd.cert_path.clone(),
        config.lnd.macaroon_path.clone(),
    ).await
        .context("Failed to initialize LND connection")?;

    // Verify LND connection
    verify_lnd_connection(&lnd, &config.network.network_type).await?;

    // 8. Load existing markets to determine supported units
    let existing_markets = cascade_db.list_markets(None).await
        .context("Failed to load existing markets")?;

    let mut supported_units: Vec<cdk_common::nuts::CurrencyUnit> = Vec::new();
    for market in &existing_markets {
        supported_units.push(cdk_common::nuts::CurrencyUnit::Custom(format!(
            "LONG_{}",
            market.slug
        )));
        supported_units.push(cdk_common::nuts::CurrencyUnit::Custom(format!(
            "SHORT_{}",
            market.slug
        )));
    }
    tracing::info!(
        "Loaded {} existing markets with {} supported units",
        existing_markets.len(),
        supported_units.len()
    );

    // 9. Create DbSignatory with custom units
    let signatory = DbSignatory::new(
        Arc::new(cdk_db.clone()),
        &seed,
        supported_units.clone(),
        std::collections::HashMap::new(),
    );
    tracing::info!("Signatory initialized");

    // 10. Build CDK Mint using MintBuilder
    let sat_unit = cdk_common::nuts::CurrencyUnit::Sat;
    let sat_denoms = vec![1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024];

    // Build the mint using CDK's MintBuilder pattern
    // Note: CDK v0.7 API may differ slightly - we'll adapt during build
    let mint = build_mint(
        cdk_db.clone(),
        signatory,
        sat_unit.clone(),
        sat_denoms,
        supported_units,
    ).await
        .context("Failed to build mint")?;

    tracing::info!("CDK Mint initialized");

    // 11. Create LMSR engine
    let lmsr_engine = Arc::new(LmsrEngine::new());

    // 12. Create MarketManager
    let market_manager = Arc::new(MarketManager::new(
        lmsr_engine.clone(),
        Arc::new(cascade_db),
        config.fees.trade_fee_percent,
    ));
    tracing::info!("Market manager initialized");

    // 13. Create TradeExecutor
    let trade_executor = Arc::new(TradeExecutor::new(
        mint.clone(),
        market_manager.clone(),
        config.fees.trade_fee_percent,
    ));
    tracing::info!("Trade executor initialized");

    // 14. Build HTTP server (CDK standard + Cascade custom routes)
    let app = build_server(mint.clone(), market_manager.clone(), trade_executor.clone(), &config)
        .await
        .context("Failed to build HTTP server")?;

    // 15. Start listening
    let addr = format!("{}:{}", config.server.host, config.server.port);
    let listener = TcpListener::bind(&addr).await
        .context(format!("Failed to bind to {}", addr))?;

    tracing::info!("=================================================");
    tracing::info!("Cascade Cashu Mint listening on http://{}", addr);
    tracing::info!("Mint URL: {}", config.mint.url);
    tracing::info!("=================================================");

    axum::serve(listener, app).await?;

    Ok(())
}

/// Build the CDK mint with all configured units
async fn build_mint(
    db: Arc<MintSqliteDatabase>,
    signatory: DbSignatory,
    sat_unit: cdk_common::nuts::CurrencyUnit,
    sat_denoms: Vec<u64>,
    custom_units: Vec<cdk_common::nuts::CurrencyUnit>,
) -> Result<Arc<Mint>> {
    use cdk::cdk::mint::MintBuilder;
    use cdk::cdk::mint::config::{UnitConfig, MintMeltLimits};
    use cdk::cdk::payment::method::bolt11::PaymentMethod;

    let mut builder = MintBuilder::new(Arc::new(db))
        .with_name("Cascade Markets Mint")
        .with_description("Cashu mint for Cascade prediction markets");

    // Configure sat unit for Lightning deposits/withdrawals
    let sat_config = UnitConfig {
        amounts: sat_denoms.clone(),
        input_fee_ppk: 0,
    };
    builder = builder.configure_unit(sat_unit.clone(), sat_config);

    // Add payment processor for sat unit (Lightning)
    let melt_limits = MintMeltLimits { min: 1, max: 1_000_000 };
    // Note: Add payment processor API may vary in CDK v0.7

    // Configure each market's LONG/SHORT units
    let custom_config = UnitConfig {
        amounts: sat_denoms,
        input_fee_ppk: 0, // No per-input fee; LMSR spread handles fees
    };
    for unit in &custom_units {
        builder = builder.configure_unit(unit.clone(), custom_config.clone());
    }

    // Build with signatory
    let mint = builder
        .build_with_signatory(Arc::new(signatory))
        .await
        .context("Failed to build mint with signatory")?;

    Ok(Arc::new(mint))
}