//! Market API handlers.
//!
//! CRUD operations for markets.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use cascade_core::CascadeError;

use crate::routes::AppState;
use crate::types::{
    error_codes, CreateMarketRequest, ErrorResponse, ListMarketsParams, MarketKeysets,
    MarketListResponse, MarketResponse, MarketPrices,
};

/// POST /v1/cascade/markets — Create a new prediction market.
pub async fn create_market(
    State(state): State<AppState>,
    Json(request): Json<CreateMarketRequest>,
) -> Result<(StatusCode, Json<MarketResponse>), (StatusCode, Json<ErrorResponse>)> {
    // Validate request
    if request.slug.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse::new(
                "Slug cannot be empty",
                error_codes::INVALID_REQUEST,
            )),
        ));
    }

    if request.title.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse::new(
                "Title cannot be empty",
                error_codes::INVALID_REQUEST,
            )),
        ));
    }

    if request.initial_reserve_sats < 1000 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse::new(
                "Initial reserve must be at least 1000 sats",
                error_codes::INVALID_REQUEST,
            )),
        ));
    }

    let market = if let Some(b) = request.b {
        state
            .market_manager
            .create_market_with_params(
                request.slug.clone(),
                request.title.clone(),
                request.description.clone(),
                request.mint.clone(),
                request.creator_pubkey.clone(),
                b,
                request.initial_reserve_sats,
            )
            .await
    } else {
        state
            .market_manager
            .create_market(
                request.slug.clone(),
                request.title.clone(),
                request.description.clone(),
                request.mint.clone(),
                request.creator_pubkey.clone(),
            )
            .await
    };

    match market {
        Ok(market) => {
            let response = build_market_response(&market);
            Ok((StatusCode::CREATED, Json(response)))
        }
        Err(e) => Err(map_error(e, &request.slug)),
    }
}

/// GET /v1/cascade/markets — List all markets.
pub async fn list_markets(
    State(state): State<AppState>,
    Query(params): Query<ListMarketsParams>,
) -> Result<Json<MarketListResponse>, (StatusCode, Json<ErrorResponse>)> {
    let markets = match params.status.as_deref() {
        Some("open") => state.market_manager.get_open_markets().await,
        Some(_) | None => state.market_manager.get_all_markets().await,
    };

    let markets = markets.map_err(|e| map_error_generic(e))?;

    let response = MarketListResponse {
        markets: markets.iter().map(build_market_response).collect(),
    };

    Ok(Json(response))
}

/// GET /v1/cascade/markets/:slug — Get a single market.
pub async fn get_market(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<MarketResponse>, (StatusCode, Json<ErrorResponse>)> {
    let market = state
        .market_manager
        .get_market(&slug)
        .await
        .map_err(|e| map_error(e, &slug))?;

    match market {
        Some(market) => Ok(Json(build_market_response(&market))),
        None => Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse::new(
                format!("Market not found: {}", slug),
                error_codes::MARKET_NOT_FOUND,
            )),
        )),
    }
}

/// Build a MarketResponse from a Market.
fn build_market_response(market: &cascade_core::Market) -> MarketResponse {
    let prices = market.long_price();
    let short_prices = market.short_price();

    MarketResponse {
        event_id: market.event_id.clone(),
        slug: market.slug.clone(),
        title: market.title.clone(),
        description: market.description.clone(),
        status: market.status.to_string(),
        prices: MarketPrices {
            long_price: prices,
            short_price: short_prices,
            q_long: market.q_long,
            q_short: market.q_short,
            b: market.b,
        },
        reserve_sats: market.reserve_sats,
        keysets: build_market_keysets(&market.slug),
        created_at: market.created_at.timestamp(),
        end_date: market.end_date.map(|d| d.timestamp()),
        outcome: market.outcome,
    }
}

/// Build keyset information for a market.
///
/// In a full implementation, this would query the CDK Mint for actual keyset IDs.
/// For now, we derive them from the market slug.
fn build_market_keysets(slug: &str) -> MarketKeysets {
    let slug_normalized = slug.replace(['/', '-', ' '], "_");
    MarketKeysets {
        long_keyset_id: format!("long_{}", slug_normalized),
        long_unit: format!("LONG_{}", slug_normalized),
        short_keyset_id: format!("short_{}", slug_normalized),
        short_unit: format!("SHORT_{}", slug_normalized),
    }
}

/// Map CascadeError to HTTP status code and ErrorResponse.
fn map_error(e: CascadeError, _slug: &str) -> (StatusCode, Json<ErrorResponse>) {
    match e {
        CascadeError::MarketNotFound { slug } => (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse::new(
                format!("Market not found: {}", slug),
                error_codes::MARKET_NOT_FOUND,
            )),
        ),
        CascadeError::InvalidInput { reason } => (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse::new(
                "Invalid request",
                error_codes::INVALID_REQUEST,
            )
            .with_detail(&reason)),
        ),
        CascadeError::MarketNotActive { status, .. } => (
            StatusCode::CONFLICT,
            Json(ErrorResponse::new(
                format!("Market is not active: {:?}", status),
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

/// Map generic CascadeError to HTTP status code.
fn map_error_generic(_e: CascadeError) -> (StatusCode, Json<ErrorResponse>) {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(ErrorResponse::new(
            "Internal server error",
            error_codes::INTERNAL_ERROR,
        )),
    )
}
