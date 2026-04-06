//! Market resolution API handlers.

use axum::{http::StatusCode, Json};
use serde::{Deserialize, Serialize};

/// Request to resolve a market.
#[derive(Debug, Deserialize)]
pub struct ResolveMarketRequest {
    pub outcome: bool,
}

/// Response for market resolution.
#[derive(Debug, Serialize)]
pub struct ResolveResponse {
    pub market_id: String,
    pub resolved: bool,
}

/// Resolve a market with the given outcome.
pub async fn resolve_market(
    _market_id: String,
    Json(_req): Json<ResolveMarketRequest>,
) -> (StatusCode, Json<ResolveResponse>) {
    todo!("Implement resolve_market handler")
}
