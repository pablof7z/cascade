use std::str::FromStr;
use std::sync::Arc;

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use cdk::error::{Error as CdkError, ErrorResponse};
use cdk::mint::Mint;
use cdk::nuts::{CurrencyUnit, Id, KeySet, KeySetInfo, KeysResponse, KeysetResponse};

use crate::routes::AppState;

fn is_market_unit(unit: &CurrencyUnit) -> bool {
    match unit {
        CurrencyUnit::Custom(value) => {
            let lowered = value.to_ascii_lowercase();
            lowered.starts_with("long_") || lowered.starts_with("short_")
        }
        _ => false,
    }
}

fn is_wallet_public_unit(unit: &CurrencyUnit) -> bool {
    matches!(unit, CurrencyUnit::Usd)
}

fn wallet_visible_keysets(mint: &Arc<Mint>) -> Vec<KeySetInfo> {
    mint.keysets()
        .keysets
        .into_iter()
        .filter(|keyset| is_wallet_public_unit(&keyset.unit) && !is_market_unit(&keyset.unit))
        .collect()
}

fn wallet_visible_pubkeys(mint: &Arc<Mint>) -> Vec<KeySet> {
    mint.pubkeys()
        .keysets
        .into_iter()
        .filter(|keyset| is_wallet_public_unit(&keyset.unit) && !is_market_unit(&keyset.unit))
        .collect()
}

fn wallet_visible_keyset_ids(mint: &Arc<Mint>) -> Vec<Id> {
    wallet_visible_keysets(mint)
        .into_iter()
        .map(|keyset| keyset.id)
        .collect()
}

fn cdk_bad_request(error: CdkError) -> Response {
    (StatusCode::BAD_REQUEST, Json(ErrorResponse::from(error))).into_response()
}

pub async fn get_wallet_keys(
    State(state): State<AppState>,
) -> Result<Json<KeysResponse>, Response> {
    Ok(Json(KeysResponse {
        keysets: wallet_visible_pubkeys(&state.mint),
    }))
}

pub async fn get_wallet_keysets(
    State(state): State<AppState>,
) -> Result<Json<KeysetResponse>, Response> {
    Ok(Json(KeysetResponse {
        keysets: wallet_visible_keysets(&state.mint),
    }))
}

pub async fn get_wallet_keyset_pubkeys(
    State(state): State<AppState>,
    Path(keyset_id): Path<String>,
) -> Result<Json<KeysResponse>, Response> {
    let id = Id::from_str(&keyset_id).map_err(|_| cdk_bad_request(CdkError::UnknownKeySet))?;
    let allowed = wallet_visible_keyset_ids(&state.mint)
        .into_iter()
        .any(|candidate| candidate == id);

    if !allowed {
        return Err(cdk_bad_request(CdkError::UnknownKeySet));
    }

    let pubkeys = state.mint.keyset_pubkeys(&id).map_err(cdk_bad_request)?;

    Ok(Json(pubkeys))
}
