//! Cascade API — HTTP endpoints for the Cashu mint

pub mod fx;
pub mod handlers;
pub mod routes;
pub mod stripe;
pub mod types;

use crate::stripe::{StripeConfig, StripeGateway};
use axum::Router;
use cascade_core::db::CascadeDatabase;
use cascade_core::lightning::lnd_client::{LndClient, LndConfig};
use std::sync::Arc;
use tokio::sync::Mutex;
use tower_http::cors::{Any, CorsLayer};

/// Build the complete HTTP server combining CDK routes + Cascade custom routes
pub async fn build_server(
    market_manager: Arc<cascade_core::MarketManager>,
    lnd_config: LndConfig,
    stripe_config: Option<StripeConfig>,
    mint: Arc<cdk::mint::Mint>,
    db: Arc<CascadeDatabase>,
    network_type: &str,
    mint_url: &str,
) -> Result<Router, Box<dyn std::error::Error + Send + Sync>> {
    // Create InvoiceService with LND client
    let mut lnd_client = LndClient::new(lnd_config);
    lnd_client
        .connect()
        .await
        .map_err(|e| format!("Failed to connect LND client: {e}"))?;

    let invoice_service = Arc::new(Mutex::new(cascade_core::invoice::InvoiceService::new(
        lnd_client, 3600, // default expiry: 1 hour
        40,   // CLTV delta
    )));
    let fx_service = Arc::new(
        fx::FxQuoteService::for_network(network_type)
            .map_err(|e| format!("Failed to initialize FX quote service: {e}"))?,
    );
    let stripe_gateway = stripe_config
        .map(StripeGateway::new)
        .transpose()
        .map_err(|e| format!("Failed to initialize Stripe gateway: {e}"))?
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
        mint.clone(),
        db,
        network_type == "signet",
        network_type.to_string(),
        mint_url.to_string(),
    );

    // Build cascade-specific routes
    let cascade_routes = routes::build_cascade_routes(state);

    // Build CDK mint routes (Cashu standard endpoints)
    let custom_methods = vec!["bolt11".to_string()]; // Support Lightning BOLT11 invoices
    let mint_routes = cdk_axum::create_mint_router(mint, custom_methods)
        .await
        .map_err(|e| format!("Failed to create mint router: {}", e))?;

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_headers(Any)
        .allow_methods(Any);

    // Merge all routes
    Ok(cascade_routes.merge(mint_routes).layer(cors))
}
