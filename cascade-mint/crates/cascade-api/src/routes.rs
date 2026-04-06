//! API routes for Cascade mint.
//!
//! Defines all custom Cascade endpoints under /v1/cascade/.

use axum::{
    routing::{get, post},
    Router,
};
use cascade_core::{MarketManager, NostrPublisher};

use crate::handlers::{market, price, resolve, trade};

/// Application state shared across all handlers.
#[derive(Clone)]
pub struct AppState {
    /// Market manager for market operations
    pub market_manager: MarketManager,
    /// Nostr publisher for market and trade events
    pub nostr_publisher: NostrPublisher,
}

/// Create the Cascade custom routes.
///
/// These routes are nested under /v1/cascade/ and provide market management,
/// trading, pricing, and resolution endpoints.
pub fn cascade_routes(market_manager: MarketManager, nostr_publisher: NostrPublisher) -> Router {
    Router::new()
        // Market management
        .route("/markets", get(market::list_markets))
        .route("/markets", post(market::create_market))
        .route("/markets/:slug", get(market::get_market))
        // Trading
        .route("/trade/buy", post(trade::buy))
        .route("/trade/sell", post(trade::sell))
        .route("/trade/payout", post(trade::payout))
        // Pricing
        .route("/price/:slug", get(price::get_prices))
        .route("/price/:slug/quote", post(price::get_quote))
        // Resolution
        .route("/resolve/:slug", post(resolve::resolve_market))
        // Shared state
        .with_state(AppState { market_manager, nostr_publisher })
}
