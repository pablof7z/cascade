//! Market resolution API handlers.
//!
//! Endpoints for resolving prediction markets.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use cascade_core::CascadeError;

use crate::routes::AppState;
use crate::types::{error_codes, ErrorResponse, ResolveRequest, ResolveResponse};

/// POST /v1/cascade/resolve/:slug — Resolve a market with the given outcome.
pub async fn resolve_market(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    Json(request): Json<ResolveRequest>,
) -> Result<Json<ResolveResponse>, (StatusCode, Json<ErrorResponse>)> {
    // Validate authorization
    // In production, verify:
    // 1. Nostr event signature from the market creator
    // 2. Event is tagged with the market's d-tag
    // 3. Event content matches the resolution
    // For now, we accept requests but should add admin key validation
    if request.proof.admin_key.is_none() {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(ErrorResponse::new(
                "Admin key or Nostr event required for resolution",
                error_codes::UNAUTHORIZED,
            )),
        ));
    }

    // Resolve the market
    let result = state
        .market_manager
        .resolve_market(&slug, request.outcome.to_bool())
        .await;

    match result {
        Ok(market) => {
            // Publish market resolution event to Nostr (fire and forget)
            if let Err(e) = state.nostr_publisher.update_market(&market).await {
                tracing::warn!("Failed to publish market resolution to Nostr: {}", e);
            }

            let response = ResolveResponse {
                market_slug: slug,
                outcome: request.outcome,
                status: "resolved".to_string(),
            };
            Ok(Json(response))
        }
        Err(e) => Err(map_error(e)),
    }
}

/// Map CascadeError to HTTP status code and ErrorResponse.
fn map_error(e: CascadeError) -> (StatusCode, Json<ErrorResponse>) {
    match e {
        CascadeError::MarketNotFound { slug } => (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse::new(
                format!("Market not found: {}", slug),
                error_codes::MARKET_NOT_FOUND,
            )),
        ),
        CascadeError::MarketNotActive { status, .. } => (
            StatusCode::CONFLICT,
            Json(ErrorResponse::new(
                format!("Cannot resolve market: {:?}", status),
                error_codes::MARKET_NOT_ACTIVE,
            )),
        ),
        _ => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse::new(
                "Internal server error",
                error_codes::INTERNAL_ERROR,
            )),
        ),
    }
}
