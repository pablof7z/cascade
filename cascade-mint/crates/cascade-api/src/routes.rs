//! HTTP route definitions

use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;
use cascade_core::MarketManager;

use crate::handlers;

/// Build Cascade custom routes under /v1/cascade/
pub fn build_cascade_routes(market_manager: Arc<MarketManager>) -> Router {
    Router::new()
        // Market endpoints
        .route("/v1/cascade/markets", get(handlers::market::list_markets))
        .route("/v1/cascade/markets", post(handlers::market::create_market))
        .route("/v1/cascade/markets/:market_id", get(handlers::market::get_market))
        
        // Trade endpoints
        .route("/v1/cascade/trades/buy", post(handlers::trade::buy))
        .route("/v1/cascade/trades/sell", post(handlers::trade::sell))
        
        // Price endpoints
        .route("/v1/cascade/prices/:market_id", get(handlers::price::get_prices))
        .route("/v1/cascade/quote", post(handlers::price::quote))
        
        // Resolution endpoints
        .route("/v1/cascade/resolve", post(handlers::resolve::resolve_market))
        .route("/v1/cascade/payout", post(handlers::resolve::execute_payout))
        
        // Health check
        .route("/v1/cascade/health", get(handlers::health))
        
        .with_state(market_manager)
}
