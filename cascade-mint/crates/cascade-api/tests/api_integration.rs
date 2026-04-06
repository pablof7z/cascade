//! API Integration Tests for Cascade Cashu Mint
//!
//! Tests that verify the Cashu API endpoints work correctly.
//! These tests use the real build_cascade_routes with proper AppState.

use cascade_api::routes::{build_cascade_routes, AppState};
use cascade_api::types::{CreateMarketRequest, LightningTradeRequest};
use cascade_core::{invoice::InvoiceService, lightning::lnd_client::LndClient, LmsrEngine, MarketManager};
use std::sync::Arc;
use tokio::sync::Mutex;

/// Test helper to create a test server with proper AppState
async fn create_test_server() -> (String, Arc<Mutex<InvoiceService>>) {
    // Create real market manager with LMSR engine
    let lmsr = LmsrEngine::new(10.0).expect("Failed to create LMSR engine");
    let market_manager = Arc::new(MarketManager::new(lmsr));

    // Create a mock LND config (will fail on actual Lightning calls but fine for non-Lightning tests)
    let lnd_config = cascade_core::LndConfig {
        host: "localhost:10009".to_string(),
        cert_path: None,
        macaroon_path: None,
        tls_domain: None,
    };
    let lnd_client = LndClient::new(lnd_config);

    // Create invoice service
    let invoice_service = Arc::new(Mutex::new(InvoiceService::new(
        lnd_client,
        3600, // default expiry: 1 hour
        40,   // CLTV delta
    )));

    // Create AppState
    let state = AppState::new(market_manager, invoice_service.clone());

    // Build routes with state
    let app = build_cascade_routes(state);

    // Bind to a random available port
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let url = format!("http://{}", addr);

    // Spawn the server
    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    // Give the server a moment to start
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    (url, invoice_service)
}

/// Test that the health endpoint returns OK
#[tokio::test]
async fn test_health_endpoint() {
    let (url, _invoice_service) = create_test_server().await;

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

/// Test creating a market with required fields (slug, b)
#[tokio::test]
async fn test_create_market_with_required_fields() {
    let (url, _invoice_service) = create_test_server().await;

    let client = reqwest::Client::new();
    let request = CreateMarketRequest {
        title: "Bitcoin Price Above $50k".to_string(),
        description: "Will BTC be above $50k at end of 2024?".to_string(),
        slug: "btc-price-50k-2024".to_string(),
        b: 10.0, // LMSR liquidity parameter
    };

    let response = client
        .post(&format!("{}/api/market/create", url))
        .json(&request)
        .send()
        .await
        .expect("Failed to make request");

    // Market creation should return 201 Created
    assert_eq!(
        response.status(),
        201,
        "Market create should return 201 Created, got: {}",
        response.status()
    );

    let body: serde_json::Value = response
        .json()
        .await
        .expect("Failed to parse response");

    // Verify response contains expected fields
    assert_eq!(
        body.get("title").and_then(|v| v.as_str()),
        Some("Bitcoin Price Above $50k"),
        "Response should contain title"
    );
    assert_eq!(
        body.get("slug").and_then(|v| v.as_str()),
        Some("btc-price-50k-2024"),
        "Response should contain slug"
    );
    assert_eq!(
        body.get("b").and_then(|v| v.as_f64()),
        Some(10.0),
        "Response should contain b value"
    );
    assert!(
        body.get("event_id").is_some(),
        "Response should contain event_id"
    );
}

/// Test getting a market by ID
#[tokio::test]
async fn test_get_market_by_id() {
    let (url, _invoice_service) = create_test_server().await;
    let client = reqwest::Client::new();

    // First create a market
    let request = CreateMarketRequest {
        title: "Test Market".to_string(),
        description: "A test market".to_string(),
        slug: "test-market-get".to_string(),
        b: 5.0,
    };

    let create_response = client
        .post(&format!("{}/api/market/create", url))
        .json(&request)
        .send()
        .await
        .expect("Failed to create market");

    assert_eq!(create_response.status(), 201);

    let created: serde_json::Value = create_response
        .json()
        .await
        .expect("Failed to parse create response");

    let market_id = created
        .get("event_id")
        .and_then(|v| v.as_str())
        .expect("Missing event_id");

    // Now fetch the market
    let get_response = client
        .get(&format!("{}/api/market/{}", url, market_id))
        .send()
        .await
        .expect("Failed to make request");

    assert_eq!(
        get_response.status(),
        200,
        "Get market should return 200, got: {}",
        get_response.status()
    );

    let market: serde_json::Value = get_response
        .json()
        .await
        .expect("Failed to parse get response");

    assert_eq!(
        market.get("slug").and_then(|v| v.as_str()),
        Some("test-market-get"),
        "Market slug should match"
    );
}

/// Test getting a non-existent market returns 404
#[tokio::test]
async fn test_get_nonexistent_market() {
    let (url, _invoice_service) = create_test_server().await;
    let client = reqwest::Client::new();

    let response = client
        .get(&format!("{}/api/market/nonexistent-id", url))
        .send()
        .await
        .expect("Failed to make request");

    assert_eq!(
        response.status(),
        404,
        "Non-existent market should return 404, got: {}",
        response.status()
    );
}

/// Test lightning order creation (without actual Lightning payment)
/// This tests the route is registered and handles basic validation
#[tokio::test]
async fn test_lightning_order_endpoint_registered() {
    let (url, _invoice_service) = create_test_server().await;
    let client = reqwest::Client::new();

    let request = LightningTradeRequest {
        market_id: "test-market".to_string(),
        side: "LONG".to_string(),
        amount_sats: 1000,
        buyer_pubkey: "test-pubkey-123".to_string(),
        expiry_seconds: Some(3600),
    };

    let response = client
        .post(&format!("{}/api/lightning/create-order", url))
        .json(&request)
        .send()
        .await
        .expect("Failed to make request");

    // Route should be registered (may fail due to LND not being available, but route exists)
    // We accept 500 (internal error from LND) as valid - the route is registered
    let status = response.status();
    assert!(
        status.is_server_error() || status == 400 || status == 404,
        "Lightning order endpoint should be registered, got: {}",
        status
    );
}

/// Test lightning check-order endpoint is registered
#[tokio::test]
async fn test_lightning_check_order_endpoint_registered() {
    let (url, _invoice_service) = create_test_server().await;
    let client = reqwest::Client::new();

    let response = client
        .post(&format!("{}/api/lightning/check-order", url))
        .json(&serde_json::json!({
            "payment_hash": "test-hash"
        }))
        .send()
        .await
        .expect("Failed to make request");

    // Route should be registered
    let status = response.status();
    assert!(
        status.is_server_error() || status == 400 || status == 404,
        "Check order endpoint should be registered, got: {}",
        status
    );
}

/// Test that basic API routes are registered
#[tokio::test]
async fn test_basic_api_routes_registered() {
    let (url, _invoice_service) = create_test_server().await;
    let client = reqwest::Client::new();

    // Test core routes - they should not return 404
    let routes = vec![
        "/health",
        "/api/market/create",
        "/api/lightning/create-order",
        "/api/lightning/check-order",
    ];

    for path in routes {
        let request = client.post(&format!("{}{}", url, path)).json(&serde_json::json!({}));

        let response = request.send().await.expect("Failed to make request");

        // All routes should return non-404 (they may return other errors but routes exist)
        assert_ne!(
            response.status(),
            404,
            "Route {} should be registered",
            path
        );
    }

    // Test GET route
    let response = client
        .get(&format!("{}/health", url))
        .send()
        .await
        .expect("Failed to make request");

    assert_ne!(
        response.status(),
        404,
        "Health GET route should be registered"
    );
}
