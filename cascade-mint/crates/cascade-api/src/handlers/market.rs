//! Market management handlers

use axum::{
    extract::{Path, State, Json},
    http::StatusCode,
};
use std::sync::Arc;
use cascade_core::MarketManager;
use crate::types::{CreateMarketRequest, MarketResponse, MarketsListResponse};

/// List all markets
pub async fn list_markets(
    State(market_manager): State<Arc<MarketManager>>,
) -> (StatusCode, Json<MarketsListResponse>) {
    match market_manager.list_markets().await {
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
    State(market_manager): State<Arc<MarketManager>>,
    Json(req): Json<CreateMarketRequest>,
) -> (StatusCode, Json<MarketResponse>) {
    let event_id = uuid::Uuid::new_v4().to_string();
    
    match market_manager
        .create_market(
            event_id.clone(),
            req.slug,
            req.title,
            req.description,
            req.b,
            "creator".to_string(), // TODO: Get from auth
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
            }),
        ),
    }
}

/// Get a specific market
pub async fn get_market(
    State(market_manager): State<Arc<MarketManager>>,
    Path(market_id): Path<String>,
) -> (StatusCode, Json<MarketResponse>) {
    match market_manager.get_market(&market_id).await {
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
            }),
        ),
    }
}
