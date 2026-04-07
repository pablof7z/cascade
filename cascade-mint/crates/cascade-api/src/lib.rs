//! Cascade API — HTTP endpoints for the Cashu mint

pub mod handlers;
pub mod routes;
pub mod types;

use axum::Router;
use cascade_core::lightning::lnd_client::{LndClient, LndConfig};
use std::sync::Arc;
use tokio::sync::Mutex;

/// Build the complete HTTP server combining CDK routes + Cascade custom routes
pub async fn build_server(
    market_manager: Arc<cascade_core::MarketManager>,
    lnd_config: LndConfig,
    mint: Arc<cdk::mint::Mint>,
) -> Result<Router, Box<dyn std::error::Error + Send + Sync>> {
    // Create InvoiceService with LND client
    let lnd_client = LndClient::new(lnd_config);
    
    let invoice_service = Arc::new(Mutex::new(cascade_core::invoice::InvoiceService::new(
        lnd_client,
        3600, // default expiry: 1 hour
        40,   // CLTV delta
    )));
    
    // Create AppState
    let state = routes::AppState::new(
        market_manager,
        invoice_service,
        mint.clone(),
    );
    
    // Build cascade-specific routes
    let cascade_routes = routes::build_cascade_routes(state);
    
    // Build CDK mint routes (Cashu standard endpoints)
    let custom_methods = vec!["bolt11".to_string()]; // Support Lightning BOLT11 invoices
    let mint_routes = cdk_axum::create_mint_router(mint, custom_methods)
        .await
        .map_err(|e| format!("Failed to create mint router: {}", e))?;
    
    // Merge all routes
    Ok(cascade_routes.merge(mint_routes))
}
