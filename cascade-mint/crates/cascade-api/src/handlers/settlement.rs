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

/// Validate a Cashu proof input
/// Returns Ok(()) if valid, Err(message) if invalid
fn validate_proof(proof: &ProofInput) -> Result<(), String> {
    // Check secret is not empty
    if proof.secret.is_empty() {
        return Err("Proof secret cannot be empty".to_string());
    }

    // Check amount is positive
    if proof.amount == 0 {
        return Err("Proof amount must be greater than 0".to_string());
    }

    // Check C (commitment) is valid hex and proper length
    // Cashu uses compressed secp256k1 public keys: 33 bytes = 66 hex chars
    if proof.C.is_empty() {
        return Err("Proof commitment (C) cannot be empty".to_string());
    }

    // Validate hex format and length (66 chars for compressed point)
    if proof.C.len() != 66 {
        return Err(format!(
            "Proof commitment (C) must be 66 hex characters for compressed secp256k1 key, got {}",
            proof.C.len()
        ));
    }

    if !proof.C.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("Proof commitment (C) must be valid hex".to_string());
    }

    // Validate keyset_id is not empty
    if proof.keyset_id.is_empty() {
        return Err("Proof keyset_id cannot be empty".to_string());
    }

    // Validate DLEQ proof if present
    if let Some(dleq) = &proof.dleq_proof {
        if dleq.e.is_empty() || dleq.s.is_empty() {
            return Err("DLEQ proof must have non-empty e and s values".to_string());
        }
        if dleq.e.len() != 64 || dleq.s.len() != 64 {
            return Err("DLEQ proof e and s must be 64 hex characters each".to_string());
        }
        if !dleq.e.chars().all(|c| c.is_ascii_hexdigit()) || !dleq.s.chars().all(|c| c.is_ascii_hexdigit()) {
            return Err("DLEQ proof e and s must be valid hex".to_string());
        }
    }

    Ok(())
}

/// Calculate the LMSR sell refund for a given quantity
/// This uses the proper LMSR cost function: C(q) - C(q-delta)
fn calculate_sell_refund(lmsr: &LmsrEngine, q_long: f64, q_short: f64, side: Side, shares: f64) -> Result<u64, String> {
    let (q_for_side, q_opposite) = match side {
        Side::Long => (q_long, q_short),
        Side::Short => (q_short, q_long),
    };

    if shares > q_for_side {
        return Err(format!(
            "Cannot sell {} shares: only {} available",
            shares, q_for_side
        ));
    }

    lmsr.calculate_sell_refund(q_for_side, q_opposite, shares)
        .map_err(|e| e.to_string())
}

/// Mid-market redemption endpoint
///
/// Users can sell their shares back for sats at any time (before resolution).
/// Uses LMSR math to calculate payout at current market price minus 1% fee.
pub async fn redeem(
    State(state): State<AppState>,
    Json(req): Json<MarketRedeemRequest>,
) -> (StatusCode, Json<Result<MarketRedeemResponse, ErrorResponse>>) {
    // Validate proof
    if let Err(msg) = validate_proof(&req.proof) {
        return (
            StatusCode::BAD_REQUEST,
            Json(Err(ErrorResponse {
                error: "Invalid proof".to_string(),
                details: Some(msg),
            })),
        );
    }

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

    // Atomic check-and-set: acquire write lock FIRST, then check if spent
    // This prevents race conditions where two concurrent requests both pass the read check
    {
        let mut spent = state.spent_proofs.write().await;
        if spent.contains(&req.proof.secret) {
            return (
                StatusCode::CONFLICT,
                Json(Err(ErrorResponse {
                    error: "Proof already spent".to_string(),
                    details: Some("This proof has already been redeemed".to_string()),
                })),
            );
        }

        // Calculate payout using proper LMSR refund formula
        let lmsr = state.market_manager.lmsr();
        let gross_payout = match calculate_sell_refund(lmsr, market.q_long, market.q_short, side, req.shares) {
            Ok(refund) => refund,
            Err(msg) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(Err(ErrorResponse {
                        error: "Refund calculation failed".to_string(),
                        details: Some(msg),
                    })),
                );
            }
        };

        let fee = (gross_payout * FEE_BASIS_POINTS / 10000) as u64; // 1% fee
        let net_payout = gross_payout.saturating_sub(fee);

        // Mark proof as spent BEFORE returning (atomic with check)
        spent.insert(req.proof.secret.clone());

        // Update market LMSR state
        let (delta_long, delta_short) = match side {
            Side::Long => (-req.shares, 0.0),
            Side::Short => (0.0, -req.shares),
        };
        let _ = state.market_manager.update_lmsr_state(&req.market_id, delta_long, delta_short, -(gross_payout as i64)).await;

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

        return (
            StatusCode::OK,
            Json(Ok(MarketRedeemResponse {
                success: true,
                payout: gross_payout,
                fee,
                net_payout,
                tokens,
            })),
        );
    }
}

/// Post-resolution settlement endpoint
///
/// After market resolves, winners claim their payout, losers get nothing.
pub async fn settle(
    State(state): State<AppState>,
    Json(req): Json<MarketSettleRequest>,
) -> (StatusCode, Json<Result<MarketSettleResponse, ErrorResponse>>) {
    // Validate proof
    if let Err(msg) = validate_proof(&req.proof) {
        return (
            StatusCode::BAD_REQUEST,
            Json(Err(ErrorResponse {
                error: "Invalid proof".to_string(),
                details: Some(msg),
            })),
        );
    }

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

    // Atomic check-and-set: acquire write lock FIRST, then check if spent
    {
        let mut spent = state.spent_proofs.write().await;
        if spent.contains(&req.proof.secret) {
            return (
                StatusCode::CONFLICT,
                Json(Err(ErrorResponse {
                    error: "Proof already spent".to_string(),
                    details: Some("This proof has already been settled".to_string()),
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

        // Mark proof as spent (regardless of win/loss to prevent re-submission)
        spent.insert(req.proof.secret.clone());

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
        return (
            StatusCode::OK,
            Json(Ok(MarketSettleResponse {
                success: true,
                won,
                payout,
                fee,
                net_payout,
                tokens,
            })),
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::DleqProof;

    fn make_valid_proof() -> ProofInput {
        ProofInput {
            secret: "test_secret_123".to_string(),
            amount: 100,
            C: "a".repeat(66), // Valid 66 char hex for compressed pubkey
            keyset_id: "keyset123".to_string(),
            witness: None,
            dleq_proof: None,
        }
    }

    #[test]
    fn test_fee_calculation() {
        // 1% fee on 10000 sats = 100 sats
        let gross = 10000u64;
        let fee = (gross * FEE_BASIS_POINTS / 10000) as u64;
        assert_eq!(fee, 100);
    }

    #[test]
    fn test_validate_proof_empty_secret() {
        let mut proof = make_valid_proof();
        proof.secret = "".to_string();
        let result = validate_proof(&proof);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("secret"));
    }

    #[test]
    fn test_validate_proof_zero_amount() {
        let mut proof = make_valid_proof();
        proof.amount = 0;
        let result = validate_proof(&proof);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("amount"));
    }

    #[test]
    fn test_validate_proof_invalid_hex() {
        let mut proof = make_valid_proof();
        proof.C = "xyz".repeat(22); // 66 chars but not hex
        let result = validate_proof(&proof);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("hex"));
    }

    #[test]
    fn test_validate_proof_wrong_length() {
        let mut proof = make_valid_proof();
        proof.C = "a".repeat(64); // Too short (should be 66 for compressed pubkey)
        let result = validate_proof(&proof);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("66 hex characters"));
    }

    #[test]
    fn test_validate_proof_empty_keyset_id() {
        let mut proof = make_valid_proof();
        proof.keyset_id = "".to_string();
        let result = validate_proof(&proof);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("keyset_id"));
    }

    #[test]
    fn test_validate_proof_invalid_dleq() {
        let mut proof = make_valid_proof();
        proof.dleq_proof = Some(DleqProof {
            e: "abc".to_string(),
            s: "def".to_string(),
        });
        let result = validate_proof(&proof);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("64 hex characters"));
    }

    #[test]
    fn test_validate_proof_valid() {
        let proof = make_valid_proof();
        let result = validate_proof(&proof);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_proof_valid_with_dleq() {
        let mut proof = make_valid_proof();
        proof.dleq_proof = Some(DleqProof {
            e: "a".repeat(64),
            s: "b".repeat(64),
        });
        let result = validate_proof(&proof);
        assert!(result.is_ok());
    }
}
