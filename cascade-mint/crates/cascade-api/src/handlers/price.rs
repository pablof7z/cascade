//! Price and quote handlers

use axum::{
    extract::{Path, State, Json},
    http::StatusCode,
};
use cascade_core::market::Side;
use crate::types::{PriceResponse, QuoteRequest, QuoteResponse};
use crate::routes::AppState;

/// Get current prices for a market
pub async fn get_prices(
    State(state): State<AppState>,
    Path(market_id): Path<String>,
) -> (StatusCode, Json<PriceResponse>) {
    match state.market_manager.get_market(&market_id).await {
        Ok(market) => {
            let lmsr = state.market_manager.lmsr();
            match lmsr.get_prices(market.q_long, market.q_short) {
                Ok((price_long, price_short)) => (
                    StatusCode::OK,
                    Json(PriceResponse {
                        market_id,
                        price_long,
                        price_short,
                        q_long: market.q_long,
                        q_short: market.q_short,
                    }),
                ),
                Err(_) => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(PriceResponse {
                        market_id,
                        price_long: 0.0,
                        price_short: 0.0,
                        q_long: market.q_long,
                        q_short: market.q_short,
                    }),
                ),
            }
        }
        Err(_) => (
            StatusCode::NOT_FOUND,
            Json(PriceResponse {
                market_id,
                price_long: 0.0,
                price_short: 0.0,
                q_long: 0.0,
                q_short: 0.0,
            }),
        ),
    }
}

/// Get a price quote for a hypothetical trade
pub async fn quote(
    State(state): State<AppState>,
    Json(req): Json<QuoteRequest>,
) -> (StatusCode, Json<QuoteResponse>) {
    // Parse side
    let side = match req.side.to_lowercase().as_str() {
        "long" => Side::Long,
        "short" => Side::Short,
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(QuoteResponse {
                    market_id: req.market_id,
                    side: req.side,
                    quantity: 0.0,
                    cost_sats: 0,
                    price: 0.0,
                }),
            )
        }
    };

    match state.market_manager.get_market(&req.market_id).await {
        Ok(market) => {
            let lmsr = state.market_manager.lmsr();
            
            // Get quantities for the specified side
            let (q_main, q_other) = match side {
                Side::Long => (market.q_long, market.q_short),
                Side::Short => (market.q_short, market.q_long),
            };

            // Calculate cost
            let cost = match lmsr.calculate_buy_cost(q_main, q_other, req.quantity) {
                Ok(c) => c,
                Err(_) => {
                    return (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(QuoteResponse {
                            market_id: req.market_id,
                            side: req.side,
                            quantity: req.quantity,
                            cost_sats: 0,
                            price: 0.0,
                        }),
                    )
                }
            };

            let price = (cost as f64) / req.quantity;

            (
                StatusCode::OK,
                Json(QuoteResponse {
                    market_id: req.market_id,
                    side: req.side,
                    quantity: req.quantity,
                    cost_sats: cost,
                    price,
                }),
            )
        }
        Err(_) => (
            StatusCode::NOT_FOUND,
            Json(QuoteResponse {
                market_id: req.market_id,
                side: req.side,
                quantity: 0.0,
                cost_sats: 0,
                price: 0.0,
            }),
        ),
    }
}
