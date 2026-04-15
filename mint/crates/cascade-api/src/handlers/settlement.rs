//! Market-scoped key discovery handlers.

use crate::routes::AppState;
use crate::types::{
    ErrorResponse, KeysetPublicKeyResponse, MarketKeysetResponse, MarketMintKeysResponse,
};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use cdk::util::hex;

/// GET /{event_id}/v1/keys - Get the market's LONG and SHORT keysets.
/// Uses the kind 982 event id as the canonical path segment.
pub async fn get_market_keys(
    State(state): State<AppState>,
    Path(event_id): Path<String>,
) -> Result<Json<MarketMintKeysResponse>, (StatusCode, Json<ErrorResponse>)> {
    let market = match state.get_market_by_event_id(&event_id).await {
        Some(market) => market,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: "Market not found".to_string(),
                    details: Some(event_id),
                }),
            ));
        }
    };

    let keysets_response = state.mint.keysets();
    let pubkeys_response = state.mint.pubkeys();
    let build_market_keyset =
        |market_keyset_id: &str, outcome: &str| -> Option<MarketKeysetResponse> {
            let keyset = keysets_response
                .keysets
                .iter()
                .find(|keyset| keyset.id.to_string() == market_keyset_id)?;

            let mut keys = std::collections::BTreeMap::new();
            if let Some(pubkey_set) = pubkeys_response.keysets.iter().find(|p| p.id == keyset.id) {
                for (amount, key) in pubkey_set.keys.iter() {
                    keys.insert(
                        amount.to_string(),
                        KeysetPublicKeyResponse {
                            pubkey: hex::encode(key.to_bytes()),
                        },
                    );
                }
            }

            Some(MarketKeysetResponse {
                id: keyset.id.to_string(),
                unit: keyset.unit.to_string(),
                outcome: outcome.to_string(),
                keys,
            })
        };

    let long_keyset = match build_market_keyset(&market.long_keyset_id, "long") {
        Some(keyset) => keyset,
        None => {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Market LONG keyset is not active on the mint".to_string(),
                    details: Some(market.long_keyset_id),
                }),
            ));
        }
    };

    let short_keyset = match build_market_keyset(&market.short_keyset_id, "short") {
        Some(keyset) => keyset,
        None => {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Market SHORT keyset is not active on the mint".to_string(),
                    details: Some(market.short_keyset_id),
                }),
            ));
        }
    };

    Ok(Json(MarketMintKeysResponse {
        market_id: market.event_id,
        long_keyset,
        short_keyset,
    }))
}
