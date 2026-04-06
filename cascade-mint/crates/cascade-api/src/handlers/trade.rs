//! Trade execution handlers

use axum::{
    extract::{State, Json},
    http::StatusCode,
};
use std::sync::Arc;
use cascade_core::{MarketManager, market::Side, trade::TradeExecutor, lmsr::LmsrEngine};
use crate::types::{BuyRequest, SellRequest, TradeResponse};

/// Execute a buy order
pub async fn buy(
    State(market_manager): State<Arc<MarketManager>>,
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
    let market = match market_manager.get_market(&req.market_id).await {
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
    let executor = TradeExecutor::new(market_manager.lmsr().clone(), 100); // 1% fee
    
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
    State(market_manager): State<Arc<MarketManager>>,
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
    let market = match market_manager.get_market(&req.market_id).await {
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
    let executor = TradeExecutor::new(market_manager.lmsr().clone(), 100); // 1% fee

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
