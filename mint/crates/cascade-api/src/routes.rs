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
use crate::handlers::{self, price, product};
use crate::nostr::TradePublisher;
use crate::stripe::StripeGateway;
use crate::usdc::UsdcWallet;
use cascade_core::{db::CascadeDatabase, invoice::InvoiceService, MarketManager};

/// Application state shared across route handlers
#[derive(Clone)]
pub struct AppState {
    pub market_manager: Arc<MarketManager>,
    pub invoice_service: Arc<Mutex<InvoiceService>>,
    /// Funding quotes currently being issued through the standard /v1/mint/quote/bolt11 flow.
    pub processing_fundings: Arc<Mutex<HashSet<String>>>,
    /// Set of spent proof secrets (to prevent double-redemption)
    /// In production, this would be persisted to a database
    pub spent_proofs: Arc<RwLock<HashSet<String>>>,
    /// FX quote service for USD <-> msat conversion
    pub fx_service: Arc<FxQuoteService>,
    /// Optional Stripe gateway for hosted card funding
    pub stripe_gateway: Option<Arc<StripeGateway>>,
    /// Optional USDC treasury wallet configuration for deposit intents
    pub usdc_wallet: Option<Arc<UsdcWallet>>,
    /// CDK mint for proof verification and keyset validation
    pub mint: Arc<cdk::mint::Mint>,
    /// Cascade database for price history and other queries
    pub db: Arc<CascadeDatabase>,
    /// Skip CDK proof verification (for integration tests with mock keysets)
    pub test_mode: bool,
    /// Whether signet-only product shortcuts are enabled
    pub paper_mode: bool,
    /// Actual backend network for this runtime.
    pub network_type: String,
    /// Canonical public mint URL for this runtime.
    pub mint_url: String,
    /// Optional Nostr trade publisher for mint-authored trade events.
    pub trade_publisher: Option<Arc<TradePublisher>>,
    /// Mint Nostr pubkey used in trade event payloads.
    pub mint_nostr_pubkey: String,
    /// Serialize market bootstrap so slug uniqueness checks stay authoritative.
    pub market_bootstrap_lock: Arc<Mutex<()>>,
}

impl AppState {
    pub fn new(
        market_manager: Arc<MarketManager>,
        invoice_service: Arc<Mutex<InvoiceService>>,
        fx_service: Arc<FxQuoteService>,
        stripe_gateway: Option<Arc<StripeGateway>>,
        usdc_wallet: Option<Arc<UsdcWallet>>,
        mint: Arc<cdk::mint::Mint>,
        db: Arc<CascadeDatabase>,
        paper_mode: bool,
        network_type: String,
        mint_url: String,
        trade_publisher: Option<Arc<TradePublisher>>,
        mint_nostr_pubkey: String,
    ) -> Self {
        Self {
            market_manager,
            invoice_service,
            processing_fundings: Arc::new(Mutex::new(HashSet::new())),
            spent_proofs: Arc::new(RwLock::new(HashSet::new())),
            fx_service,
            stripe_gateway,
            usdc_wallet,
            mint,
            db,
            test_mode: false,
            paper_mode,
            network_type,
            mint_url,
            trade_publisher,
            mint_nostr_pubkey,
            market_bootstrap_lock: Arc::new(Mutex::new(())),
        }
    }

    pub fn new_test(
        market_manager: Arc<MarketManager>,
        invoice_service: Arc<Mutex<InvoiceService>>,
        fx_service: Arc<FxQuoteService>,
        stripe_gateway: Option<Arc<StripeGateway>>,
        usdc_wallet: Option<Arc<UsdcWallet>>,
        mint: Arc<cdk::mint::Mint>,
        db: Arc<CascadeDatabase>,
    ) -> Self {
        Self {
            market_manager,
            invoice_service,
            processing_fundings: Arc::new(Mutex::new(HashSet::new())),
            spent_proofs: Arc::new(RwLock::new(HashSet::new())),
            fx_service,
            stripe_gateway,
            usdc_wallet,
            mint,
            db,
            test_mode: true,
            paper_mode: true,
            network_type: "signet".to_string(),
            mint_url: "http://127.0.0.1:0".to_string(),
            trade_publisher: None,
            mint_nostr_pubkey: "4b6e51d4d8d057f0dcbe67f2be22849f1889291d1ea2ef85f8c1ef4efb0616fb"
                .to_string(),
            market_bootstrap_lock: Arc::new(Mutex::new(())),
        }
    }

    pub fn edition(&self) -> &str {
        if self.paper_mode {
            "signet"
        } else {
            "mainnet"
        }
    }

    pub fn market_event_kind(&self) -> i64 {
        if self.paper_mode {
            980
        } else {
            982
        }
    }

    pub fn trade_event_kind(&self) -> i64 {
        if self.paper_mode {
            981
        } else {
            983
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
        .route("/v1/keys", get(handlers::keys::get_wallet_keys))
        .route("/v1/keysets", get(handlers::keys::get_wallet_keysets))
        .route(
            "/v1/keys/{keyset_id}",
            get(handlers::keys::get_wallet_keyset_pubkeys),
        )
        // Price feeds
        .route("/api/price/{currency}", get(price::get_prices))
        .route(
            "/api/product/fx/lightning/{amount_minor}",
            get(product::preview_lightning_fx_quote),
        )
        .route("/api/trades/quote", post(product::quote_trade))
        .route(
            "/api/trades/quotes/{quote_id}",
            get(product::trade_quote_status),
        )
        .route("/api/trades/buy", post(product::buy_trade))
        .route("/api/trades/sell/quote", post(product::quote_trade_sell))
        .route("/api/trades/sell", post(product::sell_trade))
        .route(
            "/api/trades/requests/{request_id}",
            get(product::trade_request_status),
        )
        .route("/api/trades/{trade_id}", get(product::trade_status))
        // Stripe funding routes (browser calls mint directly)
        .route("/v1/fund/stripe", post(product::create_stripe_funding))
        .route("/v1/fund/stripe/webhook", post(product::stripe_webhook))
        .route(
            "/v1/fund/stripe/requests/{request_id}",
            get(product::wallet_funding_request_status),
        )
        .route(
            "/v1/fund/stripe/{funding_id}",
            get(product::get_wallet_funding_status),
        )
        .route(
            "/api/portfolio/funding/usdc/deposit-intents",
            post(product::create_usdc_deposit_intent),
        )
        .route(
            "/api/portfolio/funding/usdc/deposit-intents/{intent_id}",
            get(product::get_usdc_deposit_intent),
        )
        .route(
            "/api/portfolio/withdrawals/usdc",
            post(product::create_usdc_withdrawal),
        )
        .route(
            "/api/portfolio/withdrawals/usdc/requests/{request_id}",
            get(product::get_usdc_withdrawal_by_request_id),
        )
        .route(
            "/api/portfolio/withdrawals/usdc/{withdrawal_id}",
            get(product::get_usdc_withdrawal),
        )
        // Market-scoped key discovery
        .route(
            "/{event_id}/v1/keys",
            get(handlers::settlement::get_market_keys),
        )
        .route(
            "/v1/mint/quote/bolt11",
            post(product::create_mint_quote_bolt11),
        )
        .route(
            "/v1/mint/quote/bolt11/{quote_id}",
            get(product::get_mint_quote_bolt11),
        )
        .route(
            "/v1/mint/quote/wallet/{quote_id}",
            get(product::get_mint_quote_wallet),
        )
        .route(
            "/v1/mint/quote/stripe/{quote_id}",
            get(product::get_mint_quote_stripe),
        )
        .route("/v1/mint/bolt11", post(product::mint_bolt11))
        .route("/v1/mint/wallet", post(product::mint_wallet))
        .route("/v1/mint/stripe", post(product::mint_stripe))
        // Health check
        .route("/health", get(health_check))
        .with_state(state)
}

/// Simple health check endpoint
async fn health_check() -> impl IntoResponse {
    (StatusCode::OK, "OK")
}
