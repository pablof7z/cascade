//! Cascade API routes

use axum::{
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use std::sync::Arc;
use tokio::sync::{Mutex, RwLock};
use std::collections::HashSet;

use cascade_core::{MarketManager, invoice::InvoiceService};
use crate::handlers::{self, price, resolve, trade, market};

/// Application state shared across route handlers
#[derive(Clone)]
pub struct AppState {
    pub market_manager: Arc<MarketManager>,
    pub invoice_service: Arc<Mutex<InvoiceService>>,
    /// Set of spent proof secrets (to prevent double-redemption)
    /// In production, this would be persisted to a database
    pub spent_proofs: Arc<RwLock<HashSet<String>>>,
    /// CDK mint for proof verification and keyset validation
    pub mint: Arc<cdk::mint::Mint>,
    /// Skip CDK proof verification (for integration tests with mock keysets)
    pub test_mode: bool,
}

impl AppState {
    pub fn new(
        market_manager: Arc<MarketManager>,
        invoice_service: Arc<Mutex<InvoiceService>>,
        mint: Arc<cdk::mint::Mint>,
    ) -> Self {
        Self {
            market_manager,
            invoice_service,
            spent_proofs: Arc::new(RwLock::new(HashSet::new())),
            mint,
            test_mode: false,
        }
    }
    
    pub fn new_test(
        market_manager: Arc<MarketManager>,
        invoice_service: Arc<Mutex<InvoiceService>>,
        mint: Arc<cdk::mint::Mint>,
    ) -> Self {
        Self {
            market_manager,
            invoice_service,
            spent_proofs: Arc::new(RwLock::new(HashSet::new())),
            mint,
            test_mode: true,
        }
    }
}

/// Build the cascade-specific HTTP routes
pub fn build_cascade_routes(state: AppState) -> Router {
    Router::new()
        // Price feeds
        .route("/api/price/{currency}", get(price::get_prices))
        // Lightning trade settlement
        .route("/api/lightning/create-order", post(handlers::trade::create_lightning_trade))
        .route("/api/lightning/check-order", post(handlers::trade::get_invoice_status))
        .route("/api/lightning/settle/{order_id}", post(handlers::trade::settle_lightning_trade))
        // Market management
        .route("/api/market/create", post(market::create_market))
        .route("/api/market/{id}", get(market::get_market))
        .route("/api/market/{id}/resolve", post(resolve::resolve_market))
        // Trade execution
        .route("/api/trade/bid", post(trade::buy))
        .route("/api/trade/ask", post(trade::sell))
        // Phase 7: Settlement & Redemption
        .route("/v1/cascade/redeem", post(handlers::settlement::redeem))
        .route("/v1/cascade/settle", post(handlers::settlement::settle))
        // Mint public keys for test proof construction
        .route("/v1/keys", get(handlers::settlement::get_mint_keys))
        // Health check
        .route("/health", get(health_check))
        .with_state(state)
}

/// Simple health check endpoint
async fn health_check() -> impl IntoResponse {
    (StatusCode::OK, "OK")
}
