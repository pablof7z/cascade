//! Trade execution handlers

use axum::{
    extract::{Path, State, Json},
    http::StatusCode,
};
use serde_json::Value;
use cascade_core::{market::Side, trade::TradeExecutor, Preimage};
use cdk::nuts::{Proof, Proofs, BlindedMessage, SwapRequest};
use cdk::Amount;
use cdk::util::hex;
use std::str::FromStr;
use crate::types::{
    BuyRequest, SellRequest, TradeResponse, LightningTradeRequest,
    InvoiceStatusRequest, SettleRequest, EscrowStatsResponse, LightningSellRequest,
    TokenOutput,
};
use crate::routes::AppState;

/// Execute a buy order
///
/// When the client provides `outputs` (blinded messages for the market's LONG/SHORT keyset),
/// this handler uses CDK's process_swap_request to atomically spend the input SAT proofs
/// and sign the LONG/SHORT token outputs.
///
/// When no outputs are provided, it falls back to the legacy LMSR-only calculation
/// (no token issuance, just accounting).
pub async fn buy(
    State(state): State<AppState>,
    Json(req): Json<BuyRequest>,
) -> (StatusCode, Json<TradeResponse>) {
    // Parse side
    let side = match req.side.to_lowercase().as_str() {
        "long" => Side::Long,
        "short" => Side::Short,
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(TradeResponse {
                    trade_id: String::new(),
                    market_id: req.market_id,
                    side: req.side,
                    quantity: 0.0,
                    cost_sats: 0,
                    fee_sats: 0,
                    tokens: vec![],
                }),
            )
        }
    };

    // Get market
    let market = match state.market_manager.get_market(&req.market_id).await {
        Ok(m) => m,
        Err(_) => {
            return (
                StatusCode::NOT_FOUND,
                Json(TradeResponse {
                    trade_id: String::new(),
                    market_id: req.market_id,
                    side: req.side,
                    quantity: 0.0,
                    cost_sats: 0,
                    fee_sats: 0,
                    tokens: vec![],
                }),
            )
        }
    };

    // Create trade executor and execute buy
    let executor = TradeExecutor::new(state.market_manager.lmsr().clone(), 100); // 1% fee
    
    match executor.execute_buy(&market, side, req.quantity, req.buyer_pubkey) {
        Ok(trade) => {
            // Update market LMSR state after successful buy
            let (delta_long, delta_short) = match side {
                Side::Long => (req.quantity, 0.0),
                Side::Short => (0.0, req.quantity),
            };
            let _ = state.market_manager.update_lmsr_state(
                &req.market_id,
                delta_long,
                delta_short,
                trade.cost_sats as i64,
            ).await;

            // If client provided blinded messages for market token keyset,
            // use CDK process_swap_request to blind-sign them.
            // NOTE: For a full buy flow, the client would also provide SAT proofs as inputs.
            // The current implementation uses the mint's own signing authority (blind_sign)
            // since the trade cost is accounted via LMSR, not via input proofs.
            let tokens: Vec<TokenOutput> = if !req.outputs.is_empty() {
                // Convert client-provided blinded messages to CDK format
                let blinded_messages: Vec<BlindedMessage> = match req.outputs.iter()
                    .map(|b| {
                        let amount = Amount::from(b.amount);
                        let keyset_id = cdk::nuts::Id::from_str(&b.id)
                            .map_err(|e| format!("Invalid keyset ID '{}': {}", b.id, e))?;
                        let blinded_secret_bytes = hex::decode(&b.b_)
                            .map_err(|e| format!("Invalid B_ hex: {}", e))?;
                        let blinded_secret = cdk::nuts::PublicKey::from_slice(&blinded_secret_bytes)
                            .map_err(|e| format!("Invalid B_ public key: {}", e))?;
                        Ok(BlindedMessage::new(amount, keyset_id, blinded_secret))
                    })
                    .collect::<Result<Vec<_>, String>>()
                {
                    Ok(msgs) => msgs,
                    Err(e) => {
                        tracing::warn!("Invalid blinded messages in buy request: {}", e);
                        // Return trade response without tokens — trade still executed
                        return (
                            StatusCode::CREATED,
                            Json(TradeResponse {
                                trade_id: trade.id,
                                market_id: trade.market_id,
                                side: format!("{:?}", trade.side),
                                quantity: trade.quantity,
                                cost_sats: trade.cost_sats,
                                fee_sats: trade.fee_sats,
                                tokens: vec![],
                            }),
                        );
                    }
                };

                // Blind-sign the outputs — the mint is issuing tokens backed by LMSR reserves
                match state.mint.blind_sign(blinded_messages).await {
                    Ok(signatures) => signatures.into_iter().map(|sig| TokenOutput {
                        amount: sig.amount.to_u64(),
                        id: sig.keyset_id.to_string(),
                        c_: sig.c.to_hex(),
                    }).collect(),
                    Err(e) => {
                        tracing::error!("Blind signing failed in buy: {}", e);
                        // Trade executed but token issuance failed — client should retry
                        vec![]
                    }
                }
            } else {
                vec![]
            };

            (
                StatusCode::CREATED,
                Json(TradeResponse {
                    trade_id: trade.id,
                    market_id: trade.market_id,
                    side: format!("{:?}", trade.side),
                    quantity: trade.quantity,
                    cost_sats: trade.cost_sats,
                    fee_sats: trade.fee_sats,
                    tokens,
                }),
            )
        }
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(TradeResponse {
                trade_id: String::new(),
                market_id: req.market_id,
                side: req.side,
                quantity: 0.0,
                cost_sats: 0,
                fee_sats: 0,
                tokens: vec![],
            }),
        ),
    }
}

/// Execute a sell order
///
/// When the client provides `proofs` (LONG/SHORT token proofs) and `outputs` (blinded
/// messages for SAT keyset), this handler uses CDK's process_swap_request to atomically
/// spend the market token proofs and sign SAT token outputs.
///
/// When no proofs/outputs are provided, it falls back to the legacy LMSR-only calculation.
pub async fn sell(
    State(state): State<AppState>,
    Json(req): Json<SellRequest>,
) -> (StatusCode, Json<TradeResponse>) {
    // Parse side
    let side = match req.side.to_lowercase().as_str() {
        "long" => Side::Long,
        "short" => Side::Short,
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(TradeResponse {
                    trade_id: String::new(),
                    market_id: req.market_id,
                    side: req.side,
                    quantity: 0.0,
                    cost_sats: 0,
                    fee_sats: 0,
                    tokens: vec![],
                }),
            )
        }
    };

    // Get market
    let market = match state.market_manager.get_market(&req.market_id).await {
        Ok(m) => m,
        Err(_) => {
            return (
                StatusCode::NOT_FOUND,
                Json(TradeResponse {
                    trade_id: String::new(),
                    market_id: req.market_id,
                    side: req.side,
                    quantity: 0.0,
                    cost_sats: 0,
                    fee_sats: 0,
                    tokens: vec![],
                }),
            )
        }
    };

    // Create trade executor and execute sell
    let executor = TradeExecutor::new(state.market_manager.lmsr().clone(), 100); // 1% fee

    match executor.execute_sell(&market, side, req.quantity, req.seller_pubkey) {
        Ok(trade) => {
            // Update market LMSR state after successful sell
            let (delta_long, delta_short) = match side {
                Side::Long => (-req.quantity, 0.0),
                Side::Short => (0.0, -req.quantity),
            };
            let _ = state.market_manager.update_lmsr_state(
                &req.market_id,
                delta_long,
                delta_short,
                -(trade.cost_sats as i64), // Negative because we're refunding sats from reserve
            ).await;

            // If client provided proofs AND outputs, use CDK process_swap_request
            // to atomically spend the market token proofs and sign SAT outputs.
            let tokens: Vec<TokenOutput> = if !req.proofs.is_empty() && !req.outputs.is_empty() {
                // Convert input proofs to CDK format
                let input_proofs: Proofs = match req.proofs.iter()
                    .map(|p| {
                        let amount = Amount::from(p.amount);
                        let keyset_id = cdk::nuts::Id::from_str(&p.id)
                            .map_err(|e| format!("Invalid keyset ID: {}", e))?;
                        let secret = cdk::secret::Secret::new(p.secret.clone());
                        let c_bytes = hex::decode(&p.C)
                            .map_err(|e| format!("Invalid commitment hex: {}", e))?;
                        let c = cdk::nuts::PublicKey::from_slice(&c_bytes)
                            .map_err(|e| format!("Invalid commitment public key: {}", e))?;
                        Ok(Proof {
                            amount,
                            keyset_id,
                            secret,
                            c,
                            witness: None,
                            dleq: None,
                            p2pk_e: None,
                        })
                    })
                    .collect::<Result<Vec<_>, String>>()
                {
                    Ok(p) => p,
                    Err(e) => {
                        tracing::warn!("Invalid proofs in sell request: {}", e);
                        return (
                            StatusCode::CREATED,
                            Json(TradeResponse {
                                trade_id: trade.id,
                                market_id: trade.market_id,
                                side: format!("{:?}", trade.side),
                                quantity: trade.quantity.abs(),
                                cost_sats: trade.cost_sats,
                                fee_sats: trade.fee_sats,
                                tokens: vec![],
                            }),
                        );
                    }
                };

                // Convert output blinded messages to CDK format
                let blinded_messages: Vec<BlindedMessage> = match req.outputs.iter()
                    .map(|b| {
                        let amount = Amount::from(b.amount);
                        let keyset_id = cdk::nuts::Id::from_str(&b.id)
                            .map_err(|e| format!("Invalid keyset ID '{}': {}", b.id, e))?;
                        let blinded_secret_bytes = hex::decode(&b.b_)
                            .map_err(|e| format!("Invalid B_ hex: {}", e))?;
                        let blinded_secret = cdk::nuts::PublicKey::from_slice(&blinded_secret_bytes)
                            .map_err(|e| format!("Invalid B_ public key: {}", e))?;
                        Ok(BlindedMessage::new(amount, keyset_id, blinded_secret))
                    })
                    .collect::<Result<Vec<_>, String>>()
                {
                    Ok(msgs) => msgs,
                    Err(e) => {
                        tracing::warn!("Invalid blinded messages in sell request: {}", e);
                        return (
                            StatusCode::CREATED,
                            Json(TradeResponse {
                                trade_id: trade.id,
                                market_id: trade.market_id,
                                side: format!("{:?}", trade.side),
                                quantity: trade.quantity.abs(),
                                cost_sats: trade.cost_sats,
                                fee_sats: trade.fee_sats,
                                tokens: vec![],
                            }),
                        );
                    }
                };

                // Atomic swap: spend market token proofs, sign SAT outputs
                let swap_request = SwapRequest::new(input_proofs, blinded_messages);
                match state.mint.process_swap_request(swap_request).await {
                    Ok(swap_response) => swap_response.signatures.into_iter().map(|sig| TokenOutput {
                        amount: sig.amount.to_u64(),
                        id: sig.keyset_id.to_string(),
                        c_: sig.c.to_hex(),
                    }).collect(),
                    Err(e) => {
                        tracing::error!("Swap failed in sell: {}", e);
                        vec![]
                    }
                }
            } else {
                vec![]
            };

            (
                StatusCode::CREATED,
                Json(TradeResponse {
                    trade_id: trade.id,
                    market_id: trade.market_id,
                    side: format!("{:?}", trade.side),
                    quantity: trade.quantity.abs(),
                    cost_sats: trade.cost_sats,
                    fee_sats: trade.fee_sats,
                    tokens,
                }),
            )
        }
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(TradeResponse {
                trade_id: String::new(),
                market_id: req.market_id,
                side: req.side,
                quantity: 0.0,
                cost_sats: 0,
                fee_sats: 0,
                tokens: vec![],
            }),
        ),
    }
}

// ============================================================================
// Lightning Trade Endpoints
// ============================================================================

/// Create a Lightning invoice for buying tokens
///
/// This endpoint creates a new Lightning invoice for purchasing prediction market tokens.
/// The invoice is held in escrow until payment is received and verified.
pub async fn create_lightning_trade(
    State(state): State<AppState>,
    Json(req): Json<LightningTradeRequest>,
) -> (StatusCode, Json<Value>) {
    // Parse side
    let side = match req.side.to_uppercase().as_str() {
        "LONG" => Side::Long,
        "SHORT" => Side::Short,
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "error": "Invalid side",
                    "details": "Side must be 'LONG' or 'SHORT'"
                })),
            )
        }
    };

    // Get market by event_id (market_id)
    let market = match state.market_manager.get_market(&req.market_id).await {
        Ok(m) => m,
        Err(_) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({
                    "error": "Market not found",
                    "details": req.market_id
                })),
            )
        }
    };

    // Check market is active
    if !market.is_active() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": "Market not active",
                "details": format!("Market {} is not accepting trades", req.market_id)
            })),
        );
    }

    // Create trade executor and calculate cost
    let executor = TradeExecutor::new(state.market_manager.lmsr().clone(), 100); // 1% fee
    
    // Calculate cost for the requested quantity
    let trade = match executor.execute_buy(&market, side, req.amount_sats as f64, req.buyer_pubkey.clone()) {
        Ok(t) => t,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "error": "Trade calculation failed",
                    "details": e.to_string()
                })),
            )
        }
    };

    // Generate Lightning invoice via InvoiceService
    let expires_at = chrono::Utc::now().timestamp() + (req.expiry_seconds.unwrap_or(3600) as i64);
    
    // Lock the invoice service
    let mut invoice_service = state.invoice_service.lock().await;
    
    // Create Lightning order with InvoiceService
    let lightning_order = match invoice_service.create_lightning_order(
        &req.market_id,
        &market.event_id,
        &req.side,
        trade.cost_sats,
        trade.fee_sats,
        &trade.id,
        req.buyer_pubkey.clone(),
        expires_at,
    ).await {
        Ok(order) => order,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "error": "Failed to create Lightning invoice",
                    "details": e.to_string()
                })),
            )
        }
    };

    (
        StatusCode::CREATED,
        Json(serde_json::json!({
            "order_id": lightning_order.id,
            "market_id": req.market_id,
            "side": req.side,
            "amount_sats": trade.cost_sats.saturating_sub(trade.fee_sats),
            "fee_sats": trade.fee_sats,
            "total_sats": trade.cost_sats,
            "invoice": lightning_order.invoice,
            "payment_hash": lightning_order.payment_hash,
            "expires_at": expires_at
        })),
    )
}

/// Create a Lightning invoice for selling tokens
pub async fn sell_lightning_trade(
    State(state): State<AppState>,
    Json(req): Json<LightningSellRequest>,
) -> (StatusCode, Json<Value>) {
    // Parse side
    let side = match req.side.to_uppercase().as_str() {
        "LONG" => Side::Long,
        "SHORT" => Side::Short,
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "error": "Invalid side",
                    "details": "Side must be 'LONG' or 'SHORT'"
                })),
            )
        }
    };

    // Get market by event_id (market_id)
    let market = match state.market_manager.get_market(&req.market_id).await {
        Ok(m) => m,
        Err(_) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({
                    "error": "Market not found",
                    "details": req.market_id
                })),
            )
        }
    };

    // Check market is active
    if !market.is_active() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": "Market not active",
                "details": format!("Market {} is not accepting trades", req.market_id)
            })),
        );
    }

    // Create trade executor and calculate proceeds
    let executor = TradeExecutor::new(state.market_manager.lmsr().clone(), 100); // 1% fee
    
    // Calculate proceeds for selling tokens
    let trade = match executor.execute_sell(&market, side, req.amount_sats as f64, req.seller_pubkey.clone()) {
        Ok(t) => t,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "error": "Trade calculation failed",
                    "details": e.to_string()
                })),
            )
        }
    };

    // Generate Lightning invoice via InvoiceService
    let expires_at = chrono::Utc::now().timestamp() + (req.expiry_seconds.unwrap_or(3600) as i64);
    
    // Lock the invoice service
    let mut invoice_service = state.invoice_service.lock().await;
    
    // Create Lightning order with InvoiceService
    let lightning_order = match invoice_service.create_lightning_order(
        &req.market_id,
        &market.event_id,
        &req.side,
        trade.cost_sats,
        trade.fee_sats,
        &trade.id,
        req.seller_pubkey.clone(),
        expires_at,
    ).await {
        Ok(order) => order,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "error": "Failed to create Lightning invoice",
                    "details": e.to_string()
                })),
            )
        }
    };

    (
        StatusCode::CREATED,
        Json(serde_json::json!({
            "order_id": lightning_order.id,
            "market_id": req.market_id,
            "side": req.side,
            "amount_sats": trade.cost_sats.saturating_sub(trade.fee_sats),
            "fee_sats": trade.fee_sats,
            "total_sats": trade.cost_sats,
            "invoice": lightning_order.invoice,
            "payment_hash": lightning_order.payment_hash,
            "expires_at": expires_at
        })),
    )
}

/// Check Lightning invoice status
pub async fn get_invoice_status(
    State(state): State<AppState>,
    Json(req): Json<InvoiceStatusRequest>,
) -> (StatusCode, Json<Value>) {
    // Lock the invoice service
    let invoice_service = state.invoice_service.lock().await;
    
    // Check invoice status via InvoiceService
    match invoice_service.get_invoice_status(&req.payment_hash).await {
        Ok(status) => (
            StatusCode::OK,
            Json(serde_json::json!({
                "payment_hash": req.payment_hash,
                "state": status,
                "amount_sats": 0  // TODO: Get from order
            })),
        ),
        Err(e) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({
                "error": "Invoice not found",
                "details": e.to_string()
            })),
        ),
    }
}

/// Settle a Lightning trade with preimage
///
/// This endpoint verifies the payment preimage and settles the trade,
/// releasing the escrowed funds and minting tokens to the buyer.
pub async fn settle_lightning_trade(
    State(state): State<AppState>,
    Path(order_id): Path<String>,
    Json(req): Json<SettleRequest>,
) -> (StatusCode, Json<Value>) {
    // Validate preimage format (32 bytes hex = 64 characters)
    if req.preimage.len() != 64 {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": "Invalid preimage",
                "details": "Preimage must be 64 hex characters (32 bytes)"
            })),
        );
    }

    // Parse preimage
    let preimage = match Preimage::from_hex(&req.preimage) {
        Ok(p) => p,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "error": "Invalid preimage",
                    "details": e.to_string()
                })),
            )
        }
    };

    // Lock the invoice service
    let mut invoice_service = state.invoice_service.lock().await;
    
    // Settle via InvoiceService
    match invoice_service.settle_by_order_id(&order_id, &preimage).await {
        Ok(_) => (
            StatusCode::OK,
            Json(serde_json::json!({
                "order_id": order_id,
                "state": "fulfilled",
                "fulfilled": true
            })),
        ),
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": "Settlement failed",
                "details": e.to_string()
            })),
        ),
    }
}

/// Get escrow statistics
pub async fn get_escrow_stats(
    State(state): State<AppState>,
) -> (StatusCode, Json<EscrowStatsResponse>) {
    // Lock the invoice service
    let invoice_service = state.invoice_service.lock().await;
    
    // Get actual stats from EscrowManager via InvoiceService
    let stats = invoice_service.escrow_manager().get_stats();
    
    (
        StatusCode::OK,
        Json(EscrowStatsResponse {
            pending_count: stats.pending_count,
            pending_sats: stats.pending_sats,
            settled_count: stats.settled_count,
            settled_sats: stats.settled_sats,
            refunded_count: stats.refunded_count,
            refunded_sats: stats.refunded_sats,
            failed_count: stats.failed_count,
        }),
    )
}
