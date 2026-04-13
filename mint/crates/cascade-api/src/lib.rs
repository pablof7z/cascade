//! Cascade API — HTTP endpoints for the Cashu mint

pub mod fx;
pub mod handlers;
pub mod payment;
pub mod routes;
pub mod stripe;
pub mod types;
pub mod usdc;

use crate::stripe::{StripeConfig, StripeGateway};
use crate::usdc::{UsdcConfig, UsdcWallet};
use axum::Router;
use cascade_core::db::CascadeDatabase;
use cascade_core::invoice::InvoiceService;
use std::sync::Arc;
use tokio::sync::Mutex;
use tower_http::cors::{Any, CorsLayer};

/// Build the complete HTTP server combining CDK routes + Cascade custom routes
pub async fn build_server(
    market_manager: Arc<cascade_core::MarketManager>,
    invoice_service: Arc<Mutex<InvoiceService>>,
    fx_service: Arc<fx::FxQuoteService>,
    stripe_config: Option<StripeConfig>,
    usdc_config: Option<UsdcConfig>,
    mint: Arc<cdk::mint::Mint>,
    db: Arc<CascadeDatabase>,
    network_type: &str,
    mint_url: &str,
) -> Result<Router, Box<dyn std::error::Error + Send + Sync>> {
    let stripe_gateway = stripe_config
        .map(StripeGateway::new)
        .transpose()
        .map_err(|e| format!("Failed to initialize Stripe gateway: {e}"))?
        .map(Arc::new);
    let usdc_wallet = usdc_config
        .map(UsdcWallet::new)
        .transpose()
        .map_err(|e| format!("Failed to initialize USDC wallet: {e}"))?
        .map(Arc::new);

    mint.start()
        .await
        .map_err(|e| format!("Failed to start mint services: {e}"))?;

    // Create AppState
    let state = routes::AppState::new(
        market_manager,
        invoice_service,
        fx_service,
        stripe_gateway,
        usdc_wallet,
        mint.clone(),
        db,
        network_type == "signet",
        network_type.to_string(),
        mint_url.to_string(),
    );

    // Build cascade-specific routes
    let cascade_routes = routes::build_cascade_routes(state);

    // Build CDK mint routes (Cashu standard endpoints)
    let mint_routes = cdk_axum::create_mint_router(mint, vec!["bolt11".to_string()])
        .await
        .map_err(|e| format!("Failed to create mint router: {}", e))?;

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_headers(Any)
        .allow_methods(Any);

    // Merge all routes
    Ok(cascade_routes.merge(mint_routes).layer(cors))
}
