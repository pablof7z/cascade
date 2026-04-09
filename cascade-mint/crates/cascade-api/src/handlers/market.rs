//! Market management handlers

use axum::{
    extract::{Path, State, Json},
    http::StatusCode,
};
use crate::types::{CreateMarketRequest, MarketResponse, MarketsListResponse};
use crate::routes::AppState;

/// List all markets
pub async fn list_markets(
    State(state): State<AppState>,
) -> (StatusCode, Json<MarketsListResponse>) {
    match state.market_manager.list_markets().await {
        Ok(markets) => {
            let market_responses = markets
                .into_iter()
                .map(|m| MarketResponse {
                    event_id: m.event_id,
                    slug: m.slug,
                    title: m.title,
                    description: m.description,
                    b: m.b,
                    q_long: m.q_long,
                    q_short: m.q_short,
                    status: format!("{:?}", m.status),
                    long_keyset_id: m.long_keyset_id,
                    short_keyset_id: m.short_keyset_id,
                    reserve: m.reserve_sats,
                })
                .collect();

            (
                StatusCode::OK,
                Json(MarketsListResponse {
                    markets: market_responses,
                }),
            )
        }
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(MarketsListResponse { markets: vec![] }),
        ),
    }
}

/// Create a new market
pub async fn create_market(
    State(state): State<AppState>,
    Json(req): Json<CreateMarketRequest>,
) -> (StatusCode, Json<MarketResponse>) {
    let event_id = uuid::Uuid::new_v4().to_string();

    // Standard denomination set for market share tokens
    let denominations: Vec<u64> = vec![1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192];

    // Register a dedicated LONG keyset for this market via CDK rotate_keyset
    let long_keyset_id = match state.mint.rotate_keyset(
        cdk::nuts::CurrencyUnit::Custom(format!("LONG_{}", req.slug)),
        denominations.clone(),
        0,
        false,
        None,
    ).await {
        Ok(info) => info.id.to_string(),
        Err(e) => {
            tracing::error!("Failed to create LONG keyset for market {}: {}", req.slug, e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(MarketResponse {
                    event_id,
                    slug: String::new(),
                    title: String::new(),
                    description: String::new(),
                    b: 0.0,
                    q_long: 0.0,
                    q_short: 0.0,
                    status: "error".to_string(),
                    long_keyset_id: String::new(),
                    short_keyset_id: String::new(),
                    reserve: 0,
                }),
            );
        }
    };

    // Register a dedicated SHORT keyset for this market via CDK rotate_keyset
    let short_keyset_id = match state.mint.rotate_keyset(
        cdk::nuts::CurrencyUnit::Custom(format!("SHORT_{}", req.slug)),
        denominations,
        0,
        false,
        None,
    ).await {
        Ok(info) => info.id.to_string(),
        Err(e) => {
            tracing::error!("Failed to create SHORT keyset for market {}: {}", req.slug, e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(MarketResponse {
                    event_id,
                    slug: String::new(),
                    title: String::new(),
                    description: String::new(),
                    b: 0.0,
                    q_long: 0.0,
                    q_short: 0.0,
                    status: "error".to_string(),
                    long_keyset_id: String::new(),
                    short_keyset_id: String::new(),
                    reserve: 0,
                }),
            );
        }
    };

    match state.market_manager
        .create_market(
            event_id.clone(),
            req.slug,
            req.title,
            req.description,
            req.b,
            "creator".to_string(), // TODO: Get from auth
            long_keyset_id,
            short_keyset_id,
        )
        .await
    {
        Ok(market) => (
            StatusCode::CREATED,
            Json(MarketResponse {
                event_id: market.event_id,
                slug: market.slug,
                title: market.title,
                description: market.description,
                b: market.b,
                q_long: market.q_long,
                q_short: market.q_short,
                status: format!("{:?}", market.status),
                long_keyset_id: market.long_keyset_id,
                short_keyset_id: market.short_keyset_id,
                reserve: market.reserve_sats,
            }),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(MarketResponse {
                event_id,
                slug: String::new(),
                title: String::new(),
                description: String::new(),
                b: 0.0,
                q_long: 0.0,
                q_short: 0.0,
                status: "error".to_string(),
                long_keyset_id: String::new(),
                short_keyset_id: String::new(),
                reserve: 0,
            }),
        ),
    }
}

/// Get a specific market
pub async fn get_market(
    State(state): State<AppState>,
    Path(market_id): Path<String>,
) -> (StatusCode, Json<MarketResponse>) {
    match state.market_manager.get_market(&market_id).await {
        Ok(market) => (
            StatusCode::OK,
            Json(MarketResponse {
                event_id: market.event_id,
                slug: market.slug,
                title: market.title,
                description: market.description,
                b: market.b,
                q_long: market.q_long,
                q_short: market.q_short,
                status: format!("{:?}", market.status),
                long_keyset_id: market.long_keyset_id,
                short_keyset_id: market.short_keyset_id,
                reserve: market.reserve_sats,
            }),
        ),
        Err(_) => (
            StatusCode::NOT_FOUND,
            Json(MarketResponse {
                event_id: market_id,
                slug: String::new(),
                title: String::new(),
                description: String::new(),
                b: 0.0,
                q_long: 0.0,
                q_short: 0.0,
                status: "not_found".to_string(),
                long_keyset_id: String::new(),
                short_keyset_id: String::new(),
                reserve: 0,
            }),
        ),
    }
}
