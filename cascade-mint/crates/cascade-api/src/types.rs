//! Request and response types for Cascade API

use serde::{Deserialize, Serialize};

// Market endpoints

#[derive(Debug, Deserialize, Serialize)]
pub struct CreateMarketRequest {
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
}

#[derive(Debug, Deserialize)]
pub struct SellRequest {
    pub market_id: String,
    pub side: String,
    pub quantity: f64,
    pub seller_pubkey: String,
}

#[derive(Debug, Serialize)]
pub struct TradeResponse {
    pub trade_id: String,
    pub market_id: String,
    pub side: String,
    pub quantity: f64,
    pub cost_sats: u64,
    pub fee_sats: u64,
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
