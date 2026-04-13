//! API Integration Tests for Cascade Cashu Mint
//!
//! Tests that verify the Cashu API endpoints work correctly.
//! These tests start a local server and make HTTP requests to it.

use axum::Router;
use cdk::amount::{FeeAndAmounts, SplitTarget};
use cdk::dhke::construct_proofs;
use cdk::mint::{MintBuilder, MintMeltLimits, UnitConfig};
use cdk::nuts::{BlindSignature, CurrencyUnit, KeySet, KeysResponse, PreMintSecrets, Proof};
use cdk::Amount;
use cdk_common::nut00::KnownMethod;
use cdk_common::nuts::PaymentMethod;
use cdk_common::Bolt11Invoice;
use hmac::{Hmac, Mac};
use serde_json::{json, Value};
use sha2::Sha256;
use std::str::FromStr;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::Mutex;

type HmacSha256 = Hmac<Sha256>;

const TEST_USD_DENOMINATIONS: &[u64] = &[
    1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192,
];
const TEST_MARKET_DENOMINATIONS: &[u64] = &[
    1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072,
    262144, 524288, 1048576,
];

/// Test helper to create a test server
async fn create_test_server() -> String {
    // Create a simple router for basic endpoint testing
    let app = Router::new()
        .route("/health", axum::routing::get(|| async { "OK" }))
        .route("/v1/info", axum::routing::get(|| async { 
            r#"{"name":"Cascade Test Mint","version":"0.1.0","description":"Test mint for integration tests"}"#
        }))
        .route("/evt123/v1/keys", axum::routing::get(|| async {
            r#"{"market_id":"evt123","long_keyset":{"id":"long-keyset","unit":"LONG_test-market","outcome":"long","keys":{"1":{"pubkey":"02aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}}},"short_keyset":{"id":"short-keyset","unit":"SHORT_test-market","outcome":"short","keys":{"1":{"pubkey":"03bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}}}}"#
        }));

    // Bind to a random available port
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let url = format!("http://{}", addr);

    // Spawn the server
    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    // Give the server a moment to start
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    url
}

async fn create_product_test_server() -> String {
    create_product_test_server_with_funding(None, None, "signet").await
}

async fn create_product_test_server_with_stripe(
    stripe_config: Option<cascade_api::stripe::StripeConfig>,
) -> String {
    create_product_test_server_with_funding(stripe_config, None, "signet").await
}

async fn create_product_test_server_with_usdc(
    usdc_config: Option<cascade_api::usdc::UsdcConfig>,
    network_type: &'static str,
) -> String {
    create_product_test_server_with_funding(None, usdc_config, network_type).await
}

async fn create_product_test_server_with_usdc_bundle(
    usdc_config: Option<cascade_api::usdc::UsdcConfig>,
    network_type: &'static str,
) -> (String, Arc<Mutex<cascade_core::invoice::InvoiceService>>) {
    create_product_test_server_bundle_with_funding(None, usdc_config, network_type).await
}

async fn create_product_test_server_with_funding(
    stripe_config: Option<cascade_api::stripe::StripeConfig>,
    usdc_config: Option<cascade_api::usdc::UsdcConfig>,
    network_type: &'static str,
) -> String {
    create_product_test_server_bundle_with_funding(stripe_config, usdc_config, network_type)
        .await
        .0
}

async fn create_product_test_server_bundle_with_funding(
    stripe_config: Option<cascade_api::stripe::StripeConfig>,
    usdc_config: Option<cascade_api::usdc::UsdcConfig>,
    network_type: &'static str,
) -> (String, Arc<Mutex<cascade_core::invoice::InvoiceService>>) {
    let cdk_db = Arc::new(cdk_sqlite::mint::memory::empty().await.unwrap());
    let mut builder = MintBuilder::new(cdk_db.clone());
    builder
        .configure_unit(
            CurrencyUnit::Sat,
            UnitConfig {
                amounts: vec![1, 2, 4, 8, 16, 32, 64, 128],
                input_fee_ppk: 0,
            },
        )
        .unwrap();
    builder
        .configure_unit(
            CurrencyUnit::Usd,
            UnitConfig {
                amounts: vec![
                    1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192,
                ],
                input_fee_ppk: 0,
            },
        )
        .unwrap();

    let lnd_config = cascade_core::LndConfig {
        host: "127.0.0.1:10009".to_string(),
        cert_path: None,
        macaroon_path: None,
        tls_domain: None,
        network: Some(network_type.to_string()),
        cli_path: None,
    };
    let mut lnd_client = cascade_core::lightning::lnd_client::LndClient::new(lnd_config.clone());
    lnd_client.connect().await.unwrap();
    let invoice_service = Arc::new(Mutex::new(cascade_core::invoice::InvoiceService::new(
        lnd_client, 3600, 40,
    )));
    let fx_service = Arc::new(cascade_api::fx::FxQuoteService::for_network(network_type).unwrap());
    builder
        .add_payment_processor(
            CurrencyUnit::Usd,
            PaymentMethod::Known(KnownMethod::Bolt11),
            MintMeltLimits::new(1, 100_000_000),
            Arc::new(cascade_api::payment::UsdBolt11PaymentProcessor::new(
                invoice_service.clone(),
                fx_service.clone(),
                cdk_db.clone(),
                network_type == "signet",
            )),
        )
        .await
        .unwrap();

    let seed = [7_u8; 32];
    let advertised_mint_info = builder.current_mint_info();
    let mint = Arc::new(
        builder
            .build_with_seed(cdk_db.clone(), &seed)
            .await
            .unwrap(),
    );
    mint.set_mint_info(advertised_mint_info).await.unwrap();
    let cascade_db = Arc::new(
        cascade_core::db::CascadeDatabase::connect("sqlite::memory:")
            .await
            .unwrap(),
    );
    cascade_db.run_migrations().await.unwrap();
    let market_manager = Arc::new(cascade_core::MarketManager::new(
        cascade_core::LmsrEngine::new(10.0).unwrap(),
    ));

    let app = cascade_api::build_server(
        market_manager,
        invoice_service.clone(),
        fx_service,
        stripe_config,
        usdc_config,
        mint,
        cascade_db,
        network_type,
        "http://127.0.0.1:0",
    )
    .await
    .unwrap();

    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let url = format!("http://{}", addr);
    let invoice_service_for_return = invoice_service.clone();

    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    (url, invoice_service_for_return)
}

async fn create_mock_stripe_server() -> String {
    create_mock_stripe_server_with_risk_level("normal").await
}

async fn create_mock_stripe_server_with_risk_level(risk_level: &'static str) -> String {
    let app = Router::new()
        .route(
            "/v1/checkout/sessions",
            axum::routing::post(|| async move {
                let expires_at = chrono::Utc::now().timestamp() + 1800;
                axum::Json(serde_json::json!({
                    "id": "cs_test_cascade",
                    "url": "https://checkout.stripe.test/cs_test_cascade",
                    "expires_at": expires_at
                }))
            }),
        )
        .route(
            "/v1/payment_intents/{id}",
            axum::routing::get(
                move |axum::extract::Path(id): axum::extract::Path<String>| async move {
                    axum::Json(serde_json::json!({
                        "id": id,
                        "latest_charge": {
                            "outcome": {
                                "risk_level": risk_level
                            }
                        }
                    }))
                },
            ),
        );

    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let url = format!("http://{}", addr);

    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    url
}

fn stripe_signature(secret: &str, body: &str, timestamp: i64) -> String {
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).unwrap();
    mac.update(format!("{timestamp}.{body}").as_bytes());
    let signature = hex::encode(mac.finalize().into_bytes());
    format!("t={timestamp},v1={signature}")
}

fn sample_market_event(event_id: &str, slug: &str, pubkey: &str) -> serde_json::Value {
    serde_json::json!({
        "id": event_id,
        "pubkey": pubkey,
        "created_at": 1_712_800_000_i64,
        "kind": 982,
        "content": "A signed market body for tests.",
        "sig": "00",
        "tags": [
            ["d", slug],
            ["title", "Test Market"],
            ["description", "A market created in tests."],
            ["status", "open"]
        ]
    })
}

async fn create_wallet_funding_and_get_proofs(
    client: &reqwest::Client,
    url: &str,
    pubkey: &str,
    amount_minor: u64,
    edition: &str,
) -> serde_json::Value {
    create_wallet_funding_and_get_proofs_with_invoice_service(
        client,
        url,
        pubkey,
        amount_minor,
        edition,
        None,
    )
    .await
}

async fn create_wallet_funding_and_get_proofs_with_invoice_service(
    client: &reqwest::Client,
    url: &str,
    pubkey: &str,
    amount_minor: u64,
    edition: &str,
    invoice_service: Option<&Arc<Mutex<cascade_core::invoice::InvoiceService>>>,
) -> serde_json::Value {
    let quote_response = client
        .post(format!("{url}/v1/mint/quote/bolt11"))
        .header("x-cascade-edition", edition)
        .json(&serde_json::json!({
            "pubkey": pubkey,
            "amount": amount_minor,
            "unit": "usd"
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(quote_response.status(), 200);
    let quote_payload: serde_json::Value = quote_response.json().await.unwrap();
    let quote_id = quote_payload["quote"].as_str().unwrap();

    if edition == "mainnet" {
        if let (Some(invoice_service), Some(invoice)) =
            (invoice_service, quote_payload["request"].as_str())
        {
            invoice_service
                .lock()
                .await
                .pay_invoice(invoice)
                .await
                .unwrap();
        }
    }

    let paid_quote = wait_for_mint_quote_state(client, url, quote_id, &["PAID"]).await;
    mint_funding_quote_and_get_proofs(client, url, &paid_quote, amount_minor).await
}

async fn create_signet_funding_and_get_proofs(
    client: &reqwest::Client,
    url: &str,
    pubkey: &str,
    amount_minor: u64,
) -> serde_json::Value {
    create_wallet_funding_and_get_proofs(client, url, pubkey, amount_minor, "signet").await
}

async fn fetch_active_usd_keyset(client: &reqwest::Client, url: &str) -> KeySet {
    let response = client.get(format!("{url}/v1/keys")).send().await.unwrap();
    assert_eq!(response.status(), 200);

    let payload: KeysResponse = response.json().await.unwrap();
    payload
        .keysets
        .into_iter()
        .find(|keyset| keyset.unit == CurrencyUnit::Usd && keyset.active.unwrap_or(false))
        .expect("active usd keyset")
}

async fn fetch_market_keyset(
    client: &reqwest::Client,
    url: &str,
    event_id: &str,
    side: &str,
) -> KeySet {
    let response = client
        .get(format!("{url}/{event_id}/v1/keys"))
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), 200);
    let payload: Value = response.json().await.unwrap();
    let payload = payload.get("Ok").cloned().unwrap_or(payload);
    let keyset = if side.eq_ignore_ascii_case("yes") || side.eq_ignore_ascii_case("long") {
        payload["long_keyset"].clone()
    } else {
        payload["short_keyset"].clone()
    };

    let id = keyset["id"].as_str().unwrap();
    let unit = keyset["unit"].as_str().unwrap();
    let keys = keyset["keys"]
        .as_object()
        .unwrap()
        .iter()
        .map(|(amount, public_key)| {
            (
                amount.clone(),
                Value::String(public_key["pubkey"].as_str().unwrap().to_string()),
            )
        })
        .collect::<serde_json::Map<String, Value>>();

    serde_json::from_value(json!({
        "id": id,
        "unit": unit,
        "active": true,
        "keys": keys
    }))
    .unwrap()
}

fn prepare_outputs(keyset: &KeySet, amount: u64, denominations: &[u64]) -> (Value, PreMintSecrets) {
    let pre_mint = PreMintSecrets::random(
        keyset.id,
        Amount::from(amount),
        &SplitTarget::default(),
        &FeeAndAmounts::from((0, denominations.to_vec())),
    )
    .unwrap();

    (
        serde_json::to_value(pre_mint.blinded_messages()).unwrap(),
        pre_mint,
    )
}

fn proofs_from_signatures(
    signatures: &Value,
    pre_mint: &PreMintSecrets,
    keyset: &KeySet,
) -> Vec<Proof> {
    let signatures: Vec<BlindSignature> = serde_json::from_value(signatures.clone()).unwrap();
    construct_proofs(signatures, pre_mint.rs(), pre_mint.secrets(), &keyset.keys).unwrap()
}

fn proof_amount_total(proofs: &[Proof]) -> u64 {
    proofs.iter().map(|proof| proof.amount.to_u64()).sum()
}

async fn wait_for_mint_quote_state(
    client: &reqwest::Client,
    url: &str,
    quote_id: &str,
    expected_states: &[&str],
) -> serde_json::Value {
    let mut last_payload = serde_json::Value::Null;
    for _ in 0..50 {
        let response = client
            .get(format!("{url}/v1/mint/quote/bolt11/{quote_id}"))
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), 200);
        let payload: serde_json::Value = response.json().await.unwrap();
        last_payload = payload.clone();
        if expected_states.contains(&payload["state"].as_str().unwrap_or_default()) {
            return payload;
        }
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    }

    panic!(
        "mint quote {quote_id} did not reach expected state in time; last payload: {last_payload}"
    );
}

async fn wait_for_melt_quote_state(
    client: &reqwest::Client,
    url: &str,
    quote_id: &str,
    expected_states: &[&str],
) -> serde_json::Value {
    let mut last_payload = serde_json::Value::Null;
    for _ in 0..50 {
        let response = client
            .get(format!("{url}/v1/melt/quote/bolt11/{quote_id}"))
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), 200);
        let payload: serde_json::Value = response.json().await.unwrap();
        last_payload = payload.clone();
        if expected_states.contains(&payload["state"].as_str().unwrap_or_default()) {
            return payload;
        }
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    }

    panic!(
        "melt quote {quote_id} did not reach expected state in time; last payload: {last_payload}"
    );
}

async fn mint_funding_quote_and_get_proofs(
    client: &reqwest::Client,
    url: &str,
    quote_payload: &serde_json::Value,
    amount_minor: u64,
) -> serde_json::Value {
    let keyset = fetch_active_usd_keyset(client, url).await;
    let pre_mint = PreMintSecrets::random(
        keyset.id,
        Amount::from(amount_minor),
        &SplitTarget::default(),
        &FeeAndAmounts::from((0, TEST_USD_DENOMINATIONS.to_vec())),
    )
    .unwrap();

    let outputs = serde_json::to_value(pre_mint.blinded_messages()).unwrap();
    let mint_response = client
        .post(format!("{url}/v1/mint/bolt11"))
        .json(&serde_json::json!({
            "quote": quote_payload["quote"].as_str().unwrap(),
            "outputs": outputs
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(mint_response.status(), 200);
    let mint_payload: serde_json::Value = mint_response.json().await.unwrap();
    let signatures: Vec<BlindSignature> =
        serde_json::from_value(mint_payload["signatures"].clone()).unwrap();
    let proofs =
        construct_proofs(signatures, pre_mint.rs(), pre_mint.secrets(), &keyset.keys).unwrap();
    serde_json::to_value(proofs).unwrap()
}

/// Test that the health endpoint returns OK
#[tokio::test]
async fn test_health_endpoint() {
    let url = create_test_server().await;

    let client = reqwest::Client::new();
    let response = client
        .get(&format!("{}/health", url))
        .send()
        .await
        .expect("Failed to make request");

    assert_eq!(response.status(), 200, "Health endpoint should return 200");

    let body = response.text().await.expect("Failed to read body");
    assert_eq!(body, "OK", "Health endpoint should return OK");
}

/// Test that the mint info endpoint returns valid JSON
#[tokio::test]
async fn test_mint_info_endpoint() {
    let url = create_test_server().await;

    let client = reqwest::Client::new();
    let response = client
        .get(&format!("{}/v1/info", url))
        .send()
        .await
        .expect("Failed to make request");

    assert_eq!(
        response.status(),
        200,
        "Mint info endpoint should return 200"
    );

    let body = response.text().await.expect("Failed to read body");

    // Verify it's valid JSON with expected fields
    let json: serde_json::Value =
        serde_json::from_str(&body).expect("Response should be valid JSON");

    assert!(
        json.get("name").is_some(),
        "Response should contain 'name' field"
    );
    assert!(
        json.get("version").is_some(),
        "Response should contain 'version' field"
    );
}

/// Test that the keys endpoint returns valid JSON
#[tokio::test]
async fn test_keys_endpoint() {
    let url = create_test_server().await;

    let client = reqwest::Client::new();
    let response = client
        .get(&format!("{}/evt123/v1/keys", url))
        .send()
        .await
        .expect("Failed to make request");

    assert_eq!(response.status(), 200, "Keys endpoint should return 200");

    let body = response.text().await.expect("Failed to read body");

    // Verify it's valid JSON
    let json: serde_json::Value =
        serde_json::from_str(&body).expect("Response should be valid JSON");

    assert_eq!(
        json.get("market_id").and_then(|value| value.as_str()),
        Some("evt123")
    );
    assert!(
        json.get("long_keyset").is_some(),
        "Response should contain 'long_keyset' field"
    );
    assert!(
        json.get("short_keyset").is_some(),
        "Response should contain 'short_keyset' field"
    );
}

/// Test that 404 is returned for unknown routes
#[tokio::test]
async fn test_unknown_route_returns_404() {
    let url = create_test_server().await;

    let client = reqwest::Client::new();
    let response = client
        .get(&format!("{}/nonexistent", url))
        .send()
        .await
        .expect("Failed to make request");

    assert_eq!(response.status(), 404, "Unknown routes should return 404");
}

/// Test cascade-specific routes exist
#[tokio::test]
async fn test_cascade_routes_exist() {
    // Create a test server with cascade-style routes
    let app = Router::new()
        .route(
            "/api/price/{currency}",
            axum::routing::get(|| async { r#"{"usd":50000.0,"btc":1.0}"# }),
        )
        .route(
            "/api/market/create",
            axum::routing::post(|| async {
                r#"{"id":"test-market","slug":"test-market","status":"active"}"#
            }),
        )
        .route(
            "/api/market/{id}",
            axum::routing::get(|| async {
                r#"{"id":"test-market","title":"Test Market","status":"active"}"#
            }),
        )
        .route("/health", axum::routing::get(|| async { "OK" }));

    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let url = format!("http://{}", addr);

    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    let client = reqwest::Client::new();

    // Test price endpoint
    let response = client
        .get(&format!("{}/api/price/btc", url))
        .send()
        .await
        .expect("Failed to make request");
    assert_eq!(response.status(), 200, "Price endpoint should return 200");

    // Test market create endpoint
    let response = client
        .post(&format!("{}/api/market/create", url))
        .json(&serde_json::json!({
            "event_id": "evt123",
            "slug": "test-market",
            "title": "Test Market",
            "description": "Test description",
            "b": 10.0
        }))
        .send()
        .await
        .expect("Failed to make request");
    assert_eq!(
        response.status(),
        200,
        "Market create endpoint should return 200"
    );

    // Test market get endpoint
    let response = client
        .get(&format!("{}/api/market/test-market", url))
        .send()
        .await
        .expect("Failed to make request");
    assert_eq!(
        response.status(),
        200,
        "Market get endpoint should return 200"
    );
}

/// Test that invalid JSON in request body returns error
#[tokio::test]
async fn test_invalid_json_returns_error() {
    let app = Router::new().route(
        "/api/market/create",
        axum::routing::post(
            |axum::extract::Json(payload): axum::extract::Json<serde_json::Value>| async move {
                format!("Received: {:?}", payload)
            },
        ),
    );

    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let url = format!("http://{}", addr);

    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    let client = reqwest::Client::new();

    // Send invalid JSON
    let response = client
        .post(&format!("{}/api/market/create", url))
        .header("Content-Type", "application/json")
        .body("not valid json {{{")
        .send()
        .await
        .expect("Failed to make request");

    // Should return a client error (4xx) for malformed JSON
    assert!(
        response.status().is_client_error(),
        "Invalid JSON should return client error, got: {}",
        response.status()
    );
}

/// Test concurrent requests are handled correctly
#[tokio::test]
async fn test_concurrent_requests() {
    let app = Router::new().route("/health", axum::routing::get(|| async { "OK" }));

    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let url = format!("http://{}", addr);

    let app_for_server = app.clone();
    tokio::spawn(async move {
        axum::serve(listener, app_for_server).await.unwrap();
    });

    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    let url_clone = url.clone();

    // Make 10 concurrent requests
    let handles: Vec<_> = (0..10)
        .map(|_| {
            let url = url_clone.clone();
            tokio::spawn(async move {
                let client = reqwest::Client::new();
                client
                    .get(&format!("{}/health", url))
                    .send()
                    .await
                    .expect("Failed to make request")
            })
        })
        .collect();

    // Wait for all requests to complete
    let mut success_count = 0;
    for handle in handles {
        let response = handle.await.expect("Task failed");
        if response.status() == 200 {
            success_count += 1;
        }
    }

    // All requests should succeed
    assert_eq!(
        success_count, 10,
        "All 10 concurrent requests should succeed"
    );
}

/// Test that Content-Type is correctly set in responses
#[tokio::test]
async fn test_content_type_header() {
    let app = Router::new().route(
        "/v1/info",
        axum::routing::get(|| async {
            (
                [("Content-Type", "application/json")],
                r#"{"name":"Test Mint"}"#,
            )
        }),
    );

    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let url = format!("http://{}", addr);

    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    let client = reqwest::Client::new();
    let response = client
        .get(&format!("{}/v1/info", url))
        .send()
        .await
        .expect("Failed to make request");

    assert_eq!(response.status(), 200);

    let content_type = response
        .headers()
        .get("Content-Type")
        .expect("Content-Type header should be present");

    assert!(
        content_type.to_str().unwrap().contains("application/json"),
        "Content-Type should be application/json"
    );
}

#[tokio::test]
async fn test_pending_market_stays_private_until_first_trade() {
    let url = create_product_test_server().await;
    let client = reqwest::Client::new();
    let creator = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    let event_id = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    let slug = "pending-market";

    let create_response = client
        .post(format!("{url}/api/product/markets"))
        .json(&serde_json::json!({
            "event_id": event_id,
            "title": "Pending Market",
            "description": "Not public yet",
            "slug": slug,
            "body": "Pending body",
            "creator_pubkey": creator,
            "raw_event": sample_market_event(event_id, slug, creator),
            "b": 10.0
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(create_response.status(), 201);
    let created: serde_json::Value = create_response.json().await.unwrap();
    assert_eq!(
        created.get("visibility").and_then(|value| value.as_str()),
        Some("pending")
    );

    let creator_response = client
        .get(format!("{url}/api/product/markets/creator/{creator}"))
        .send()
        .await
        .unwrap();
    assert_eq!(creator_response.status(), 200);
    let creator_payload: serde_json::Value = creator_response.json().await.unwrap();
    assert_eq!(
        creator_payload["markets"]
            .as_array()
            .map(|items| items.len()),
        Some(1)
    );

    let feed_response = client
        .get(format!("{url}/api/product/feed"))
        .send()
        .await
        .unwrap();
    assert_eq!(feed_response.status(), 200);
    let feed_payload: serde_json::Value = feed_response.json().await.unwrap();
    assert_eq!(
        feed_payload["markets"].as_array().map(|items| items.len()),
        Some(0)
    );

    let pending_detail_response = client
        .get(format!(
            "{url}/api/product/markets/{event_id}/pending/{creator}"
        ))
        .send()
        .await
        .unwrap();
    assert_eq!(pending_detail_response.status(), 200);
    let pending_detail_payload: serde_json::Value = pending_detail_response.json().await.unwrap();
    assert_eq!(
        pending_detail_payload["market"]["visibility"].as_str(),
        Some("pending")
    );
    assert_eq!(
        pending_detail_payload["trades"]
            .as_array()
            .map(|items| items.len()),
        Some(0)
    );

    let forbidden_pending_detail_response = client
        .get(format!(
            "{url}/api/product/markets/{event_id}/pending/ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
        ))
        .send()
        .await
        .unwrap();
    assert_eq!(forbidden_pending_detail_response.status(), 404);
}

#[tokio::test]
async fn test_paper_wallet_buy_and_sell_flow() {
    let url = create_product_test_server().await;
    let client = reqwest::Client::new();
    let creator = "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
    let event_id = "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";
    let slug = "paper-flow-market";

    client
        .post(format!("{url}/api/product/markets"))
        .json(&serde_json::json!({
            "event_id": event_id,
            "title": "Paper Flow Market",
            "description": "Exercise the signet paper flow",
            "slug": slug,
            "body": "Paper body",
            "creator_pubkey": creator,
            "raw_event": sample_market_event(event_id, slug, creator),
            "b": 10.0
        }))
        .send()
        .await
        .unwrap();

    let funding_proofs: Vec<Proof> = serde_json::from_value(
        create_signet_funding_and_get_proofs(&client, &url, creator, 10_000).await,
    )
    .unwrap();
    let usd_keyset = fetch_active_usd_keyset(&client, &url).await;
    let market_keyset = fetch_market_keyset(&client, &url, event_id, "yes").await;

    let buy_quote_response = client
        .post(format!("{url}/api/trades/quote"))
        .json(&serde_json::json!({
            "event_id": event_id,
            "side": "yes",
            "spend_minor": 8000
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(buy_quote_response.status(), 200);
    let buy_quote_payload: serde_json::Value = buy_quote_response.json().await.unwrap();
    let (issued_outputs, issued_pre_mint) = prepare_outputs(
        &market_keyset,
        buy_quote_payload["quantity_minor"].as_u64().unwrap(),
        TEST_MARKET_DENOMINATIONS,
    );
    let (change_outputs, change_pre_mint) = prepare_outputs(
        &usd_keyset,
        proof_amount_total(&funding_proofs).saturating_sub(8000),
        TEST_USD_DENOMINATIONS,
    );

    let buy_response = client
        .post(format!("{url}/api/trades/buy"))
        .json(&serde_json::json!({
            "event_id": event_id,
            "pubkey": creator,
            "side": "yes",
            "spend_minor": 8000,
            "proofs": funding_proofs,
            "issued_outputs": issued_outputs,
            "change_outputs": change_outputs
        }))
        .send()
        .await
        .unwrap();
    let buy_status = buy_response.status();
    let buy_payload: serde_json::Value = buy_response.json().await.unwrap();
    assert_eq!(buy_status, 201, "buy payload: {buy_payload}");
    assert_eq!(buy_payload["market"]["visibility"].as_str(), Some("public"));
    assert_eq!(
        buy_payload["settlement"]["mode"].as_str(),
        Some("bolt11_wallet_to_market")
    );
    assert_eq!(
        buy_payload["settlement"]["rail"].as_str(),
        Some("lightning")
    );
    assert_eq!(
        buy_payload["settlement"]["settlement_minor"].as_u64(),
        Some(8000)
    );
    assert!(buy_payload["settlement"]["invoice"].as_str().is_some());
    assert!(buy_payload["settlement"]["payment_hash"].as_str().is_some());
    assert_eq!(
        buy_payload["settlement"]["metadata"]["payer_role"].as_str(),
        Some("wallet_mint")
    );
    assert_eq!(
        buy_payload["settlement"]["metadata"]["receiver_role"].as_str(),
        Some("market_mint")
    );
    assert_eq!(
        buy_payload["settlement"]["metadata"]["invoice_state"].as_str(),
        Some("settled")
    );
    let first_quantity = buy_quote_payload["quantity"].as_f64().unwrap();
    let issued_market_proofs = proofs_from_signatures(
        &buy_payload["issued"]["signatures"],
        &issued_pre_mint,
        &market_keyset,
    );
    let _buy_change_proofs = proofs_from_signatures(
        &buy_payload["change"]["signatures"],
        &change_pre_mint,
        &usd_keyset,
    );
    assert!(first_quantity > 0.0);

    let feed_response = client
        .get(format!("{url}/api/product/feed"))
        .send()
        .await
        .unwrap();
    let feed_payload: serde_json::Value = feed_response.json().await.unwrap();
    assert_eq!(
        feed_payload["markets"].as_array().map(|items| items.len()),
        Some(1)
    );
    assert_eq!(
        feed_payload["trades"].as_array().map(|items| items.len()),
        Some(1)
    );

    let sell_quote_response = client
        .post(format!("{url}/api/trades/sell/quote"))
        .json(&serde_json::json!({
            "event_id": event_id,
            "side": "yes",
            "quantity": first_quantity / 2.0
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(sell_quote_response.status(), 200);
    let sell_quote_payload: serde_json::Value = sell_quote_response.json().await.unwrap();
    let (sell_issued_outputs, sell_issued_pre_mint) = prepare_outputs(
        &usd_keyset,
        sell_quote_payload["net_minor"].as_u64().unwrap(),
        TEST_USD_DENOMINATIONS,
    );
    let (sell_change_outputs, sell_change_pre_mint) = prepare_outputs(
        &market_keyset,
        proof_amount_total(&issued_market_proofs)
            .saturating_sub(sell_quote_payload["quantity_minor"].as_u64().unwrap()),
        TEST_MARKET_DENOMINATIONS,
    );

    let sell_response = client
        .post(format!("{url}/api/trades/sell"))
        .json(&serde_json::json!({
            "event_id": event_id,
            "pubkey": creator,
            "side": "yes",
            "quantity": first_quantity / 2.0,
            "proofs": issued_market_proofs,
            "issued_outputs": sell_issued_outputs,
            "change_outputs": sell_change_outputs
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(sell_response.status(), 201);
    let sell_payload: serde_json::Value = sell_response.json().await.unwrap();
    let _sell_usd_proofs = proofs_from_signatures(
        &sell_payload["issued"]["signatures"],
        &sell_issued_pre_mint,
        &usd_keyset,
    );
    let _sell_market_change_proofs = proofs_from_signatures(
        &sell_payload["change"]["signatures"],
        &sell_change_pre_mint,
        &market_keyset,
    );
    assert_eq!(
        sell_payload["settlement"]["mode"].as_str(),
        Some("bolt11_market_to_wallet")
    );
    assert_eq!(
        sell_payload["settlement"]["rail"].as_str(),
        Some("lightning")
    );
    assert!(sell_payload["settlement"]["invoice"].as_str().is_some());
    assert!(sell_payload["settlement"]["payment_hash"]
        .as_str()
        .is_some());
    assert_eq!(
        sell_payload["settlement"]["metadata"]["payer_role"].as_str(),
        Some("market_mint")
    );
    assert_eq!(
        sell_payload["settlement"]["metadata"]["receiver_role"].as_str(),
        Some("wallet_mint")
    );
    assert_eq!(
        sell_payload["settlement"]["metadata"]["invoice_state"].as_str(),
        Some("settled")
    );

    let detail_response = client
        .get(format!("{url}/api/product/markets/slug/{slug}"))
        .send()
        .await
        .unwrap();
    assert_eq!(detail_response.status(), 200);
    let detail_payload: serde_json::Value = detail_response.json().await.unwrap();
    assert_eq!(
        detail_payload["trades"].as_array().map(|items| items.len()),
        Some(2)
    );
}

#[tokio::test]
async fn test_coordinator_trade_routes_and_status() {
    let url = create_product_test_server().await;
    let client = reqwest::Client::new();
    let creator = "1212121212121212121212121212121212121212121212121212121212121212";
    let event_id = "3434343434343434343434343434343434343434343434343434343434343434";
    let slug = "coordinator-trade-market";

    client
        .post(format!("{url}/api/product/markets"))
        .json(&serde_json::json!({
            "event_id": event_id,
            "title": "Coordinator Trade Market",
            "description": "Exercise coordinator routes",
            "slug": slug,
            "body": "Coordinator body",
            "creator_pubkey": creator,
            "raw_event": sample_market_event(event_id, slug, creator),
            "b": 10.0
        }))
        .send()
        .await
        .unwrap();

    let funding_proofs: Vec<Proof> = serde_json::from_value(
        create_signet_funding_and_get_proofs(&client, &url, creator, 10_000).await,
    )
    .unwrap();

    let quote_response = client
        .post(format!("{url}/api/trades/quote"))
        .json(&serde_json::json!({
            "event_id": event_id,
            "side": "yes",
            "spend_minor": 4000
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(quote_response.status(), 200);
    let quote_payload: serde_json::Value = quote_response.json().await.unwrap();
    assert_eq!(quote_payload["trade_type"].as_str(), Some("buy"));
    assert!(quote_payload["quantity"].as_f64().unwrap() > 0.0);
    assert_eq!(quote_payload["settlement_minor"].as_u64(), Some(4000));
    assert!(quote_payload["settlement_msat"].as_u64().unwrap() > 0);
    assert!(quote_payload["settlement_fee_msat"].as_u64().unwrap() > 0);
    assert!(quote_payload["fx_quote_id"].as_str().is_some());
    assert!(quote_payload["fx_source"].as_str().is_some());
    assert!(quote_payload["btc_usd_price"].as_f64().unwrap() > 0.0);
    assert!(quote_payload["spread_bps"].as_u64().is_some());
    assert!(
        quote_payload["fx_metadata"]["reference_btc_usd_price"]
            .as_f64()
            .unwrap()
            > 0.0
    );
    assert!(quote_payload["fx_metadata"]["execution_spread_bps"]
        .as_u64()
        .is_some());
    assert_eq!(
        quote_payload["fx_metadata"]["quote_direction"].as_str(),
        Some("usd_to_msat")
    );
    assert!(quote_payload["fx_metadata"]["combination_policy"]
        .as_str()
        .is_some());
    assert!(quote_payload["marginal_price_before_ppm"].as_u64().unwrap() > 0);
    assert!(quote_payload["marginal_price_after_ppm"].as_u64().unwrap() > 0);
    assert!(quote_payload["fx_observations"].as_array().is_some());
    let buy_quote_id = quote_payload["quote_id"].as_str().unwrap().to_string();
    assert_eq!(quote_payload["status"].as_str(), Some("open"));

    let quote_status_response = client
        .get(format!("{url}/api/trades/quotes/{buy_quote_id}"))
        .send()
        .await
        .unwrap();
    assert_eq!(quote_status_response.status(), 200);
    let quote_status_payload: serde_json::Value = quote_status_response.json().await.unwrap();
    assert_eq!(
        quote_status_payload["quote_id"].as_str(),
        Some(buy_quote_id.as_str())
    );
    assert_eq!(
        quote_status_payload["fx_quote_id"].as_str(),
        quote_payload["fx_quote_id"].as_str()
    );
    assert_eq!(
        quote_status_payload["fx_metadata"]["reference_btc_usd_price"].as_f64(),
        quote_payload["fx_metadata"]["reference_btc_usd_price"].as_f64()
    );
    let usd_keyset = fetch_active_usd_keyset(&client, &url).await;
    let market_keyset = fetch_market_keyset(&client, &url, event_id, "yes").await;
    let (issued_outputs, issued_pre_mint) = prepare_outputs(
        &market_keyset,
        quote_payload["quantity_minor"].as_u64().unwrap(),
        TEST_MARKET_DENOMINATIONS,
    );
    let (change_outputs, change_pre_mint) = prepare_outputs(
        &usd_keyset,
        proof_amount_total(&funding_proofs)
            .saturating_sub(quote_payload["spend_minor"].as_u64().unwrap()),
        TEST_USD_DENOMINATIONS,
    );

    let buy_response = client
        .post(format!("{url}/api/trades/buy"))
        .json(&serde_json::json!({
            "event_id": event_id,
            "pubkey": creator,
            "side": "yes",
            "spend_minor": 4000,
            "quote_id": buy_quote_id,
            "proofs": funding_proofs,
            "issued_outputs": issued_outputs,
            "change_outputs": change_outputs
        }))
        .send()
        .await
        .unwrap();
    let buy_status = buy_response.status();
    let buy_payload: serde_json::Value = buy_response.json().await.unwrap();
    assert_eq!(buy_status, 201, "buy payload: {buy_payload}");
    let trade_id = buy_payload["trade"]["id"].as_str().unwrap().to_string();
    let quantity = quote_payload["quantity"].as_f64().unwrap();
    let issued_market_proofs = proofs_from_signatures(
        &buy_payload["issued"]["signatures"],
        &issued_pre_mint,
        &market_keyset,
    );
    let _buy_change_proofs = proofs_from_signatures(
        &buy_payload["change"]["signatures"],
        &change_pre_mint,
        &usd_keyset,
    );
    assert_eq!(buy_payload["market"]["visibility"].as_str(), Some("public"));

    let trade_status_response = client
        .get(format!("{url}/api/trades/{trade_id}"))
        .send()
        .await
        .unwrap();
    assert_eq!(trade_status_response.status(), 200);
    let trade_status_payload: serde_json::Value = trade_status_response.json().await.unwrap();
    assert_eq!(
        trade_status_payload["trade"]["id"].as_str(),
        Some(trade_id.as_str())
    );
    assert_eq!(
        trade_status_payload["settlement"]["trade_id"].as_str(),
        Some(trade_id.as_str())
    );
    assert_eq!(
        trade_status_payload["settlement"]["mode"].as_str(),
        Some("bolt11_wallet_to_market")
    );
    assert_eq!(
        trade_status_payload["settlement"]["rail"].as_str(),
        Some("lightning")
    );
    assert!(trade_status_payload["settlement"]["invoice"]
        .as_str()
        .is_some());
    assert!(trade_status_payload["settlement"]["payment_hash"]
        .as_str()
        .is_some());
    assert_eq!(
        trade_status_payload["settlement"]["metadata"]["payer_role"].as_str(),
        Some("wallet_mint")
    );
    assert_eq!(
        trade_status_payload["settlement"]["metadata"]["receiver_role"].as_str(),
        Some("market_mint")
    );
    assert_eq!(
        trade_status_payload["settlement"]["metadata"]["invoice_state"].as_str(),
        Some("settled")
    );
    assert_eq!(
        trade_status_payload["market"]["event_id"].as_str(),
        Some(event_id)
    );

    let executed_quote_status_response = client
        .get(format!(
            "{url}/api/trades/quotes/{}",
            quote_payload["quote_id"].as_str().unwrap()
        ))
        .send()
        .await
        .unwrap();
    assert_eq!(executed_quote_status_response.status(), 200);
    let executed_quote_status_payload: serde_json::Value =
        executed_quote_status_response.json().await.unwrap();
    assert_eq!(
        executed_quote_status_payload["status"].as_str(),
        Some("executed")
    );
    assert_eq!(
        executed_quote_status_payload["trade_id"].as_str(),
        Some(trade_id.as_str())
    );

    let sell_quote_response = client
        .post(format!("{url}/api/trades/sell/quote"))
        .json(&serde_json::json!({
            "event_id": event_id,
            "side": "yes",
            "quantity": quantity / 2.0
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(sell_quote_response.status(), 200);
    let sell_quote_payload: serde_json::Value = sell_quote_response.json().await.unwrap();
    assert_eq!(sell_quote_payload["trade_type"].as_str(), Some("sell"));
    assert!(sell_quote_payload["net_minor"].as_u64().unwrap() > 0);
    assert_eq!(
        sell_quote_payload["settlement_minor"].as_u64(),
        sell_quote_payload["net_minor"].as_u64()
    );
    assert!(sell_quote_payload["settlement_msat"].as_u64().unwrap() > 0);
    let sell_quote_id = sell_quote_payload["quote_id"].as_str().unwrap().to_string();
    let (sell_issued_outputs, sell_issued_pre_mint) = prepare_outputs(
        &usd_keyset,
        sell_quote_payload["net_minor"].as_u64().unwrap(),
        TEST_USD_DENOMINATIONS,
    );
    let (sell_change_outputs, sell_change_pre_mint) = prepare_outputs(
        &market_keyset,
        proof_amount_total(&issued_market_proofs)
            .saturating_sub(sell_quote_payload["quantity_minor"].as_u64().unwrap()),
        TEST_MARKET_DENOMINATIONS,
    );

    let sell_response = client
        .post(format!("{url}/api/trades/sell"))
        .json(&serde_json::json!({
            "event_id": event_id,
            "pubkey": creator,
            "side": "yes",
            "quantity": quantity / 2.0,
            "quote_id": sell_quote_id,
            "proofs": issued_market_proofs,
            "issued_outputs": sell_issued_outputs,
            "change_outputs": sell_change_outputs
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(sell_response.status(), 201);
    let sell_payload: serde_json::Value = sell_response.json().await.unwrap();
    let _sell_usd_proofs = proofs_from_signatures(
        &sell_payload["issued"]["signatures"],
        &sell_issued_pre_mint,
        &usd_keyset,
    );
    let _sell_market_change_proofs = proofs_from_signatures(
        &sell_payload["change"]["signatures"],
        &sell_change_pre_mint,
        &market_keyset,
    );

    let executed_sell_quote_status_response = client
        .get(format!(
            "{url}/api/trades/quotes/{}",
            sell_quote_payload["quote_id"].as_str().unwrap()
        ))
        .send()
        .await
        .unwrap();
    assert_eq!(executed_sell_quote_status_response.status(), 200);
    let executed_sell_quote_status_payload: serde_json::Value =
        executed_sell_quote_status_response.json().await.unwrap();
    assert_eq!(
        executed_sell_quote_status_payload["status"].as_str(),
        Some("executed")
    );
}

#[tokio::test]
async fn test_lightning_funding_quote_settles_after_status_poll() {
    let url = create_product_test_server().await;
    let client = reqwest::Client::new();
    let pubkey = "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

    let quote_response = client
        .post(format!("{url}/v1/mint/quote/bolt11"))
        .header("x-cascade-edition", "signet")
        .json(&serde_json::json!({
            "pubkey": pubkey,
            "amount": 2500,
            "unit": "usd"
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(quote_response.status(), 200);
    let quote_payload: serde_json::Value = quote_response.json().await.unwrap();
    let quote_id = quote_payload["quote"].as_str().unwrap().to_string();
    assert_eq!(quote_payload["state"].as_str(), Some("UNPAID"));
    let invoice = quote_payload["request"].as_str().unwrap();
    assert!(Bolt11Invoice::from_str(invoice).is_ok());
    assert_eq!(quote_payload["amount"].as_u64(), Some(2500));
    assert_eq!(quote_payload["unit"].as_str(), Some("usd"));

    let get_quote_response = client
        .get(format!("{url}/v1/mint/quote/bolt11/{quote_id}"))
        .send()
        .await
        .unwrap();
    assert_eq!(get_quote_response.status(), 200);
    let get_quote_payload: serde_json::Value = get_quote_response.json().await.unwrap();
    assert_eq!(get_quote_payload["quote"].as_str(), Some(quote_id.as_str()));
    assert_eq!(get_quote_payload["state"].as_str(), Some("UNPAID"));

    let paid_quote = wait_for_mint_quote_state(&client, &url, &quote_id, &["PAID"]).await;
    assert_eq!(paid_quote["quote"].as_str(), Some(quote_id.as_str()));
    assert_eq!(paid_quote["state"].as_str(), Some("PAID"));
    let minted_proofs = mint_funding_quote_and_get_proofs(&client, &url, &paid_quote, 2500).await;
    assert!(minted_proofs.as_array().is_some());

    let issued_quote = wait_for_mint_quote_state(&client, &url, &quote_id, &["ISSUED"]).await;
    assert_eq!(issued_quote["state"].as_str(), Some("ISSUED"));
}

#[tokio::test]
async fn test_product_mint_info_advertises_bolt11_mint_and_melt() {
    let url = create_product_test_server().await;
    let client = reqwest::Client::new();

    let response = client.get(format!("{url}/v1/info")).send().await.unwrap();
    assert_eq!(response.status(), 200);

    let payload: serde_json::Value = response.json().await.unwrap();
    let nut04_methods = payload["nuts"]["4"]["methods"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    let nut05_methods = payload["nuts"]["5"]["methods"]
        .as_array()
        .cloned()
        .unwrap_or_default();

    assert!(nut04_methods.iter().any(|method| {
        method["method"].as_str() == Some("bolt11") && method["unit"].as_str() == Some("usd")
    }));
    assert!(nut05_methods.iter().any(|method| {
        method["method"].as_str() == Some("bolt11") && method["unit"].as_str() == Some("usd")
    }));
}

#[tokio::test]
async fn test_standard_bolt11_melt_routes_pay_invoice() {
    let (url, invoice_service) =
        create_product_test_server_bundle_with_funding(None, None, "signet").await;
    let client = reqwest::Client::new();

    let invoice = {
        let mut invoice_service = invoice_service.lock().await;
        invoice_service
            .create_invoice(
                1_750_000,
                Some("Cascade melt integration test".to_string()),
                Some(1800),
                false,
            )
            .await
            .unwrap()
    };

    let melt_quote_response = client
        .post(format!("{url}/v1/melt/quote/bolt11"))
        .json(&serde_json::json!({
            "request": invoice.bolt11().to_string(),
            "unit": "usd"
        }))
        .send()
        .await
        .unwrap();
    let melt_quote_status = melt_quote_response.status();
    let melt_quote_body = melt_quote_response.text().await.unwrap();
    assert_eq!(melt_quote_status, 200, "{melt_quote_body}");
    let melt_quote_payload: serde_json::Value = serde_json::from_str(&melt_quote_body).unwrap();
    let melt_quote_id = melt_quote_payload["quote"].as_str().unwrap().to_string();
    assert_eq!(melt_quote_payload["state"].as_str(), Some("UNPAID"));
    assert_eq!(
        melt_quote_payload["request"].as_str(),
        Some(invoice.bolt11())
    );

    let funding_amount_minor = melt_quote_payload["amount"].as_u64().unwrap()
        + melt_quote_payload["fee_reserve"].as_u64().unwrap_or(0);
    let funding_proofs = create_signet_funding_and_get_proofs(
        &client,
        &url,
        "9999999999999999999999999999999999999999999999999999999999999999",
        funding_amount_minor,
    )
    .await;

    let melt_response = client
        .post(format!("{url}/v1/melt/bolt11"))
        .json(&serde_json::json!({
            "quote": melt_quote_id,
            "inputs": funding_proofs
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(melt_response.status(), 200);
    let melt_payload: serde_json::Value = melt_response.json().await.unwrap();
    assert_eq!(melt_payload["state"].as_str(), Some("PAID"));
    assert!(melt_payload["payment_preimage"].as_str().is_some());

    let paid_quote = wait_for_melt_quote_state(
        &client,
        &url,
        melt_payload["quote"].as_str().unwrap(),
        &["PAID"],
    )
    .await;
    assert_eq!(paid_quote["state"].as_str(), Some("PAID"));
    assert!(paid_quote["payment_preimage"].as_str().is_some());

    let settled_invoice = {
        let invoice_service = invoice_service.lock().await;
        invoice_service
            .check_invoice_status(&invoice.payment_hash)
            .await
            .unwrap()
    };
    assert_eq!(
        settled_invoice,
        cascade_core::lightning::types::InvoiceState::Settled
    );
}

#[tokio::test]
async fn test_runtime_reports_actual_edition_and_funding_rails() {
    let url = create_product_test_server().await;
    let client = reqwest::Client::new();

    let response = client
        .get(format!("{url}/api/product/runtime"))
        .send()
        .await
        .unwrap();

    assert_eq!(response.status(), 200);
    let payload: serde_json::Value = response.json().await.unwrap();
    assert_eq!(payload["edition"].as_str(), Some("signet"));
    assert_eq!(payload["network"].as_str(), Some("signet"));
    assert_eq!(payload["proof_custody"].as_str(), Some("browser_local"));
    assert_eq!(
        payload["funding"]["lightning"]["available"].as_bool(),
        Some(true)
    );
    assert_eq!(
        payload["funding"]["stripe"]["available"].as_bool(),
        Some(false)
    );
    assert_eq!(
        payload["funding"]["usdc"]["available"].as_bool(),
        Some(false)
    );
    assert_eq!(
        payload["funding"]["usdc"]["reason"].as_str(),
        Some("usdc_mainnet_only")
    );
}

#[tokio::test]
async fn test_lightning_funding_rejects_client_edition_mismatch() {
    let url = create_product_test_server().await;
    let client = reqwest::Client::new();

    let response = client
        .post(format!("{url}/v1/mint/quote/bolt11"))
        .header("x-cascade-edition", "mainnet")
        .json(&serde_json::json!({
            "pubkey": "edition-mismatch-user",
            "amount": 2500,
            "unit": "usd"
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(response.status(), 409);
    let payload: serde_json::Value = response.json().await.unwrap();
    assert_eq!(
        payload["error"].as_str(),
        Some("edition_mismatch:expected=mainnet:actual=signet")
    );
}

#[tokio::test]
async fn test_lightning_funding_request_id_is_idempotent() {
    let url = create_product_test_server().await;
    let client = reqwest::Client::new();
    let pubkey = "efefefefefefefefefefefefefefefefefefefefefefefefefefefefefefefef";
    let request_id = "funding-request-idempotent-1";

    let first_response = client
        .post(format!("{url}/v1/mint/quote/bolt11"))
        .header("x-cascade-edition", "signet")
        .json(&serde_json::json!({
            "pubkey": pubkey,
            "amount": 2500,
            "unit": "usd",
            "request_id": request_id
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(first_response.status(), 200);
    let first_payload: serde_json::Value = first_response.json().await.unwrap();
    let quote_id = first_payload["quote"].as_str().unwrap().to_string();
    let invoice = first_payload["request"].as_str().unwrap().to_string();
    assert_eq!(first_payload["state"].as_str(), Some("UNPAID"));

    let second_response = client
        .post(format!("{url}/v1/mint/quote/bolt11"))
        .header("x-cascade-edition", "signet")
        .json(&serde_json::json!({
            "pubkey": pubkey,
            "amount": 2500,
            "unit": "usd",
            "request_id": request_id
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(second_response.status(), 200);
    let second_payload: serde_json::Value = second_response.json().await.unwrap();
    assert_eq!(second_payload["quote"].as_str(), Some(quote_id.as_str()));
    assert_eq!(second_payload["request"].as_str(), Some(invoice.as_str()));
    assert_eq!(second_payload["state"].as_str(), Some("UNPAID"));

    let request_status_response = client
        .get(format!("{url}/api/portfolio/funding/requests/{request_id}"))
        .send()
        .await
        .unwrap();
    assert_eq!(request_status_response.status(), 200);
    let request_status_payload: serde_json::Value = request_status_response.json().await.unwrap();
    assert_eq!(request_status_payload["status"].as_str(), Some("complete"));
    assert_eq!(
        request_status_payload["funding"]["id"].as_str(),
        Some(quote_id.as_str())
    );

    let paid_quote = wait_for_mint_quote_state(&client, &url, &quote_id, &["PAID"]).await;
    assert_eq!(paid_quote["state"].as_str(), Some("PAID"));
    let minted_proofs = mint_funding_quote_and_get_proofs(&client, &url, &paid_quote, 2500).await;
    assert!(minted_proofs.as_array().is_some());

    let issued_quote = wait_for_mint_quote_state(&client, &url, &quote_id, &["ISSUED"]).await;
    assert_eq!(issued_quote["state"].as_str(), Some("ISSUED"));
}

#[tokio::test]
async fn test_stripe_funding_completes_from_webhook() {
    let stripe_base_url = create_mock_stripe_server().await;
    let webhook_secret = "whsec_test_cascade";
    let url = create_product_test_server_with_stripe(Some(cascade_api::stripe::StripeConfig {
        secret_key: "sk_test_cascade".to_string(),
        webhook_secret: webhook_secret.to_string(),
        success_url: "https://cascade.test/portfolio?stripe=success&funding_id={FUNDING_ID}"
            .to_string(),
        cancel_url: "https://cascade.test/portfolio?stripe=cancel&funding_id={FUNDING_ID}"
            .to_string(),
        base_url: stripe_base_url,
        checkout_expiry_seconds: 1800,
        product_name: "Cascade Portfolio Funding".to_string(),
        max_funding_minor: 10_000,
        window_limit_minor: 25_000,
        window_seconds: 24 * 60 * 60,
        allowed_risk_levels: vec!["normal".to_string()],
    }))
    .await;
    let client = reqwest::Client::new();
    let pubkey = "f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0";
    let request_id = "stripe-funding-request-1";

    let create_response = client
        .post(format!("{url}/api/portfolio/funding/stripe"))
        .json(&serde_json::json!({
            "pubkey": pubkey,
            "amount_minor": 4200,
            "request_id": request_id
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(create_response.status(), 201);
    let create_payload: serde_json::Value = create_response.json().await.unwrap();
    let funding_id = create_payload["id"].as_str().unwrap().to_string();
    assert_eq!(create_payload["status"].as_str(), Some("pending"));
    assert_eq!(create_payload["rail"].as_str(), Some("stripe"));
    assert_eq!(
        create_payload["checkout_session_id"].as_str(),
        Some("cs_test_cascade")
    );
    assert_eq!(
        create_payload["checkout_url"].as_str(),
        Some("https://checkout.stripe.test/cs_test_cascade")
    );
    assert!(create_payload["invoice"].is_null());
    assert!(create_payload["fx_quote_id"].is_null());

    let request_status_response = client
        .get(format!("{url}/api/portfolio/funding/requests/{request_id}"))
        .send()
        .await
        .unwrap();
    assert_eq!(request_status_response.status(), 200);
    let request_status_payload: serde_json::Value = request_status_response.json().await.unwrap();
    assert_eq!(request_status_payload["status"].as_str(), Some("complete"));
    assert_eq!(
        request_status_payload["funding"]["id"].as_str(),
        Some(funding_id.as_str())
    );

    let event_body = serde_json::json!({
        "id": "evt_stripe_checkout_completed",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": "cs_test_cascade",
                "client_reference_id": funding_id,
                "payment_status": "paid",
                "payment_intent": "pi_test_cascade",
                "expires_at": chrono::Utc::now().timestamp() + 1800,
                "metadata": {
                    "funding_id": request_status_payload["funding"]["id"].as_str().unwrap()
                }
            }
        }
    })
    .to_string();
    let timestamp = chrono::Utc::now().timestamp();
    let signature = stripe_signature(webhook_secret, &event_body, timestamp);

    let webhook_response = client
        .post(format!("{url}/api/portfolio/funding/stripe/webhook"))
        .header("stripe-signature", signature)
        .header("content-type", "application/json")
        .body(event_body)
        .send()
        .await
        .unwrap();
    assert_eq!(webhook_response.status(), 200);

    let funding_status_response = client
        .get(format!("{url}/api/portfolio/funding/{funding_id}"))
        .send()
        .await
        .unwrap();
    assert_eq!(funding_status_response.status(), 200);
    let funding_status_payload: serde_json::Value = funding_status_response.json().await.unwrap();
    assert_eq!(funding_status_payload["status"].as_str(), Some("paid"));
    assert_eq!(
        funding_status_payload["risk_level"].as_str(),
        Some("normal")
    );
    assert!(funding_status_payload.get("issued_proofs").is_none());
}

#[tokio::test]
async fn test_stripe_funding_moves_to_review_required_for_high_risk() {
    let stripe_base_url = create_mock_stripe_server_with_risk_level("highest").await;
    let webhook_secret = "whsec_test_cascade";
    let url = create_product_test_server_with_stripe(Some(cascade_api::stripe::StripeConfig {
        secret_key: "sk_test_cascade".to_string(),
        webhook_secret: webhook_secret.to_string(),
        success_url: "https://cascade.test/portfolio?stripe=success&funding_id={FUNDING_ID}"
            .to_string(),
        cancel_url: "https://cascade.test/portfolio?stripe=cancel&funding_id={FUNDING_ID}"
            .to_string(),
        base_url: stripe_base_url,
        checkout_expiry_seconds: 1800,
        product_name: "Cascade Portfolio Funding".to_string(),
        max_funding_minor: 10_000,
        window_limit_minor: 25_000,
        window_seconds: 24 * 60 * 60,
        allowed_risk_levels: vec!["normal".to_string()],
    }))
    .await;
    let client = reqwest::Client::new();
    let pubkey = "1111111111111111111111111111111111111111111111111111111111111111";

    let create_response = client
        .post(format!("{url}/api/portfolio/funding/stripe"))
        .json(&serde_json::json!({
            "pubkey": pubkey,
            "amount_minor": 4200
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(create_response.status(), 201);
    let create_payload: serde_json::Value = create_response.json().await.unwrap();
    let funding_id = create_payload["id"].as_str().unwrap().to_string();

    let event_body = serde_json::json!({
        "id": "evt_stripe_checkout_high_risk",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": "cs_test_cascade",
                "client_reference_id": funding_id,
                "payment_status": "paid",
                "payment_intent": "pi_test_high_risk",
                "expires_at": chrono::Utc::now().timestamp() + 1800,
                "metadata": {
                    "funding_id": create_payload["id"].as_str().unwrap()
                }
            }
        }
    })
    .to_string();
    let timestamp = chrono::Utc::now().timestamp();
    let signature = stripe_signature(webhook_secret, &event_body, timestamp);

    let webhook_response = client
        .post(format!("{url}/api/portfolio/funding/stripe/webhook"))
        .header("stripe-signature", signature)
        .header("content-type", "application/json")
        .body(event_body)
        .send()
        .await
        .unwrap();
    assert_eq!(webhook_response.status(), 200);
    let webhook_payload: serde_json::Value = webhook_response.json().await.unwrap();
    assert_eq!(webhook_payload["status"].as_str(), Some("review_required"));

    let funding_status_response = client
        .get(format!("{url}/api/portfolio/funding/{funding_id}"))
        .send()
        .await
        .unwrap();
    assert_eq!(funding_status_response.status(), 200);
    let funding_status_payload: serde_json::Value = funding_status_response.json().await.unwrap();
    assert_eq!(
        funding_status_payload["status"].as_str(),
        Some("review_required")
    );
    assert_eq!(
        funding_status_payload["risk_level"].as_str(),
        Some("highest")
    );
    assert!(funding_status_payload.get("issued_proofs").is_none());
}

#[tokio::test]
async fn test_usdc_deposit_intent_unavailable_on_signet() {
    let url = create_product_test_server().await;
    let client = reqwest::Client::new();

    let response = client
        .post(format!("{url}/api/portfolio/funding/usdc/deposit-intents"))
        .header("x-cascade-edition", "signet")
        .json(&serde_json::json!({
            "pubkey": "usdc-signet-user",
            "requested_wallet_amount_minor": 5000
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(response.status(), 503);
    let payload: serde_json::Value = response.json().await.unwrap();
    assert_eq!(payload["error"].as_str(), Some("usdc_mainnet_only"));
}

#[tokio::test]
async fn test_usdc_deposit_intent_create_and_fetch() {
    let url = create_product_test_server_with_usdc(
        Some(cascade_api::usdc::UsdcConfig {
            network: "base".to_string(),
            asset: "USDC".to_string(),
            treasury_address: "0x1111111111111111111111111111111111111111".to_string(),
            deposit_intent_expiry_seconds: 3600,
            withdrawals_enabled: false,
        }),
        "mainnet",
    )
    .await;
    let client = reqwest::Client::new();

    let create_response = client
        .post(format!("{url}/api/portfolio/funding/usdc/deposit-intents"))
        .header("x-cascade-edition", "mainnet")
        .json(&serde_json::json!({
            "pubkey": "usdc-mainnet-user",
            "requested_wallet_amount_minor": 12500,
            "provider": "moonpay"
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(create_response.status(), 201);
    let create_payload: serde_json::Value = create_response.json().await.unwrap();
    let intent_id = create_payload["id"].as_str().unwrap().to_string();
    assert_eq!(create_payload["asset"].as_str(), Some("USDC"));
    assert_eq!(create_payload["network"].as_str(), Some("base"));
    assert_eq!(
        create_payload["destination_address"].as_str(),
        Some("0x1111111111111111111111111111111111111111")
    );
    assert_eq!(create_payload["provider"].as_str(), Some("moonpay"));
    assert_eq!(create_payload["status"].as_str(), Some("pending"));
    assert_eq!(
        create_payload["requested_wallet_amount_minor"].as_u64(),
        Some(12_500)
    );

    let get_response = client
        .get(format!(
            "{url}/api/portfolio/funding/usdc/deposit-intents/{intent_id}"
        ))
        .send()
        .await
        .unwrap();
    assert_eq!(get_response.status(), 200);
    let get_payload: serde_json::Value = get_response.json().await.unwrap();
    assert_eq!(get_payload["id"].as_str(), Some(intent_id.as_str()));
    assert_eq!(get_payload["status"].as_str(), Some("pending"));
    assert_eq!(get_payload["provider"].as_str(), Some("moonpay"));
    assert!(get_payload["expires_at"].as_i64().is_some());
}

#[tokio::test]
async fn test_usdc_withdrawal_unavailable_on_signet() {
    let url = create_product_test_server().await;
    let client = reqwest::Client::new();

    let response = client
        .post(format!("{url}/api/portfolio/withdrawals/usdc"))
        .header("x-cascade-edition", "signet")
        .json(&serde_json::json!({
            "pubkey": "usdc-signet-user",
            "amount_minor": 5000,
            "destination_address": "0x1111111111111111111111111111111111111111",
            "proofs": [
                {
                    "amount": 1,
                    "id": "deadbeef",
                    "secret": "secret",
                    "C": "02aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                    "witness": null,
                    "dleq": null
                }
            ],
            "change_outputs": []
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(response.status(), 503);
    let payload: serde_json::Value = response.json().await.unwrap();
    assert_eq!(payload["error"].as_str(), Some("usdc_mainnet_only"));
}

#[tokio::test]
async fn test_usdc_withdrawal_requires_explicit_enablement() {
    let (url, invoice_service) = create_product_test_server_with_usdc_bundle(
        Some(cascade_api::usdc::UsdcConfig {
            network: "base".to_string(),
            asset: "USDC".to_string(),
            treasury_address: "0x1111111111111111111111111111111111111111".to_string(),
            deposit_intent_expiry_seconds: 3600,
            withdrawals_enabled: false,
        }),
        "mainnet",
    )
    .await;
    let client = reqwest::Client::new();
    let proofs = create_wallet_funding_and_get_proofs_with_invoice_service(
        &client,
        &url,
        "usdc-mainnet-user",
        5000,
        "mainnet",
        Some(&invoice_service),
    )
    .await;

    let response = client
        .post(format!("{url}/api/portfolio/withdrawals/usdc"))
        .header("x-cascade-edition", "mainnet")
        .json(&serde_json::json!({
            "pubkey": "usdc-mainnet-user",
            "amount_minor": 2500,
            "destination_address": "0x1111111111111111111111111111111111111111",
            "proofs": proofs,
            "change_outputs": []
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(response.status(), 503);
    let payload: serde_json::Value = response.json().await.unwrap();
    assert_eq!(
        payload["error"].as_str(),
        Some("usdc_withdrawals_unavailable")
    );
}

#[tokio::test]
async fn test_usdc_withdrawal_create_fetch_and_idempotency() {
    let (url, invoice_service) = create_product_test_server_with_usdc_bundle(
        Some(cascade_api::usdc::UsdcConfig {
            network: "base".to_string(),
            asset: "USDC".to_string(),
            treasury_address: "0x1111111111111111111111111111111111111111".to_string(),
            deposit_intent_expiry_seconds: 3600,
            withdrawals_enabled: true,
        }),
        "mainnet",
    )
    .await;
    let client = reqwest::Client::new();
    let pubkey = "usdc-withdraw-mainnet-user";
    let proofs = create_wallet_funding_and_get_proofs_with_invoice_service(
        &client,
        &url,
        pubkey,
        5000,
        "mainnet",
        Some(&invoice_service),
    )
    .await;
    let usd_keyset = fetch_active_usd_keyset(&client, &url).await;
    let (change_outputs, _) = prepare_outputs(&usd_keyset, 1000, TEST_USD_DENOMINATIONS);

    let request_body = serde_json::json!({
        "pubkey": pubkey,
        "amount_minor": 4000,
        "destination_address": "0x2222222222222222222222222222222222222222",
        "proofs": proofs,
        "change_outputs": change_outputs,
        "provider": "manual",
        "request_id": "usdc-withdrawal-1"
    });

    let create_response = client
        .post(format!("{url}/api/portfolio/withdrawals/usdc"))
        .header("x-cascade-edition", "mainnet")
        .json(&request_body)
        .send()
        .await
        .unwrap();
    assert_eq!(create_response.status(), 202);
    let create_payload: serde_json::Value = create_response.json().await.unwrap();
    let withdrawal_id = create_payload["id"].as_str().unwrap().to_string();
    assert_eq!(create_payload["status"].as_str(), Some("pending"));
    assert_eq!(create_payload["asset"].as_str(), Some("USDC"));
    assert_eq!(create_payload["network"].as_str(), Some("base"));
    assert_eq!(
        create_payload["destination_address"].as_str(),
        Some("0x2222222222222222222222222222222222222222")
    );
    assert_eq!(create_payload["amount_minor"].as_u64(), Some(4_000));
    assert_eq!(create_payload["asset_units"].as_u64(), Some(40_000_000));
    assert_eq!(create_payload["provider"].as_str(), Some("manual"));
    assert_eq!(
        create_payload["request_id"].as_str(),
        Some("usdc-withdrawal-1")
    );
    let change_amount = create_payload["change"]["signatures"]
        .as_array()
        .unwrap()
        .iter()
        .map(|signature| signature["amount"].as_u64().unwrap())
        .sum::<u64>();
    assert_eq!(change_amount, 1000);

    let get_response = client
        .get(format!(
            "{url}/api/portfolio/withdrawals/usdc/{withdrawal_id}"
        ))
        .send()
        .await
        .unwrap();
    assert_eq!(get_response.status(), 200);
    let get_payload: serde_json::Value = get_response.json().await.unwrap();
    assert_eq!(get_payload["id"].as_str(), Some(withdrawal_id.as_str()));
    assert_eq!(get_payload["status"].as_str(), Some("pending"));
    assert_eq!(get_payload["change"]["unit"].as_str(), Some("usd"));

    let request_lookup_response = client
        .get(format!(
            "{url}/api/portfolio/withdrawals/usdc/requests/usdc-withdrawal-1"
        ))
        .send()
        .await
        .unwrap();
    assert_eq!(request_lookup_response.status(), 200);
    let request_lookup_payload: serde_json::Value = request_lookup_response.json().await.unwrap();
    assert_eq!(
        request_lookup_payload["id"].as_str(),
        Some(withdrawal_id.as_str())
    );

    let replay_response = client
        .post(format!("{url}/api/portfolio/withdrawals/usdc"))
        .header("x-cascade-edition", "mainnet")
        .json(&request_body)
        .send()
        .await
        .unwrap();
    assert_eq!(replay_response.status(), 200);
    let replay_payload: serde_json::Value = replay_response.json().await.unwrap();
    assert_eq!(replay_payload["id"].as_str(), Some(withdrawal_id.as_str()));
    assert_eq!(replay_payload["status"].as_str(), Some("pending"));
}

#[tokio::test]
async fn test_trade_execution_requires_input_proofs() {
    let url = create_product_test_server().await;
    let client = reqwest::Client::new();
    let creator = "abababababababababababababababababababababababababababababababab";
    let event_id = "cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd";
    let slug = "proof-required-market";

    client
        .post(format!("{url}/api/product/markets"))
        .json(&serde_json::json!({
            "event_id": event_id,
            "title": "Proof Required Market",
            "description": "Trade execution must require input proofs",
            "slug": slug,
            "body": "Proof-required body",
            "creator_pubkey": creator,
            "raw_event": sample_market_event(event_id, slug, creator),
            "b": 10.0
        }))
        .send()
        .await
        .unwrap();

    let buy_response = client
        .post(format!("{url}/api/trades/buy"))
        .json(&serde_json::json!({
            "event_id": event_id,
            "pubkey": creator,
            "side": "yes",
            "spend_minor": 4000
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(buy_response.status(), 400);
    let buy_payload: serde_json::Value = buy_response.json().await.unwrap();
    assert_eq!(buy_payload["error"].as_str(), Some("input_proofs_required"));

    let sell_response = client
        .post(format!("{url}/api/trades/sell"))
        .json(&serde_json::json!({
            "event_id": event_id,
            "pubkey": creator,
            "side": "yes",
            "quantity": 1.0
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(sell_response.status(), 400);
    let sell_payload: serde_json::Value = sell_response.json().await.unwrap();
    assert_eq!(
        sell_payload["error"].as_str(),
        Some("input_proofs_required")
    );
}

#[tokio::test]
async fn test_trade_request_id_is_idempotent() {
    let url = create_product_test_server().await;
    let client = reqwest::Client::new();
    let creator = "5656565656565656565656565656565656565656565656565656565656565656";
    let event_id = "7878787878787878787878787878787878787878787878787878787878787878";
    let slug = "trade-request-idempotency-market";
    let request_id = "req-buy-idempotent-1";

    client
        .post(format!("{url}/api/product/markets"))
        .json(&serde_json::json!({
            "event_id": event_id,
            "title": "Trade Request Idempotency Market",
            "description": "Ensure duplicate request ids do not double execute",
            "slug": slug,
            "body": "Trade request idempotency body",
            "creator_pubkey": creator,
            "raw_event": sample_market_event(event_id, slug, creator),
            "b": 10.0
        }))
        .send()
        .await
        .unwrap();

    let funding_proofs: Vec<Proof> = serde_json::from_value(
        create_signet_funding_and_get_proofs(&client, &url, creator, 10_000).await,
    )
    .unwrap();
    let usd_keyset = fetch_active_usd_keyset(&client, &url).await;
    let market_keyset = fetch_market_keyset(&client, &url, event_id, "yes").await;
    let buy_quote_response = client
        .post(format!("{url}/api/trades/quote"))
        .json(&serde_json::json!({
            "event_id": event_id,
            "side": "yes",
            "spend_minor": 4000
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(buy_quote_response.status(), 200);
    let buy_quote_payload: serde_json::Value = buy_quote_response.json().await.unwrap();
    let (issued_outputs, _issued_pre_mint) = prepare_outputs(
        &market_keyset,
        buy_quote_payload["quantity_minor"].as_u64().unwrap(),
        TEST_MARKET_DENOMINATIONS,
    );
    let (change_outputs, _change_pre_mint) = prepare_outputs(
        &usd_keyset,
        proof_amount_total(&funding_proofs).saturating_sub(4000),
        TEST_USD_DENOMINATIONS,
    );

    let first_buy_response = client
        .post(format!("{url}/api/trades/buy"))
        .json(&serde_json::json!({
            "event_id": event_id,
            "pubkey": creator,
            "side": "yes",
            "spend_minor": 4000,
            "request_id": request_id,
            "proofs": funding_proofs.clone(),
            "issued_outputs": issued_outputs,
            "change_outputs": change_outputs
        }))
        .send()
        .await
        .unwrap();
    let first_buy_status = first_buy_response.status();
    let first_buy_payload: serde_json::Value = first_buy_response.json().await.unwrap();
    assert_eq!(first_buy_status, 201, "buy payload: {first_buy_payload}");
    let trade_id = first_buy_payload["trade"]["id"]
        .as_str()
        .unwrap()
        .to_string();

    let second_buy_response = client
        .post(format!("{url}/api/trades/buy"))
        .json(&serde_json::json!({
            "event_id": event_id,
            "pubkey": creator,
            "side": "yes",
            "spend_minor": 4000,
            "request_id": request_id,
            "proofs": funding_proofs,
            "issued_outputs": [],
            "change_outputs": []
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(second_buy_response.status(), 200);
    let second_buy_payload: serde_json::Value = second_buy_response.json().await.unwrap();
    assert_eq!(
        second_buy_payload["trade"]["id"].as_str(),
        Some(trade_id.as_str())
    );

    let request_status_response = client
        .get(format!("{url}/api/trades/requests/{request_id}"))
        .send()
        .await
        .unwrap();
    assert_eq!(request_status_response.status(), 200);
    let request_status_payload: serde_json::Value = request_status_response.json().await.unwrap();
    assert_eq!(request_status_payload["status"].as_str(), Some("complete"));
    assert_eq!(
        request_status_payload["trade"]["id"].as_str(),
        Some(trade_id.as_str())
    );

    let detail_response = client
        .get(format!("{url}/api/product/markets/slug/{slug}"))
        .send()
        .await
        .unwrap();
    assert_eq!(detail_response.status(), 200);
    let detail_payload: serde_json::Value = detail_response.json().await.unwrap();
    assert_eq!(
        detail_payload["trades"].as_array().map(|items| items.len()),
        Some(1)
    );
}

#[tokio::test]
async fn test_lightning_fx_quote_preview() {
    let url = create_product_test_server().await;
    let client = reqwest::Client::new();

    let response = client
        .get(format!("{url}/api/product/fx/lightning/2500"))
        .send()
        .await
        .unwrap();

    assert_eq!(response.status(), 200);
    let payload: serde_json::Value = response.json().await.unwrap();
    assert_eq!(payload["amount_minor"].as_u64(), Some(2500));
    assert!(payload["amount_msat"].as_u64().unwrap() > 0);
    assert!(payload["btc_usd_price"].as_f64().unwrap() > 0.0);
    assert!(
        payload["metadata"]["reference_btc_usd_price"]
            .as_f64()
            .unwrap()
            > 0.0
    );
    assert!(payload["metadata"]["execution_spread_bps"]
        .as_u64()
        .is_some());
    assert!(payload["metadata"]["provider_count"].as_u64().is_some());
    assert_eq!(
        payload["metadata"]["quote_direction"].as_str(),
        Some("usd_to_msat")
    );
    assert!(payload["observations"]
        .as_array()
        .map(|items| !items.is_empty())
        .unwrap_or(false));
}

#[tokio::test]
async fn test_signet_funding_enforces_single_and_window_limits() {
    let url = create_product_test_server().await;
    let client = reqwest::Client::new();
    let pubkey = "abababababababababababababababababababababababababababababababab";

    let too_large_response = client
        .post(format!("{url}/v1/mint/quote/bolt11"))
        .header("x-cascade-edition", "signet")
        .json(&serde_json::json!({
            "pubkey": pubkey,
            "amount": 10001,
            "unit": "usd"
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(too_large_response.status(), 400);
    let too_large_payload: serde_json::Value = too_large_response.json().await.unwrap();
    assert_eq!(
        too_large_payload["error"].as_str(),
        Some("signet_funding_single_limit_exceeded:max_minor=10000")
    );

    for amount_minor in [10_000_u64, 10_000_u64, 5_000_u64] {
        let response = client
            .post(format!("{url}/v1/mint/quote/bolt11"))
            .header("x-cascade-edition", "signet")
            .json(&serde_json::json!({
                "pubkey": pubkey,
                "amount": amount_minor,
                "unit": "usd"
            }))
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), 200);
    }

    let capped_response = client
        .post(format!("{url}/v1/mint/quote/bolt11"))
        .header("x-cascade-edition", "signet")
        .json(&serde_json::json!({
            "pubkey": pubkey,
            "amount": 100,
            "unit": "usd"
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(capped_response.status(), 429);
    let capped_payload: serde_json::Value = capped_response.json().await.unwrap();
    assert_eq!(
        capped_payload["error"].as_str(),
        Some("signet_funding_window_limit_exceeded:window_minor=25000:remaining_minor=0")
    );
}
