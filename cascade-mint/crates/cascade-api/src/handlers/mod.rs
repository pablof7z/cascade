//! HTTP request handlers

pub mod market;
pub mod trade;
pub mod price;
pub mod resolve;

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
