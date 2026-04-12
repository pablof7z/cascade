//! Request and response types for Cascade API

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

// Market endpoints

#[derive(Debug, Deserialize, Serialize)]
pub struct CreateMarketRequest {
    pub event_id: String,
    pub title: String,
    pub description: String,
    pub slug: String,
    pub b: f64,
}

#[derive(Debug, Serialize)]
pub struct MarketResponse {
    pub event_id: String,
    pub slug: String,
    pub title: String,
    pub description: String,
    pub b: f64,
    pub q_long: f64,
    pub q_short: f64,
    pub status: String,
    pub long_keyset_id: String,
    pub short_keyset_id: String,
    pub reserve: u64,
}

#[derive(Debug, Serialize)]
pub struct MarketsListResponse {
    pub markets: Vec<MarketResponse>,
}

// Trade endpoints

#[derive(Debug, Deserialize)]
pub struct BuyRequest {
    pub market_id: String,
    pub side: String, // "long" or "short"
    pub quantity: f64,
    pub buyer_pubkey: String,
    /// Blinded messages for the market token keyset — client provides these
    /// so the mint can blind-sign LONG or SHORT tokens via process_swap_request.
    /// The keyset ID in each BlindedMessage must match the market's LONG or SHORT keyset.
    #[serde(default)]
    pub outputs: Vec<BlindedMessageInput>,
}

#[derive(Debug, Deserialize)]
pub struct SellRequest {
    pub market_id: String,
    pub side: String,
    pub quantity: f64,
    pub seller_pubkey: String,
    /// Input SAT proofs the user is spending to sell their position.
    /// If provided, process_swap_request will be used to atomically spend these
    /// proofs and sign the market token outputs.
    #[serde(default)]
    pub proofs: Vec<ProofInput>,
    /// Blinded messages for the market token keyset — client provides these
    /// so the mint can blind-sign LONG or SHORT tokens via process_swap_request.
    #[serde(default)]
    pub outputs: Vec<BlindedMessageInput>,
}

#[derive(Debug, Serialize)]
pub struct TradeResponse {
    pub trade_id: String,
    pub market_id: String,
    pub side: String,
    pub quantity: f64,
    pub cost_sats: u64,
    pub fee_sats: u64,
    /// Blind-signed tokens returned to the client (only when outputs are provided)
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub tokens: Vec<TokenOutput>,
}

// Price endpoints

#[derive(Debug, Serialize)]
pub struct PriceResponse {
    pub market_id: String,
    pub price_long: f64,
    pub price_short: f64,
    pub q_long: f64,
    pub q_short: f64,
}

#[derive(Debug, Deserialize)]
pub struct QuoteRequest {
    pub market_id: String,
    pub side: String,
    pub quantity: f64,
}

#[derive(Debug, Serialize)]
pub struct QuoteResponse {
    pub market_id: String,
    pub side: String,
    pub quantity: f64,
    pub cost_sats: u64,
    pub price: f64,
}

// Resolution endpoints

#[derive(Debug, Deserialize)]
pub struct ResolveRequest {
    pub market_id: String,
    pub outcome: String, // "long" or "short"
}

#[derive(Debug, Serialize)]
pub struct ResolveResponse {
    pub market_id: String,
    pub outcome: String,
}

// Payout endpoints

#[derive(Debug, Deserialize)]
pub struct PayoutRequest {
    pub market_id: String,
    pub recipient_pubkey: String,
    pub winning_tokens: f64,
}

#[derive(Debug, Serialize)]
pub struct PayoutResponse {
    pub payout_id: String,
    pub market_id: String,
    pub payout_sats: u64,
}

// Error response

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
    pub details: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct KeysetPublicKeyResponse {
    pub pubkey: String,
}

#[derive(Debug, Serialize)]
pub struct MarketKeysetResponse {
    pub id: String,
    pub unit: String,
    pub outcome: String,
    pub keys: BTreeMap<String, KeysetPublicKeyResponse>,
}

#[derive(Debug, Serialize)]
pub struct MarketMintKeysResponse {
    pub market_id: String,
    pub long_keyset: MarketKeysetResponse,
    pub short_keyset: MarketKeysetResponse,
}

// Product endpoints

#[derive(Debug, Deserialize, Serialize)]
pub struct ProductCreateMarketRequest {
    pub event_id: String,
    pub title: String,
    pub description: String,
    pub slug: String,
    pub body: String,
    pub creator_pubkey: String,
    pub raw_event: Value,
    #[serde(default = "default_lmsr_b")]
    pub b: f64,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ProductMarketSummary {
    pub event_id: String,
    pub slug: String,
    pub title: String,
    pub description: String,
    pub creator_pubkey: String,
    pub visibility: String,
    pub created_at: i64,
    pub first_trade_at: Option<i64>,
    pub price_yes_ppm: u64,
    pub price_no_ppm: u64,
    pub volume_minor: u64,
    pub trade_count: u64,
    pub reserve_minor: u64,
    pub raw_event: Value,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ProductFeedResponse {
    pub markets: Vec<Value>,
    pub trades: Vec<Value>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ProductRuntimeRailResponse {
    pub available: bool,
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ProductRuntimeFundingResponse {
    pub lightning: ProductRuntimeRailResponse,
    pub stripe: ProductRuntimeRailResponse,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ProductRuntimeResponse {
    pub edition: String,
    pub network: String,
    pub mint_url: String,
    pub proof_custody: String,
    pub request_edition_header: String,
    pub funding: ProductRuntimeFundingResponse,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct CreatorMarketsResponse {
    pub markets: Vec<ProductMarketSummary>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ProductMarketDetailResponse {
    pub market: ProductMarketSummary,
    pub trades: Vec<Value>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ProductTradeStatusResponse {
    pub market: ProductMarketSummary,
    pub trade: Value,
    pub settlement: Option<ProductTradeSettlementResponse>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ProductTradeRequestStatusResponse {
    pub request_id: String,
    pub status: String,
    pub error: Option<String>,
    pub market: Option<ProductMarketSummary>,
    pub trade: Option<Value>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ProductFundingEventResponse {
    pub id: String,
    pub rail: String,
    pub amount_minor: u64,
    pub status: String,
    pub risk_level: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ProductLightningTopupQuoteRequest {
    pub pubkey: String,
    pub amount_minor: u64,
    pub request_id: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ProductStripeTopupRequest {
    pub pubkey: String,
    pub amount_minor: u64,
    pub request_id: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ProductWalletTopupResponse {
    pub id: String,
    pub rail: String,
    pub amount_minor: u64,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub amount_msat: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub invoice: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payment_hash: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub checkout_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub checkout_session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub checkout_expires_at: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fx_source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub btc_usd_price: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub spread_bps: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fx_quote_id: Option<String>,
    pub observations: Vec<ProductFxObservationResponse>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub risk_level: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub issued_proofs: Option<Vec<ProofInput>>,
    pub created_at: i64,
    pub expires_at: i64,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ProductWalletTopupRequestStatusResponse {
    pub request_id: String,
    pub rail: String,
    pub amount_minor: u64,
    pub status: String,
    pub error: Option<String>,
    pub topup: Option<ProductWalletTopupResponse>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ProductFxObservationResponse {
    pub source: String,
    pub btc_usd_price: f64,
    pub observed_at: i64,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ProductLightningFxQuoteResponse {
    pub amount_minor: u64,
    pub amount_msat: u64,
    pub btc_usd_price: f64,
    pub fx_source: String,
    pub spread_bps: u64,
    pub created_at: i64,
    pub expires_at: i64,
    pub fallback_used: bool,
    pub observations: Vec<ProductFxObservationResponse>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ProductWalletPositionResponse {
    pub market_event_id: String,
    pub market_slug: String,
    pub market_title: String,
    pub direction: String,
    pub quantity: f64,
    pub cost_basis_minor: u64,
    pub current_price_ppm: u64,
    pub market_value_minor: u64,
    pub unrealized_pnl_minor: i64,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ProductWalletResponse {
    pub pubkey: String,
    pub available_minor: u64,
    pub pending_minor: u64,
    pub total_deposited_minor: u64,
    pub positions: Vec<ProductWalletPositionResponse>,
    pub pending_topups: Vec<ProductWalletTopupResponse>,
    pub funding_events: Vec<ProductFundingEventResponse>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ProductTradeQuoteRequest {
    pub trade_type: String,
    pub side: String,
    pub spend_minor: Option<u64>,
    pub quantity: Option<f64>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ProductCoordinatorTradeQuoteRequest {
    pub event_id: String,
    pub side: String,
    pub spend_minor: Option<u64>,
    pub quantity: Option<f64>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ProductTradeQuoteResponse {
    pub quote_id: Option<String>,
    pub market_event_id: String,
    pub trade_type: String,
    pub side: String,
    pub fx_quote_id: Option<String>,
    pub quantity: f64,
    pub quantity_minor: u64,
    pub spend_minor: u64,
    pub fee_minor: u64,
    pub net_minor: u64,
    pub settlement_minor: u64,
    pub settlement_msat: u64,
    pub settlement_fee_msat: u64,
    pub average_price_ppm: u64,
    pub marginal_price_before_ppm: u64,
    pub marginal_price_after_ppm: u64,
    pub current_price_yes_ppm: u64,
    pub current_price_no_ppm: u64,
    pub fx_source: Option<String>,
    pub btc_usd_price: Option<f64>,
    pub spread_bps: Option<u64>,
    pub fx_observations: Vec<ProductFxObservationResponse>,
    pub created_at: Option<i64>,
    pub expires_at: Option<i64>,
    pub status: Option<String>,
    pub trade_id: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ProductBuyRequest {
    pub pubkey: String,
    pub side: String,
    pub spend_minor: u64,
    #[serde(default)]
    pub proofs: Vec<ProofInput>,
    pub quote_id: Option<String>,
    pub request_id: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ProductCoordinatorBuyRequest {
    pub event_id: String,
    pub pubkey: String,
    pub side: String,
    pub spend_minor: u64,
    #[serde(default)]
    pub proofs: Vec<ProofInput>,
    pub quote_id: Option<String>,
    pub request_id: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ProductSellRequest {
    pub pubkey: String,
    pub side: String,
    pub quantity: f64,
    #[serde(default)]
    pub proofs: Vec<ProofInput>,
    pub quote_id: Option<String>,
    pub request_id: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ProductCoordinatorSellRequest {
    pub event_id: String,
    pub pubkey: String,
    pub side: String,
    pub quantity: f64,
    #[serde(default)]
    pub proofs: Vec<ProofInput>,
    pub quote_id: Option<String>,
    pub request_id: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ProductTradeProofBundleResponse {
    pub unit: String,
    pub proofs: Vec<ProofInput>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ProductTradeExecutionResponse {
    pub wallet: ProductWalletResponse,
    pub market: ProductMarketSummary,
    pub trade: Value,
    pub settlement: Option<ProductTradeSettlementResponse>,
    pub issued: Option<ProductTradeProofBundleResponse>,
    pub change: Option<ProductTradeProofBundleResponse>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ProductTradeSettlementResponse {
    pub id: String,
    pub trade_id: String,
    pub quote_id: Option<String>,
    pub rail: String,
    pub mode: String,
    pub side: String,
    pub trade_type: String,
    pub settlement_minor: u64,
    pub settlement_msat: u64,
    pub settlement_fee_msat: u64,
    pub fx_quote_id: Option<String>,
    pub invoice: Option<String>,
    pub payment_hash: Option<String>,
    pub status: String,
    pub metadata: Option<Value>,
    pub created_at: i64,
    pub settled_at: Option<i64>,
    pub completed_at: Option<i64>,
}

// Lightning trade endpoints

#[derive(Debug, Deserialize, Serialize)]
pub struct LightningTradeRequest {
    pub market_id: String, // event_id of the market
    pub side: String,      // "LONG" or "SHORT"
    pub amount_sats: u64,
    pub buyer_pubkey: String,
    pub expiry_seconds: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct LightningTradeResponse {
    pub order_id: String,
    pub market_id: String,
    pub side: String,
    pub amount_sats: u64,
    pub fee_sats: u64,
    pub total_sats: u64,
    pub invoice: String,
    pub payment_hash: String,
    pub expires_at: i64,
}

/// Lightning sell request
#[derive(Debug, Deserialize)]
pub struct LightningSellRequest {
    pub market_id: String, // event_id of the market
    pub side: String,      // "LONG" or "SHORT"
    pub amount_sats: u64,
    pub seller_pubkey: String,
    pub expiry_seconds: Option<u64>,
}

#[derive(Debug, Deserialize)]
pub struct InvoiceStatusRequest {
    pub payment_hash: String,
}

#[derive(Debug, Serialize)]
pub struct InvoiceStatusResponse {
    pub payment_hash: String,
    pub state: String, // "open", "settled", "expired", "cancelled"
    pub amount_sats: u64,
}

#[derive(Debug, Deserialize)]
pub struct SettleRequest {
    pub order_id: String,
    pub preimage: String, // hex-encoded 32-byte preimage
}

#[derive(Debug, Serialize)]
pub struct SettleResponse {
    pub order_id: String,
    pub state: String,
    pub fulfilled: bool,
}

#[derive(Debug, Serialize)]
pub struct EscrowStatsResponse {
    pub pending_count: u64,
    pub pending_sats: u64,
    pub settled_count: u64,
    pub settled_sats: u64,
    pub refunded_count: u64,
    pub refunded_sats: u64,
    pub failed_count: u64,
}

// =============================================================================
// Settlement & Redemption Endpoints (Phase 7)
// =============================================================================

/// Cashu proof for redemption - matches NUT-01 Proof structure
#[allow(non_snake_case)]
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ProofInput {
    /// Unique secret identifying this proof
    pub secret: String,
    /// Number of satoshis this proof is worth
    pub amount: u64,
    /// Compressed public key commitment (66 hex chars for secp256k1)
    pub C: String,
    /// Keyset ID this proof belongs to (matches Cashu NUT-00 id field)
    #[serde(rename = "id")]
    pub id: String,
    /// Optional witness data for HTLC proofs
    pub witness: Option<String>,
    /// Optional DLEQ proof (e, s, r) for zero-knowledge amount proof (NUT-12)
    #[serde(rename = "dleq", default)]
    pub dleq: Option<DleqProof>,
}

/// DLEQ proof for zero-knowledge amount proof (NUT-12)
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct DleqProof {
    pub e: String,
    pub s: String,
    /// Random nonce r (64 hex chars)
    pub r: String,
}

/// Blinded message — provided by the client for CDK blind signing
/// Matches the CDK NUT-00 BlindedMessage JSON format
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct BlindedMessageInput {
    /// Denomination in satoshis
    pub amount: u64,
    /// Keyset ID the client wants signed with
    pub id: String,
    /// Blinded secret (B_) — hex-encoded compressed secp256k1 public key
    #[serde(rename = "B_")]
    pub b_: String,
}

fn default_lmsr_b() -> f64 {
    10.0
}

/// Mid-market redemption request
#[derive(Debug, Deserialize)]
pub struct MarketRedeemRequest {
    pub market_id: String,
    pub side: String, // "yes" or "no"
    pub shares: f64,
    pub proof: ProofInput,
    /// Blinded messages for SAT tokens the client wants minted in exchange
    pub outputs: Vec<BlindedMessageInput>,
}

/// Mid-market redemption response
#[derive(Debug, Serialize)]
pub struct MarketRedeemResponse {
    pub success: bool,
    pub payout: u64,
    pub fee: u64,
    pub net_payout: u64,
    pub tokens: Vec<TokenOutput>,
}

/// Post-resolution settlement request
#[derive(Debug, Deserialize)]
pub struct MarketSettleRequest {
    pub market_id: String,
    pub side: String, // "yes" or "no"
    pub proof: ProofInput,
    /// Blinded messages for SAT tokens — provided by winner for blind signing
    pub outputs: Vec<BlindedMessageInput>,
}

/// Post-resolution settlement response
#[derive(Debug, Serialize)]
pub struct MarketSettleResponse {
    pub success: bool,
    pub won: bool,
    pub payout: u64,
    pub fee: u64,
    pub net_payout: u64,
    pub tokens: Vec<TokenOutput>,
}

/// Token output from minting — matches CDK NUT-00 BlindSignature JSON format
#[derive(Debug, Serialize)]
pub struct TokenOutput {
    /// Denomination in satoshis
    pub amount: u64,
    /// Keyset ID that signed this token
    pub id: String,
    /// Blinded signature (C_) — hex-encoded compressed secp256k1 public key
    #[serde(rename = "C_")]
    pub c_: String,
}
