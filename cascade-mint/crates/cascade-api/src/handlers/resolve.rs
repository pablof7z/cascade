//! Market resolution and payout handlers

use axum::{
    extract::{State, Json},
    http::StatusCode,
};
use cascade_core::{market::Side, trade::TradeExecutor};
use crate::types::{ResolveRequest, ResolveResponse, PayoutRequest, PayoutResponse};
use crate::routes::AppState;

/// Resolve a market with an outcome
pub async fn resolve_market(
    State(state): State<AppState>,
    Json(req): Json<ResolveRequest>,
) -> (StatusCode, Json<ResolveResponse>) {
    // Parse outcome
    let outcome = match req.outcome.to_lowercase().as_str() {
        "long" => Side::Long,
        "short" => Side::Short,
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ResolveResponse {
                    market_id: req.market_id,
                    outcome: "invalid".to_string(),
                }),
            )
        }
    };

    match state.market_manager.resolve_market(&req.market_id, outcome).await {
        Ok(_) => (
            StatusCode::OK,
            Json(ResolveResponse {
                market_id: req.market_id,
                outcome: req.outcome,
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ResolveResponse {
                market_id: req.market_id,
                outcome: "error".to_string(),
            }),
        ),
    }
}

/// Execute a payout for a resolved market
pub async fn execute_payout(
    State(state): State<AppState>,
    Json(req): Json<PayoutRequest>,
) -> (StatusCode, Json<PayoutResponse>) {
    // Get market
    let market = match state.market_manager.get_market(&req.market_id).await {
        Ok(m) => m,
        Err(_) => {
            return (
                StatusCode::NOT_FOUND,
                Json(PayoutResponse {
                    payout_id: String::new(),
                    market_id: req.market_id,
                    payout_sats: 0,
                }),
            )
        }
    };

    // Create trade executor and execute payout
    let executor = TradeExecutor::new(state.market_manager.lmsr().clone(), 100);
    
    match executor.execute_resolution_payout(&market, req.recipient_pubkey, req.winning_tokens) {
        Ok(payout) => (
            StatusCode::CREATED,
            Json(PayoutResponse {
                payout_id: payout.id,
                market_id: payout.market_id,
                payout_sats: payout.payout_sats,
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(PayoutResponse {
                payout_id: String::new(),
                market_id: req.market_id,
                payout_sats: 0,
            }),
        ),
    }
}
