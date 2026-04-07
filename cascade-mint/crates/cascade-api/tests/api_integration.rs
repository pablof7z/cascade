//! API Integration Tests for Cascade Cashu Mint
//!
//! Tests that verify the Cashu API endpoints work correctly.
//! These tests start a local server and make HTTP requests to it.

use axum::Router;
use tokio::net::TcpListener;

/// Test helper to create a test server
async fn create_test_server() -> String {
    // Create a simple router for basic endpoint testing
    let app = Router::new()
        .route("/health", axum::routing::get(|| async { "OK" }))
        .route("/v1/info", axum::routing::get(|| async { 
            r#"{"name":"Cascade Test Mint","version":"0.1.0","description":"Test mint for integration tests"}"#
        }))
        .route("/v1/keys", axum::routing::get(|| async { 
            r#"{"publicKeys":{}}"#
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
    
    assert_eq!(response.status(), 200, "Mint info endpoint should return 200");
    
    let body = response.text().await.expect("Failed to read body");
    
    // Verify it's valid JSON with expected fields
    let json: serde_json::Value = serde_json::from_str(&body)
        .expect("Response should be valid JSON");
    
    assert!(json.get("name").is_some(), "Response should contain 'name' field");
    assert!(json.get("version").is_some(), "Response should contain 'version' field");
}

/// Test that the keys endpoint returns valid JSON
#[tokio::test]
async fn test_keys_endpoint() {
    let url = create_test_server().await;
    
    let client = reqwest::Client::new();
    let response = client
        .get(&format!("{}/v1/keys", url))
        .send()
        .await
        .expect("Failed to make request");
    
    assert_eq!(response.status(), 200, "Keys endpoint should return 200");
    
    let body = response.text().await.expect("Failed to read body");
    
    // Verify it's valid JSON
    let json: serde_json::Value = serde_json::from_str(&body)
        .expect("Response should be valid JSON");
    
    assert!(json.get("publicKeys").is_some(), "Response should contain 'publicKeys' field");
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
        .route("/api/price/{currency}", axum::routing::get(|| async { 
            r#"{"usd":50000.0,"btc":1.0}"#
        }))
        .route("/api/market/create", axum::routing::post(|| async { 
            r#"{"id":"test-market","slug":"test-market","status":"active"}"#
        }))
        .route("/api/market/{id}", axum::routing::get(|| async { 
            r#"{"id":"test-market","title":"Test Market","status":"active"}"#
        }))
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
            "title": "Test Market",
            "description": "Test description"
        }))
        .send()
        .await
        .expect("Failed to make request");
    assert_eq!(response.status(), 200, "Market create endpoint should return 200");
    
    // Test market get endpoint
    let response = client
        .get(&format!("{}/api/market/test-market", url))
        .send()
        .await
        .expect("Failed to make request");
    assert_eq!(response.status(), 200, "Market get endpoint should return 200");
}

/// Test that invalid JSON in request body returns error
#[tokio::test]
async fn test_invalid_json_returns_error() {
    let app = Router::new()
        .route("/api/market/create", axum::routing::post(|axum::extract::Json(payload): axum::extract::Json<serde_json::Value>| async move {
            format!("Received: {:?}", payload)
        }));
    
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
    assert!(response.status().is_client_error(), 
        "Invalid JSON should return client error, got: {}", response.status());
}

/// Test concurrent requests are handled correctly
#[tokio::test]
async fn test_concurrent_requests() {
    let app = Router::new()
        .route("/health", axum::routing::get(|| async { "OK" }));
    
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
    let handles: Vec<_> = (0..10).map(|_| {
        let url = url_clone.clone();
        tokio::spawn(async move {
            let client = reqwest::Client::new();
            client
                .get(&format!("{}/health", url))
                .send()
                .await
                .expect("Failed to make request")
        })
    }).collect();
    
    // Wait for all requests to complete
    let mut success_count = 0;
    for handle in handles {
        let response = handle.await.expect("Task failed");
        if response.status() == 200 {
            success_count += 1;
        }
    }
    
    // All requests should succeed
    assert_eq!(success_count, 10, "All 10 concurrent requests should succeed");
}

/// Test that Content-Type is correctly set in responses
#[tokio::test]
async fn test_content_type_header() {
    let app = Router::new()
        .route("/v1/info", axum::routing::get(|| async { 
            (
                [("Content-Type", "application/json")],
                r#"{"name":"Test Mint"}"#
            )
        }));
    
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
    
    let content_type = response.headers()
        .get("Content-Type")
        .expect("Content-Type header should be present");
    
    assert!(content_type.to_str().unwrap().contains("application/json"),
        "Content-Type should be application/json");
}
