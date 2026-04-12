use crate::fx::FxQuoteEnvelope;
use crate::routes::AppState;
use crate::types::{
    CreatorMarketsResponse, ProductBuyRequest, ProductCoordinatorBuyRequest,
    ProductCoordinatorSellRequest, ProductCoordinatorTradeQuoteRequest, ProductCreateMarketRequest,
    ProductFeedResponse, ProductFundingEventResponse, ProductFxObservationResponse,
    ProductLightningFxQuoteResponse, ProductLightningTopupQuoteRequest,
    ProductMarketDetailResponse, ProductMarketSummary, ProductPaperFaucetRequest,
    ProductSellRequest, ProductTradeExecutionResponse, ProductTradeProofBundleResponse,
    ProductTradeQuoteRequest, ProductTradeQuoteResponse, ProductTradeRequestStatusResponse,
    ProductTradeSettlementResponse, ProductTradeStatusResponse,
    ProductWalletFundingExecutionResponse, ProductWalletPositionResponse, ProductWalletResponse,
    ProductWalletTopupExecutionResponse, ProductWalletTopupRequestStatusResponse,
    ProductWalletTopupResponse, ProofInput,
};
use axum::{
    extract::{Json, Path, State},
    http::{header::AUTHORIZATION, HeaderMap, Method, StatusCode, Uri},
};
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use bitcoin::secp256k1::{schnorr::Signature, Message, Secp256k1, XOnlyPublicKey};
use cascade_core::{
    product::{
        FxQuoteSnapshot, MarketLaunchState, PortfolioPositionSnapshot, PortfolioProofInsert,
        PortfolioProofSpend, TradeExecutionRequest, TradeExecutionRequestStatus,
        TradeQuoteSnapshot, TradeSettlementInsert, TradeSettlementRecord, WalletTopupQuote,
        WalletTopupRequest, WalletTopupRequestStatus,
    },
    Market, Side, WalletBalanceRecord,
};
use cdk::amount::SplitTarget;
use cdk::dhke::construct_proofs;
use cdk::nuts::{CurrencyUnit, PreMintSecrets};
use cdk::Amount;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::str::FromStr;

const TRADE_FEE_BPS: u64 = 100;
const TRADE_QUOTE_TTL_SECONDS: i64 = 30;
const FALLBACK_MINT_PUBKEY: &str =
    "1111111111111111111111111111111111111111111111111111111111111111";
const PAPER_FAUCET_SINGLE_TOPUP_LIMIT_MINOR: u64 = 10_000;
const PAPER_FAUCET_WINDOW_LIMIT_MINOR: u64 = 25_000;
const PAPER_FAUCET_WINDOW_SECONDS: i64 = 24 * 60 * 60;
const NIP98_AUTH_KIND: i64 = 27_235;
const NIP98_AUTH_WINDOW_SECONDS: i64 = 120;
const SHARE_MINOR_SCALE: u64 = 10_000;
const MAX_MARKET_DENOMINATION_POWER: u32 = 32;

struct RequestAuthContext {
    signer_pubkey: Option<String>,
}

#[derive(serde::Deserialize)]
struct Nip98AuthEvent {
    id: String,
    pubkey: String,
    created_at: i64,
    kind: i64,
    tags: Vec<Vec<String>>,
    content: String,
    sig: String,
}

struct PreparedTradeQuote {
    response: ProductTradeQuoteResponse,
    fx_quote: FxQuoteSnapshot,
}

fn signet_only_unavailable(feature: &str) -> (StatusCode, Json<Value>) {
    (
        StatusCode::NOT_IMPLEMENTED,
        Json(json!({
            "error": "signet_only_endpoint",
            "feature": feature
        })),
    )
}

fn proof_input_from_cdk_proof(proof: &cdk::nuts::Proof) -> Result<ProofInput, serde_json::Error> {
    let value = serde_json::to_value(proof)?;
    serde_json::from_value(value)
}

fn portfolio_proof_insert_from_input(
    proof: &ProofInput,
    unit: &str,
    market_event_id: Option<&str>,
    direction: Option<&str>,
    source: &str,
) -> PortfolioProofInsert {
    PortfolioProofInsert {
        secret: proof.secret.clone(),
        keyset_id: proof.id.clone(),
        unit: unit.to_string(),
        amount: proof.amount,
        commitment: proof.C.clone(),
        market_event_id: market_event_id.map(str::to_string),
        direction: direction.map(str::to_string),
        source: source.to_string(),
    }
}

fn portfolio_proof_spend_from_input(proof: &ProofInput) -> PortfolioProofSpend {
    PortfolioProofSpend {
        secret: proof.secret.clone(),
        keyset_id: proof.id.clone(),
        amount: proof.amount,
        commitment: proof.C.clone(),
    }
}

fn wallet_proofs_metadata_json(
    source: &str,
    proofs: &[ProofInput],
    extra: Value,
) -> Result<String, serde_json::Error> {
    let mut payload = json!({
        "source": source,
        "issued_proofs": proofs,
        "unit": "usd"
    });

    if let Some(object) = payload.as_object_mut() {
        if let Some(extra_object) = extra.as_object() {
            for (key, value) in extra_object {
                object.insert(key.clone(), value.clone());
            }
        }
    }

    serde_json::to_string(&payload)
}

async fn issue_wallet_proofs(
    state: &AppState,
    amount_minor: u64,
) -> Result<Vec<ProofInput>, String> {
    issue_proofs_for_unit(state, CurrencyUnit::Usd, amount_minor).await
}

async fn issue_proofs_for_unit(
    state: &AppState,
    unit: CurrencyUnit,
    amount: u64,
) -> Result<Vec<ProofInput>, String> {
    let active_keyset = state
        .mint
        .keysets()
        .keysets
        .into_iter()
        .find(|keyset| keyset.active && keyset.unit == unit)
        .ok_or_else(|| format!("active_keyset_not_configured_for_unit:{unit}"))?;
    let keyset_response = state.mint.pubkeys();
    let keyset = keyset_response
        .keysets
        .into_iter()
        .find(|keyset| keyset.id == active_keyset.id)
        .ok_or_else(|| format!("missing_pubkeys_for_keyset:{}", active_keyset.id))?;

    let supported_amounts = keyset
        .keys
        .iter()
        .map(|(amount, _)| amount.to_u64())
        .collect::<Vec<_>>();
    let fee_and_amounts = (0, supported_amounts).into();
    let pre_mint = PreMintSecrets::random(
        active_keyset.id,
        Amount::from(amount),
        &SplitTarget::None,
        &fee_and_amounts,
    )
    .map_err(|error| error.to_string())?;

    let signatures = state
        .mint
        .blind_sign(pre_mint.blinded_messages().to_vec())
        .await
        .map_err(|error| error.to_string())?;

    let proofs = construct_proofs(signatures, pre_mint.rs(), pre_mint.secrets(), &keyset.keys)
        .map_err(|error| error.to_string())?;

    proofs
        .iter()
        .map(proof_input_from_cdk_proof)
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

fn quantity_to_minor(quantity: f64) -> Result<u64, String> {
    if !quantity.is_finite() || quantity <= 0.0 {
        return Err("quantity must be positive".to_string());
    }

    Ok((quantity * SHARE_MINOR_SCALE as f64).round().max(0.0) as u64)
}

fn minor_to_quantity(quantity_minor: u64) -> f64 {
    quantity_minor as f64 / SHARE_MINOR_SCALE as f64
}

fn floor_quantity_to_minor_grid(quantity: f64) -> Result<f64, String> {
    let quantity_minor = (quantity * SHARE_MINOR_SCALE as f64).floor().max(0.0) as u64;
    if quantity_minor == 0 {
        return Err("quantity is too small for a trade".to_string());
    }
    Ok(minor_to_quantity(quantity_minor))
}

async fn issue_market_proofs(
    state: &AppState,
    market: &Market,
    side: Side,
    quantity: f64,
) -> Result<Vec<ProofInput>, String> {
    let quantity_minor = quantity_to_minor(quantity)?;
    let unit = market_currency_unit(&market.slug, side);

    issue_proofs_for_unit(state, unit, quantity_minor).await
}

fn market_currency_unit(slug: &str, side: Side) -> CurrencyUnit {
    match side {
        Side::Long => CurrencyUnit::Custom(format!("long_{}", slug)),
        Side::Short => CurrencyUnit::Custom(format!("short_{}", slug)),
    }
}

fn trade_proof_bundle(
    unit: &str,
    proofs: Vec<ProofInput>,
) -> Option<ProductTradeProofBundleResponse> {
    if proofs.is_empty() {
        return None;
    }

    Some(ProductTradeProofBundleResponse {
        unit: unit.to_string(),
        proofs,
    })
}

fn market_share_denominations() -> Vec<u64> {
    (0..=MAX_MARKET_DENOMINATION_POWER)
        .map(|power| 1_u64 << power)
        .collect()
}

fn issued_proofs_from_metadata(value: Option<&str>) -> Option<Vec<ProofInput>> {
    let metadata = parse_metadata_json(value)?;
    let proofs = metadata.get("issued_proofs")?.clone();
    serde_json::from_value(proofs).ok()
}

fn trade_proof_bundle_from_metadata(
    value: Option<&str>,
    field: &str,
) -> Option<ProductTradeProofBundleResponse> {
    let metadata = parse_metadata_json(value)?;
    let bundle = metadata.get(field)?.clone();
    serde_json::from_value(bundle).ok()
}

fn trade_proof_bundles_from_settlement(
    settlement: Option<&TradeSettlementRecord>,
) -> (
    Option<ProductTradeProofBundleResponse>,
    Option<ProductTradeProofBundleResponse>,
) {
    let Some(settlement) = settlement else {
        return (None, None);
    };

    (
        trade_proof_bundle_from_metadata(settlement.metadata_json.as_deref(), "issued"),
        trade_proof_bundle_from_metadata(settlement.metadata_json.as_deref(), "change"),
    )
}

fn proof_total_amount(proofs: &[ProofInput]) -> u64 {
    proofs.iter().map(|proof| proof.amount).sum()
}

fn cdk_proof_from_input(proof: &ProofInput) -> Result<cdk::nuts::Proof, String> {
    let value = serde_json::to_value(proof).map_err(|error| error.to_string())?;
    serde_json::from_value(value).map_err(|error| error.to_string())
}

async fn verify_input_proofs(state: &AppState, proofs: &[ProofInput]) -> Result<(), String> {
    let converted = proofs
        .iter()
        .map(cdk_proof_from_input)
        .collect::<Result<Vec<_>, _>>()?;
    state
        .mint
        .verify_proofs(converted)
        .await
        .map_err(|error| error.to_string())
}

fn market_proof_unit(market: &Market, side: Side) -> String {
    match side {
        Side::Long => format!("long_{}", market.slug),
        Side::Short => format!("short_{}", market.slug),
    }
}

pub async fn feed(State(state): State<AppState>) -> (StatusCode, Json<ProductFeedResponse>) {
    let markets = state.db.list_public_markets().await.unwrap_or_default();
    let trades = state
        .db
        .list_recent_public_trade_events(240)
        .await
        .unwrap_or_default();

    (
        StatusCode::OK,
        Json(ProductFeedResponse {
            markets: markets
                .into_iter()
                .filter_map(|(_, launch)| serde_json::from_str(&launch.raw_event_json).ok())
                .collect(),
            trades: trades
                .into_iter()
                .filter_map(|trade| serde_json::from_str(&trade.raw_event_json).ok())
                .collect(),
        }),
    )
}

pub async fn creator_markets(
    State(state): State<AppState>,
    Path(pubkey): Path<String>,
) -> (StatusCode, Json<CreatorMarketsResponse>) {
    let markets = state
        .db
        .list_creator_markets(&pubkey)
        .await
        .unwrap_or_default();

    (
        StatusCode::OK,
        Json(CreatorMarketsResponse {
            markets: markets
                .into_iter()
                .filter_map(|(market, launch)| product_market_summary(&state, &market, &launch))
                .collect(),
        }),
    )
}

pub async fn market_detail(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> (StatusCode, Json<Value>) {
    match state.db.get_public_market_by_slug(&slug).await {
        Ok(Some((market, launch))) => market_detail_response(&state, &market, &launch).await,
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "market_not_found" })),
        ),
        Err(error) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": error.to_string() })),
        ),
    }
}

pub async fn pending_market_detail(
    State(state): State<AppState>,
    Path((event_id, creator_pubkey)): Path<(String, String)>,
) -> (StatusCode, Json<Value>) {
    let market = match state.db.get_market(&event_id).await {
        Ok(Some(market)) => market,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "market_not_found" })),
            )
        }
        Err(error) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": error.to_string() })),
            )
        }
    };

    if market.creator_pubkey != creator_pubkey {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "market_not_found" })),
        );
    }

    let launch = match state.db.get_market_launch_state(&event_id).await {
        Ok(Some(launch)) => launch,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "market_launch_state_not_found" })),
            )
        }
        Err(error) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": error.to_string() })),
            )
        }
    };

    market_detail_response(&state, &market, &launch).await
}

pub async fn portfolio(
    State(state): State<AppState>,
    Path(pubkey): Path<String>,
) -> (StatusCode, Json<Value>) {
    match wallet_response(&state, &pubkey).await {
        Ok(wallet) => (StatusCode::OK, Json(json!(wallet))),
        Err(error) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": error.to_string() })),
        ),
    }
}

pub async fn preview_lightning_fx_quote(
    State(state): State<AppState>,
    Path(amount_minor): Path<u64>,
) -> (StatusCode, Json<Value>) {
    match state.fx_service.quote_wallet_topup(amount_minor).await {
        Ok(quote) => (
            StatusCode::OK,
            Json(json!(lightning_fx_quote_response(&quote))),
        ),
        Err(error) => (StatusCode::BAD_GATEWAY, Json(json!({ "error": error }))),
    }
}

enum WalletTopupRequestGuard {
    New,
    Complete(ProductWalletTopupResponse),
    Pending,
    Failed(String),
}

pub async fn create_lightning_topup_quote(
    State(state): State<AppState>,
    Json(req): Json<ProductLightningTopupQuoteRequest>,
) -> (StatusCode, Json<Value>) {
    if req.pubkey.trim().is_empty() || req.amount_minor == 0 {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "pubkey_and_amount_minor_are_required" })),
        );
    }

    match prepare_wallet_topup_request(
        &state,
        req.request_id.as_deref(),
        &req.pubkey,
        "lightning",
        req.amount_minor,
    )
    .await
    {
        Ok(WalletTopupRequestGuard::Complete(response)) => {
            return (StatusCode::OK, Json(json!(response)));
        }
        Ok(WalletTopupRequestGuard::Pending) => {
            return (
                StatusCode::CONFLICT,
                Json(json!({ "error": "wallet_topup_request_in_progress" })),
            );
        }
        Ok(WalletTopupRequestGuard::Failed(error)) => {
            return (StatusCode::CONFLICT, Json(json!({ "error": error })));
        }
        Ok(WalletTopupRequestGuard::New) => {}
        Err(error) => {
            return (StatusCode::CONFLICT, Json(json!({ "error": error })));
        }
    }

    let fx_quote = match state.fx_service.quote_wallet_topup(req.amount_minor).await {
        Ok(quote) => quote.snapshot,
        Err(error) => {
            if let Some(request_id) = req.request_id.as_deref() {
                let _ = state.db.fail_wallet_topup_request(request_id, &error).await;
            }
            return (StatusCode::BAD_GATEWAY, Json(json!({ "error": error })));
        }
    };
    let invoice_expiry_seconds = (fx_quote.expires_at - fx_quote.created_at).max(60) as u64;
    let invoice = {
        let mut invoice_service = state.invoice_service.lock().await;
        match invoice_service
            .create_invoice(
                fx_quote.amount_msat,
                Some(format!("Cascade wallet top-up for {}", req.pubkey)),
                Some(invoice_expiry_seconds),
            )
            .await
        {
            Ok(invoice) => invoice,
            Err(error) => {
                let error_message = format!("failed_to_create_lightning_invoice: {error}");
                if let Some(request_id) = req.request_id.as_deref() {
                    let _ = state
                        .db
                        .fail_wallet_topup_request(request_id, &error_message)
                        .await;
                }
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": error_message })),
                );
            }
        }
    };

    match state
        .db
        .create_wallet_topup_quote(
            &req.pubkey,
            "lightning",
            req.amount_minor,
            fx_quote.amount_msat,
            Some(invoice.bolt11()),
            Some(&invoice.payment_hash.to_hex()),
            req.request_id.as_deref(),
            &fx_quote,
        )
        .await
    {
        Ok(quote) => {
            let response = wallet_topup_response(&quote, &fx_quote, None);
            (StatusCode::CREATED, Json(json!(response)))
        }
        Err(error) => {
            let error_message = error.to_string();
            if let Some(request_id) = req.request_id.as_deref() {
                let _ = state
                    .db
                    .fail_wallet_topup_request(request_id, &error_message)
                    .await;
            }

            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": error_message })),
            )
        }
    }
}

pub async fn wallet_topup_request_status(
    State(state): State<AppState>,
    Path(request_id): Path<String>,
) -> (StatusCode, Json<Value>) {
    match load_wallet_topup_request_status_response(&state, &request_id).await {
        Ok(Some(response)) => (StatusCode::OK, Json(json!(response))),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "wallet_topup_request_not_found" })),
        ),
        Err(error) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": error })),
        ),
    }
}

pub async fn wallet(
    State(state): State<AppState>,
    Path(pubkey): Path<String>,
) -> (StatusCode, Json<Value>) {
    portfolio(State(state), Path(pubkey)).await
}

pub async fn get_lightning_topup_quote(
    State(state): State<AppState>,
    Path(quote_id): Path<String>,
) -> (StatusCode, Json<Value>) {
    let now = chrono::Utc::now().timestamp();
    let existing = match state.db.get_wallet_topup_quote(&quote_id).await {
        Ok(Some(quote)) => quote,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "topup_quote_not_found" })),
            )
        }
        Err(error) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": error.to_string() })),
            )
        }
    };

    if existing.expires_at <= now && existing.status.to_string() == "invoice_pending" {
        let _ = state
            .db
            .expire_wallet_topups_for_pubkey(&existing.pubkey, now)
            .await;
    }

    let quote = match state.db.get_wallet_topup_quote(&quote_id).await {
        Ok(Some(quote)) => quote,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "topup_quote_not_found" })),
            )
        }
        Err(error) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": error.to_string() })),
            )
        }
    };

    let quote = match sync_wallet_topup_quote_best_effort(&state, &quote).await {
        Ok(quote) => quote,
        Err(_) => quote,
    };

    match load_wallet_topup_response(&state, &quote).await {
        Ok(response) => (StatusCode::OK, Json(json!(response))),
        Err(error) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": error })),
        ),
    }
}

pub async fn get_wallet_topup_status(
    State(state): State<AppState>,
    Path(quote_id): Path<String>,
) -> (StatusCode, Json<Value>) {
    get_lightning_topup_quote(State(state), Path(quote_id)).await
}

pub async fn settle_lightning_topup_quote(
    State(state): State<AppState>,
    Path(quote_id): Path<String>,
) -> (StatusCode, Json<Value>) {
    if !state.paper_mode {
        return signet_only_unavailable("wallet_lightning_topup_settlement");
    }

    let existing_quote = match state.db.get_wallet_topup_quote(&quote_id).await {
        Ok(Some(quote)) => quote,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "topup_quote_not_found" })),
            )
        }
        Err(error) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": error.to_string() })),
            )
        }
    };

    let proofs = if existing_quote.status.to_string() == "complete" {
        issued_proofs_from_metadata(existing_quote.metadata_json.as_deref()).unwrap_or_default()
    } else {
        match issue_wallet_proofs(&state, existing_quote.amount_minor).await {
            Ok(proofs) => proofs,
            Err(error) => {
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": error })),
                )
            }
        }
    };

    let metadata_json = match wallet_proofs_metadata_json(
        "signet-lightning-topup",
        &proofs,
        json!({ "topup_quote_id": quote_id }),
    ) {
        Ok(metadata) => metadata,
        Err(error) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": error.to_string() })),
            )
        }
    };

    let proof_records = proofs
        .iter()
        .map(|proof| {
            portfolio_proof_insert_from_input(proof, "usd", None, None, "signet_lightning_topup")
        })
        .collect::<Vec<_>>();

    if let Err(error) = state.db.insert_portfolio_proofs(&proof_records).await {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": error.to_string() })),
        );
    }

    match state
        .db
        .complete_wallet_topup_quote(&quote_id, Some("paper"), Some(&metadata_json))
        .await
    {
        Ok(quote) => match wallet_response(&state, &quote.pubkey).await {
            Ok(wallet) => match load_wallet_topup_response(&state, &quote).await {
                Ok(topup) => (
                    StatusCode::OK,
                    Json(json!(ProductWalletTopupExecutionResponse { topup, wallet })),
                ),
                Err(error) => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": error })),
                ),
            },
            Err(error) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": error })),
            ),
        },
        Err(error) => (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": error.to_string() })),
        ),
    }
}

pub async fn paper_faucet(
    State(state): State<AppState>,
    Json(req): Json<ProductPaperFaucetRequest>,
) -> (StatusCode, Json<Value>) {
    if !state.paper_mode {
        return signet_only_unavailable("paper_wallet_faucet");
    }

    if req.pubkey.trim().is_empty() || req.amount_minor == 0 {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "pubkey_and_amount_minor_are_required" })),
        );
    }

    if let Err(response) = enforce_paper_funding_limits(&state, &req.pubkey, req.amount_minor).await
    {
        return response;
    }

    let proofs = match issue_wallet_proofs(&state, req.amount_minor).await {
        Ok(proofs) => proofs,
        Err(error) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": error })),
            )
        }
    };

    let metadata_json = match wallet_proofs_metadata_json(
        "signet-paper-faucet",
        &proofs,
        json!({ "pubkey": req.pubkey }),
    ) {
        Ok(metadata) => metadata,
        Err(error) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": error.to_string() })),
            )
        }
    };

    let proof_records = proofs
        .iter()
        .map(|proof| {
            portfolio_proof_insert_from_input(proof, "usd", None, None, "signet_paper_faucet")
        })
        .collect::<Vec<_>>();

    if let Err(error) = state.db.insert_portfolio_proofs(&proof_records).await {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": error.to_string() })),
        );
    }

    match state
        .db
        .credit_wallet(
            &req.pubkey,
            req.amount_minor,
            "paper",
            Some("paper"),
            Some(&metadata_json),
        )
        .await
    {
        Ok(_) => match wallet_response(&state, &req.pubkey).await {
            Ok(wallet) => (
                StatusCode::CREATED,
                Json(json!(ProductWalletFundingExecutionResponse {
                    wallet,
                    proofs
                })),
            ),
            Err(error) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": error.to_string() })),
            ),
        },
        Err(error) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": error.to_string() })),
        ),
    }
}

pub async fn create_market(
    State(state): State<AppState>,
    headers: HeaderMap,
    method: Method,
    uri: Uri,
    Json(req): Json<ProductCreateMarketRequest>,
) -> (StatusCode, Json<Value>) {
    let auth = match request_auth_context(&headers, &method, &uri) {
        Ok(context) => context,
        Err(error) => return (StatusCode::UNAUTHORIZED, Json(json!({ "error": error }))),
    };

    if let Some(signer_pubkey) = auth.signer_pubkey.as_deref() {
        if signer_pubkey != req.creator_pubkey {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({ "error": "request_signer_must_match_creator_pubkey" })),
            );
        }
    }

    if req.event_id.trim().is_empty()
        || req.slug.trim().is_empty()
        || req.title.trim().is_empty()
        || req.creator_pubkey.trim().is_empty()
    {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "event_id_slug_title_and_creator_pubkey_are_required" })),
        );
    }

    let raw_event_id = req.raw_event.get("id").and_then(Value::as_str);
    let raw_event_kind = req.raw_event.get("kind").and_then(Value::as_i64);
    if raw_event_id != Some(req.event_id.as_str()) || raw_event_kind != Some(982) {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "raw_event_must_be_the_signed_kind_982_event" })),
        );
    }

    if let Ok(Some((market, launch))) = state.db.get_public_market_by_slug(&req.slug).await {
        if let Some(summary) = product_market_summary(&state, &market, &launch) {
            return (StatusCode::CONFLICT, Json(json!(summary)));
        }
    }

    if let Ok(Some(_)) = state.db.get_market(&req.event_id).await {
        return (
            StatusCode::CONFLICT,
            Json(json!({ "error": "market_already_exists" })),
        );
    }

    let denominations = market_share_denominations();

    let long_keyset_id = match state
        .mint
        .rotate_keyset(
            market_currency_unit(&req.slug, Side::Long),
            denominations.clone(),
            0,
            false,
            None,
        )
        .await
    {
        Ok(info) => info.id.to_string(),
        Err(error) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("failed_to_create_long_keyset: {error}") })),
            )
        }
    };

    let short_keyset_id = match state
        .mint
        .rotate_keyset(
            market_currency_unit(&req.slug, Side::Short),
            denominations,
            0,
            false,
            None,
        )
        .await
    {
        Ok(info) => info.id.to_string(),
        Err(error) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("failed_to_create_short_keyset: {error}") })),
            )
        }
    };

    let market = match state
        .market_manager
        .create_market(
            req.event_id.clone(),
            req.slug.clone(),
            req.title.clone(),
            req.description.clone(),
            req.b,
            req.creator_pubkey.clone(),
            long_keyset_id,
            short_keyset_id,
        )
        .await
    {
        Ok(market) => market,
        Err(error) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": error.to_string() })),
            )
        }
    };

    let raw_event_json = match serde_json::to_string(&req.raw_event) {
        Ok(value) => value,
        Err(error) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": format!("invalid_raw_event: {error}") })),
            )
        }
    };

    if let Err(error) = state.db.insert_market(&market).await {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": error.to_string() })),
        );
    }
    if let Err(error) = state
        .db
        .insert_market_launch_state(&market.event_id, &raw_event_json)
        .await
    {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": error.to_string() })),
        );
    }

    let launch = match state.db.get_market_launch_state(&market.event_id).await {
        Ok(Some(launch)) => launch,
        Ok(None) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "market_launch_state_missing" })),
            )
        }
        Err(error) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": error.to_string() })),
            )
        }
    };

    match product_market_summary(&state, &market, &launch) {
        Some(summary) => (StatusCode::CREATED, Json(json!(summary))),
        None => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "failed_to_build_market_summary" })),
        ),
    }
}

pub async fn quote_trade(
    State(state): State<AppState>,
    Json(req): Json<ProductCoordinatorTradeQuoteRequest>,
) -> (StatusCode, Json<Value>) {
    let quote_request = ProductTradeQuoteRequest {
        trade_type: "buy".to_string(),
        side: req.side,
        spend_minor: req.spend_minor,
        quantity: req.quantity,
    };
    quote_trade_by_event(&state, &req.event_id, &quote_request).await
}

pub async fn quote_trade_sell(
    State(state): State<AppState>,
    Json(req): Json<ProductCoordinatorTradeQuoteRequest>,
) -> (StatusCode, Json<Value>) {
    let quote_request = ProductTradeQuoteRequest {
        trade_type: "sell".to_string(),
        side: req.side,
        spend_minor: None,
        quantity: req.quantity,
    };
    quote_trade_by_event(&state, &req.event_id, &quote_request).await
}

pub async fn buy_trade(
    State(state): State<AppState>,
    headers: HeaderMap,
    method: Method,
    uri: Uri,
    Json(req): Json<ProductCoordinatorBuyRequest>,
) -> (StatusCode, Json<Value>) {
    let auth = match request_auth_context(&headers, &method, &uri) {
        Ok(context) => context,
        Err(error) => return (StatusCode::UNAUTHORIZED, Json(json!({ "error": error }))),
    };

    if let Some(signer_pubkey) = auth.signer_pubkey.as_deref() {
        if signer_pubkey != req.pubkey {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({ "error": "request_signer_must_match_pubkey" })),
            );
        }
    }

    let buy_request = ProductBuyRequest {
        pubkey: req.pubkey,
        side: req.side,
        spend_minor: req.spend_minor,
        proofs: req.proofs,
        quote_id: req.quote_id,
        request_id: req.request_id,
    };
    buy_trade_by_event(
        &state,
        &req.event_id,
        &buy_request,
        auth.signer_pubkey.as_deref(),
    )
    .await
}

pub async fn sell_trade(
    State(state): State<AppState>,
    headers: HeaderMap,
    method: Method,
    uri: Uri,
    Json(req): Json<ProductCoordinatorSellRequest>,
) -> (StatusCode, Json<Value>) {
    let auth = match request_auth_context(&headers, &method, &uri) {
        Ok(context) => context,
        Err(error) => return (StatusCode::UNAUTHORIZED, Json(json!({ "error": error }))),
    };

    if let Some(signer_pubkey) = auth.signer_pubkey.as_deref() {
        if signer_pubkey != req.pubkey {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({ "error": "request_signer_must_match_pubkey" })),
            );
        }
    }

    let sell_request = ProductSellRequest {
        pubkey: req.pubkey,
        side: req.side,
        quantity: req.quantity,
        proofs: req.proofs,
        quote_id: req.quote_id,
        request_id: req.request_id,
    };
    sell_trade_by_event(
        &state,
        &req.event_id,
        &sell_request,
        auth.signer_pubkey.as_deref(),
    )
    .await
}

pub async fn trade_quote_status(
    State(state): State<AppState>,
    Path(quote_id): Path<String>,
) -> (StatusCode, Json<Value>) {
    match load_trade_quote_response(&state, &quote_id).await {
        Ok(Some(response)) => (StatusCode::OK, Json(json!(response))),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "trade_quote_not_found" })),
        ),
        Err(error) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": error })),
        ),
    }
}

async fn prepare_wallet_topup_request(
    state: &AppState,
    request_id: Option<&str>,
    pubkey: &str,
    rail: &str,
    amount_minor: u64,
) -> Result<WalletTopupRequestGuard, String> {
    let Some(request_id) = request_id.filter(|value| !value.trim().is_empty()) else {
        return Ok(WalletTopupRequestGuard::New);
    };

    if let Some(existing) = state
        .db
        .get_wallet_topup_request(request_id)
        .await
        .map_err(|error| error.to_string())?
    {
        return handle_existing_wallet_topup_request(state, &existing, pubkey, rail, amount_minor)
            .await;
    }

    match state
        .db
        .create_wallet_topup_request(request_id, pubkey, rail, amount_minor)
        .await
    {
        Ok(_) => Ok(WalletTopupRequestGuard::New),
        Err(error) => {
            let error_message = error.to_string();
            if !error_message.contains("UNIQUE constraint failed") {
                return Err(error_message);
            }

            let Some(existing) = state
                .db
                .get_wallet_topup_request(request_id)
                .await
                .map_err(|db_error| db_error.to_string())?
            else {
                return Err(error_message);
            };

            handle_existing_wallet_topup_request(state, &existing, pubkey, rail, amount_minor).await
        }
    }
}

async fn handle_existing_wallet_topup_request(
    state: &AppState,
    existing: &WalletTopupRequest,
    pubkey: &str,
    rail: &str,
    amount_minor: u64,
) -> Result<WalletTopupRequestGuard, String> {
    if !wallet_topup_request_matches(existing, pubkey, rail, amount_minor) {
        return Err("wallet_topup_request_id_conflict".to_string());
    }

    match existing.status {
        WalletTopupRequestStatus::Complete => Ok(WalletTopupRequestGuard::Complete(
            load_wallet_topup_response_for_request(state, existing).await?,
        )),
        WalletTopupRequestStatus::Pending => Ok(WalletTopupRequestGuard::Pending),
        WalletTopupRequestStatus::Failed => Ok(WalletTopupRequestGuard::Failed(
            existing
                .error_message
                .clone()
                .unwrap_or_else(|| "wallet_topup_request_failed".to_string()),
        )),
    }
}

fn wallet_topup_request_matches(
    existing: &WalletTopupRequest,
    pubkey: &str,
    rail: &str,
    amount_minor: u64,
) -> bool {
    existing.pubkey == pubkey && existing.rail == rail && existing.amount_minor == amount_minor
}

async fn load_wallet_topup_response_for_request(
    state: &AppState,
    request: &WalletTopupRequest,
) -> Result<ProductWalletTopupResponse, String> {
    let topup_quote_id = request
        .topup_quote_id
        .as_deref()
        .ok_or_else(|| "wallet_topup_request_missing_quote".to_string())?;

    let quote = state
        .db
        .get_wallet_topup_quote(topup_quote_id)
        .await
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "topup_quote_not_found".to_string())?;

    load_wallet_topup_response(state, &quote).await
}

pub async fn trade_request_status(
    State(state): State<AppState>,
    Path(request_id): Path<String>,
) -> (StatusCode, Json<Value>) {
    match load_trade_request_status_response(&state, &request_id).await {
        Ok(Some(response)) => (StatusCode::OK, Json(json!(response))),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "trade_request_not_found" })),
        ),
        Err(error) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": error })),
        ),
    }
}

pub async fn trade_status(
    State(state): State<AppState>,
    Path(trade_id): Path<String>,
) -> (StatusCode, Json<Value>) {
    match load_trade_status_response(&state, &trade_id).await {
        Ok(response) => (StatusCode::OK, Json(json!(response))),
        Err(error) if error == "trade_not_found" => {
            (StatusCode::NOT_FOUND, Json(json!({ "error": error })))
        }
        Err(error) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": error })),
        ),
    }
}

pub async fn quote_market_trade(
    State(state): State<AppState>,
    Path(event_id): Path<String>,
    Json(req): Json<ProductTradeQuoteRequest>,
) -> (StatusCode, Json<Value>) {
    quote_trade_by_event(&state, &event_id, &req).await
}

pub async fn buy_market_position(
    State(state): State<AppState>,
    Path(event_id): Path<String>,
    headers: HeaderMap,
    method: Method,
    uri: Uri,
    Json(req): Json<ProductBuyRequest>,
) -> (StatusCode, Json<Value>) {
    let auth = match request_auth_context(&headers, &method, &uri) {
        Ok(context) => context,
        Err(error) => return (StatusCode::UNAUTHORIZED, Json(json!({ "error": error }))),
    };

    if let Some(signer_pubkey) = auth.signer_pubkey.as_deref() {
        if signer_pubkey != req.pubkey {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({ "error": "request_signer_must_match_pubkey" })),
            );
        }
    }

    buy_trade_by_event(&state, &event_id, &req, auth.signer_pubkey.as_deref()).await
}

pub async fn sell_market_position(
    State(state): State<AppState>,
    Path(event_id): Path<String>,
    headers: HeaderMap,
    method: Method,
    uri: Uri,
    Json(req): Json<ProductSellRequest>,
) -> (StatusCode, Json<Value>) {
    let auth = match request_auth_context(&headers, &method, &uri) {
        Ok(context) => context,
        Err(error) => return (StatusCode::UNAUTHORIZED, Json(json!({ "error": error }))),
    };

    if let Some(signer_pubkey) = auth.signer_pubkey.as_deref() {
        if signer_pubkey != req.pubkey {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({ "error": "request_signer_must_match_pubkey" })),
            );
        }
    }

    sell_trade_by_event(&state, &event_id, &req, auth.signer_pubkey.as_deref()).await
}

enum TradeRequestGuard {
    New,
    Complete(ProductTradeExecutionResponse),
    Pending,
    Failed(String),
}

async fn prepare_trade_request(
    state: &AppState,
    request_id: Option<&str>,
    pubkey: &str,
    market_event_id: &str,
    trade_type: &str,
    side: &str,
    spend_minor: Option<u64>,
    quantity: Option<f64>,
) -> Result<TradeRequestGuard, String> {
    let Some(request_id) = request_id.filter(|value| !value.trim().is_empty()) else {
        return Ok(TradeRequestGuard::New);
    };

    if let Some(existing) = state
        .db
        .get_trade_execution_request(request_id)
        .await
        .map_err(|error| error.to_string())?
    {
        return handle_existing_trade_request(
            state,
            &existing,
            pubkey,
            market_event_id,
            trade_type,
            side,
            spend_minor,
            quantity,
        )
        .await;
    }

    match state
        .db
        .create_trade_execution_request(
            request_id,
            pubkey,
            market_event_id,
            trade_type,
            side,
            spend_minor,
            quantity,
        )
        .await
    {
        Ok(_) => Ok(TradeRequestGuard::New),
        Err(error) => {
            let error_message = error.to_string();
            if !error_message.contains("UNIQUE constraint failed") {
                return Err(error_message);
            }

            let Some(existing) = state
                .db
                .get_trade_execution_request(request_id)
                .await
                .map_err(|db_error| db_error.to_string())?
            else {
                return Err(error_message);
            };

            handle_existing_trade_request(
                state,
                &existing,
                pubkey,
                market_event_id,
                trade_type,
                side,
                spend_minor,
                quantity,
            )
            .await
        }
    }
}

async fn handle_existing_trade_request(
    state: &AppState,
    existing: &TradeExecutionRequest,
    pubkey: &str,
    market_event_id: &str,
    trade_type: &str,
    side: &str,
    spend_minor: Option<u64>,
    quantity: Option<f64>,
) -> Result<TradeRequestGuard, String> {
    if !trade_request_matches(
        existing,
        pubkey,
        market_event_id,
        trade_type,
        side,
        spend_minor,
        quantity,
    ) {
        return Err("trade_request_id_conflict".to_string());
    }

    match existing.status {
        TradeExecutionRequestStatus::Complete => Ok(TradeRequestGuard::Complete(
            load_trade_execution_response_for_request(state, existing).await?,
        )),
        TradeExecutionRequestStatus::Pending => Ok(TradeRequestGuard::Pending),
        TradeExecutionRequestStatus::Failed => Ok(TradeRequestGuard::Failed(
            existing
                .error_message
                .clone()
                .unwrap_or_else(|| "trade_request_failed".to_string()),
        )),
    }
}

fn trade_request_matches(
    existing: &TradeExecutionRequest,
    pubkey: &str,
    market_event_id: &str,
    trade_type: &str,
    side: &str,
    spend_minor: Option<u64>,
    quantity: Option<f64>,
) -> bool {
    if existing.pubkey != pubkey
        || existing.market_event_id != market_event_id
        || existing.trade_type != trade_type
        || existing.side != side
        || existing.spend_minor != spend_minor
    {
        return false;
    }

    match (existing.quantity, quantity) {
        (Some(left), Some(right)) => (left - right).abs() <= f64::EPSILON,
        (None, None) => true,
        _ => false,
    }
}

async fn load_trade_execution_response_for_request(
    state: &AppState,
    request: &TradeExecutionRequest,
) -> Result<ProductTradeExecutionResponse, String> {
    let trade_id = request
        .trade_id
        .as_deref()
        .ok_or_else(|| "trade_request_missing_trade_id".to_string())?;
    let trade_status = load_trade_status_response(state, trade_id).await?;
    let wallet = wallet_response(state, &request.pubkey)
        .await
        .map_err(|error| error.to_string())?;
    let settlement_record = state
        .db
        .get_trade_settlement_by_trade_id(trade_id)
        .await
        .map_err(|error| error.to_string())?;
    let (issued, change) = trade_proof_bundles_from_settlement(settlement_record.as_ref());

    Ok(ProductTradeExecutionResponse {
        wallet,
        market: trade_status.market,
        trade: trade_status.trade,
        settlement: trade_status.settlement,
        issued,
        change,
    })
}

async fn quote_trade_by_event(
    state: &AppState,
    event_id: &str,
    req: &ProductTradeQuoteRequest,
) -> (StatusCode, Json<Value>) {
    match load_market_for_trading(state, event_id).await {
        Ok(market) => match build_quote_response(state, &market, req).await {
            Ok(quote) => match create_persisted_trade_quote(state, &market, &quote).await {
                Ok(persisted) => (StatusCode::OK, Json(json!(persisted))),
                Err(error) => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": error })),
                ),
            },
            Err(error) => (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": error.to_string() })),
            ),
        },
        Err(error) => (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": error.to_string() })),
        ),
    }
}

async fn buy_trade_by_event(
    state: &AppState,
    event_id: &str,
    req: &ProductBuyRequest,
    request_signer_pubkey: Option<&str>,
) -> (StatusCode, Json<Value>) {
    match load_market_for_trading(state, event_id).await {
        Ok(market) => {
            let side = match parse_side(&req.side) {
                Ok(side) => side,
                Err(error) => {
                    return (StatusCode::BAD_REQUEST, Json(json!({ "error": error })));
                }
            };
            let request_id = req
                .request_id
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty());

            if req.proofs.is_empty() {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "error": "input_proofs_required" })),
                );
            }

            match prepare_trade_request(
                state,
                request_id,
                &req.pubkey,
                &market.event_id,
                "buy",
                &req.side,
                Some(req.spend_minor),
                None,
            )
            .await
            {
                Ok(TradeRequestGuard::New) => {}
                Ok(TradeRequestGuard::Complete(response)) => {
                    return (StatusCode::OK, Json(json!(response)));
                }
                Ok(TradeRequestGuard::Pending) => {
                    return (
                        StatusCode::CONFLICT,
                        Json(json!({ "error": "trade_request_in_progress" })),
                    );
                }
                Ok(TradeRequestGuard::Failed(error)) => {
                    return (StatusCode::CONFLICT, Json(json!({ "error": error })));
                }
                Err(error) => {
                    return (StatusCode::CONFLICT, Json(json!({ "error": error })));
                }
            }

            let quote = if let Some(quote_id) = req
                .quote_id
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
            {
                match load_locked_trade_quote(
                    state,
                    quote_id,
                    &market.event_id,
                    "buy",
                    &req.side,
                    Some(req.spend_minor),
                    None,
                )
                .await
                {
                    Ok(quote) => quote,
                    Err(error) => {
                        if let Some(request_id) = request_id {
                            let _ = state
                                .db
                                .fail_trade_execution_request(request_id, &error)
                                .await;
                        }
                        return (StatusCode::BAD_REQUEST, Json(json!({ "error": error })));
                    }
                }
            } else {
                let quote_request = ProductTradeQuoteRequest {
                    trade_type: "buy".to_string(),
                    side: req.side.clone(),
                    spend_minor: Some(req.spend_minor),
                    quantity: None,
                };

                match build_quote_response(state, &market, &quote_request).await {
                    Ok(quote) => quote.response,
                    Err(error) => {
                        if let Some(request_id) = request_id {
                            let _ = state
                                .db
                                .fail_trade_execution_request(request_id, &error.to_string())
                                .await;
                        }
                        return (
                            StatusCode::BAD_REQUEST,
                            Json(json!({ "error": error.to_string() })),
                        );
                    }
                }
            };
            let direction = side_label(side);
            let (next_q_long, next_q_short) = next_buy_quantities(&market, side, quote.quantity);
            let next_reserve_minor = market.reserve_sats.saturating_add(quote.spend_minor);
            let created_at = chrono::Utc::now().timestamp();
            let trade_id = uuid::Uuid::new_v4().to_string();
            let post_price_ppm = post_trade_price_ppm(state, next_q_long, next_q_short, side)
                .unwrap_or_else(|_| {
                    if direction == "yes" {
                        quote.current_price_yes_ppm
                    } else {
                        quote.current_price_no_ppm
                    }
                });
            let raw_event = build_trade_event(
                &trade_id,
                mint_pubkey_from_market(&quote.market_event_id, &quote.side),
                &market.event_id,
                direction,
                "buy",
                quote.spend_minor,
                quote.quantity,
                post_price_ppm,
                created_at,
                request_signer_pubkey,
            );
            let raw_event_json = match serde_json::to_string(&raw_event) {
                Ok(raw) => raw,
                Err(error) => {
                    if let Some(request_id) = request_id {
                        let _ = state
                            .db
                            .fail_trade_execution_request(request_id, &error.to_string())
                            .await;
                    }
                    return (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(json!({ "error": error.to_string() })),
                    );
                }
            };

            if let Err(error) = verify_input_proofs(state, &req.proofs).await {
                if let Some(request_id) = request_id {
                    let _ = state
                        .db
                        .fail_trade_execution_request(request_id, &error)
                        .await;
                }
                return (StatusCode::BAD_REQUEST, Json(json!({ "error": error })));
            }

            let input_total_minor = proof_total_amount(&req.proofs);
            if input_total_minor < quote.spend_minor {
                let error = "insufficient_input_proofs".to_string();
                if let Some(request_id) = request_id {
                    let _ = state
                        .db
                        .fail_trade_execution_request(request_id, &error)
                        .await;
                }
                return (StatusCode::BAD_REQUEST, Json(json!({ "error": error })));
            }

            let issued_proofs =
                match issue_market_proofs(state, &market, side, quote.quantity).await {
                    Ok(proofs) => proofs,
                    Err(error) => {
                        if let Some(request_id) = request_id {
                            let _ = state
                                .db
                                .fail_trade_execution_request(request_id, &error)
                                .await;
                        }
                        return (
                            StatusCode::INTERNAL_SERVER_ERROR,
                            Json(json!({ "error": error })),
                        );
                    }
                };
            let change_amount_minor = input_total_minor.saturating_sub(quote.spend_minor);
            let change_proofs = if change_amount_minor > 0 {
                match issue_wallet_proofs(state, change_amount_minor).await {
                    Ok(proofs) => proofs,
                    Err(error) => {
                        if let Some(request_id) = request_id {
                            let _ = state
                                .db
                                .fail_trade_execution_request(request_id, &error)
                                .await;
                        }
                        return (
                            StatusCode::INTERNAL_SERVER_ERROR,
                            Json(json!({ "error": error })),
                        );
                    }
                }
            } else {
                Vec::new()
            };

            let issued_unit = market_proof_unit(&market, side);
            let issued_bundle = trade_proof_bundle(&issued_unit, issued_proofs.clone());
            let change_bundle = trade_proof_bundle("usd", change_proofs.clone());
            let settlement = build_trade_settlement_insert(
                state,
                &req.pubkey,
                &quote,
                issued_bundle.as_ref(),
                change_bundle.as_ref(),
            );
            let issued_inserts = issued_proofs
                .iter()
                .map(|proof| {
                    portfolio_proof_insert_from_input(
                        proof,
                        &issued_unit,
                        Some(&market.event_id),
                        Some(direction),
                        "trade_buy_issued",
                    )
                })
                .collect::<Vec<_>>();
            let change_inserts = change_proofs
                .iter()
                .map(|proof| {
                    portfolio_proof_insert_from_input(proof, "usd", None, None, "trade_buy_change")
                })
                .collect::<Vec<_>>();
            let spent_proofs = req
                .proofs
                .iter()
                .map(portfolio_proof_spend_from_input)
                .collect::<Vec<_>>();

            match state
                .db
                .apply_trade_execution_with_portfolio_proofs(
                    &trade_id,
                    created_at,
                    req.quote_id.as_deref(),
                    &req.pubkey,
                    &market,
                    direction,
                    "buy",
                    quote.spend_minor,
                    quote.fee_minor,
                    quote.quantity,
                    quote.spend_minor as i64,
                    -(quote.spend_minor as i64),
                    post_price_ppm,
                    &raw_event_json,
                    next_q_long,
                    next_q_short,
                    next_reserve_minor,
                    settlement.as_ref(),
                    &spent_proofs,
                    "usd",
                    None,
                    None,
                    &issued_inserts,
                    &change_inserts,
                    Some(input_total_minor),
                    None,
                )
                .await
            {
                Ok(_) => {
                    if let Some(request_id) = request_id {
                        let _ = state
                            .db
                            .complete_trade_execution_request(request_id, &trade_id)
                            .await;
                    }

                    state
                        .market_manager
                        .load_market(Market {
                            q_long: next_q_long,
                            q_short: next_q_short,
                            reserve_sats: next_reserve_minor,
                            ..market.clone()
                        })
                        .await;

                    trade_execution_response(
                        state,
                        &req.pubkey,
                        &market,
                        next_q_long,
                        next_q_short,
                        next_reserve_minor,
                        raw_event,
                    )
                    .await
                }
                Err(error) => {
                    let error_message = error.to_string();
                    if let Some(request_id) = request_id {
                        let _ = state
                            .db
                            .fail_trade_execution_request(request_id, &error_message)
                            .await;
                    }

                    (
                        StatusCode::BAD_REQUEST,
                        Json(json!({ "error": error_message })),
                    )
                }
            }
        }
        Err(error) => (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": error.to_string() })),
        ),
    }
}

async fn sell_trade_by_event(
    state: &AppState,
    event_id: &str,
    req: &ProductSellRequest,
    request_signer_pubkey: Option<&str>,
) -> (StatusCode, Json<Value>) {
    match load_market_for_trading(state, event_id).await {
        Ok(market) => {
            let side = match parse_side(&req.side) {
                Ok(side) => side,
                Err(error) => {
                    return (StatusCode::BAD_REQUEST, Json(json!({ "error": error })));
                }
            };
            let direction = side_label(side);
            let positions = match state.db.list_positions(&req.pubkey).await {
                Ok(positions) => positions,
                Err(error) => {
                    return (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(json!({ "error": error.to_string() })),
                    );
                }
            };
            let position = positions.into_iter().find(|position| {
                position.market_event_id == market.event_id && position.direction == direction
            });

            if req.quantity <= 0.0 {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "error": "invalid_sell_quantity" })),
                );
            }

            if req.proofs.is_empty() {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "error": "input_proofs_required" })),
                );
            }

            let request_id = req
                .request_id
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty());

            match prepare_trade_request(
                state,
                request_id,
                &req.pubkey,
                &market.event_id,
                "sell",
                &req.side,
                None,
                Some(req.quantity),
            )
            .await
            {
                Ok(TradeRequestGuard::New) => {}
                Ok(TradeRequestGuard::Complete(response)) => {
                    return (StatusCode::OK, Json(json!(response)));
                }
                Ok(TradeRequestGuard::Pending) => {
                    return (
                        StatusCode::CONFLICT,
                        Json(json!({ "error": "trade_request_in_progress" })),
                    );
                }
                Ok(TradeRequestGuard::Failed(error)) => {
                    return (StatusCode::CONFLICT, Json(json!({ "error": error })));
                }
                Err(error) => {
                    return (StatusCode::CONFLICT, Json(json!({ "error": error })));
                }
            }

            let quote = if let Some(quote_id) = req
                .quote_id
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
            {
                match load_locked_trade_quote(
                    state,
                    quote_id,
                    &market.event_id,
                    "sell",
                    &req.side,
                    None,
                    Some(req.quantity),
                )
                .await
                {
                    Ok(quote) => quote,
                    Err(error) => {
                        if let Some(request_id) = request_id {
                            let _ = state
                                .db
                                .fail_trade_execution_request(request_id, &error)
                                .await;
                        }
                        return (StatusCode::BAD_REQUEST, Json(json!({ "error": error })));
                    }
                }
            } else {
                let quote_request = ProductTradeQuoteRequest {
                    trade_type: "sell".to_string(),
                    side: req.side.clone(),
                    spend_minor: None,
                    quantity: Some(req.quantity),
                };
                match build_quote_response(state, &market, &quote_request).await {
                    Ok(quote) => quote.response,
                    Err(error) => {
                        if let Some(request_id) = request_id {
                            let _ = state
                                .db
                                .fail_trade_execution_request(request_id, &error.to_string())
                                .await;
                        }
                        return (
                            StatusCode::BAD_REQUEST,
                            Json(json!({ "error": error.to_string() })),
                        );
                    }
                }
            };

            let (next_q_long, next_q_short) = next_sell_quantities(&market, side, quote.quantity);
            let next_reserve_minor = market.reserve_sats.saturating_sub(quote.net_minor);
            let created_at = chrono::Utc::now().timestamp();
            let trade_id = uuid::Uuid::new_v4().to_string();
            let post_price_ppm = post_trade_price_ppm(state, next_q_long, next_q_short, side)
                .unwrap_or_else(|_| {
                    if direction == "yes" {
                        quote.current_price_yes_ppm
                    } else {
                        quote.current_price_no_ppm
                    }
                });
            let raw_event = build_trade_event(
                &trade_id,
                mint_pubkey_from_market(&quote.market_event_id, &quote.side),
                &market.event_id,
                direction,
                "sell",
                quote.net_minor,
                quote.quantity,
                post_price_ppm,
                created_at,
                request_signer_pubkey,
            );
            let raw_event_json = match serde_json::to_string(&raw_event) {
                Ok(raw) => raw,
                Err(error) => {
                    if let Some(request_id) = request_id {
                        let _ = state
                            .db
                            .fail_trade_execution_request(request_id, &error.to_string())
                            .await;
                    }
                    return (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(json!({ "error": error.to_string() })),
                    );
                }
            };
            if let Err(error) = verify_input_proofs(state, &req.proofs).await {
                if let Some(request_id) = request_id {
                    let _ = state
                        .db
                        .fail_trade_execution_request(request_id, &error)
                        .await;
                }
                return (StatusCode::BAD_REQUEST, Json(json!({ "error": error })));
            }

            let input_quantity_minor = proof_total_amount(&req.proofs);
            if input_quantity_minor < quote.quantity_minor {
                let error = "insufficient_input_proofs".to_string();
                if let Some(request_id) = request_id {
                    let _ = state
                        .db
                        .fail_trade_execution_request(request_id, &error)
                        .await;
                }
                return (StatusCode::BAD_REQUEST, Json(json!({ "error": error })));
            }

            let selected_quantity = minor_to_quantity(input_quantity_minor);
            let selected_cost_basis_minor = if let Some(position) = position.as_ref() {
                let selected_proportion = (selected_quantity / position.quantity).clamp(0.0, 1.0);
                ((position.cost_basis_minor as f64) * selected_proportion).round() as u64
            } else {
                0
            };
            let selected_snapshot = PortfolioPositionSnapshot {
                quantity: selected_quantity,
                cost_basis_minor: selected_cost_basis_minor,
            };
            let selected_release_proportion =
                (quote.quantity / selected_snapshot.quantity).clamp(0.0, 1.0);
            let released_selected_cost_basis = ((selected_snapshot.cost_basis_minor as f64)
                * selected_release_proportion)
                .round() as i64;

            let issued_proofs = match issue_wallet_proofs(state, quote.net_minor).await {
                Ok(proofs) => proofs,
                Err(error) => {
                    if let Some(request_id) = request_id {
                        let _ = state
                            .db
                            .fail_trade_execution_request(request_id, &error)
                            .await;
                    }
                    return (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(json!({ "error": error })),
                    );
                }
            };
            let change_quantity_minor = input_quantity_minor.saturating_sub(quote.quantity_minor);
            let change_proofs = if change_quantity_minor > 0 {
                match issue_market_proofs(
                    state,
                    &market,
                    side,
                    minor_to_quantity(change_quantity_minor),
                )
                .await
                {
                    Ok(proofs) => proofs,
                    Err(error) => {
                        if let Some(request_id) = request_id {
                            let _ = state
                                .db
                                .fail_trade_execution_request(request_id, &error)
                                .await;
                        }
                        return (
                            StatusCode::INTERNAL_SERVER_ERROR,
                            Json(json!({ "error": error })),
                        );
                    }
                }
            } else {
                Vec::new()
            };

            let market_unit = market_proof_unit(&market, side);
            let issued_bundle = trade_proof_bundle("usd", issued_proofs.clone());
            let change_bundle = trade_proof_bundle(&market_unit, change_proofs.clone());
            let settlement = build_trade_settlement_insert(
                state,
                &req.pubkey,
                &quote,
                issued_bundle.as_ref(),
                change_bundle.as_ref(),
            );
            let issued_inserts = issued_proofs
                .iter()
                .map(|proof| {
                    portfolio_proof_insert_from_input(proof, "usd", None, None, "trade_sell_issued")
                })
                .collect::<Vec<_>>();
            let change_inserts = change_proofs
                .iter()
                .map(|proof| {
                    portfolio_proof_insert_from_input(
                        proof,
                        &market_unit,
                        Some(&market.event_id),
                        Some(direction),
                        "trade_sell_change",
                    )
                })
                .collect::<Vec<_>>();
            let spent_proofs = req
                .proofs
                .iter()
                .map(portfolio_proof_spend_from_input)
                .collect::<Vec<_>>();

            match state
                .db
                .apply_trade_execution_with_portfolio_proofs(
                    &trade_id,
                    created_at,
                    req.quote_id.as_deref(),
                    &req.pubkey,
                    &market,
                    direction,
                    "sell",
                    quote.net_minor,
                    quote.fee_minor,
                    -quote.quantity,
                    -released_selected_cost_basis,
                    quote.net_minor as i64,
                    post_price_ppm,
                    &raw_event_json,
                    next_q_long,
                    next_q_short,
                    next_reserve_minor,
                    settlement.as_ref(),
                    &spent_proofs,
                    &market_unit,
                    Some(&market.event_id),
                    Some(direction),
                    &issued_inserts,
                    &change_inserts,
                    None,
                    Some(&selected_snapshot),
                )
                .await
            {
                Ok(_) => {
                    if let Some(request_id) = request_id {
                        let _ = state
                            .db
                            .complete_trade_execution_request(request_id, &trade_id)
                            .await;
                    }

                    state
                        .market_manager
                        .load_market(Market {
                            q_long: next_q_long,
                            q_short: next_q_short,
                            reserve_sats: next_reserve_minor,
                            ..market.clone()
                        })
                        .await;

                    trade_execution_response(
                        state,
                        &req.pubkey,
                        &market,
                        next_q_long,
                        next_q_short,
                        next_reserve_minor,
                        raw_event,
                    )
                    .await
                }
                Err(error) => {
                    let error_message = error.to_string();
                    if let Some(request_id) = request_id {
                        let _ = state
                            .db
                            .fail_trade_execution_request(request_id, &error_message)
                            .await;
                    }

                    (
                        StatusCode::BAD_REQUEST,
                        Json(json!({ "error": error_message })),
                    )
                }
            }
        }
        Err(error) => (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": error.to_string() })),
        ),
    }
}

async fn load_trade_status_response(
    state: &AppState,
    trade_id: &str,
) -> Result<ProductTradeStatusResponse, String> {
    let trade_record = state
        .db
        .get_market_trade_event(trade_id)
        .await
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "trade_not_found".to_string())?;

    let market = state
        .db
        .get_market(&trade_record.market_event_id)
        .await
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "market_not_found".to_string())?;

    let launch = state
        .db
        .get_market_launch_state(&trade_record.market_event_id)
        .await
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "market_launch_state_not_found".to_string())?;

    let summary = product_market_summary(state, &market, &launch)
        .ok_or_else(|| "failed_to_build_market_summary".to_string())?;

    let trade = serde_json::from_str::<Value>(&trade_record.raw_event_json)
        .map_err(|error| format!("invalid_trade_event_json: {error}"))?;
    let settlement = state
        .db
        .get_trade_settlement_by_trade_id(trade_id)
        .await
        .map_err(|error| error.to_string())?
        .as_ref()
        .map(product_trade_settlement_response);

    Ok(ProductTradeStatusResponse {
        market: summary,
        trade,
        settlement,
    })
}

async fn load_market_summary_by_event_id(
    state: &AppState,
    event_id: &str,
) -> Result<Option<ProductMarketSummary>, String> {
    let Some(market) = state
        .db
        .get_market(event_id)
        .await
        .map_err(|error| error.to_string())?
    else {
        return Ok(None);
    };

    let Some(launch) = state
        .db
        .get_market_launch_state(event_id)
        .await
        .map_err(|error| error.to_string())?
    else {
        return Ok(None);
    };

    Ok(product_market_summary(state, &market, &launch))
}

async fn load_wallet_topup_request_status_response(
    state: &AppState,
    request_id: &str,
) -> Result<Option<ProductWalletTopupRequestStatusResponse>, String> {
    let Some(request) = state
        .db
        .get_wallet_topup_request(request_id)
        .await
        .map_err(|error| error.to_string())?
    else {
        return Ok(None);
    };

    let topup = if request.status == WalletTopupRequestStatus::Complete {
        Some(load_wallet_topup_response_for_request(state, &request).await?)
    } else {
        None
    };

    Ok(Some(ProductWalletTopupRequestStatusResponse {
        request_id: request.request_id,
        rail: request.rail,
        amount_minor: request.amount_minor,
        status: request.status.to_string(),
        error: request.error_message,
        topup,
    }))
}

fn trade_quote_state_label(snapshot: &TradeQuoteSnapshot, now: i64) -> &'static str {
    if snapshot.executed_trade_id.is_some() {
        "executed"
    } else if snapshot.expires_at <= now {
        "expired"
    } else {
        "open"
    }
}

fn product_fx_observation_response(
    observation: &cascade_core::product::FxQuoteObservation,
) -> ProductFxObservationResponse {
    ProductFxObservationResponse {
        source: observation.source.clone(),
        btc_usd_price: observation.btc_usd_price,
        observed_at: observation.observed_at,
    }
}

fn product_trade_settlement_response(
    settlement: &TradeSettlementRecord,
) -> ProductTradeSettlementResponse {
    ProductTradeSettlementResponse {
        id: settlement.id.clone(),
        trade_id: settlement.trade_id.clone(),
        quote_id: settlement.quote_id.clone(),
        rail: settlement.rail.clone(),
        mode: settlement.mode.clone(),
        side: settlement.side.clone(),
        trade_type: settlement.trade_type.clone(),
        settlement_minor: settlement.settlement_minor,
        settlement_msat: settlement.settlement_msat,
        settlement_fee_msat: settlement.settlement_fee_msat,
        fx_quote_id: settlement.fx_quote_id.clone(),
        invoice: settlement.invoice.clone(),
        payment_hash: settlement.payment_hash.clone(),
        status: settlement.status.to_string(),
        metadata: settlement
            .metadata_json
            .as_deref()
            .and_then(|json| serde_json::from_str(json).ok()),
        created_at: settlement.created_at,
        settled_at: settlement.settled_at,
        completed_at: settlement.completed_at,
    }
}

fn product_trade_quote_from_snapshot(
    snapshot: &TradeQuoteSnapshot,
    fx_quote: Option<&FxQuoteSnapshot>,
) -> ProductTradeQuoteResponse {
    ProductTradeQuoteResponse {
        quote_id: Some(snapshot.id.clone()),
        market_event_id: snapshot.market_event_id.clone(),
        trade_type: snapshot.trade_type.clone(),
        side: snapshot.side.clone(),
        fx_quote_id: Some(snapshot.fx_quote_id.clone()),
        quantity: snapshot.quantity,
        quantity_minor: quantity_to_minor(snapshot.quantity).unwrap_or_default(),
        spend_minor: snapshot.spend_minor,
        fee_minor: snapshot.fee_minor,
        net_minor: snapshot.net_minor,
        settlement_minor: snapshot.settlement_minor,
        settlement_msat: snapshot.settlement_msat,
        settlement_fee_msat: snapshot.settlement_fee_msat,
        average_price_ppm: snapshot.average_price_ppm,
        marginal_price_before_ppm: snapshot.marginal_price_before_ppm,
        marginal_price_after_ppm: snapshot.marginal_price_after_ppm,
        current_price_yes_ppm: snapshot.current_price_yes_ppm,
        current_price_no_ppm: snapshot.current_price_no_ppm,
        fx_source: fx_quote.map(|quote| quote.source.clone()),
        btc_usd_price: fx_quote.map(|quote| quote.btc_usd_price),
        spread_bps: fx_quote.map(|quote| quote.spread_bps),
        fx_observations: fx_quote
            .map(|quote| {
                quote
                    .observations
                    .iter()
                    .map(product_fx_observation_response)
                    .collect()
            })
            .unwrap_or_default(),
        created_at: Some(snapshot.created_at),
        expires_at: Some(snapshot.expires_at),
        status: Some(trade_quote_state_label(snapshot, chrono::Utc::now().timestamp()).to_string()),
        trade_id: snapshot.executed_trade_id.clone(),
    }
}

async fn load_trade_quote_response(
    state: &AppState,
    quote_id: &str,
) -> Result<Option<ProductTradeQuoteResponse>, String> {
    let Some(snapshot) = state
        .db
        .get_trade_quote_snapshot(quote_id)
        .await
        .map_err(|error| error.to_string())?
    else {
        return Ok(None);
    };

    let fx_quote = state
        .db
        .get_fx_quote_snapshot(&snapshot.fx_quote_id)
        .await
        .map_err(|error| error.to_string())?;

    Ok(Some(product_trade_quote_from_snapshot(
        &snapshot,
        fx_quote.as_ref(),
    )))
}

async fn create_persisted_trade_quote(
    state: &AppState,
    market: &Market,
    quote: &PreparedTradeQuote,
) -> Result<ProductTradeQuoteResponse, String> {
    let expires_at = chrono::Utc::now().timestamp() + TRADE_QUOTE_TTL_SECONDS;
    let snapshot = state
        .db
        .create_trade_quote_snapshot(
            &market.event_id,
            &quote.response.trade_type,
            &quote.response.side,
            &quote.fx_quote,
            quote.response.spend_minor,
            quote.response.fee_minor,
            quote.response.net_minor,
            quote.response.settlement_minor,
            quote.response.settlement_msat,
            quote.response.settlement_fee_msat,
            quote.response.quantity,
            quote.response.average_price_ppm,
            quote.response.marginal_price_before_ppm,
            quote.response.marginal_price_after_ppm,
            quote.response.current_price_yes_ppm,
            quote.response.current_price_no_ppm,
            market.q_long,
            market.q_short,
            market.reserve_sats,
            expires_at,
        )
        .await
        .map_err(|error| error.to_string())?;

    Ok(product_trade_quote_from_snapshot(
        &snapshot,
        Some(&quote.fx_quote),
    ))
}

fn quote_snapshot_matches(
    snapshot: &TradeQuoteSnapshot,
    market_event_id: &str,
    trade_type: &str,
    side: &str,
    spend_minor: Option<u64>,
    quantity: Option<f64>,
) -> bool {
    if snapshot.market_event_id != market_event_id
        || snapshot.trade_type != trade_type
        || snapshot.side != side
    {
        return false;
    }

    if let Some(spend_minor) = spend_minor {
        if snapshot.spend_minor != spend_minor {
            return false;
        }
    }

    if let Some(quantity) = quantity {
        if (snapshot.quantity - quantity).abs() > f64::EPSILON {
            return false;
        }
    }

    true
}

async fn load_locked_trade_quote(
    state: &AppState,
    quote_id: &str,
    market_event_id: &str,
    trade_type: &str,
    side: &str,
    spend_minor: Option<u64>,
    quantity: Option<f64>,
) -> Result<ProductTradeQuoteResponse, String> {
    let snapshot = state
        .db
        .get_trade_quote_snapshot(quote_id)
        .await
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "trade_quote_not_found".to_string())?;

    if !quote_snapshot_matches(
        &snapshot,
        market_event_id,
        trade_type,
        side,
        spend_minor,
        quantity,
    ) {
        return Err("trade_quote_conflict".to_string());
    }

    match trade_quote_state_label(&snapshot, chrono::Utc::now().timestamp()) {
        "executed" => Err("trade_quote_already_executed".to_string()),
        "expired" => Err("trade_quote_expired".to_string()),
        _ => {
            let fx_quote = state
                .db
                .get_fx_quote_snapshot(&snapshot.fx_quote_id)
                .await
                .map_err(|error| error.to_string())?;

            Ok(product_trade_quote_from_snapshot(
                &snapshot,
                fx_quote.as_ref(),
            ))
        }
    }
}

async fn load_trade_request_status_response(
    state: &AppState,
    request_id: &str,
) -> Result<Option<ProductTradeRequestStatusResponse>, String> {
    let Some(request) = state
        .db
        .get_trade_execution_request(request_id)
        .await
        .map_err(|error| error.to_string())?
    else {
        return Ok(None);
    };

    let market = load_market_summary_by_event_id(state, &request.market_event_id).await?;

    let trade = if let Some(trade_id) = request.trade_id.as_deref() {
        Some(load_trade_status_response(state, trade_id).await?.trade)
    } else {
        None
    };

    Ok(Some(ProductTradeRequestStatusResponse {
        request_id: request.request_id,
        status: request.status.to_string(),
        error: request.error_message,
        market,
        trade,
    }))
}

async fn trade_execution_response(
    state: &AppState,
    pubkey: &str,
    market: &Market,
    next_q_long: f64,
    next_q_short: f64,
    next_reserve_minor: u64,
    raw_event: Value,
) -> (StatusCode, Json<Value>) {
    let wallet = match wallet_response(state, pubkey).await {
        Ok(wallet) => wallet,
        Err(error) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": error.to_string() })),
            );
        }
    };
    let settlement = if let Some(trade_id) = raw_event.get("id").and_then(Value::as_str) {
        state
            .db
            .get_trade_settlement_by_trade_id(trade_id)
            .await
            .ok()
            .flatten()
    } else {
        None
    };
    let updated_market = match state.db.get_market_launch_state(&market.event_id).await {
        Ok(Some(launch)) => product_market_summary(
            state,
            &Market {
                q_long: next_q_long,
                q_short: next_q_short,
                reserve_sats: next_reserve_minor,
                ..market.clone()
            },
            &launch,
        ),
        _ => None,
    };

    let (issued, change) = trade_proof_bundles_from_settlement(settlement.as_ref());

    match updated_market {
        Some(summary) => (
            StatusCode::CREATED,
            Json(json!(ProductTradeExecutionResponse {
                wallet,
                market: summary,
                trade: raw_event,
                settlement: settlement.as_ref().map(product_trade_settlement_response),
                issued,
                change,
            })),
        ),
        None => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "failed_to_build_updated_market_summary" })),
        ),
    }
}

async fn market_detail_response(
    state: &AppState,
    market: &Market,
    launch: &MarketLaunchState,
) -> (StatusCode, Json<Value>) {
    let trades = state
        .db
        .list_market_trade_events(&market.event_id, 240)
        .await
        .unwrap_or_default();

    match product_market_summary(state, market, launch) {
        Some(summary) => (
            StatusCode::OK,
            Json(json!(ProductMarketDetailResponse {
                market: summary,
                trades: trades
                    .into_iter()
                    .filter_map(|trade| serde_json::from_str(&trade.raw_event_json).ok())
                    .collect(),
            })),
        ),
        None => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "failed_to_build_market_summary" })),
        ),
    }
}

async fn enforce_paper_funding_limits(
    state: &AppState,
    pubkey: &str,
    amount_minor: u64,
) -> Result<(), (StatusCode, Json<Value>)> {
    if amount_minor > PAPER_FAUCET_SINGLE_TOPUP_LIMIT_MINOR {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({
                "error": format!(
                    "paper_faucet_single_topup_limit_exceeded:max_minor={PAPER_FAUCET_SINGLE_TOPUP_LIMIT_MINOR}"
                )
            })),
        ));
    }

    let window_started_at = chrono::Utc::now().timestamp() - PAPER_FAUCET_WINDOW_SECONDS;
    let funded_in_window = state
        .db
        .sum_wallet_funding_amount_since(pubkey, "paper", window_started_at)
        .await
        .map_err(|error| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": error.to_string() })),
            )
        })?;

    if funded_in_window.saturating_add(amount_minor) > PAPER_FAUCET_WINDOW_LIMIT_MINOR {
        let remaining_minor = PAPER_FAUCET_WINDOW_LIMIT_MINOR.saturating_sub(funded_in_window);
        return Err((
            StatusCode::TOO_MANY_REQUESTS,
            Json(json!({
                "error": format!(
                    "paper_faucet_window_limit_exceeded:window_minor={PAPER_FAUCET_WINDOW_LIMIT_MINOR}:remaining_minor={remaining_minor}"
                )
            })),
        ));
    }

    Ok(())
}

fn parse_side(value: &str) -> Result<Side, String> {
    match value.to_lowercase().as_str() {
        "yes" | "long" => Ok(Side::Long),
        "no" | "short" => Ok(Side::Short),
        _ => Err("side must be yes/no or long/short".to_string()),
    }
}

fn side_label(side: Side) -> &'static str {
    match side {
        Side::Long => "yes",
        Side::Short => "no",
    }
}

fn calculate_fee_minor(amount_minor: u64) -> u64 {
    ((amount_minor as f64) * (TRADE_FEE_BPS as f64 / 10_000.0)).ceil() as u64
}

fn buy_cost_for_quantity(
    state: &AppState,
    market: &Market,
    side: Side,
    quantity: f64,
) -> Result<(u64, u64, u64), String> {
    let (q_primary, q_secondary) = match side {
        Side::Long => (market.q_long, market.q_short),
        Side::Short => (market.q_short, market.q_long),
    };
    let market_cost = state
        .market_manager
        .lmsr()
        .calculate_buy_cost(q_primary, q_secondary, quantity)
        .map_err(|error| error.to_string())?;
    let fee_minor = calculate_fee_minor(market_cost);
    Ok((market_cost, fee_minor, market_cost + fee_minor))
}

fn sell_value_for_quantity(
    state: &AppState,
    market: &Market,
    side: Side,
    quantity: f64,
) -> Result<(u64, u64, u64), String> {
    let (q_primary, q_secondary) = match side {
        Side::Long => (market.q_long, market.q_short),
        Side::Short => (market.q_short, market.q_long),
    };
    let gross_minor = state
        .market_manager
        .lmsr()
        .calculate_sell_refund(q_primary, q_secondary, quantity)
        .map_err(|error| error.to_string())?;
    let fee_minor = calculate_fee_minor(gross_minor);
    let net_minor = gross_minor.saturating_sub(fee_minor);
    Ok((gross_minor, fee_minor, net_minor))
}

fn solve_buy_quantity(
    state: &AppState,
    market: &Market,
    side: Side,
    spend_minor: u64,
) -> Result<(f64, u64, u64, u64), String> {
    if spend_minor == 0 {
        return Err("spend_minor must be positive".to_string());
    }

    let mut low = 0.0_f64;
    let mut high = 1.0_f64;
    while let Ok((_, _, total_minor)) = buy_cost_for_quantity(state, market, side, high) {
        if total_minor >= spend_minor {
            break;
        }
        high *= 2.0;
        if high > 1_000_000.0 {
            break;
        }
    }

    for _ in 0..80 {
        let mid = (low + high) / 2.0;
        if mid <= 0.0 {
            break;
        }
        let (_, _, total_minor) = buy_cost_for_quantity(state, market, side, mid)?;
        if total_minor > spend_minor {
            high = mid;
        } else {
            low = mid;
        }
    }

    let quantity = low;
    let (market_cost_minor, fee_minor, total_minor) =
        buy_cost_for_quantity(state, market, side, quantity)?;
    if quantity <= f64::EPSILON || total_minor == 0 {
        return Err("spend_minor is too small for a trade".to_string());
    }

    Ok((quantity, market_cost_minor, fee_minor, total_minor))
}

fn usd_minor_to_msat(amount_minor: u64, btc_usd_price: f64) -> u64 {
    if amount_minor == 0 || !btc_usd_price.is_finite() || btc_usd_price <= 0.0 {
        return 0;
    }

    let amount_usd = amount_minor as f64 / 100.0;
    let amount_btc = amount_usd / btc_usd_price;
    (amount_btc * 100_000_000_000.0).round().max(0.0) as u64
}

async fn build_quote_response(
    state: &AppState,
    market: &Market,
    req: &ProductTradeQuoteRequest,
) -> Result<PreparedTradeQuote, String> {
    let side = parse_side(&req.side)?;
    let (current_yes_ppm, current_no_ppm) = current_prices_ppm(state, market);

    match req.trade_type.to_lowercase().as_str() {
        "buy" => {
            let (quantity, market_cost_minor, fee_minor, total_minor) =
                if let Some(spend_minor) = req.spend_minor {
                    let (solved_quantity, _, _, _) =
                        solve_buy_quantity(state, market, side, spend_minor)?;
                    let quantity = floor_quantity_to_minor_grid(solved_quantity)?;
                    let (market_cost_minor, fee_minor, total_minor) =
                        buy_cost_for_quantity(state, market, side, quantity)?;
                    (quantity, market_cost_minor, fee_minor, total_minor)
                } else if let Some(quantity) = req.quantity {
                    let quantity = floor_quantity_to_minor_grid(quantity)?;
                    let (market_cost_minor, fee_minor, total_minor) =
                        buy_cost_for_quantity(state, market, side, quantity)?;
                    (quantity, market_cost_minor, fee_minor, total_minor)
                } else {
                    return Err("buy quote requires spend_minor or quantity".to_string());
                };
            let settlement_minor = total_minor;
            let fx_quote = state
                .fx_service
                .quote_wallet_topup(settlement_minor)
                .await?;
            let (next_q_long, next_q_short) = next_buy_quantities(market, side, quantity);
            let (post_yes_ppm, post_no_ppm) = current_prices_ppm(
                state,
                &Market {
                    q_long: next_q_long,
                    q_short: next_q_short,
                    ..market.clone()
                },
            );
            let marginal_price_before_ppm = if side == Side::Long {
                current_yes_ppm
            } else {
                current_no_ppm
            };
            let marginal_price_after_ppm = if side == Side::Long {
                post_yes_ppm
            } else {
                post_no_ppm
            };
            let settlement_fee_msat = usd_minor_to_msat(fee_minor, fx_quote.snapshot.btc_usd_price);

            let average_price_ppm = ((market_cost_minor as f64 / quantity) * 1_000_000.0)
                .round()
                .clamp(0.0, 1_000_000.0) as u64;

            Ok(PreparedTradeQuote {
                response: ProductTradeQuoteResponse {
                    quote_id: None,
                    market_event_id: market.event_id.clone(),
                    trade_type: "buy".to_string(),
                    side: side_label(side).to_string(),
                    fx_quote_id: Some(fx_quote.snapshot.id.clone()),
                    quantity,
                    quantity_minor: quantity_to_minor(quantity)?,
                    spend_minor: total_minor,
                    fee_minor,
                    net_minor: market_cost_minor,
                    settlement_minor,
                    settlement_msat: fx_quote.snapshot.amount_msat,
                    settlement_fee_msat,
                    average_price_ppm,
                    marginal_price_before_ppm,
                    marginal_price_after_ppm,
                    current_price_yes_ppm: current_yes_ppm,
                    current_price_no_ppm: current_no_ppm,
                    fx_source: Some(fx_quote.snapshot.source.clone()),
                    btc_usd_price: Some(fx_quote.snapshot.btc_usd_price),
                    spread_bps: Some(fx_quote.snapshot.spread_bps),
                    fx_observations: fx_quote
                        .snapshot
                        .observations
                        .iter()
                        .map(product_fx_observation_response)
                        .collect(),
                    created_at: None,
                    expires_at: None,
                    status: None,
                    trade_id: None,
                },
                fx_quote: fx_quote.snapshot,
            })
        }
        "sell" => {
            let quantity = floor_quantity_to_minor_grid(
                req.quantity
                    .ok_or_else(|| "sell quote requires quantity".to_string())?,
            )?;
            let (gross_minor, fee_minor, net_minor) =
                sell_value_for_quantity(state, market, side, quantity)?;
            let settlement_minor = net_minor;
            let fx_quote = state
                .fx_service
                .quote_wallet_topup(settlement_minor)
                .await?;
            let (next_q_long, next_q_short) = next_sell_quantities(market, side, quantity);
            let (post_yes_ppm, post_no_ppm) = current_prices_ppm(
                state,
                &Market {
                    q_long: next_q_long,
                    q_short: next_q_short,
                    ..market.clone()
                },
            );
            let marginal_price_before_ppm = if side == Side::Long {
                current_yes_ppm
            } else {
                current_no_ppm
            };
            let marginal_price_after_ppm = if side == Side::Long {
                post_yes_ppm
            } else {
                post_no_ppm
            };
            let settlement_fee_msat = usd_minor_to_msat(fee_minor, fx_quote.snapshot.btc_usd_price);
            let average_price_ppm = ((gross_minor as f64 / quantity) * 1_000_000.0)
                .round()
                .clamp(0.0, 1_000_000.0) as u64;

            Ok(PreparedTradeQuote {
                response: ProductTradeQuoteResponse {
                    quote_id: None,
                    market_event_id: market.event_id.clone(),
                    trade_type: "sell".to_string(),
                    side: side_label(side).to_string(),
                    fx_quote_id: Some(fx_quote.snapshot.id.clone()),
                    quantity,
                    quantity_minor: quantity_to_minor(quantity)?,
                    spend_minor: gross_minor,
                    fee_minor,
                    net_minor,
                    settlement_minor,
                    settlement_msat: fx_quote.snapshot.amount_msat,
                    settlement_fee_msat,
                    average_price_ppm,
                    marginal_price_before_ppm,
                    marginal_price_after_ppm,
                    current_price_yes_ppm: current_yes_ppm,
                    current_price_no_ppm: current_no_ppm,
                    fx_source: Some(fx_quote.snapshot.source.clone()),
                    btc_usd_price: Some(fx_quote.snapshot.btc_usd_price),
                    spread_bps: Some(fx_quote.snapshot.spread_bps),
                    fx_observations: fx_quote
                        .snapshot
                        .observations
                        .iter()
                        .map(product_fx_observation_response)
                        .collect(),
                    created_at: None,
                    expires_at: None,
                    status: None,
                    trade_id: None,
                },
                fx_quote: fx_quote.snapshot,
            })
        }
        _ => Err("trade_type must be buy or sell".to_string()),
    }
}

fn current_prices_ppm(state: &AppState, market: &Market) -> (u64, u64) {
    match state
        .market_manager
        .lmsr()
        .get_prices(market.q_long, market.q_short)
    {
        Ok((yes, no)) => (
            (yes * 1_000_000.0).round().clamp(0.0, 1_000_000.0) as u64,
            (no * 1_000_000.0).round().clamp(0.0, 1_000_000.0) as u64,
        ),
        Err(_) => (500_000, 500_000),
    }
}

fn build_trade_settlement_insert(
    state: &AppState,
    pubkey: &str,
    quote: &ProductTradeQuoteResponse,
    issued: Option<&ProductTradeProofBundleResponse>,
    change: Option<&ProductTradeProofBundleResponse>,
) -> Option<TradeSettlementInsert> {
    if !state.paper_mode {
        return None;
    }

    Some(TradeSettlementInsert {
        quote_id: quote.quote_id.clone(),
        pubkey: pubkey.to_string(),
        market_event_id: quote.market_event_id.clone(),
        trade_type: quote.trade_type.clone(),
        side: quote.side.clone(),
        rail: "paper".to_string(),
        mode: "paper_internal".to_string(),
        settlement_minor: quote.settlement_minor,
        settlement_msat: quote.settlement_msat,
        settlement_fee_msat: quote.settlement_fee_msat,
        fx_quote_id: if quote.quote_id.is_some() {
            quote.fx_quote_id.clone()
        } else {
            None
        },
        invoice: None,
        payment_hash: None,
        metadata_json: Some(
            json!({
                "fx_source": quote.fx_source,
                "btc_usd_price": quote.btc_usd_price,
                "spread_bps": quote.spread_bps,
                "fx_observations": quote.fx_observations,
                "issued": issued,
                "change": change,
            })
            .to_string(),
        ),
    })
}

fn post_trade_price_ppm(
    state: &AppState,
    q_long: f64,
    q_short: f64,
    side: Side,
) -> Result<u64, String> {
    let (yes, no) = state
        .market_manager
        .lmsr()
        .get_prices(q_long, q_short)
        .map_err(|error| error.to_string())?;
    let ppm = match side {
        Side::Long => yes,
        Side::Short => no,
    };
    Ok((ppm * 1_000_000.0).round().clamp(0.0, 1_000_000.0) as u64)
}

fn next_buy_quantities(market: &Market, side: Side, quantity: f64) -> (f64, f64) {
    match side {
        Side::Long => (market.q_long + quantity, market.q_short),
        Side::Short => (market.q_long, market.q_short + quantity),
    }
}

fn next_sell_quantities(market: &Market, side: Side, quantity: f64) -> (f64, f64) {
    match side {
        Side::Long => (market.q_long - quantity, market.q_short),
        Side::Short => (market.q_long, market.q_short - quantity),
    }
}

async fn load_market_for_trading(state: &AppState, event_id: &str) -> Result<Market, String> {
    match state.get_market_by_event_id(event_id).await {
        Some(market) => {
            state.market_manager.load_market(market.clone()).await;
            Ok(market)
        }
        None => Err(format!("market_not_found: {event_id}")),
    }
}

async fn wallet_response(state: &AppState, pubkey: &str) -> Result<ProductWalletResponse, String> {
    let now = chrono::Utc::now().timestamp();
    state
        .db
        .expire_wallet_topups_for_pubkey(pubkey, now)
        .await
        .map_err(|error| error.to_string())?;
    state
        .db
        .ensure_wallet(pubkey)
        .await
        .map_err(|error| error.to_string())?;
    let initial_pending_topups = state
        .db
        .list_pending_wallet_topup_quotes(pubkey, 8)
        .await
        .map_err(|error| error.to_string())?;
    for quote in initial_pending_topups {
        let _ = sync_wallet_topup_quote_best_effort(state, &quote).await;
    }
    let balance = state
        .db
        .get_wallet_balance(pubkey)
        .await
        .map_err(|error| error.to_string())?
        .unwrap_or(WalletBalanceRecord {
            pubkey: pubkey.to_string(),
            available_minor: 0,
            pending_minor: 0,
            total_deposited_minor: 0,
            updated_at: chrono::Utc::now().timestamp(),
        });
    let positions = state
        .db
        .list_positions(pubkey)
        .await
        .map_err(|error| error.to_string())?;
    let funding_events = state
        .db
        .list_wallet_funding_events(pubkey, 12)
        .await
        .map_err(|error| error.to_string())?;
    let pending_topups = state
        .db
        .list_pending_wallet_topup_quotes(pubkey, 8)
        .await
        .map_err(|error| error.to_string())?;

    let mut position_responses = Vec::new();
    for position in positions {
        let Some(market) = state
            .db
            .get_market(&position.market_event_id)
            .await
            .map_err(|error| error.to_string())?
        else {
            continue;
        };
        let (price_yes_ppm, price_no_ppm) = current_prices_ppm(state, &market);
        let current_price_ppm = if position.direction == "yes" {
            price_yes_ppm
        } else {
            price_no_ppm
        };
        let market_value_minor =
            ((position.quantity * current_price_ppm as f64) / 1_000_000.0).floor() as u64;
        let unrealized_pnl_minor = market_value_minor as i64 - position.cost_basis_minor as i64;
        position_responses.push(ProductWalletPositionResponse {
            market_event_id: position.market_event_id,
            market_slug: position.market_slug,
            market_title: market.title,
            direction: position.direction,
            quantity: position.quantity,
            cost_basis_minor: position.cost_basis_minor,
            current_price_ppm,
            market_value_minor,
            unrealized_pnl_minor,
        });
    }

    Ok(ProductWalletResponse {
        pubkey: balance.pubkey,
        available_minor: balance.available_minor,
        pending_minor: balance.pending_minor,
        total_deposited_minor: balance.total_deposited_minor,
        positions: position_responses,
        pending_topups: {
            let mut responses = Vec::new();
            for quote in pending_topups {
                if let Ok(response) = wallet_topup_response_for_state(state, &quote).await {
                    responses.push(response);
                }
            }
            responses
        },
        funding_events: funding_events
            .into_iter()
            .map(|event| ProductFundingEventResponse {
                id: event.id,
                rail: event.rail,
                amount_minor: event.amount_minor,
                status: event.status,
                risk_level: event.risk_level,
                created_at: event.created_at,
            })
            .collect(),
    })
}

async fn load_wallet_topup_response(
    state: &AppState,
    quote: &WalletTopupQuote,
) -> Result<ProductWalletTopupResponse, String> {
    let quote = sync_wallet_topup_quote_best_effort(state, quote)
        .await
        .unwrap_or_else(|_| quote.clone());
    wallet_topup_response_for_state(state, &quote).await
}

fn lightning_fx_quote_response(quote: &FxQuoteEnvelope) -> ProductLightningFxQuoteResponse {
    ProductLightningFxQuoteResponse {
        amount_minor: quote.snapshot.amount_minor,
        amount_msat: quote.snapshot.amount_msat,
        btc_usd_price: quote.snapshot.btc_usd_price,
        fx_source: quote.snapshot.source.clone(),
        spread_bps: quote.snapshot.spread_bps,
        created_at: quote.snapshot.created_at,
        expires_at: quote.snapshot.expires_at,
        fallback_used: quote.fallback_used,
        observations: quote
            .snapshot
            .observations
            .iter()
            .map(product_fx_observation_response)
            .collect(),
    }
}

fn wallet_topup_response(
    quote: &WalletTopupQuote,
    fx_quote: &FxQuoteSnapshot,
    issued_proofs: Option<Vec<ProofInput>>,
) -> ProductWalletTopupResponse {
    ProductWalletTopupResponse {
        id: quote.id.clone(),
        rail: quote.rail.clone(),
        amount_minor: quote.amount_minor,
        amount_msat: quote.amount_msat,
        status: quote.status.to_string(),
        invoice: quote.invoice.clone(),
        payment_hash: quote.payment_hash.clone(),
        fx_source: fx_quote.source.clone(),
        btc_usd_price: fx_quote.btc_usd_price,
        spread_bps: fx_quote.spread_bps,
        fx_quote_id: fx_quote.id.clone(),
        observations: fx_quote
            .observations
            .iter()
            .map(product_fx_observation_response)
            .collect(),
        issued_proofs,
        created_at: quote.created_at,
        expires_at: quote.expires_at,
    }
}

async fn wallet_topup_response_for_state(
    state: &AppState,
    quote: &WalletTopupQuote,
) -> Result<ProductWalletTopupResponse, String> {
    let fx_quote = state
        .db
        .get_fx_quote_snapshot(&quote.fx_quote_id)
        .await
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "fx_quote_not_found".to_string())?;
    let issued_proofs = match quote.funding_event_id.as_deref() {
        Some(funding_event_id) => state
            .db
            .get_wallet_funding_event(funding_event_id)
            .await
            .map_err(|error| error.to_string())?
            .and_then(|event| issued_proofs_from_metadata(event.metadata_json.as_deref())),
        None => issued_proofs_from_metadata(quote.metadata_json.as_deref()),
    };
    Ok(wallet_topup_response(quote, &fx_quote, issued_proofs))
}

async fn sync_wallet_topup_quote_best_effort(
    state: &AppState,
    quote: &WalletTopupQuote,
) -> Result<WalletTopupQuote, String> {
    if quote.status.to_string() != "invoice_pending" {
        return Ok(quote.clone());
    }

    let Some(payment_hash) = quote.payment_hash.as_deref() else {
        return Ok(quote.clone());
    };

    let invoice_status = {
        let invoice_service = state.invoice_service.lock().await;
        invoice_service
            .get_invoice_status(payment_hash)
            .await
            .map_err(|error| error.to_string())?
    };

    match invoice_status.as_str() {
        "settled" => {
            let proofs = if let Some(existing) =
                issued_proofs_from_metadata(quote.metadata_json.as_deref())
            {
                existing
            } else {
                let proofs = issue_wallet_proofs(state, quote.amount_minor).await?;
                let proof_records = proofs
                    .iter()
                    .map(|proof| {
                        portfolio_proof_insert_from_input(
                            proof,
                            "usd",
                            None,
                            None,
                            "lightning_topup",
                        )
                    })
                    .collect::<Vec<_>>();
                state
                    .db
                    .insert_portfolio_proofs(&proof_records)
                    .await
                    .map_err(|error| error.to_string())?;
                proofs
            };
            let metadata_json = wallet_proofs_metadata_json(
                "lightning",
                &proofs,
                json!({
                    "payment_hash": payment_hash,
                    "topup_quote_id": quote.id
                }),
            )
            .map_err(|error| error.to_string())?;
            state
                .db
                .complete_wallet_topup_quote(&quote.id, None, Some(&metadata_json))
                .await
                .map_err(|error| error.to_string())
        }
        "expired" | "cancelled" => state
            .db
            .expire_wallet_topup_quote(&quote.id)
            .await
            .map_err(|error| error.to_string())?
            .ok_or_else(|| "topup_quote_not_found".to_string()),
        _ => Ok(quote.clone()),
    }
}

fn product_market_summary(
    state: &AppState,
    market: &Market,
    launch: &MarketLaunchState,
) -> Option<ProductMarketSummary> {
    let raw_event: Value = serde_json::from_str(&launch.raw_event_json).ok()?;
    let (price_yes_ppm, price_no_ppm) = current_prices_ppm(state, market);
    Some(ProductMarketSummary {
        event_id: market.event_id.clone(),
        slug: market.slug.clone(),
        title: market.title.clone(),
        description: market.description.clone(),
        creator_pubkey: market.creator_pubkey.clone(),
        visibility: launch.visibility.to_string(),
        created_at: market.created_at,
        first_trade_at: launch.first_trade_at,
        price_yes_ppm,
        price_no_ppm,
        volume_minor: launch.volume_minor,
        trade_count: launch.trade_count,
        reserve_minor: market.reserve_sats,
        raw_event,
    })
}

fn parse_metadata_json(value: Option<&str>) -> Option<Value> {
    value.and_then(|raw| serde_json::from_str(raw).ok())
}

fn build_trade_event(
    trade_id: &str,
    mint_pubkey: String,
    market_event_id: &str,
    direction: &str,
    trade_type: &str,
    amount_minor: u64,
    quantity: f64,
    price_ppm: u64,
    created_at: i64,
    request_signer_pubkey: Option<&str>,
) -> Value {
    let mut tags = vec![
        json!(["e", market_event_id]),
        json!(["direction", direction]),
        json!(["type", trade_type]),
        json!(["amount", amount_minor.to_string()]),
        json!(["quantity", format!("{quantity:.8}")]),
        json!(["price", price_ppm.to_string()]),
        json!(["unit", "usd"]),
    ];

    if let Some(pubkey) = request_signer_pubkey {
        tags.push(json!(["p", pubkey]));
    }

    json!({
        "id": trade_id,
        "pubkey": mint_pubkey,
        "created_at": created_at,
        "kind": 983,
        "content": "",
        "sig": "",
        "tags": tags
    })
}

fn mint_pubkey_from_market(_event_id: &str, _side: &str) -> String {
    std::env::var("MINT_NOSTR_PUBKEY").unwrap_or_else(|_| FALLBACK_MINT_PUBKEY.to_string())
}

fn request_auth_context(
    headers: &HeaderMap,
    method: &Method,
    uri: &Uri,
) -> Result<RequestAuthContext, String> {
    let Some(header_value) = headers.get(AUTHORIZATION) else {
        return Ok(RequestAuthContext {
            signer_pubkey: None,
        });
    };

    let authorization = header_value
        .to_str()
        .map_err(|_| "invalid_authorization_header".to_string())?;
    let encoded_event = authorization
        .strip_prefix("Nostr ")
        .or_else(|| authorization.strip_prefix("nostr "))
        .ok_or_else(|| "unsupported_authorization_scheme".to_string())?;
    let raw_event = BASE64_STANDARD
        .decode(encoded_event)
        .map_err(|_| "invalid_nip98_payload".to_string())?;
    let auth_event: Nip98AuthEvent =
        serde_json::from_slice(&raw_event).map_err(|_| "invalid_nip98_event".to_string())?;

    verify_nip98_auth_event(&auth_event, headers, method, uri)?;

    Ok(RequestAuthContext {
        signer_pubkey: Some(auth_event.pubkey),
    })
}

fn verify_nip98_auth_event(
    event: &Nip98AuthEvent,
    headers: &HeaderMap,
    method: &Method,
    uri: &Uri,
) -> Result<(), String> {
    if event.kind != NIP98_AUTH_KIND {
        return Err("invalid_nip98_kind".to_string());
    }

    let now = chrono::Utc::now().timestamp();
    if (now - event.created_at).abs() > NIP98_AUTH_WINDOW_SECONDS {
        return Err("expired_nip98_event".to_string());
    }

    let expected_url = request_url(headers, uri)?;
    let tagged_url = tag_value(&event.tags, "u").ok_or_else(|| "missing_nip98_url".to_string())?;
    if tagged_url != expected_url {
        return Err("nip98_url_mismatch".to_string());
    }

    let tagged_method =
        tag_value(&event.tags, "method").ok_or_else(|| "missing_nip98_method".to_string())?;
    if tagged_method != method.as_str() {
        return Err("nip98_method_mismatch".to_string());
    }

    let expected_id = compute_event_id(event)?;
    if event.id != expected_id {
        return Err("invalid_nip98_event_id".to_string());
    }

    verify_event_signature(event, &expected_id)?;

    Ok(())
}

fn request_url(headers: &HeaderMap, uri: &Uri) -> Result<String, String> {
    let scheme = header_string(headers, "x-forwarded-proto")
        .or_else(|| header_string(headers, "x-scheme"))
        .unwrap_or_else(|| "http".to_string());
    let host = header_string(headers, "x-forwarded-host")
        .or_else(|| header_string(headers, "host"))
        .ok_or_else(|| "missing_request_host".to_string())?;
    let path = uri
        .path_and_query()
        .map(|value| value.as_str())
        .unwrap_or_else(|| uri.path());

    Ok(format!("{scheme}://{host}{path}"))
}

fn header_string(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|value| value.to_str().ok())
        .map(str::to_string)
}

fn tag_value<'a>(tags: &'a [Vec<String>], name: &str) -> Option<&'a str> {
    tags.iter()
        .find(|tag| tag.first().map(|value| value.as_str()) == Some(name))
        .and_then(|tag| tag.get(1))
        .map(String::as_str)
}

fn compute_event_id(event: &Nip98AuthEvent) -> Result<String, String> {
    let serialized = serde_json::to_string(&json!([
        0,
        event.pubkey,
        event.created_at,
        event.kind,
        event.tags,
        event.content,
    ]))
    .map_err(|_| "failed_to_serialize_nip98_event".to_string())?;

    Ok(hex::encode(Sha256::digest(serialized.as_bytes())))
}

fn verify_event_signature(event: &Nip98AuthEvent, event_id: &str) -> Result<(), String> {
    let public_key =
        XOnlyPublicKey::from_str(&event.pubkey).map_err(|_| "invalid_nip98_pubkey".to_string())?;
    let signature =
        Signature::from_str(&event.sig).map_err(|_| "invalid_nip98_signature".to_string())?;
    let digest = hex::decode(event_id).map_err(|_| "invalid_nip98_event_id".to_string())?;
    let message =
        Message::from_digest_slice(&digest).map_err(|_| "invalid_nip98_event_id".to_string())?;

    Secp256k1::verification_only()
        .verify_schnorr(&signature, &message, &public_key)
        .map_err(|_| "invalid_nip98_signature".to_string())
}
