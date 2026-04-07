//! Settlement handlers — Phase 7: Redemption & Post-Resolution Claiming
//!
//! Implements:
//! - POST /v1/cascade/redeem — Mid-market share redemption
//! - POST /v1/cascade/settle — Post-resolution claiming

use axum::{
    extract::State,
    http::StatusCode,
    Json,
};
use cascade_core::{market::Side, lmsr::LmsrEngine};
use crate::types::{
    MarketRedeemRequest, MarketRedeemResponse, MarketSettleRequest, MarketSettleResponse,
    TokenOutput, ProofInput, ErrorResponse,
};
use crate::routes::AppState;

/// Fee rate in basis points (100 bps = 1%)
const FEE_BASIS_POINTS: u64 = 100;

/// Calculate the LMSR price for a given side
fn calculate_lmsr_price(lmsr: &LmsrEngine, q_long: f64, q_short: f64, side: Side) -> f64 {
    match side {
        Side::Long => lmsr.price_long(q_long, q_short).unwrap_or(0.5),
        Side::Short => lmsr.price_short(q_long, q_short).unwrap_or(0.5),
    }
}

/// Mid-market redemption endpoint
///
/// Users can sell their shares back for sats at any time (before resolution).
/// Uses LMSR math to calculate payout at current market price minus 1% fee.
pub async fn redeem(
    State(state): State<AppState>,
    Json(req): Json<MarketRedeemRequest>,
) -> (StatusCode, Json<Result<MarketRedeemResponse, ErrorResponse>>) {
    // Parse side
    let side = match req.side.to_lowercase().as_str() {
        "yes" => Side::Long,
        "no" => Side::Short,
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(Err(ErrorResponse {
                    error: "Invalid side".to_string(),
                    details: Some("Side must be 'yes' or 'no'".to_string()),
                })),
            )
        }
    };

    // Get market
    let market = match state.market_manager.get_market(&req.market_id).await {
        Ok(m) => m,
        Err(_) => {
            return (
                StatusCode::NOT_FOUND,
                Json(Err(ErrorResponse {
                    error: "Market not found".to_string(),
                    details: Some(req.market_id.clone()),
                })),
            )
        }
    };

    // Check market is still active (can only redeem before resolution)
    if !market.is_active() {
        return (
            StatusCode::BAD_REQUEST,
            Json(Err(ErrorResponse {
                error: "Market not active".to_string(),
                details: Some("Cannot redeem from a resolved or archived market".to_string()),
            })),
        );
    }

    // Calculate payout using LMSR price
    let lmsr = state.market_manager.lmsr();
    let price = calculate_lmsr_price(lmsr, market.q_long, market.q_short, side);
    let gross_payout = (req.shares * price).round() as u64;
    let fee = (gross_payout * FEE_BASIS_POINTS / 10000) as u64; // 1% fee
    let net_payout = gross_payout - fee;

    // Generate mock token output (in production, this would mint actual Cashu tokens)
    let tokens = if net_payout > 0 {
        vec![TokenOutput {
            amount: net_payout,
            id: format!("token_{}", uuid::Uuid::new_v4()),
            blind_nonces: vec!["blind_nonce_1".to_string()],
            B: "public_key_placeholder".to_string(),
        }]
    } else {
        vec![]
    };

    // Return redemption response
    (
        StatusCode::OK,
        Json(Ok(MarketRedeemResponse {
            success: true,
            payout: gross_payout,
            fee,
            net_payout,
            tokens,
        })),
    )
}

/// Post-resolution settlement endpoint
///
/// After market resolves, winners claim their payout, losers get nothing.
pub async fn settle(
    State(state): State<AppState>,
    Json(req): Json<MarketSettleRequest>,
) -> (StatusCode, Json<Result<MarketSettleResponse, ErrorResponse>>) {
    // Parse side
    let side = match req.side.to_lowercase().as_str() {
        "yes" => Side::Long,
        "no" => Side::Short,
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(Err(ErrorResponse {
                    error: "Invalid side".to_string(),
                    details: Some("Side must be 'yes' or 'no'".to_string()),
                })),
            )
        }
    };

    // Get market
    let market = match state.market_manager.get_market(&req.market_id).await {
        Ok(m) => m,
        Err(_) => {
            return (
                StatusCode::NOT_FOUND,
                Json(Err(ErrorResponse {
                    error: "Market not found".to_string(),
                    details: Some(req.market_id.clone()),
                })),
            )
        }
    };

    // Check market is resolved
    if !market.is_resolved() {
        return (
            StatusCode::BAD_REQUEST,
            Json(Err(ErrorResponse {
                error: "Market not resolved".to_string(),
                details: Some("Cannot settle before market is resolved".to_string()),
            })),
        );
    }

    // Determine if user won based on outcome
    // Winner payout = shares * 1.0 (full value)
    // Loser payout = 0
    let resolution_outcome = market.resolution_outcome;
    let (won, payout, fee, net_payout) = if resolution_outcome == Some(side) {
        // User picked the winning side
        let gross = req.proof.amount; // Use proof amount as shares value
        let f = (gross * FEE_BASIS_POINTS / 10000) as u64;
        let net = gross.saturating_sub(f);
        (true, gross, f, net)
    } else {
        // User picked the losing side
        (false, 0, 0, 0)
    };

    // Generate mock token output for winners only
    let tokens = if won && net_payout > 0 {
        vec![TokenOutput {
            amount: net_payout,
            id: format!("settle_token_{}", uuid::Uuid::new_v4()),
            blind_nonces: vec!["blind_nonce_1".to_string()],
            B: "public_key_placeholder".to_string(),
        }]
    } else {
        vec![]
    };

    // Return settlement response
    (
        StatusCode::OK,
        Json(Ok(MarketSettleResponse {
            success: true,
            won,
            payout,
            fee,
            net_payout,
            tokens,
        })),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fee_calculation() {
        // 1% fee on 10000 sats = 100 sats
        let gross = 10000u64;
        let fee = (gross * FEE_BASIS_POINTS / 10000) as u64;
        assert_eq!(fee, 100);
    }
}