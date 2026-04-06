//! Price API handlers.
//!
//! Read-only endpoints for getting market prices and quotes.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use cascade_core::lmsr::Outcome;

use crate::routes::AppState;
use crate::types::{
    error_codes, ErrorResponse, PriceResponse, QuoteRequest, QuoteResponse, Side, TradeDirection,
};

/// GET /v1/cascade/price/:slug — Get current market prices.
pub async fn get_prices(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<PriceResponse>, (StatusCode, Json<ErrorResponse>)> {
    let prices = state
        .market_manager
        .get_prices(&slug)
        .await
        .map_err(|e| map_error(e, &slug))?;

    Ok(Json(PriceResponse {
        market_slug: slug,
        prices: crate::types::MarketPrices {
            long_price: prices.long_price,
            short_price: prices.short_price,
            q_long: prices.q_long,
            q_short: prices.q_short,
            b: prices.b,
        },
    }))
}

/// POST /v1/cascade/price/:slug/quote — Get a quote for a hypothetical trade.
pub async fn get_quote(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    Json(request): Json<QuoteRequest>,
) -> Result<Json<QuoteResponse>, (StatusCode, Json<ErrorResponse>)> {
    let outcome = match request.side {
        Side::Long => Outcome::Long,
        Side::Short => Outcome::Short,
    };

    // Get current prices before the trade
    let prices_before = state
        .market_manager
        .get_prices(&slug)
        .await
        .map_err(|e| map_error(e, &slug))?;

    let price_before = match outcome {
        Outcome::Long => prices_before.long_price,
        Outcome::Short => prices_before.short_price,
    };

    match request.direction {
        TradeDirection::Buy => {
            let cost = state
                .market_manager
                .calculate_buy_cost(&slug, outcome, request.amount)
                .await
                .map_err(|e| map_error(e, &slug))?;

            // Get prices after hypothetical trade
            let prices_after = state
                .market_manager
                .get_prices(&slug)
                .await
                .map_err(|e| map_error(e, &slug))?;

            let price_after = match outcome {
                Outcome::Long => prices_after.long_price,
                Outcome::Short => prices_after.short_price,
            };

            Ok(Json(QuoteResponse {
                market_slug: slug,
                side: request.side,
                direction: TradeDirection::Buy,
                amount: request.amount,
                cost_or_refund_sats: cost.cost_sats,
                fee_sats: cost.fee_sats,
                total_sats: cost.total_sats,
                price_before,
                price_after,
            }))
        }
        TradeDirection::Sell => {
            let refund = state
                .market_manager
                .calculate_sell_refund(&slug, outcome, request.amount)
                .await
                .map_err(|e| map_error(e, &slug))?;

            Ok(Json(QuoteResponse {
                market_slug: slug,
                side: request.side,
                direction: TradeDirection::Sell,
                amount: request.amount,
                cost_or_refund_sats: refund.refund_sats,
                fee_sats: 0, // Sell fees are typically lower or zero
                total_sats: refund.refund_sats,
                price_before,
                price_after: price_before, // Price doesn't change from sells
            }))
        }
    }
}

/// Map CascadeError to HTTP status code and ErrorResponse.
fn map_error(e: cascade_core::CascadeError, slug: &str) -> (StatusCode, Json<ErrorResponse>) {
    use cascade_core::CascadeError;

    match e {
        CascadeError::MarketNotFound { .. } => (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse::new(
                format!("Market not found: {}", slug),
                error_codes::MARKET_NOT_FOUND,
            )),
        ),
        CascadeError::MarketNotActive { status, .. } => (
            StatusCode::CONFLICT,
            Json(ErrorResponse::new(
                format!("Market is not active: {:?}", status),
                error_codes::MARKET_NOT_ACTIVE,
            )),
        ),
        CascadeError::InvalidInput { reason } => (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse::new("Invalid request", error_codes::INVALID_REQUEST).with_detail(&reason)),
        ),
        CascadeError::InvalidTrade { reason } => (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse::new("Invalid trade", error_codes::INVALID_REQUEST).with_detail(&reason)),
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
