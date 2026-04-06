//! Cascade API routes

use axum::{
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use std::sync::Arc;
use tokio::sync::Mutex;

use cascade_core::{MarketManager, invoice::InvoiceService};
use crate::handlers::{self, price, resolve, trade, market};

/// Application state shared across route handlers
#[derive(Clone)]
pub struct AppState {
    pub market_manager: Arc<MarketManager>,
    pub invoice_service: Arc<Mutex<InvoiceService>>,
}

impl AppState {
    pub fn new(
        market_manager: Arc<MarketManager>,
        invoice_service: Arc<Mutex<InvoiceService>>,
    ) -> Self {
        Self {
            market_manager,
            invoice_service,
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
        // Health check
        .route("/health", get(health_check))
        .with_state(state)
}

/// Simple health check endpoint
async fn health_check() -> impl IntoResponse {
    (StatusCode::OK, "OK")
}
