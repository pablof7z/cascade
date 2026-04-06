//! Trade execution handlers

use axum::{
    extract::{Path, State, Json},
    http::StatusCode,
};
use serde_json::Value;
use cascade_core::{market::Side, trade::TradeExecutor, Preimage};
use crate::types::{
    BuyRequest, SellRequest, TradeResponse, LightningTradeRequest,
    InvoiceStatusRequest, SettleRequest, EscrowStatsResponse, LightningSellRequest,
};
use crate::routes::AppState;

/// Execute a buy order
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
                }),
            )
        }
    };

    // Create trade executor and execute buy
    let executor = TradeExecutor::new(state.market_manager.lmsr().clone(), 100); // 1% fee
    
    match executor.execute_buy(&market, side, req.quantity, req.buyer_pubkey) {
        Ok(trade) => (
            StatusCode::CREATED,
            Json(TradeResponse {
                trade_id: trade.id,
                market_id: trade.market_id,
                side: format!("{:?}", trade.side),
                quantity: trade.quantity,
                cost_sats: trade.cost_sats,
                fee_sats: trade.fee_sats,
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(TradeResponse {
                trade_id: String::new(),
                market_id: req.market_id,
                side: req.side,
                quantity: 0.0,
                cost_sats: 0,
                fee_sats: 0,
            }),
        ),
    }
}

/// Execute a sell order
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
                }),
            )
        }
    };

    // Create trade executor and execute sell
    let executor = TradeExecutor::new(state.market_manager.lmsr().clone(), 100); // 1% fee

    match executor.execute_sell(&market, side, req.quantity, req.seller_pubkey) {
        Ok(trade) => (
            StatusCode::CREATED,
            Json(TradeResponse {
                trade_id: trade.id,
                market_id: trade.market_id,
                side: format!("{:?}", trade.side),
                quantity: trade.quantity.abs(),
                cost_sats: trade.cost_sats,
                fee_sats: trade.fee_sats,
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(TradeResponse {
                trade_id: String::new(),
                market_id: req.market_id,
                side: req.side,
                quantity: 0.0,
                cost_sats: 0,
                fee_sats: 0,
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
