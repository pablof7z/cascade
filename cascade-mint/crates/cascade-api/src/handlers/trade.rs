//! Trade API handlers.
//!
//! Buy, sell, and payout operations.

use axum::{
    extract::State,
    http::StatusCode,
    Json,
};
use cascade_core::{lmsr::Outcome, CascadeError, Trade};

use crate::routes::AppState;
use crate::types::{
    error_codes, BuyRequest, BuyResponse, ErrorResponse, MarketPrices, PayoutRequest,
    PayoutResponse, SellRequest, SellResponse, Side,
};

/// POST /v1/cascade/trade/buy — Buy position tokens.
pub async fn buy(
    State(state): State<AppState>,
    Json(request): Json<BuyRequest>,
) -> Result<Json<BuyResponse>, (StatusCode, Json<ErrorResponse>)> {
    // Validate request
    if request.amount <= 0.0 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse::new(
                "Amount must be positive",
                error_codes::INVALID_REQUEST,
            )),
        ));
    }

    let outcome = match request.side {
        Side::Long => Outcome::Long,
        Side::Short => Outcome::Short,
    };

    // Execute the buy trade
    let result = state
        .market_manager
        .execute_buy(&request.market_slug, outcome, request.amount, "anonymous".to_string())
        .await
        .map_err(|e| map_error(e, &request.market_slug))?;

    // Create a Trade object for Nostr publishing
    let price = match outcome {
        Outcome::Long => result.new_prices.long_price,
        Outcome::Short => result.new_prices.short_price,
    };
    let trade = Trade::new(
        request.market_slug.clone(),
        outcome,
        result.amount,
        price,
        result.cost_sats,
        result.fee_sats,
        "anonymous".to_string(),
    );

    // Publish trade event to Nostr (fire and forget, don't fail the trade if this fails)
    if let Err(e) = state.nostr_publisher.publish_trade_event(&trade, &request.market_slug).await {
        tracing::warn!("Failed to publish trade event to Nostr: {}", e);
    }

    Ok(Json(BuyResponse {
        market_slug: request.market_slug,
        side: request.side,
        amount: result.amount,
        cost_sats: result.cost_sats,
        fee_sats: result.fee_sats,
        new_prices: MarketPrices {
            long_price: result.new_prices.long_price,
            short_price: result.new_prices.short_price,
            q_long: result.new_prices.q_long,
            q_short: result.new_prices.q_short,
            b: result.new_prices.b,
        },
        trade_id: result.trade_id,
    }))
}

/// POST /v1/cascade/trade/sell — Sell position tokens.
pub async fn sell(
    State(state): State<AppState>,
    Json(request): Json<SellRequest>,
) -> Result<Json<SellResponse>, (StatusCode, Json<ErrorResponse>)> {
    // Validate request
    if request.amount <= 0.0 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse::new(
                "Amount must be positive",
                error_codes::INVALID_REQUEST,
            )),
        ));
    }

    let outcome = match request.side {
        Side::Long => Outcome::Long,
        Side::Short => Outcome::Short,
    };

    // Execute the sell trade
    let result = state
        .market_manager
        .execute_sell(&request.market_slug, outcome, request.amount, "anonymous".to_string())
        .await
        .map_err(|e| map_error(e, &request.market_slug))?;

    // Get new prices after the trade
    let prices = state
        .market_manager
        .get_prices(&request.market_slug)
        .await
        .map_err(|e| map_error(e, &request.market_slug))?;

    // Create a Trade object for Nostr publishing
    let price = match outcome {
        Outcome::Long => prices.long_price,
        Outcome::Short => prices.short_price,
    };
    let trade = Trade::new(
        request.market_slug.clone(),
        outcome,
        result.amount,
        price,
        result.refund_sats,
        result.fee_sats,
        "anonymous".to_string(),
    );

    // Publish trade event to Nostr (fire and forget, don't fail the trade if this fails)
    if let Err(e) = state.nostr_publisher.publish_trade_event(&trade, &request.market_slug).await {
        tracing::warn!("Failed to publish trade event to Nostr: {}", e);
    }

    Ok(Json(SellResponse {
        market_slug: request.market_slug,
        side: request.side,
        amount: result.amount,
        refund_sats: result.refund_sats,
        fee_sats: result.fee_sats,
        new_prices: MarketPrices {
            long_price: prices.long_price,
            short_price: prices.short_price,
            q_long: prices.q_long,
            q_short: prices.q_short,
            b: prices.b,
        },
        trade_id: result.trade_id,
    }))
}

/// POST /v1/cascade/trade/payout — Redeem winning tokens after resolution.
pub async fn payout(
    State(state): State<AppState>,
    Json(request): Json<PayoutRequest>,
) -> Result<Json<PayoutResponse>, (StatusCode, Json<ErrorResponse>)> {
    // Validate request
    if request.amount <= 0.0 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse::new(
                "Amount must be positive",
                error_codes::INVALID_REQUEST,
            )),
        ));
    }

    // Get the market to verify it's resolved
    let market = state
        .market_manager
        .get_market(&request.market_slug)
        .await
        .map_err(|e| map_error(e, &request.market_slug))?;

    let market = match market {
        Some(m) => m,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(ErrorResponse::new(
                    format!("Market not found: {}", request.market_slug),
                    error_codes::MARKET_NOT_FOUND,
                )),
            ));
        }
    };

    // Verify market is resolved
    if !market.is_resolved() {
        return Err((
            StatusCode::CONFLICT,
            Json(ErrorResponse::new(
                "Market is not resolved yet",
                error_codes::MARKET_NOT_ACTIVE,
            )),
        ));
    }

    // Calculate payout at 1:1 ratio for winning side
    let payout_sats = request.amount as u64;

    Ok(Json(PayoutResponse {
        market_slug: request.market_slug,
        payout_sats,
    }))
}

/// Map CascadeError to HTTP status code and ErrorResponse.
fn map_error(e: CascadeError, slug: &str) -> (StatusCode, Json<ErrorResponse>) {
    match e {
        CascadeError::MarketNotFound { .. } => (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse::new(
                format!("Market not found: {}", slug),
                error_codes::MARKET_NOT_FOUND,
            )
            .with_detail("The market slug does not exist")),
        ),
        CascadeError::MarketNotActive { status, .. } => (
            StatusCode::CONFLICT,
            Json(ErrorResponse::new(
                format!("Market is not active: {:?}", status),
                error_codes::MARKET_NOT_ACTIVE,
            )
            .with_detail("Trading is only allowed on open markets")),
        ),
        CascadeError::InvalidTrade { reason } => (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse::new("Invalid trade", error_codes::INVALID_REQUEST).with_detail(reason)),
        ),
        CascadeError::InvalidInput { reason } => (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse::new("Invalid input", error_codes::INVALID_REQUEST).with_detail(reason)),
        ),
        CascadeError::InsufficientFunds { reason } => (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse::new("Insufficient funds", error_codes::INSUFFICIENT_FUNDS).with_detail(reason)),
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
