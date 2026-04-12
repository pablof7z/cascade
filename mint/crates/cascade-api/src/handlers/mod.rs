//! HTTP request handlers

pub mod market;
pub mod price;
pub mod product;
pub mod resolve;
pub mod settlement;
pub mod trade;

use axum::Json;
use serde_json::json;

/// Health check endpoint
pub async fn health() -> Json<serde_json::Value> {
    Json(json!({
        "status": "ok",
        "service": "cascade-mint",
        "version": env!("CARGO_PKG_VERSION")
    }))
}
