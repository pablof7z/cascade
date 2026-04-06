//! API types for Cascade mint.

use serde::{Deserialize, Serialize};

/// Request to create a new market.
#[derive(Debug, Deserialize)]
pub struct CreateMarketRequest {
    pub title: String,
    pub description: String,
}

/// Response for market operations.
#[derive(Debug, Serialize)]
pub struct MarketResponse {
    pub id: String,
    pub title: String,
    pub slug: String,
}

/// Request to place a trade.
#[derive(Debug, Deserialize)]
pub struct TradeRequest {
    pub market_id: String,
    pub outcome: bool,
    pub amount: u64,
}

/// Response for trade operations.
#[derive(Debug, Serialize)]
pub struct TradeResponse {
    pub trade_id: String,
    pub amount: u64,
    pub price: f64,
}
