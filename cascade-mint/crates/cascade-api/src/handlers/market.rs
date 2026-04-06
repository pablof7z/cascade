//! Market API handlers.

use axum::{http::StatusCode, Json};
use crate::types::{CreateMarketRequest, MarketResponse};

/// Create a new market.
pub async fn create_market(
    Json(_req): Json<CreateMarketRequest>,
) -> (StatusCode, Json<MarketResponse>) {
    todo!("Implement create_market handler")
}

/// Get market info.
pub async fn get_market(_market_id: String) -> (StatusCode, Json<MarketResponse>) {
    todo!("Implement get_market handler")
}
