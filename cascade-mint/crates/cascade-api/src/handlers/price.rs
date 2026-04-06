//! Price API handlers.

use axum::{http::StatusCode, Json};
use serde::Serialize;

/// Response for market prices.
#[derive(Debug, Serialize)]
pub struct PriceResponse {
    pub yes_price: f64,
    pub no_price: f64,
}

/// Get market prices.
pub async fn get_price(_market_id: String) -> (StatusCode, Json<PriceResponse>) {
    todo!("Implement get_price handler")
}
