//! API Integration Tests for Cascade Cashu Mint
//!
//! Tests that verify the Cashu API endpoints work correctly.
//! These tests start a local server and make HTTP requests to it.

use axum::Router;
use cdk::mint::{MintBuilder, UnitConfig};
use cdk::nuts::CurrencyUnit;
use std::sync::Arc;
use tokio::net::TcpListener;

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

    let seed = [7_u8; 32];
    let mint = Arc::new(builder.build_with_seed(cdk_db, &seed).await.unwrap());
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
        cascade_core::LndConfig {
            host: "127.0.0.1:10009".to_string(),
            cert_path: None,
            macaroon_path: None,
            tls_domain: None,
            network: None,
            cli_path: None,
        },
        mint,
        cascade_db,
        "signet",
    )
    .await
    .unwrap();

    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let url = format!("http://{}", addr);

    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    url
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

async fn create_signet_topup_and_get_proofs(
    client: &reqwest::Client,
    url: &str,
    pubkey: &str,
    amount_minor: u64,
) -> serde_json::Value {
    let response = client
        .post(format!("{url}/api/wallet/topups/lightning/quote"))
        .json(&serde_json::json!({
            "pubkey": pubkey,
            "amount_minor": amount_minor
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), 201);
    let payload: serde_json::Value = response.json().await.unwrap();
    assert_eq!(payload["status"].as_str(), Some("invoice_pending"));
    let quote_id = payload["id"].as_str().unwrap();
    wait_for_topup_completion(client, url, quote_id).await["issued_proofs"].clone()
}

async fn wait_for_topup_completion(
    client: &reqwest::Client,
    url: &str,
    quote_id: &str,
) -> serde_json::Value {
    for _ in 0..20 {
        let response = client
            .get(format!("{url}/api/wallet/topups/{quote_id}"))
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), 200);
        let payload: serde_json::Value = response.json().await.unwrap();
        if payload["status"].as_str() == Some("complete") {
            return payload;
        }
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    }

    panic!("topup quote {quote_id} did not complete in time");
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

    let topup_proofs = create_signet_topup_and_get_proofs(&client, &url, creator, 10_000).await;

    let buy_response = client
        .post(format!("{url}/api/product/markets/{event_id}/buy"))
        .json(&serde_json::json!({
            "pubkey": creator,
            "side": "yes",
            "spend_minor": 8000,
            "proofs": topup_proofs
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(buy_response.status(), 201);
    let buy_payload: serde_json::Value = buy_response.json().await.unwrap();
    assert_eq!(buy_payload["market"]["visibility"].as_str(), Some("public"));
    assert_eq!(
        buy_payload["settlement"]["mode"].as_str(),
        Some("bolt11_internal")
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
    let first_quantity = buy_payload["wallet"]["positions"][0]["quantity"]
        .as_f64()
        .unwrap();
    let issued_market_proofs = buy_payload["issued"]["proofs"].clone();
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

    let sell_response = client
        .post(format!("{url}/api/product/markets/{event_id}/sell"))
        .json(&serde_json::json!({
            "pubkey": creator,
            "side": "yes",
            "quantity": first_quantity / 2.0,
            "proofs": issued_market_proofs
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(sell_response.status(), 201);
    let sell_payload: serde_json::Value = sell_response.json().await.unwrap();
    assert!(sell_payload["wallet"]["available_minor"].as_u64().unwrap() > 2000);
    assert_eq!(
        sell_payload["settlement"]["mode"].as_str(),
        Some("bolt11_internal")
    );
    assert_eq!(
        sell_payload["settlement"]["rail"].as_str(),
        Some("lightning")
    );
    assert!(sell_payload["settlement"]["invoice"].as_str().is_some());
    assert!(sell_payload["settlement"]["payment_hash"]
        .as_str()
        .is_some());

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

    let topup_proofs = create_signet_topup_and_get_proofs(&client, &url, creator, 10_000).await;

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

    let buy_response = client
        .post(format!("{url}/api/trades/buy"))
        .json(&serde_json::json!({
            "event_id": event_id,
            "pubkey": creator,
            "side": "yes",
            "spend_minor": 4000,
            "quote_id": buy_quote_id,
            "proofs": topup_proofs
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(buy_response.status(), 201);
    let buy_payload: serde_json::Value = buy_response.json().await.unwrap();
    let trade_id = buy_payload["trade"]["id"].as_str().unwrap().to_string();
    let quantity = buy_payload["wallet"]["positions"][0]["quantity"]
        .as_f64()
        .unwrap();
    let issued_market_proofs = buy_payload["issued"]["proofs"].clone();
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
        Some("bolt11_internal")
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

    let sell_response = client
        .post(format!("{url}/api/trades/sell"))
        .json(&serde_json::json!({
            "event_id": event_id,
            "pubkey": creator,
            "side": "yes",
            "quantity": quantity / 2.0,
            "quote_id": sell_quote_id,
            "proofs": issued_market_proofs
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(sell_response.status(), 201);
    let sell_payload: serde_json::Value = sell_response.json().await.unwrap();
    assert!(sell_payload["wallet"]["available_minor"].as_u64().unwrap() > 0);

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
async fn test_lightning_topup_quote_settles_after_status_poll() {
    let url = create_product_test_server().await;
    let client = reqwest::Client::new();
    let pubkey = "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

    let quote_response = client
        .post(format!("{url}/api/wallet/topups/lightning/quote"))
        .json(&serde_json::json!({
            "pubkey": pubkey,
            "amount_minor": 2500
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(quote_response.status(), 201);
    let quote_payload: serde_json::Value = quote_response.json().await.unwrap();
    let quote_id = quote_payload["id"].as_str().unwrap().to_string();
    assert_eq!(quote_payload["status"].as_str(), Some("invoice_pending"));
    assert!(quote_payload["invoice"]
        .as_str()
        .unwrap()
        .starts_with("lnbc"));
    assert!(quote_payload["amount_msat"].as_u64().unwrap() > 0);
    assert!(quote_payload["fx_quote_id"].as_str().is_some());
    assert!(quote_payload["observations"].as_array().is_some());
    assert!(quote_payload["issued_proofs"].is_null());

    let wallet_pending_response = client
        .get(format!("{url}/api/product/portfolio/{pubkey}"))
        .send()
        .await
        .unwrap();
    assert_eq!(wallet_pending_response.status(), 200);
    let wallet_pending_payload: serde_json::Value = wallet_pending_response.json().await.unwrap();
    assert_eq!(wallet_pending_payload["available_minor"].as_u64(), Some(0));
    assert_eq!(wallet_pending_payload["pending_minor"].as_u64(), Some(2500));
    assert_eq!(
        wallet_pending_payload["pending_topups"]
            .as_array()
            .map(|items| items.len()),
        Some(1)
    );

    let get_quote_response = client
        .get(format!("{url}/api/wallet/topups/lightning/{quote_id}"))
        .send()
        .await
        .unwrap();
    assert_eq!(get_quote_response.status(), 200);
    let get_quote_payload: serde_json::Value = get_quote_response.json().await.unwrap();
    assert_eq!(get_quote_payload["id"].as_str(), Some(quote_id.as_str()));
    assert_eq!(
        get_quote_payload["status"].as_str(),
        Some("invoice_pending")
    );

    let completed_payload = wait_for_topup_completion(&client, &url, &quote_id).await;
    assert_eq!(completed_payload["id"].as_str(), Some(quote_id.as_str()));
    assert_eq!(completed_payload["status"].as_str(), Some("complete"));
    assert!(completed_payload["issued_proofs"].as_array().is_some());

    let wallet_complete_response = client
        .get(format!("{url}/api/product/portfolio/{pubkey}"))
        .send()
        .await
        .unwrap();
    assert_eq!(wallet_complete_response.status(), 200);
    let wallet_complete_payload: serde_json::Value = wallet_complete_response.json().await.unwrap();
    assert_eq!(
        wallet_complete_payload["available_minor"].as_u64(),
        Some(2500)
    );
    assert_eq!(wallet_complete_payload["pending_minor"].as_u64(), Some(0));
    assert_eq!(
        wallet_complete_payload["pending_topups"]
            .as_array()
            .map(|items| items.len()),
        Some(0)
    );
    assert_eq!(
        wallet_complete_payload["funding_events"][0]["rail"].as_str(),
        Some("lightning")
    );
}

#[tokio::test]
async fn test_lightning_topup_request_id_is_idempotent() {
    let url = create_product_test_server().await;
    let client = reqwest::Client::new();
    let pubkey = "efefefefefefefefefefefefefefefefefefefefefefefefefefefefefefefef";
    let request_id = "topup-request-idempotent-1";

    let first_response = client
        .post(format!("{url}/api/wallet/topups/lightning/quote"))
        .json(&serde_json::json!({
            "pubkey": pubkey,
            "amount_minor": 2500,
            "request_id": request_id
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(first_response.status(), 201);
    let first_payload: serde_json::Value = first_response.json().await.unwrap();
    let quote_id = first_payload["id"].as_str().unwrap().to_string();
    let invoice = first_payload["invoice"].as_str().unwrap().to_string();
    assert_eq!(first_payload["status"].as_str(), Some("invoice_pending"));
    assert!(first_payload["issued_proofs"].is_null());

    let second_response = client
        .post(format!("{url}/api/wallet/topups/lightning/quote"))
        .json(&serde_json::json!({
            "pubkey": pubkey,
            "amount_minor": 2500,
            "request_id": request_id
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(second_response.status(), 200);
    let second_payload: serde_json::Value = second_response.json().await.unwrap();
    assert_eq!(second_payload["id"].as_str(), Some(quote_id.as_str()));
    assert_eq!(second_payload["invoice"].as_str(), Some(invoice.as_str()));
    assert_eq!(second_payload["status"].as_str(), Some("invoice_pending"));

    let request_status_response = client
        .get(format!("{url}/api/wallet/topups/requests/{request_id}"))
        .send()
        .await
        .unwrap();
    assert_eq!(request_status_response.status(), 200);
    let request_status_payload: serde_json::Value = request_status_response.json().await.unwrap();
    assert_eq!(request_status_payload["status"].as_str(), Some("complete"));
    assert_eq!(
        request_status_payload["topup"]["id"].as_str(),
        Some(quote_id.as_str())
    );

    let wallet_pending_response = client
        .get(format!("{url}/api/product/portfolio/{pubkey}"))
        .send()
        .await
        .unwrap();
    assert_eq!(wallet_pending_response.status(), 200);
    let wallet_pending_payload: serde_json::Value = wallet_pending_response.json().await.unwrap();
    assert_eq!(wallet_pending_payload["available_minor"].as_u64(), Some(0));
    assert_eq!(wallet_pending_payload["pending_minor"].as_u64(), Some(2500));
    assert_eq!(
        wallet_pending_payload["pending_topups"]
            .as_array()
            .map(|items| items.len()),
        Some(1)
    );

    let completed_payload = wait_for_topup_completion(&client, &url, &quote_id).await;
    assert_eq!(completed_payload["status"].as_str(), Some("complete"));
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

    let topup_proofs = create_signet_topup_and_get_proofs(&client, &url, creator, 10_000).await;

    let first_buy_response = client
        .post(format!("{url}/api/trades/buy"))
        .json(&serde_json::json!({
            "event_id": event_id,
            "pubkey": creator,
            "side": "yes",
            "spend_minor": 4000,
            "request_id": request_id,
            "proofs": topup_proofs.clone()
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(first_buy_response.status(), 201);
    let first_buy_payload: serde_json::Value = first_buy_response.json().await.unwrap();
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
            "proofs": topup_proofs
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

    let wallet_response = client
        .get(format!("{url}/api/product/portfolio/{creator}"))
        .send()
        .await
        .unwrap();
    assert_eq!(wallet_response.status(), 200);
    let wallet_payload: serde_json::Value = wallet_response.json().await.unwrap();
    assert_eq!(wallet_payload["available_minor"].as_u64(), Some(6000));

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
    assert!(payload["observations"]
        .as_array()
        .map(|items| !items.is_empty())
        .unwrap_or(false));
}

#[tokio::test]
async fn test_signet_topup_enforces_single_and_window_limits() {
    let url = create_product_test_server().await;
    let client = reqwest::Client::new();
    let pubkey = "abababababababababababababababababababababababababababababababab";

    let too_large_response = client
        .post(format!("{url}/api/wallet/topups/lightning/quote"))
        .json(&serde_json::json!({
            "pubkey": pubkey,
            "amount_minor": 10001
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(too_large_response.status(), 400);
    let too_large_payload: serde_json::Value = too_large_response.json().await.unwrap();
    assert_eq!(
        too_large_payload["error"].as_str(),
        Some("signet_topup_single_limit_exceeded:max_minor=10000")
    );

    for amount_minor in [10_000_u64, 10_000_u64, 5_000_u64] {
        let response = client
            .post(format!("{url}/api/wallet/topups/lightning/quote"))
            .json(&serde_json::json!({
                "pubkey": pubkey,
                "amount_minor": amount_minor
            }))
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), 201);
    }

    let capped_response = client
        .post(format!("{url}/api/wallet/topups/lightning/quote"))
        .json(&serde_json::json!({
            "pubkey": pubkey,
            "amount_minor": 100
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(capped_response.status(), 429);
    let capped_payload: serde_json::Value = capped_response.json().await.unwrap();
    assert_eq!(
        capped_payload["error"].as_str(),
        Some("signet_topup_window_limit_exceeded:window_minor=25000:remaining_minor=0")
    );
}
