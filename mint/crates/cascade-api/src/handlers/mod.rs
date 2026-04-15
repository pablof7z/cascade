//! HTTP request handlers

pub mod keys;
pub mod price;
pub mod product;
pub mod settlement;

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
