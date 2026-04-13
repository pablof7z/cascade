use crate::fx::FxQuoteEnvelope;
use crate::routes::AppState;
use crate::stripe::{
    funding_metadata_checkout_fields, funding_metadata_merge, stripe_event_metadata,
};
use crate::types::{
    BlindedMessageInput, CreatorMarketsResponse, MintBolt11Request, MintBolt11Response,
    MintQuoteBolt11Request, MintQuoteBolt11Response, ProductBuyRequest,
    ProductCoordinatorBuyRequest, ProductCoordinatorSellRequest,
    ProductCoordinatorTradeQuoteRequest, ProductCreateMarketRequest, ProductFeedResponse,
    ProductFxObservationResponse, ProductLightningFxQuoteResponse, ProductMarketDetailResponse,
    ProductMarketSummary, ProductPortfolioFundingRequestStatusResponse,
    ProductPortfolioFundingResponse, ProductRuntimeFundingResponse, ProductRuntimeRailResponse,
    ProductRuntimeResponse, ProductSellRequest, ProductStripeFundingRequest,
    ProductTradeBlindSignatureBundleResponse, ProductTradeExecutionResponse,
    ProductTradeQuoteRequest, ProductTradeQuoteResponse, ProductTradeRequestStatusResponse,
    ProductTradeSettlementResponse, ProductTradeStatusResponse, ProofInput, TokenOutput,
};
use axum::{
    body::Bytes,
    extract::{Json, Path, State},
    http::{header::AUTHORIZATION, HeaderMap, Method, StatusCode, Uri},
};
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use bitcoin::secp256k1::{schnorr::Signature, Message, Secp256k1, XOnlyPublicKey};
use cascade_core::{
    product::{
        FxQuoteSnapshot, MarketLaunchState, TradeExecutionRequest, TradeExecutionRequestStatus,
        TradeQuoteSnapshot, TradeSettlementInsert, TradeSettlementRecord, WalletFundingQuote,
        WalletFundingRequest, WalletFundingRequestStatus, WalletFundingStatus,
    },
    Market, Side,
};
use cdk::mint::MintInput;
use cdk::mint::QuoteId;
use cdk::nuts::{
    BlindSignature, BlindedMessage, CurrencyUnit, MintQuoteState, MintRequest, State as ProofState,
};
use cdk::Amount;
use cdk_common::mint::{MintQuote as StoredMintQuote, Operation};
use cdk_common::nut00::KnownMethod;
use cdk_common::payment::PaymentIdentifier;
use cdk_common::PaymentMethod;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::str::FromStr;

const TRADE_FEE_BPS: u64 = 100;
const TRADE_QUOTE_TTL_SECONDS: i64 = 30;
const FALLBACK_MINT_PUBKEY: &str =
    "1111111111111111111111111111111111111111111111111111111111111111";
const SIGNET_FUNDING_SINGLE_LIMIT_MINOR: u64 = 10_000;
const SIGNET_FUNDING_WINDOW_LIMIT_MINOR: u64 = 25_000;
const SIGNET_FUNDING_WINDOW_SECONDS: i64 = 24 * 60 * 60;
const NIP98_AUTH_KIND: i64 = 27_235;
const NIP98_AUTH_WINDOW_SECONDS: i64 = 120;
const SHARE_MINOR_SCALE: u64 = 10_000;
const MAX_MARKET_DENOMINATION_POWER: u32 = 32;
const CLIENT_EDITION_HEADER: &str = "x-cascade-edition";

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

fn normalize_client_edition(value: &str) -> Option<&'static str> {
    match value.trim().to_ascii_lowercase().as_str() {
        "paper" | "signet" => Some("signet"),
        "mainnet" => Some("mainnet"),
        _ => None,
    }
}

fn edition_mismatch_error(expected: &str, actual: &str) -> String {
    format!("edition_mismatch:expected={expected}:actual={actual}")
}

fn require_client_edition(
    headers: &HeaderMap,
    state: &AppState,
) -> Option<(StatusCode, Json<Value>)> {
    let expected = headers
        .get(CLIENT_EDITION_HEADER)
        .and_then(|value| value.to_str().ok())
        .and_then(normalize_client_edition)?;

    let actual = state.edition();
    if expected == actual {
        return None;
    }

    Some((
        StatusCode::CONFLICT,
        Json(json!({ "error": edition_mismatch_error(expected, actual) })),
    ))
}

fn runtime_response(state: &AppState) -> ProductRuntimeResponse {
    ProductRuntimeResponse {
        edition: state.edition().to_string(),
        network: state.network_type.clone(),
        mint_url: state.mint_url.clone(),
        proof_custody: "browser_local".to_string(),
        request_edition_header: CLIENT_EDITION_HEADER.to_string(),
        funding: ProductRuntimeFundingResponse {
            lightning: ProductRuntimeRailResponse {
                available: true,
                reason: None,
            },
            stripe: ProductRuntimeRailResponse {
                available: state.stripe_gateway.is_some(),
                reason: state
                    .stripe_gateway
                    .as_ref()
                    .map(|_| None)
                    .unwrap_or_else(|| Some("stripe_fundings_unavailable".to_string())),
            },
        },
    }
}

fn funding_metadata_json(source: &str, extra: Value) -> Result<String, serde_json::Error> {
    let mut payload = json!({ "source": source });

    if let Some(object) = payload.as_object_mut() {
        if let Some(extra_object) = extra.as_object() {
            for (key, value) in extra_object {
                object.insert(key.clone(), value.clone());
            }
        }
    }

    serde_json::to_string(&payload)
}

fn wallet_funding_status_label(quote: &WalletFundingQuote) -> String {
    if quote.rail == "stripe" && quote.status == WalletFundingStatus::InvoicePending {
        "pending".to_string()
    } else {
        quote.status.to_string()
    }
}

fn cdk_mint_quote_state_label(state: MintQuoteState) -> &'static str {
    match state {
        MintQuoteState::Unpaid => "UNPAID",
        MintQuoteState::Paid => "PAID",
        MintQuoteState::Issued => "ISSUED",
    }
}

fn mint_quote_bolt11_response_from_cdk(
    quote: &StoredMintQuote,
) -> Result<MintQuoteBolt11Response, String> {
    let amount = quote
        .amount
        .clone()
        .ok_or_else(|| "mint_quote_amount_missing".to_string())?;

    Ok(MintQuoteBolt11Response {
        quote: quote.id.to_string(),
        request: quote.request.clone(),
        amount: amount.value(),
        unit: "usd".to_string(),
        state: cdk_mint_quote_state_label(quote.state()).to_string(),
        expiry: Some(i64::try_from(quote.expiry).unwrap_or(i64::MAX)),
    })
}

fn wallet_funding_amount(quote: &WalletFundingQuote) -> Amount<CurrencyUnit> {
    Amount::new(quote.amount_minor, CurrencyUnit::Usd)
}

fn build_cdk_mint_quote_for_wallet_funding(
    quote: &WalletFundingQuote,
) -> Result<StoredMintQuote, String> {
    let quote_id = QuoteId::from_str(&quote.id).map_err(|error| error.to_string())?;
    let request = quote
        .invoice
        .clone()
        .ok_or_else(|| "funding_quote_missing_invoice".to_string())?;
    let payment_hash = quote
        .payment_hash
        .clone()
        .ok_or_else(|| "funding_quote_missing_payment_hash".to_string())?;
    let request_lookup_id =
        PaymentIdentifier::new("payment_hash", &payment_hash).map_err(|error| error.to_string())?;
    let amount = wallet_funding_amount(quote);
    let zero = Amount::new(0, CurrencyUnit::Usd);
    let extra_json = Some(json!({
        "source": "cascade_wallet_funding",
        "rail": quote.rail,
        "fx_quote_id": quote.fx_quote_id,
    }));

    Ok(StoredMintQuote::new(
        Some(quote_id),
        request,
        CurrencyUnit::Usd,
        Some(amount),
        quote.expires_at.max(0) as u64,
        request_lookup_id,
        None,
        zero.clone(),
        zero,
        PaymentMethod::Known(KnownMethod::Bolt11),
        quote.created_at.max(0) as u64,
        Vec::new(),
        Vec::new(),
        extra_json,
    ))
}

fn reconcile_cdk_mint_quote_with_wallet_funding(
    mint_quote: &mut cdk_common::database::mint::Acquired<StoredMintQuote>,
    quote: &WalletFundingQuote,
) -> Result<(), String> {
    let amount = wallet_funding_amount(quote);
    let payment_hash = quote
        .payment_hash
        .as_deref()
        .ok_or_else(|| "funding_quote_missing_payment_hash".to_string())?;
    let payment_hash = payment_hash.to_string();

    if matches!(
        quote.status,
        WalletFundingStatus::Paid | WalletFundingStatus::Complete
    ) && !mint_quote.payment_ids().contains(&&payment_hash)
    {
        mint_quote
            .add_payment(
                amount.clone(),
                payment_hash.clone(),
                quote.settled_at.map(|timestamp| timestamp.max(0) as u64),
            )
            .map_err(|error| error.to_string())?;
    }

    if quote.status == WalletFundingStatus::Complete && mint_quote.state() != MintQuoteState::Issued
    {
        let remaining = mint_quote.amount_mintable();
        if remaining.value() > 0 {
            mint_quote
                .add_issuance(remaining)
                .map_err(|error| error.to_string())?;
        }
    }

    Ok(())
}

async fn ensure_cdk_mint_quote_for_wallet_funding(
    state: &AppState,
    quote: &WalletFundingQuote,
) -> Result<StoredMintQuote, String> {
    if quote.rail != "lightning" {
        return Err("wallet_funding_quote_not_lightning".to_string());
    }

    let quote_id = QuoteId::from_str(&quote.id).map_err(|error| error.to_string())?;
    let localstore = state.mint.localstore();
    let mut tx = localstore
        .begin_transaction()
        .await
        .map_err(|error| error.to_string())?;

    let mut mint_quote = match tx
        .get_mint_quote(&quote_id)
        .await
        .map_err(|error| error.to_string())?
    {
        Some(quote) => quote,
        None => tx
            .add_mint_quote(build_cdk_mint_quote_for_wallet_funding(quote)?)
            .await
            .map_err(|error| error.to_string())?,
    };

    reconcile_cdk_mint_quote_with_wallet_funding(&mut mint_quote, quote)?;
    tx.update_mint_quote(&mut mint_quote)
        .await
        .map_err(|error| error.to_string())?;
    tx.commit().await.map_err(|error| error.to_string())?;

    Ok(mint_quote.inner())
}

async fn sync_lightning_funding_quote_state(
    state: &AppState,
    quote: &WalletFundingQuote,
) -> Result<(WalletFundingQuote, StoredMintQuote), String> {
    let synced_quote = sync_wallet_funding_quote_best_effort(state, quote).await?;
    let mint_quote = ensure_cdk_mint_quote_for_wallet_funding(state, &synced_quote).await?;

    if mint_quote.state() == MintQuoteState::Issued
        && synced_quote.status != WalletFundingStatus::Complete
    {
        let metadata_json = funding_metadata_json(
            "bolt11",
            json!({
                "payment_hash": synced_quote.payment_hash,
                "funding_quote_id": synced_quote.id,
                "reconciled_via": "mint_quote_state"
            }),
        )
        .map_err(|error| error.to_string())?;

        let completed_quote = state
            .db
            .complete_wallet_funding_quote(&synced_quote.id, None, Some(&metadata_json))
            .await
            .map_err(|error| error.to_string())?;

        return Ok((completed_quote, mint_quote));
    }

    Ok((synced_quote, mint_quote))
}

fn stripe_funding_context(amount_minor: u64, expires_at: i64) -> FxQuoteSnapshot {
    let created_at = chrono::Utc::now().timestamp();
    FxQuoteSnapshot {
        id: uuid::Uuid::new_v4().to_string(),
        amount_minor,
        amount_msat: 0,
        btc_usd_price: 0.0,
        source: "stripe".to_string(),
        spread_bps: 0,
        observations: Vec::new(),
        created_at,
        expires_at: expires_at.max(created_at + 300),
    }
}

fn stripe_funding_metadata(
    checkout_url: Option<&str>,
    checkout_session_id: Option<&str>,
    checkout_expires_at: Option<i64>,
    risk_level: Option<&str>,
) -> Value {
    let mut fields = Vec::new();

    if let Some(checkout_url) = checkout_url {
        fields.push(("checkout_url", Value::String(checkout_url.to_string())));
    }

    if let Some(checkout_session_id) = checkout_session_id {
        fields.push((
            "checkout_session_id",
            Value::String(checkout_session_id.to_string()),
        ));
    }

    if let Some(checkout_expires_at) = checkout_expires_at {
        fields.push((
            "checkout_expires_at",
            Value::Number(checkout_expires_at.into()),
        ));
    }

    if let Some(risk_level) = risk_level {
        fields.push(("risk_level", Value::String(risk_level.to_string())));
    }

    funding_metadata_merge(&fields)
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

fn market_currency_unit(slug: &str, side: Side) -> CurrencyUnit {
    match side {
        Side::Long => CurrencyUnit::Custom(format!("long_{}", slug)),
        Side::Short => CurrencyUnit::Custom(format!("short_{}", slug)),
    }
}

fn trade_signature_bundle(
    unit: &str,
    signatures: Vec<TokenOutput>,
) -> Option<ProductTradeBlindSignatureBundleResponse> {
    if signatures.is_empty() {
        return None;
    }

    Some(ProductTradeBlindSignatureBundleResponse {
        unit: unit.to_string(),
        signatures,
    })
}

fn market_share_denominations() -> Vec<u64> {
    (0..=MAX_MARKET_DENOMINATION_POWER)
        .map(|power| 1_u64 << power)
        .collect()
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

fn cdk_blinded_message_from_input(output: &BlindedMessageInput) -> Result<BlindedMessage, String> {
    let blinded_secret_bytes =
        hex::decode(&output.b_).map_err(|error| format!("invalid_b_hex:{error}"))?;
    let blinded_secret = cdk::nuts::PublicKey::from_slice(&blinded_secret_bytes)
        .map_err(|error| format!("invalid_b_public_key:{error}"))?;
    let keyset_id = cdk::nuts::Id::from_str(&output.id)
        .map_err(|error| format!("invalid_keyset_id:{error}"))?;

    Ok(BlindedMessage::new(
        Amount::from(output.amount),
        keyset_id,
        blinded_secret,
    ))
}

fn token_output_from_signature(signature: BlindSignature) -> TokenOutput {
    TokenOutput {
        amount: signature.amount.to_u64(),
        id: signature.keyset_id.to_string(),
        c_: signature.c.to_hex(),
    }
}

fn active_keyset_id_for_unit(state: &AppState, unit: &CurrencyUnit) -> Result<String, String> {
    state
        .mint
        .keysets()
        .keysets
        .into_iter()
        .find(|keyset| keyset.active && &keyset.unit == unit)
        .map(|keyset| keyset.id.to_string())
        .ok_or_else(|| format!("active_keyset_not_configured_for_unit:{unit}"))
}

fn validate_output_amounts(
    outputs: &[BlindedMessageInput],
    expected_keyset_id: &str,
    expected_amount: u64,
    label: &str,
) -> Result<Vec<BlindedMessage>, String> {
    let actual_amount = outputs
        .iter()
        .fold(0_u64, |sum, output| sum.saturating_add(output.amount));

    if actual_amount != expected_amount {
        return Err(format!("{label}_amount_mismatch"));
    }

    if outputs.iter().any(|output| output.id != expected_keyset_id) {
        return Err(format!("{label}_invalid_keyset"));
    }

    outputs
        .iter()
        .map(cdk_blinded_message_from_input)
        .collect::<Result<Vec<_>, _>>()
}

async fn spend_input_proofs_and_store_outputs(
    state: &AppState,
    input_proofs: &[ProofInput],
    issued_outputs: &[BlindedMessageInput],
    change_outputs: &[BlindedMessageInput],
) -> Result<(Vec<TokenOutput>, Vec<TokenOutput>), String> {
    let cdk_input_proofs = input_proofs
        .iter()
        .map(cdk_proof_from_input)
        .collect::<Result<Vec<_>, _>>()?;

    let issued_messages = issued_outputs
        .iter()
        .map(cdk_blinded_message_from_input)
        .collect::<Result<Vec<_>, _>>()?;
    let change_messages = change_outputs
        .iter()
        .map(cdk_blinded_message_from_input)
        .collect::<Result<Vec<_>, _>>()?;

    let mut all_messages = issued_messages.clone();
    all_messages.extend(change_messages.clone());

    if !issued_messages.is_empty() {
        state
            .mint
            .verify_outputs(&issued_messages)
            .map_err(|error| error.to_string())?;
    }

    if !change_messages.is_empty() {
        state
            .mint
            .verify_outputs(&change_messages)
            .map_err(|error| error.to_string())?;
    }

    let issued_signatures = if issued_messages.is_empty() {
        Vec::new()
    } else {
        state
            .mint
            .blind_sign(issued_messages.clone())
            .await
            .map_err(|error| error.to_string())?
    };

    let change_signatures = if change_messages.is_empty() {
        Vec::new()
    } else {
        state
            .mint
            .blind_sign(change_messages.clone())
            .await
            .map_err(|error| error.to_string())?
    };

    let mut all_signatures = issued_signatures.clone();
    all_signatures.extend(change_signatures.clone());

    let operation = Operation::new_swap(
        Amount::from(all_messages.iter().fold(0_u64, |sum, message| {
            sum.saturating_add(message.amount.to_u64())
        })),
        Amount::from(cdk_input_proofs.iter().fold(0_u64, |sum, proof| {
            sum.saturating_add(proof.amount.to_u64())
        })),
        Amount::ZERO,
    );

    let mut tx = state
        .mint
        .localstore()
        .begin_transaction()
        .await
        .map_err(|error| error.to_string())?;

    let mut acquired = tx
        .add_proofs(cdk_input_proofs, None, &operation)
        .await
        .map_err(|error| error.to_string())?;
    tx.update_proofs_state(&mut acquired, ProofState::Spent)
        .await
        .map_err(|error| error.to_string())?;

    if !all_messages.is_empty() {
        tx.add_blinded_messages(None, &all_messages, &operation)
            .await
            .map_err(|error| error.to_string())?;
        let blinded_secrets = all_messages
            .iter()
            .map(|message| message.blinded_secret)
            .collect::<Vec<_>>();
        tx.add_blind_signatures(&blinded_secrets, &all_signatures, None)
            .await
            .map_err(|error| error.to_string())?;
    }

    tx.add_completed_operation(&operation, &HashMap::new())
        .await
        .map_err(|error| error.to_string())?;
    tx.commit().await.map_err(|error| error.to_string())?;

    let issued_signatures = issued_signatures
        .into_iter()
        .map(token_output_from_signature)
        .collect::<Vec<_>>();
    let change_signatures = change_signatures
        .into_iter()
        .map(token_output_from_signature)
        .collect::<Vec<_>>();

    Ok((issued_signatures, change_signatures))
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

pub async fn runtime(State(state): State<AppState>) -> (StatusCode, Json<ProductRuntimeResponse>) {
    (StatusCode::OK, Json(runtime_response(&state)))
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

pub async fn preview_lightning_fx_quote(
    State(state): State<AppState>,
    Path(amount_minor): Path<u64>,
) -> (StatusCode, Json<Value>) {
    match state.fx_service.quote_wallet_funding(amount_minor).await {
        Ok(quote) => (
            StatusCode::OK,
            Json(json!(lightning_fx_quote_response(&quote))),
        ),
        Err(error) => (StatusCode::BAD_GATEWAY, Json(json!({ "error": error }))),
    }
}

enum WalletFundingRequestGuard {
    New,
    Complete(ProductPortfolioFundingResponse),
    Pending,
    Failed(String),
}

async fn create_lightning_wallet_funding_quote_record(
    state: &AppState,
    pubkey: &str,
    amount_minor: u64,
    request_id: Option<&str>,
    description: Option<&str>,
    enforce_limits: bool,
) -> Result<WalletFundingQuote, (StatusCode, String)> {
    if state.paper_mode && enforce_limits && !pubkey.trim().is_empty() {
        if let Err(error) = enforce_signet_funding_limits(state, pubkey, amount_minor).await {
            if let Some(request_id) = request_id {
                let _ = state
                    .db
                    .fail_wallet_funding_request(request_id, &error)
                    .await;
            }
            return Err((signet_funding_limit_error_response(&error).0, error));
        }
    }

    let fx_quote = match state.fx_service.quote_wallet_funding(amount_minor).await {
        Ok(quote) => quote.snapshot,
        Err(error) => {
            if let Some(request_id) = request_id {
                let _ = state
                    .db
                    .fail_wallet_funding_request(request_id, &error)
                    .await;
            }
            return Err((StatusCode::BAD_GATEWAY, error));
        }
    };
    let invoice_expiry_seconds = (fx_quote.expires_at - fx_quote.created_at).max(60) as u64;
    let invoice_description = description
        .map(str::to_string)
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| {
            if pubkey.trim().is_empty() {
                "Cascade portfolio funding".to_string()
            } else {
                format!("Cascade portfolio funding for {}", pubkey)
            }
        });
    let invoice = {
        let mut invoice_service = state.invoice_service.lock().await;
        match invoice_service
            .create_invoice(
                fx_quote.amount_msat,
                Some(invoice_description),
                Some(invoice_expiry_seconds),
                state.paper_mode,
            )
            .await
        {
            Ok(invoice) => invoice,
            Err(error) => {
                let error_message = format!("failed_to_create_lightning_invoice: {error}");
                if let Some(request_id) = request_id {
                    let _ = state
                        .db
                        .fail_wallet_funding_request(request_id, &error_message)
                        .await;
                }
                return Err((StatusCode::INTERNAL_SERVER_ERROR, error_message));
            }
        }
    };

    let quote = state
        .db
        .create_wallet_funding_quote(
            None,
            pubkey,
            "lightning",
            amount_minor,
            fx_quote.amount_msat,
            Some(invoice.bolt11()),
            Some(&invoice.payment_hash.to_hex()),
            None,
            request_id,
            &fx_quote,
        )
        .await
        .map_err(|error| {
            let error_message = error.to_string();
            if let Some(request_id) = request_id {
                let db = state.db.clone();
                let request_id = request_id.to_string();
                let error_copy = error_message.clone();
                tokio::spawn(async move {
                    let _ = db
                        .fail_wallet_funding_request(&request_id, &error_copy)
                        .await;
                });
            }
            (StatusCode::INTERNAL_SERVER_ERROR, error_message)
        })?;

    if state.paper_mode {
        schedule_signet_funding_payment(state.clone(), invoice.bolt11().to_string());
    }

    Ok(quote)
}

pub async fn create_mint_quote_bolt11(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<MintQuoteBolt11Request>,
) -> (StatusCode, Json<Value>) {
    if req.amount == 0 {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "amount_is_required" })),
        );
    }

    if !req.unit.eq_ignore_ascii_case("usd") {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "unit_unsupported" })),
        );
    }

    if let Some(response) = require_client_edition(&headers, &state) {
        return response;
    }

    match prepare_wallet_funding_request(
        &state,
        req.request_id.as_deref(),
        req.pubkey.as_deref().unwrap_or(""),
        "lightning",
        req.amount,
    )
    .await
    {
        Ok(WalletFundingRequestGuard::Complete(response)) => {
            let quote = match state.db.get_wallet_funding_quote(&response.id).await {
                Ok(Some(quote)) => quote,
                Ok(None) => {
                    return (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(json!({ "error": "wallet_funding_quote_not_found" })),
                    );
                }
                Err(error) => {
                    return (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(json!({ "error": error.to_string() })),
                    );
                }
            };

            let mint_quote = match sync_lightning_funding_quote_state(&state, &quote).await {
                Ok((_, mint_quote)) => mint_quote,
                Err(error) => {
                    return (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(json!({ "error": error })),
                    )
                }
            };

            return match mint_quote_bolt11_response_from_cdk(&mint_quote) {
                Ok(response) => (StatusCode::OK, Json(json!(response))),
                Err(error) => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": error })),
                ),
            };
        }
        Ok(WalletFundingRequestGuard::Pending) => {
            return (
                StatusCode::CONFLICT,
                Json(json!({ "error": "wallet_funding_request_in_progress" })),
            );
        }
        Ok(WalletFundingRequestGuard::Failed(error)) => {
            return (StatusCode::CONFLICT, Json(json!({ "error": error })));
        }
        Ok(WalletFundingRequestGuard::New) => {}
        Err(error) => {
            return (StatusCode::CONFLICT, Json(json!({ "error": error })));
        }
    }

    match create_lightning_wallet_funding_quote_record(
        &state,
        req.pubkey.as_deref().unwrap_or(""),
        req.amount,
        req.request_id.as_deref(),
        req.description.as_deref(),
        req.pubkey.is_some(),
    )
    .await
    {
        Ok(quote) => {
            let mint_quote = match ensure_cdk_mint_quote_for_wallet_funding(&state, &quote).await {
                Ok(mint_quote) => mint_quote,
                Err(error) => {
                    return (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(json!({ "error": error })),
                    )
                }
            };

            match mint_quote_bolt11_response_from_cdk(&mint_quote) {
                Ok(response) => (StatusCode::OK, Json(json!(response))),
                Err(error) => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": error })),
                ),
            }
        }
        Err((status, error)) => (status, Json(json!({ "error": error }))),
    }
}

pub async fn create_stripe_funding(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<ProductStripeFundingRequest>,
) -> (StatusCode, Json<Value>) {
    if req.pubkey.trim().is_empty() || req.amount_minor == 0 {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "pubkey_and_amount_minor_are_required" })),
        );
    }

    if let Some(response) = require_client_edition(&headers, &state) {
        return response;
    }

    match prepare_wallet_funding_request(
        &state,
        req.request_id.as_deref(),
        &req.pubkey,
        "stripe",
        req.amount_minor,
    )
    .await
    {
        Ok(WalletFundingRequestGuard::Complete(response)) => {
            return (StatusCode::OK, Json(json!(response)));
        }
        Ok(WalletFundingRequestGuard::Pending) => {
            return (
                StatusCode::CONFLICT,
                Json(json!({ "error": "wallet_funding_request_in_progress" })),
            );
        }
        Ok(WalletFundingRequestGuard::Failed(error)) => {
            return (StatusCode::CONFLICT, Json(json!({ "error": error })));
        }
        Ok(WalletFundingRequestGuard::New) => {}
        Err(error) => {
            return (StatusCode::CONFLICT, Json(json!({ "error": error })));
        }
    }

    if state.paper_mode {
        if let Err(error) =
            enforce_signet_funding_limits(&state, &req.pubkey, req.amount_minor).await
        {
            if let Some(request_id) = req.request_id.as_deref() {
                let _ = state
                    .db
                    .fail_wallet_funding_request(request_id, &error)
                    .await;
            }
            return signet_funding_limit_error_response(&error);
        }
    }

    let Some(stripe_gateway) = state.stripe_gateway.clone() else {
        if let Some(request_id) = req.request_id.as_deref() {
            let _ = state
                .db
                .fail_wallet_funding_request(request_id, "stripe_fundings_unavailable")
                .await;
        }
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({ "error": "stripe_fundings_unavailable" })),
        );
    };

    if let Err(error) = enforce_stripe_funding_limits(
        &state,
        stripe_gateway.as_ref(),
        &req.pubkey,
        req.amount_minor,
    )
    .await
    {
        if let Some(request_id) = req.request_id.as_deref() {
            let _ = state
                .db
                .fail_wallet_funding_request(request_id, &error)
                .await;
        }
        return stripe_funding_limit_error_response(&error);
    }

    let quote_id = uuid::Uuid::new_v4().to_string();
    let edition = if state.paper_mode {
        "signet"
    } else {
        "mainnet"
    };
    let session = match stripe_gateway
        .create_funding_checkout_session(
            &quote_id,
            &req.pubkey,
            req.amount_minor,
            req.request_id.as_deref(),
            edition,
        )
        .await
    {
        Ok(session) => session,
        Err(error) => {
            if let Some(request_id) = req.request_id.as_deref() {
                let _ = state
                    .db
                    .fail_wallet_funding_request(request_id, &error)
                    .await;
            }
            return (StatusCode::BAD_GATEWAY, Json(json!({ "error": error })));
        }
    };

    let fx_quote = stripe_funding_context(
        req.amount_minor,
        session
            .expires_at
            .unwrap_or_else(|| chrono::Utc::now().timestamp() + 30 * 60),
    );
    let metadata_json = match serde_json::to_string(&stripe_funding_metadata(
        Some(&session.url),
        Some(&session.id),
        session.expires_at,
        None,
    )) {
        Ok(metadata_json) => metadata_json,
        Err(error) => {
            if let Some(request_id) = req.request_id.as_deref() {
                let _ = state
                    .db
                    .fail_wallet_funding_request(request_id, &error.to_string())
                    .await;
            }
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": error.to_string() })),
            );
        }
    };

    match state
        .db
        .create_wallet_funding_quote(
            Some(&quote_id),
            &req.pubkey,
            "stripe",
            req.amount_minor,
            0,
            None,
            None,
            Some(&metadata_json),
            req.request_id.as_deref(),
            &fx_quote,
        )
        .await
    {
        Ok(quote) => match load_wallet_funding_response(&state, &quote).await {
            Ok(response) => (StatusCode::CREATED, Json(json!(response))),
            Err(error) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": error })),
            ),
        },
        Err(error) => {
            let error_message = error.to_string();
            if let Some(request_id) = req.request_id.as_deref() {
                let _ = state
                    .db
                    .fail_wallet_funding_request(request_id, &error_message)
                    .await;
            }
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": error_message })),
            )
        }
    }
}

pub async fn stripe_webhook(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> (StatusCode, Json<Value>) {
    let Some(stripe_gateway) = state.stripe_gateway.clone() else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({ "error": "stripe_fundings_unavailable" })),
        );
    };

    let Some(signature_header) = headers
        .get("stripe-signature")
        .and_then(|value| value.to_str().ok())
    else {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "missing_stripe_signature" })),
        );
    };

    let event = match stripe_gateway.verify_webhook(&body, signature_header) {
        Ok(event) => event,
        Err(error) => return (StatusCode::BAD_REQUEST, Json(json!({ "error": error }))),
    };

    match event.event_type.as_str() {
        "checkout.session.completed" => {
            let object = &event.data.object;
            if object.get("payment_status").and_then(Value::as_str) != Some("paid") {
                return (StatusCode::OK, Json(json!({ "status": "ignored" })));
            }

            let metadata = stripe_event_metadata(object);
            let funding_id = metadata.get("funding_id").cloned().or_else(|| {
                object
                    .get("client_reference_id")
                    .and_then(Value::as_str)
                    .map(str::to_string)
            });
            let Some(funding_id) = funding_id else {
                return (
                    StatusCode::OK,
                    Json(json!({ "status": "ignored", "reason": "missing_funding_id" })),
                );
            };

            let quote = match state.db.get_wallet_funding_quote(&funding_id).await {
                Ok(Some(quote)) => quote,
                Ok(None) => {
                    return (
                        StatusCode::OK,
                        Json(json!({ "status": "ignored", "reason": "funding_not_found" })),
                    )
                }
                Err(error) => {
                    return (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(json!({ "error": error.to_string() })),
                    )
                }
            };

            if quote.rail != "stripe" {
                return (
                    StatusCode::OK,
                    Json(json!({ "status": "ignored", "reason": "non_stripe_funding" })),
                );
            }
            if quote.status != WalletFundingStatus::InvoicePending {
                return (
                    StatusCode::OK,
                    Json(json!({
                        "status": wallet_funding_status_label(&quote),
                        "event_id": event.id
                    })),
                );
            }

            let payment_intent_id = object.get("payment_intent").and_then(Value::as_str);
            let risk_level = match payment_intent_id {
                Some(payment_intent_id) => stripe_gateway
                    .retrieve_payment_intent_risk_level(payment_intent_id)
                    .await
                    .ok()
                    .flatten(),
                None => None,
            };
            let normalized_risk_level = stripe_gateway.normalized_risk_level(risk_level.as_deref());
            let existing_metadata =
                funding_metadata_checkout_fields(quote.metadata_json.as_deref());
            let checkout_session_id = object
                .get("id")
                .and_then(Value::as_str)
                .or(existing_metadata.1.as_deref());
            let checkout_expires_at = object
                .get("expires_at")
                .and_then(Value::as_i64)
                .or(existing_metadata.2);
            let extra = stripe_funding_metadata(
                existing_metadata.0.as_deref(),
                checkout_session_id,
                checkout_expires_at,
                Some(&normalized_risk_level),
            );

            if !stripe_gateway.is_risk_level_allowed(Some(&normalized_risk_level)) {
                match state
                    .db
                    .mark_wallet_funding_quote_review_required(
                        &quote.id,
                        Some(&normalized_risk_level),
                        Some(&serde_json::to_string(&extra).unwrap_or_else(|_| "{}".to_string())),
                    )
                    .await
                {
                    Ok(_) => (
                        StatusCode::OK,
                        Json(json!({
                            "status": "review_required",
                            "event_id": event.id
                        })),
                    ),
                    Err(error) => (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(json!({ "error": error.to_string() })),
                    ),
                }
            } else {
                let metadata_json = match funding_metadata_json("stripe", extra) {
                    Ok(value) => value,
                    Err(error) => {
                        return (
                            StatusCode::INTERNAL_SERVER_ERROR,
                            Json(json!({ "error": error.to_string() })),
                        )
                    }
                };

                match state
                    .db
                    .mark_wallet_funding_quote_paid(&quote.id, Some(&metadata_json))
                    .await
                {
                    Ok(_) => (
                        StatusCode::OK,
                        Json(json!({ "status": "paid", "event_id": event.id })),
                    ),
                    Err(error) => (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(json!({ "error": error.to_string() })),
                    ),
                }
            }
        }
        "checkout.session.expired" => {
            let object = &event.data.object;
            let metadata = stripe_event_metadata(object);
            let Some(funding_id) = metadata.get("funding_id").cloned().or_else(|| {
                object
                    .get("client_reference_id")
                    .and_then(Value::as_str)
                    .map(str::to_string)
            }) else {
                return (
                    StatusCode::OK,
                    Json(json!({ "status": "ignored", "reason": "missing_funding_id" })),
                );
            };

            match state.db.expire_wallet_funding_quote(&funding_id).await {
                Ok(_) => (
                    StatusCode::OK,
                    Json(json!({ "status": "expired", "event_id": event.id })),
                ),
                Err(error) => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": error.to_string() })),
                ),
            }
        }
        _ => (StatusCode::OK, Json(json!({ "status": "ignored" }))),
    }
}

pub async fn wallet_funding_request_status(
    State(state): State<AppState>,
    Path(request_id): Path<String>,
) -> (StatusCode, Json<Value>) {
    match load_wallet_funding_request_status_response(&state, &request_id).await {
        Ok(Some(response)) => (StatusCode::OK, Json(json!(response))),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "wallet_funding_request_not_found" })),
        ),
        Err(error) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": error })),
        ),
    }
}

async fn load_wallet_funding_status(
    State(state): State<AppState>,
    Path(quote_id): Path<String>,
) -> (StatusCode, Json<Value>) {
    let now = chrono::Utc::now().timestamp();
    let existing = match state.db.get_wallet_funding_quote(&quote_id).await {
        Ok(Some(quote)) => quote,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "funding_quote_not_found" })),
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
            .expire_wallet_fundings_for_pubkey(&existing.pubkey, now)
            .await;
    }

    let quote = match state.db.get_wallet_funding_quote(&quote_id).await {
        Ok(Some(quote)) => quote,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "funding_quote_not_found" })),
            )
        }
        Err(error) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": error.to_string() })),
            )
        }
    };

    let quote = if quote.rail == "lightning" {
        match sync_lightning_funding_quote_state(&state, &quote).await {
            Ok((quote, _)) => quote,
            Err(_) => quote,
        }
    } else {
        match sync_wallet_funding_quote_best_effort(&state, &quote).await {
            Ok(quote) => quote,
            Err(_) => quote,
        }
    };

    match load_wallet_funding_response(&state, &quote).await {
        Ok(response) => (StatusCode::OK, Json(json!(response))),
        Err(error) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": error })),
        ),
    }
}

pub async fn get_mint_quote_bolt11(
    State(state): State<AppState>,
    Path(quote_id): Path<String>,
) -> (StatusCode, Json<Value>) {
    let now = chrono::Utc::now().timestamp();
    let existing = match state.db.get_wallet_funding_quote(&quote_id).await {
        Ok(Some(quote)) => quote,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({ "detail": "Quote not found" })),
            )
        }
        Err(error) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "detail": error.to_string() })),
            )
        }
    };

    if existing.expires_at <= now && existing.status == WalletFundingStatus::InvoicePending {
        let _ = state.db.expire_wallet_funding_quote(&existing.id).await;
    }

    let quote = match state.db.get_wallet_funding_quote(&quote_id).await {
        Ok(Some(quote)) => quote,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({ "detail": "Quote not found" })),
            )
        }
        Err(error) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "detail": error.to_string() })),
            )
        }
    };

    let (quote, mint_quote) = match sync_lightning_funding_quote_state(&state, &quote).await {
        Ok(result) => result,
        Err(error) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "detail": error })),
            )
        }
    };

    let _ = quote;

    match mint_quote_bolt11_response_from_cdk(&mint_quote) {
        Ok(response) => (StatusCode::OK, Json(json!(response))),
        Err(error) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "detail": error })),
        ),
    }
}

pub async fn mint_bolt11(
    State(state): State<AppState>,
    Json(req): Json<MintBolt11Request>,
) -> (StatusCode, Json<Value>) {
    if req.quote.trim().is_empty() || req.outputs.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "detail": "quote_and_outputs_are_required" })),
        );
    }

    let quote = match state.db.get_wallet_funding_quote(&req.quote).await {
        Ok(Some(quote)) => quote,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({ "detail": "Quote not found" })),
            )
        }
        Err(error) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "detail": error.to_string() })),
            )
        }
    };

    let (quote, mint_quote) = match sync_lightning_funding_quote_state(&state, &quote).await {
        Ok(result) => result,
        Err(error) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "detail": error })),
            )
        }
    };

    if mint_quote.state() == MintQuoteState::Issued || quote.status == WalletFundingStatus::Complete
    {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "detail": "Quote already issued" })),
        );
    }

    if mint_quote.state() != MintQuoteState::Paid {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "detail": "Quote not paid" })),
        );
    }

    {
        let mut processing = state.processing_fundings.lock().await;
        if !processing.insert(req.quote.clone()) {
            return (
                StatusCode::CONFLICT,
                Json(json!({ "detail": "Quote issuance already in progress" })),
            );
        }
    }

    let issue_result = async {
        let blinded_messages = req
            .outputs
            .iter()
            .map(cdk_blinded_message_from_input)
            .collect::<Result<Vec<_>, String>>()
            .map_err(|error| ("bad_request".to_string(), error))?;

        let quote_id = QuoteId::from_str(&quote.id)
            .map_err(|error| ("bad_request".to_string(), error.to_string()))?;
        let mint_request = MintRequest {
            quote: quote_id,
            outputs: blinded_messages,
            signature: None,
        };

        let mint_response = state
            .mint
            .process_mint_request(MintInput::Single(mint_request))
            .await
            .map_err(|error| {
                let detail = error.to_string();
                let kind = if detail.contains("unpaid")
                    || detail.contains("issued")
                    || detail.contains("amount")
                    || detail.contains("keyset")
                    || detail.contains("duplicate")
                    || detail.contains("output")
                {
                    "bad_request"
                } else {
                    "internal"
                };
                (kind.to_string(), detail)
            })?;

        let metadata_json = funding_metadata_json(
            "bolt11",
            json!({
                "payment_hash": quote.payment_hash,
                "funding_quote_id": quote.id,
                "minted_via": "v1/mint/bolt11"
            }),
        )
        .map_err(|error| ("internal".to_string(), error.to_string()))?;

        state
            .db
            .complete_wallet_funding_quote(&quote.id, None, Some(&metadata_json))
            .await
            .map_err(|error| ("internal".to_string(), error.to_string()))?;

        Ok(MintBolt11Response {
            signatures: mint_response
                .signatures
                .into_iter()
                .map(token_output_from_signature)
                .collect(),
        })
    }
    .await;

    {
        let mut processing = state.processing_fundings.lock().await;
        processing.remove(&req.quote);
    }

    match issue_result {
        Ok(response) => (StatusCode::OK, Json(json!(response))),
        Err((kind, detail)) if kind == "bad_request" => {
            (StatusCode::BAD_REQUEST, Json(json!({ "detail": detail })))
        }
        Err((_, detail)) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "detail": detail })),
        ),
    }
}

pub async fn get_wallet_funding_status(
    State(state): State<AppState>,
    Path(quote_id): Path<String>,
) -> (StatusCode, Json<Value>) {
    load_wallet_funding_status(State(state), Path(quote_id)).await
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

    if let Some(response) = require_client_edition(&headers, &state) {
        return response;
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
    headers: HeaderMap,
    Json(req): Json<ProductCoordinatorTradeQuoteRequest>,
) -> (StatusCode, Json<Value>) {
    if let Some(response) = require_client_edition(&headers, &state) {
        return response;
    }

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
    headers: HeaderMap,
    Json(req): Json<ProductCoordinatorTradeQuoteRequest>,
) -> (StatusCode, Json<Value>) {
    if let Some(response) = require_client_edition(&headers, &state) {
        return response;
    }

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

    if let Some(response) = require_client_edition(&headers, &state) {
        return response;
    }

    let buy_request = ProductBuyRequest {
        pubkey: req.pubkey,
        side: req.side,
        spend_minor: req.spend_minor,
        proofs: req.proofs,
        issued_outputs: req.issued_outputs,
        change_outputs: req.change_outputs,
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

    if let Some(response) = require_client_edition(&headers, &state) {
        return response;
    }

    let sell_request = ProductSellRequest {
        pubkey: req.pubkey,
        side: req.side,
        quantity: req.quantity,
        proofs: req.proofs,
        issued_outputs: req.issued_outputs,
        change_outputs: req.change_outputs,
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

async fn prepare_wallet_funding_request(
    state: &AppState,
    request_id: Option<&str>,
    pubkey: &str,
    rail: &str,
    amount_minor: u64,
) -> Result<WalletFundingRequestGuard, String> {
    let Some(request_id) = request_id.filter(|value| !value.trim().is_empty()) else {
        return Ok(WalletFundingRequestGuard::New);
    };

    if let Some(existing) = state
        .db
        .get_wallet_funding_request(request_id)
        .await
        .map_err(|error| error.to_string())?
    {
        return handle_existing_wallet_funding_request(
            state,
            &existing,
            pubkey,
            rail,
            amount_minor,
        )
        .await;
    }

    match state
        .db
        .create_wallet_funding_request(request_id, pubkey, rail, amount_minor)
        .await
    {
        Ok(_) => Ok(WalletFundingRequestGuard::New),
        Err(error) => {
            let error_message = error.to_string();
            if !error_message.contains("UNIQUE constraint failed") {
                return Err(error_message);
            }

            let Some(existing) = state
                .db
                .get_wallet_funding_request(request_id)
                .await
                .map_err(|db_error| db_error.to_string())?
            else {
                return Err(error_message);
            };

            handle_existing_wallet_funding_request(state, &existing, pubkey, rail, amount_minor)
                .await
        }
    }
}

async fn handle_existing_wallet_funding_request(
    state: &AppState,
    existing: &WalletFundingRequest,
    pubkey: &str,
    rail: &str,
    amount_minor: u64,
) -> Result<WalletFundingRequestGuard, String> {
    if !wallet_funding_request_matches(existing, pubkey, rail, amount_minor) {
        return Err("wallet_funding_request_id_conflict".to_string());
    }

    match existing.status {
        WalletFundingRequestStatus::Complete => Ok(WalletFundingRequestGuard::Complete(
            load_wallet_funding_response_for_request(state, existing).await?,
        )),
        WalletFundingRequestStatus::Pending => Ok(WalletFundingRequestGuard::Pending),
        WalletFundingRequestStatus::Failed => Ok(WalletFundingRequestGuard::Failed(
            existing
                .error_message
                .clone()
                .unwrap_or_else(|| "wallet_funding_request_failed".to_string()),
        )),
    }
}

fn wallet_funding_request_matches(
    existing: &WalletFundingRequest,
    pubkey: &str,
    rail: &str,
    amount_minor: u64,
) -> bool {
    existing.pubkey == pubkey && existing.rail == rail && existing.amount_minor == amount_minor
}

async fn load_wallet_funding_response_for_request(
    state: &AppState,
    request: &WalletFundingRequest,
) -> Result<ProductPortfolioFundingResponse, String> {
    let funding_quote_id = request
        .funding_quote_id
        .as_deref()
        .ok_or_else(|| "wallet_funding_request_missing_quote".to_string())?;

    let quote = state
        .db
        .get_wallet_funding_quote(funding_quote_id)
        .await
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "funding_quote_not_found".to_string())?;

    load_wallet_funding_response(state, &quote).await
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

    Ok(ProductTradeExecutionResponse {
        market: trade_status.market,
        trade: trade_status.trade,
        settlement: trade_status.settlement,
        issued: None,
        change: None,
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
                    Ok(quote) => match create_persisted_trade_quote(state, &market, &quote).await {
                        Ok(persisted) => persisted,
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
                    },
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

            let issued_unit = market_proof_unit(&market, side);
            let issued_keyset_id =
                match active_keyset_id_for_unit(state, &market_currency_unit(&market.slug, side)) {
                    Ok(keyset_id) => keyset_id,
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
            let usd_keyset_id = match active_keyset_id_for_unit(state, &CurrencyUnit::Usd) {
                Ok(keyset_id) => keyset_id,
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

            if let Err(error) = validate_output_amounts(
                &req.issued_outputs,
                &issued_keyset_id,
                quote.quantity_minor,
                "issued_outputs",
            ) {
                if let Some(request_id) = request_id {
                    let _ = state
                        .db
                        .fail_trade_execution_request(request_id, &error)
                        .await;
                }
                return (StatusCode::BAD_REQUEST, Json(json!({ "error": error })));
            }

            if let Err(error) = validate_output_amounts(
                &req.change_outputs,
                &usd_keyset_id,
                change_amount_minor,
                "change_outputs",
            ) {
                if let Some(request_id) = request_id {
                    let _ = state
                        .db
                        .fail_trade_execution_request(request_id, &error)
                        .await;
                }
                return (StatusCode::BAD_REQUEST, Json(json!({ "error": error })));
            }

            let settlement = match build_trade_settlement_insert(state, &req.pubkey, &quote).await {
                Ok(settlement) => settlement,
                Err(error) => {
                    if let Some(request_id) = request_id {
                        let _ = state
                            .db
                            .fail_trade_execution_request(request_id, &error)
                            .await;
                    }
                    return (StatusCode::BAD_GATEWAY, Json(json!({ "error": error })));
                }
            };
            let (issued_signatures, change_signatures) = match spend_input_proofs_and_store_outputs(
                state,
                &req.proofs,
                &req.issued_outputs,
                &req.change_outputs,
            )
            .await
            {
                Ok(result) => result,
                Err(error) => {
                    if let Some(request_id) = request_id {
                        let _ = state
                            .db
                            .fail_trade_execution_request(request_id, &error)
                            .await;
                    }
                    return (StatusCode::BAD_REQUEST, Json(json!({ "error": error })));
                }
            };

            match state
                .db
                .apply_trade_execution_snapshots(
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
                    post_price_ppm,
                    &raw_event_json,
                    next_q_long,
                    next_q_short,
                    next_reserve_minor,
                    settlement.as_ref(),
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
                        &market,
                        next_q_long,
                        next_q_short,
                        next_reserve_minor,
                        raw_event,
                        trade_signature_bundle(&issued_unit, issued_signatures),
                        trade_signature_bundle("usd", change_signatures),
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
                    Ok(quote) => match create_persisted_trade_quote(state, &market, &quote).await {
                        Ok(persisted) => persisted,
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
                    },
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

            let usd_keyset_id = match active_keyset_id_for_unit(state, &CurrencyUnit::Usd) {
                Ok(keyset_id) => keyset_id,
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
            let market_unit = market_proof_unit(&market, side);
            let market_keyset_id =
                match active_keyset_id_for_unit(state, &market_currency_unit(&market.slug, side)) {
                    Ok(keyset_id) => keyset_id,
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

            if let Err(error) = validate_output_amounts(
                &req.issued_outputs,
                &usd_keyset_id,
                quote.net_minor,
                "issued_outputs",
            ) {
                if let Some(request_id) = request_id {
                    let _ = state
                        .db
                        .fail_trade_execution_request(request_id, &error)
                        .await;
                }
                return (StatusCode::BAD_REQUEST, Json(json!({ "error": error })));
            }

            if let Err(error) = validate_output_amounts(
                &req.change_outputs,
                &market_keyset_id,
                change_quantity_minor,
                "change_outputs",
            ) {
                if let Some(request_id) = request_id {
                    let _ = state
                        .db
                        .fail_trade_execution_request(request_id, &error)
                        .await;
                }
                return (StatusCode::BAD_REQUEST, Json(json!({ "error": error })));
            }

            let settlement = match build_trade_settlement_insert(state, &req.pubkey, &quote).await {
                Ok(settlement) => settlement,
                Err(error) => {
                    if let Some(request_id) = request_id {
                        let _ = state
                            .db
                            .fail_trade_execution_request(request_id, &error)
                            .await;
                    }
                    return (StatusCode::BAD_GATEWAY, Json(json!({ "error": error })));
                }
            };
            let (issued_signatures, change_signatures) = match spend_input_proofs_and_store_outputs(
                state,
                &req.proofs,
                &req.issued_outputs,
                &req.change_outputs,
            )
            .await
            {
                Ok(result) => result,
                Err(error) => {
                    if let Some(request_id) = request_id {
                        let _ = state
                            .db
                            .fail_trade_execution_request(request_id, &error)
                            .await;
                    }
                    return (StatusCode::BAD_REQUEST, Json(json!({ "error": error })));
                }
            };

            match state
                .db
                .apply_trade_execution_snapshots(
                    &trade_id,
                    created_at,
                    req.quote_id.as_deref(),
                    &req.pubkey,
                    &market,
                    direction,
                    "sell",
                    quote.net_minor,
                    quote.fee_minor,
                    quote.quantity,
                    post_price_ppm,
                    &raw_event_json,
                    next_q_long,
                    next_q_short,
                    next_reserve_minor,
                    settlement.as_ref(),
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
                        &market,
                        next_q_long,
                        next_q_short,
                        next_reserve_minor,
                        raw_event,
                        trade_signature_bundle("usd", issued_signatures),
                        trade_signature_bundle(&market_unit, change_signatures),
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

async fn load_wallet_funding_request_status_response(
    state: &AppState,
    request_id: &str,
) -> Result<Option<ProductPortfolioFundingRequestStatusResponse>, String> {
    let Some(request) = state
        .db
        .get_wallet_funding_request(request_id)
        .await
        .map_err(|error| error.to_string())?
    else {
        return Ok(None);
    };

    let funding = if request.status == WalletFundingRequestStatus::Complete {
        Some(load_wallet_funding_response_for_request(state, &request).await?)
    } else {
        None
    };

    Ok(Some(ProductPortfolioFundingRequestStatusResponse {
        request_id: request.request_id,
        rail: request.rail,
        amount_minor: request.amount_minor,
        status: request.status.to_string(),
        error: request.error_message,
        funding,
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
    market: &Market,
    next_q_long: f64,
    next_q_short: f64,
    next_reserve_minor: u64,
    raw_event: Value,
    issued: Option<ProductTradeBlindSignatureBundleResponse>,
    change: Option<ProductTradeBlindSignatureBundleResponse>,
) -> (StatusCode, Json<Value>) {
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

    match updated_market {
        Some(summary) => (
            StatusCode::CREATED,
            Json(json!(ProductTradeExecutionResponse {
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

async fn enforce_signet_funding_limits(
    state: &AppState,
    pubkey: &str,
    amount_minor: u64,
) -> Result<(), String> {
    if amount_minor > SIGNET_FUNDING_SINGLE_LIMIT_MINOR {
        return Err(format!(
            "signet_funding_single_limit_exceeded:max_minor={SIGNET_FUNDING_SINGLE_LIMIT_MINOR}"
        ));
    }

    let window_started_at = chrono::Utc::now().timestamp() - SIGNET_FUNDING_WINDOW_SECONDS;
    let funded_in_window = state
        .db
        .sum_wallet_funding_quote_amount_since_all_rails(pubkey, window_started_at)
        .await
        .map_err(|error| error.to_string())?;

    if funded_in_window.saturating_add(amount_minor) > SIGNET_FUNDING_WINDOW_LIMIT_MINOR {
        let remaining_minor = SIGNET_FUNDING_WINDOW_LIMIT_MINOR.saturating_sub(funded_in_window);
        return Err(format!(
            "signet_funding_window_limit_exceeded:window_minor={SIGNET_FUNDING_WINDOW_LIMIT_MINOR}:remaining_minor={remaining_minor}"
        ));
    }

    Ok(())
}

fn signet_funding_limit_error_response(error: &str) -> (StatusCode, Json<Value>) {
    let status = if error.starts_with("signet_funding_window_limit_exceeded") {
        StatusCode::TOO_MANY_REQUESTS
    } else {
        StatusCode::BAD_REQUEST
    };
    (status, Json(json!({ "error": error })))
}

async fn enforce_stripe_funding_limits(
    state: &AppState,
    stripe_gateway: &crate::stripe::StripeGateway,
    pubkey: &str,
    amount_minor: u64,
) -> Result<(), String> {
    if amount_minor > stripe_gateway.max_funding_minor() {
        return Err(format!(
            "stripe_funding_single_limit_exceeded:max_minor={}",
            stripe_gateway.max_funding_minor()
        ));
    }

    let window_started_at = chrono::Utc::now().timestamp() - stripe_gateway.window_seconds();
    let funded_in_window = state
        .db
        .sum_wallet_funding_quote_amount_since(pubkey, "stripe", window_started_at)
        .await
        .map_err(|error| error.to_string())?;

    if funded_in_window.saturating_add(amount_minor) > stripe_gateway.window_limit_minor() {
        let remaining_minor = stripe_gateway
            .window_limit_minor()
            .saturating_sub(funded_in_window);
        return Err(format!(
            "stripe_funding_window_limit_exceeded:window_minor={}:remaining_minor={remaining_minor}",
            stripe_gateway.window_limit_minor()
        ));
    }

    Ok(())
}

fn stripe_funding_limit_error_response(error: &str) -> (StatusCode, Json<Value>) {
    let status = if error.starts_with("stripe_funding_window_limit_exceeded") {
        StatusCode::TOO_MANY_REQUESTS
    } else {
        StatusCode::BAD_REQUEST
    };
    (status, Json(json!({ "error": error })))
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
                .quote_wallet_funding(settlement_minor)
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
                .quote_wallet_funding(settlement_minor)
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

async fn build_trade_settlement_insert(
    state: &AppState,
    pubkey: &str,
    quote: &ProductTradeQuoteResponse,
) -> Result<Option<TradeSettlementInsert>, String> {
    if quote.settlement_msat == 0 {
        return Err("trade_settlement_msat_must_be_positive".to_string());
    }

    let now = chrono::Utc::now().timestamp();
    let invoice_expiry_seconds = quote
        .expires_at
        .map(|expires_at| (expires_at - now).max(60) as u64)
        .unwrap_or(300);

    let (mode, payer_role, receiver_role) = match quote.trade_type.as_str() {
        "buy" => ("bolt11_wallet_to_market", "wallet_mint", "market_mint"),
        "sell" => ("bolt11_market_to_wallet", "market_mint", "wallet_mint"),
        _ => return Err("unsupported_trade_type_for_settlement".to_string()),
    };

    let (invoice, preimage, invoice_state) = {
        let mut invoice_service = state.invoice_service.lock().await;
        let invoice = invoice_service
            .create_invoice(
                quote.settlement_msat,
                Some(format!(
                    "Cascade {} settlement for {} {}",
                    quote.trade_type, quote.market_event_id, quote.side
                )),
                Some(invoice_expiry_seconds),
                true,
            )
            .await
            .map_err(|error| format!("failed_to_create_trade_settlement_invoice: {error}"))?;
        let preimage = invoice_service
            .pay_invoice(invoice.bolt11())
            .await
            .map_err(|error| format!("failed_to_pay_trade_settlement_invoice: {error}"))?;
        let invoice_state = invoice_service
            .get_invoice_status(&invoice.payment_hash.to_hex())
            .await
            .map_err(|error| format!("failed_to_verify_trade_settlement_invoice: {error}"))?;
        if invoice_state != "settled" {
            return Err(format!(
                "trade_settlement_invoice_not_settled:state={invoice_state}"
            ));
        }
        (invoice, preimage, invoice_state)
    };

    Ok(Some(TradeSettlementInsert {
        quote_id: quote.quote_id.clone(),
        pubkey: pubkey.to_string(),
        market_event_id: quote.market_event_id.clone(),
        trade_type: quote.trade_type.clone(),
        side: quote.side.clone(),
        rail: "lightning".to_string(),
        mode: mode.to_string(),
        settlement_minor: quote.settlement_minor,
        settlement_msat: quote.settlement_msat,
        settlement_fee_msat: quote.settlement_fee_msat,
        fx_quote_id: quote.fx_quote_id.clone(),
        invoice: Some(invoice.bolt11().to_string()),
        payment_hash: Some(invoice.payment_hash.to_hex()),
        metadata_json: Some(
            json!({
                "payer_role": payer_role,
                "receiver_role": receiver_role,
                "invoice_state": invoice_state,
                "invoice_created_at": invoice.created_at,
                "invoice_expiry_seconds": invoice.expiry_seconds,
                "fx_source": quote.fx_source,
                "btc_usd_price": quote.btc_usd_price,
                "spread_bps": quote.spread_bps,
                "fx_observations": quote.fx_observations,
                "payment_preimage": preimage.to_hex(),
            })
            .to_string(),
        ),
    }))
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

async fn load_wallet_funding_response(
    state: &AppState,
    quote: &WalletFundingQuote,
) -> Result<ProductPortfolioFundingResponse, String> {
    let quote = sync_wallet_funding_quote_best_effort(state, quote)
        .await
        .unwrap_or_else(|_| quote.clone());
    wallet_funding_response_for_state(state, &quote).await
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

fn wallet_funding_response(
    quote: &WalletFundingQuote,
    fx_quote: &FxQuoteSnapshot,
    metadata_json: Option<&str>,
) -> ProductPortfolioFundingResponse {
    let (checkout_url, checkout_session_id, checkout_expires_at, risk_level) =
        funding_metadata_checkout_fields(metadata_json);
    let is_lightning = quote.rail == "lightning";

    ProductPortfolioFundingResponse {
        id: quote.id.clone(),
        rail: quote.rail.clone(),
        amount_minor: quote.amount_minor,
        amount_msat: is_lightning.then_some(quote.amount_msat),
        status: wallet_funding_status_label(quote),
        invoice: quote.invoice.clone(),
        payment_hash: quote.payment_hash.clone(),
        checkout_url,
        checkout_session_id,
        checkout_expires_at,
        fx_source: is_lightning.then(|| fx_quote.source.clone()),
        btc_usd_price: is_lightning.then_some(fx_quote.btc_usd_price),
        spread_bps: is_lightning.then_some(fx_quote.spread_bps),
        fx_quote_id: is_lightning.then(|| fx_quote.id.clone()),
        observations: if is_lightning {
            fx_quote
                .observations
                .iter()
                .map(product_fx_observation_response)
                .collect()
        } else {
            Vec::new()
        },
        risk_level,
        created_at: quote.created_at,
        expires_at: quote.expires_at,
    }
}

async fn wallet_funding_response_for_state(
    state: &AppState,
    quote: &WalletFundingQuote,
) -> Result<ProductPortfolioFundingResponse, String> {
    let fx_quote = state
        .db
        .get_fx_quote_snapshot(&quote.fx_quote_id)
        .await
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "fx_quote_not_found".to_string())?;
    let funding_event = match quote.funding_event_id.as_deref() {
        Some(funding_event_id) => state
            .db
            .get_wallet_funding_event(funding_event_id)
            .await
            .map_err(|error| error.to_string())?,
        None => None,
    };
    let metadata_json = funding_event
        .as_ref()
        .and_then(|event| event.metadata_json.as_deref())
        .or(quote.metadata_json.as_deref());
    Ok(wallet_funding_response(quote, &fx_quote, metadata_json))
}

async fn sync_wallet_funding_quote_best_effort(
    state: &AppState,
    quote: &WalletFundingQuote,
) -> Result<WalletFundingQuote, String> {
    if quote.status != WalletFundingStatus::InvoicePending {
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
        "settled" => state
            .db
            .mark_wallet_funding_quote_paid(
                &quote.id,
                Some(
                    &json!({
                        "payment_hash": payment_hash,
                        "funding_quote_id": quote.id,
                        "settled_via": "invoice_status_poll"
                    })
                    .to_string(),
                ),
            )
            .await
            .map_err(|error| error.to_string()),
        "expired" | "cancelled" => state
            .db
            .expire_wallet_funding_quote(&quote.id)
            .await
            .map_err(|error| error.to_string())?
            .ok_or_else(|| "funding_quote_not_found".to_string()),
        _ => Ok(quote.clone()),
    }
}

fn schedule_signet_funding_payment(state: AppState, invoice: String) {
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(250)).await;
        let invoice_service = state.invoice_service.lock().await;
        let _ = invoice_service.pay_invoice(&invoice).await;
    });
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
