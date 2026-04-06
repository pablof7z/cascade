//! API types (DTOs) for Cascade HTTP API.
//!
//! Request and response structures for all custom Cascade endpoints.

use serde::{Deserialize, Serialize};

/// Market outcome side.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum Side {
    Long,
    Short,
}

impl Side {
    /// Convert to boolean: true = Long (YES), false = Short (NO)
    pub fn to_bool(&self) -> bool {
        matches!(self, Side::Long)
    }

    /// Create from boolean: true = Long (YES), false = Short (NO)
    pub fn from_bool(value: bool) -> Self {
        if value {
            Side::Long
        } else {
            Side::Short
        }
    }
}

/// Trade direction.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TradeDirection {
    Buy,
    Sell,
}

// ==================== MARKET ENDPOINT TYPES ====================

/// Request to create a new market.
#[derive(Debug, Deserialize)]
pub struct CreateMarketRequest {
    /// Nostr event ID (kind 982) for this market
    pub event_id: String,
    /// Unique slug identifier (d-tag value)
    pub slug: String,
    /// Market title/question
    pub title: String,
    /// Market description/details
    pub description: String,
    /// Optional LMSR sensitivity parameter (default: 0.0001)
    pub b: Option<f64>,
    /// Seed reserve from creator in sats
    pub initial_reserve_sats: u64,
    /// Hex pubkey of market creator
    pub creator_pubkey: String,
    /// Mint URL for the sat keyset
    pub mint: String,
    /// Optional image URL
    pub image: Option<String>,
}

/// Response containing market information.
#[derive(Debug, Serialize)]
pub struct MarketResponse {
    /// Nostr event ID
    pub event_id: String,
    /// Unique slug identifier
    pub slug: String,
    /// Market title
    pub title: String,
    /// Market description
    pub description: String,
    /// Market status
    pub status: String,
    /// Current market prices
    pub prices: MarketPrices,
    /// Reserve pool in sats
    pub reserve_sats: u64,
    /// Keyset information
    pub keysets: MarketKeysets,
    /// Creation timestamp
    pub created_at: i64,
    /// Optional end date
    pub end_date: Option<i64>,
    /// Resolution outcome (if resolved)
    pub outcome: Option<bool>,
}

/// Keyset information for a market's LONG and SHORT tokens.
#[derive(Debug, Serialize)]
pub struct MarketKeysets {
    /// CDK keyset ID for LONG unit
    pub long_keyset_id: String,
    /// Unit name for LONG (e.g., "LONG_slug")
    pub long_unit: String,
    /// CDK keyset ID for SHORT unit
    pub short_keyset_id: String,
    /// Unit name for SHORT (e.g., "SHORT_slug")
    pub short_unit: String,
}

/// Response containing a list of markets.
#[derive(Debug, Serialize)]
pub struct MarketListResponse {
    pub markets: Vec<MarketResponse>,
}

/// Query parameters for listing markets.
#[derive(Debug, Deserialize)]
pub struct ListMarketsParams {
    /// Filter by status (open, resolved, cancelled, archived)
    pub status: Option<String>,
}

// ==================== PRICE ENDPOINT TYPES ====================

/// Current market prices.
#[derive(Debug, Serialize)]
pub struct MarketPrices {
    /// Current LONG (YES) price (0.0 to 1.0)
    pub long_price: f64,
    /// Current SHORT (NO) price (0.0 to 1.0)
    pub short_price: f64,
    /// Total outstanding LONG shares
    pub q_long: f64,
    /// Total outstanding SHORT shares
    pub q_short: f64,
    /// LMSR liquidity parameter
    pub b: f64,
}

/// Response containing market prices.
#[derive(Debug, Serialize)]
pub struct PriceResponse {
    pub market_slug: String,
    pub prices: MarketPrices,
}

/// Request for a price quote.
#[derive(Debug, Deserialize)]
pub struct QuoteRequest {
    pub side: Side,
    pub amount: f64,
    pub direction: TradeDirection,
}

/// Response for a price quote.
#[derive(Debug, Serialize)]
pub struct QuoteResponse {
    pub market_slug: String,
    pub side: Side,
    pub direction: TradeDirection,
    pub amount: f64,
    /// Cost to buy or refund for sell (in sats)
    pub cost_or_refund_sats: u64,
    /// Fee in sats
    pub fee_sats: u64,
    /// Total sats required/received
    pub total_sats: u64,
    /// Price before the trade
    pub price_before: f64,
    /// Price after the trade
    pub price_after: f64,
}

// ==================== TRADE ENDPOINT TYPES ====================

/// Request to buy position tokens.
#[derive(Debug, Deserialize)]
pub struct BuyRequest {
    pub market_slug: String,
    pub side: Side,
    /// Number of tokens to buy
    pub amount: f64,
}

/// Response for buying position tokens.
#[derive(Debug, Serialize)]
pub struct BuyResponse {
    pub market_slug: String,
    pub side: Side,
    pub amount: f64,
    /// Cost in sats
    pub cost_sats: u64,
    /// Fee in sats
    pub fee_sats: u64,
    /// New prices after trade
    pub new_prices: MarketPrices,
    /// Trade ID
    pub trade_id: String,
}

/// Request to sell position tokens.
#[derive(Debug, Deserialize)]
pub struct SellRequest {
    pub market_slug: String,
    pub side: Side,
    /// Number of tokens to sell
    pub amount: f64,
}

/// Response for selling position tokens.
#[derive(Debug, Serialize)]
pub struct SellResponse {
    pub market_slug: String,
    pub side: Side,
    pub amount: f64,
    /// Refund in sats
    pub refund_sats: u64,
    /// Fee in sats
    pub fee_sats: u64,
    /// New prices after trade
    pub new_prices: MarketPrices,
    /// Trade ID
    pub trade_id: String,
}

/// Request to redeem winning tokens after market resolution.
#[derive(Debug, Deserialize)]
pub struct PayoutRequest {
    pub market_slug: String,
    /// Number of winning tokens to redeem
    pub amount: f64,
}

/// Response for payout redemption.
#[derive(Debug, Serialize)]
pub struct PayoutResponse {
    pub market_slug: String,
    /// Payout in sats (1:1 with amount for winning side)
    pub payout_sats: u64,
}

// ==================== RESOLUTION ENDPOINT TYPES ====================

/// Authorization proof for resolving a market.
#[derive(Debug, Deserialize)]
pub struct ResolveProof {
    /// Nostr event (kind TBD) signed by market creator
    pub nostr_event: Option<String>,
    /// Admin secret key (for development/testing only)
    pub admin_key: Option<String>,
}

/// Request to resolve a market.
#[derive(Debug, Deserialize)]
pub struct ResolveRequest {
    /// Resolution outcome: LONG (YES) or SHORT (NO)
    pub outcome: Side,
    /// Authorization proof
    pub proof: ResolveProof,
}

/// Response for market resolution.
#[derive(Debug, Serialize)]
pub struct ResolveResponse {
    pub market_slug: String,
    pub outcome: Side,
    pub status: String,
}

// ==================== ERROR RESPONSE ====================

/// Standard error response format.
#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    /// Human-readable error message
    pub error: String,
    /// Machine-readable error code
    pub code: String,
    /// Optional additional context
    pub detail: Option<String>,
}

impl ErrorResponse {
    /// Create a new error response.
    pub fn new(error: impl Into<String>, code: impl Into<String>) -> Self {
        Self {
            error: error.into(),
            code: code.into(),
            detail: None,
        }
    }

    /// Add detail to the error response (builder pattern).
    pub fn with_detail(mut self, detail: impl Into<String>) -> Self {
        self.detail = Some(detail.into());
        self
    }
}

/// API error codes.
pub mod error_codes {
    /// Market not found
    pub const MARKET_NOT_FOUND: &str = "MARKET_NOT_FOUND";
    /// Market is not active (resolved/archived)
    pub const MARKET_NOT_ACTIVE: &str = "MARKET_NOT_ACTIVE";
    /// Insufficient funds in proofs
    pub const INSUFFICIENT_FUNDS: &str = "INSUFFICIENT_FUNDS";
    /// Invalid proofs provided
    pub const INVALID_PROOFS: &str = "INVALID_PROOFS";
    /// Malformed request body
    pub const INVALID_REQUEST: &str = "INVALID_REQUEST";
    /// Trying to redeem losing-side tokens
    pub const WRONG_SIDE: &str = "WRONG_SIDE";
    /// Resolution without valid authorization
    pub const UNAUTHORIZED: &str = "UNAUTHORIZED";
    /// Unexpected server error
    pub const INTERNAL_ERROR: &str = "INTERNAL_ERROR";
}
