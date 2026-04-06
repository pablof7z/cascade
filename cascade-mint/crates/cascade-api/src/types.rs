//! Request and response types for Cascade API

use serde::{Deserialize, Serialize};

// Market endpoints

#[derive(Debug, Deserialize)]
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

#[derive(Debug, Deserialize)]
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
