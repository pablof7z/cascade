//! Trade API handlers.

use axum::{http::StatusCode, Json};
use crate::types::{TradeRequest, TradeResponse};

/// Place a trade on a market.
pub async fn place_trade(
    Json(_req): Json<TradeRequest>,
) -> (StatusCode, Json<TradeResponse>) {
    todo!("Implement place_trade handler")
}
