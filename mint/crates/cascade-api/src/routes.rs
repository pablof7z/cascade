//! Cascade API routes

use axum::{
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use std::collections::HashSet;
use std::sync::Arc;
use tokio::sync::{Mutex, RwLock};

use crate::fx::FxQuoteService;
use crate::handlers::{self, market, price, product, resolve, trade};
use cascade_core::{db::CascadeDatabase, invoice::InvoiceService, MarketManager};

/// Application state shared across route handlers
#[derive(Clone)]
pub struct AppState {
    pub market_manager: Arc<MarketManager>,
    pub invoice_service: Arc<Mutex<InvoiceService>>,
    /// Set of spent proof secrets (to prevent double-redemption)
    /// In production, this would be persisted to a database
    pub spent_proofs: Arc<RwLock<HashSet<String>>>,
    /// FX quote service for USD <-> msat conversion
    pub fx_service: Arc<FxQuoteService>,
    /// CDK mint for proof verification and keyset validation
    pub mint: Arc<cdk::mint::Mint>,
    /// Cascade database for price history and other queries
    pub db: Arc<CascadeDatabase>,
    /// Skip CDK proof verification (for integration tests with mock keysets)
    pub test_mode: bool,
    /// Whether signet-only product shortcuts are enabled
    pub paper_mode: bool,
}

impl AppState {
    pub fn new(
        market_manager: Arc<MarketManager>,
        invoice_service: Arc<Mutex<InvoiceService>>,
        fx_service: Arc<FxQuoteService>,
        mint: Arc<cdk::mint::Mint>,
        db: Arc<CascadeDatabase>,
        paper_mode: bool,
    ) -> Self {
        Self {
            market_manager,
            invoice_service,
            spent_proofs: Arc::new(RwLock::new(HashSet::new())),
            fx_service,
            mint,
            db,
            test_mode: false,
            paper_mode,
        }
    }

    pub fn new_test(
        market_manager: Arc<MarketManager>,
        invoice_service: Arc<Mutex<InvoiceService>>,
        fx_service: Arc<FxQuoteService>,
        mint: Arc<cdk::mint::Mint>,
        db: Arc<CascadeDatabase>,
    ) -> Self {
        Self {
            market_manager,
            invoice_service,
            spent_proofs: Arc::new(RwLock::new(HashSet::new())),
            fx_service,
            mint,
            db,
            test_mode: true,
            paper_mode: true,
        }
    }

    pub async fn get_market_by_event_id(
        &self,
        event_id: &str,
    ) -> Option<cascade_core::market::Market> {
        if let Ok(market) = self.market_manager.get_market(event_id).await {
            return Some(market);
        }

        self.db.get_market(event_id).await.ok().flatten()
    }
}

/// Build the cascade-specific HTTP routes
pub fn build_cascade_routes(state: AppState) -> Router {
    Router::new()
        // Price feeds
        .route("/api/price/{currency}", get(price::get_prices))
        // Lightning trade settlement
        .route(
            "/api/lightning/create-order",
            post(handlers::trade::create_lightning_trade),
        )
        .route(
            "/api/lightning/check-order",
            post(handlers::trade::get_invoice_status),
        )
        .route(
            "/api/lightning/settle/{order_id}",
            post(handlers::trade::settle_lightning_trade),
        )
        // Market management
        .route("/api/market/create", post(market::create_market))
        .route("/api/market/{id}", get(market::get_market))
        .route(
            "/api/market/{id}/price-history",
            get(market::get_price_history),
        )
        .route("/api/product/feed", get(product::feed))
        .route(
            "/api/product/markets/creator/{pubkey}",
            get(product::creator_markets),
        )
        .route(
            "/api/product/markets/slug/{slug}",
            get(product::market_detail),
        )
        .route(
            "/api/product/markets/{event_id}/pending/{creator_pubkey}",
            get(product::pending_market_detail),
        )
        .route("/api/product/markets", post(product::create_market))
        .route(
            "/api/product/markets/{event_id}/quote",
            post(product::quote_market_trade),
        )
        .route(
            "/api/product/markets/{event_id}/buy",
            post(product::buy_market_position),
        )
        .route(
            "/api/product/markets/{event_id}/sell",
            post(product::sell_market_position),
        )
        .route("/api/product/wallet/{pubkey}", get(product::wallet))
        .route("/api/product/paper/faucet", post(product::paper_faucet))
        .route(
            "/api/product/fx/lightning/{amount_minor}",
            get(product::preview_lightning_fx_quote),
        )
        .route("/api/trades/quote", post(product::quote_trade))
        .route("/api/trades/buy", post(product::buy_trade))
        .route("/api/trades/sell/quote", post(product::quote_trade_sell))
        .route("/api/trades/sell", post(product::sell_trade))
        .route(
            "/api/trades/requests/{request_id}",
            get(product::trade_request_status),
        )
        .route("/api/trades/{trade_id}", get(product::trade_status))
        .route(
            "/api/wallet/topups/{quote_id}",
            get(product::get_wallet_topup_status),
        )
        .route(
            "/api/wallet/topups/lightning/quote",
            post(product::create_lightning_topup_quote),
        )
        .route(
            "/api/wallet/topups/lightning/{quote_id}",
            get(product::get_lightning_topup_quote),
        )
        .route(
            "/api/wallet/topups/lightning/{quote_id}/settle",
            post(product::settle_lightning_topup_quote),
        )
        .route("/api/market/{id}/resolve", post(resolve::resolve_market))
        // Trade execution
        .route("/api/trade/bid", post(trade::buy))
        .route("/api/trade/ask", post(trade::sell))
        // Market-scoped key discovery
        .route(
            "/{event_id}/v1/keys",
            get(handlers::settlement::get_market_keys),
        )
        // Phase 7: Settlement & Redemption
        .route("/v1/cascade/redeem", post(handlers::settlement::redeem))
        .route("/v1/cascade/settle", post(handlers::settlement::settle))
        // Health check
        .route("/health", get(health_check))
        .with_state(state)
}

/// Simple health check endpoint
async fn health_check() -> impl IntoResponse {
    (StatusCode::OK, "OK")
}
