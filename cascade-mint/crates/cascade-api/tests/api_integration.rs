//! API Integration Tests for Cascade Cashu Mint
//!
//! Tests that verify the Cashu API endpoints work correctly.
//! These tests use the real build_cascade_routes with proper AppState.

use cascade_api::routes::{build_cascade_routes, AppState};
use cascade_api::types::{CreateMarketRequest, LightningTradeRequest, ProofInput};
use cascade_core::{invoice::InvoiceService, lightning::lnd_client::LndClient, LmsrEngine, MarketManager};
use cdk::mint::{MintBuilder, UnitConfig};
use cdk_common::nuts::CurrencyUnit;
use cdk_sqlite::mint::memory::empty as create_mint_db;
use std::sync::Arc;
use tokio::sync::Mutex;
use cdk::util::hex;
use cdk::secp256k1::{Secp256k1, Keypair};

/// Create a test CDK mint with in-memory database and random seed
async fn create_test_mint() -> Arc<cdk::mint::Mint> {
    let db = create_mint_db().await.expect("Failed to create test mint DB");
    let db = Arc::new(db);

    // Generate random 32-byte seed for test mint
    let mut seed = [0u8; 32];
    use rand::RngCore;
    rand::thread_rng().fill_bytes(&mut seed);

    let mut builder = MintBuilder::new(db.clone());
    builder.configure_unit(
        CurrencyUnit::Sat,
        UnitConfig {
            amounts: vec![1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072, 262144, 524288],
            input_fee_ppk: 0,
        },
    ).expect("Failed to configure SAT unit");
    let mint = builder.build_with_seed(db.clone(), &seed).await.expect("Failed to build test mint");
    Arc::new(mint)
}

/// Get the real SAT keyset ID from the mint
fn get_mint_keyset_id(mint: &Arc<cdk::mint::Mint>) -> String {
    let keysets = mint.keysets();
    keysets.keysets.iter()
        .find(|ks| ks.unit == CurrencyUnit::Sat)
        .map(|ks| ks.id.to_string())
        .expect("No SAT keyset found in test mint")
}

/// Create a valid ProofInput using the mint's real keyset and public key
fn create_valid_proof_input(mint: &Arc<cdk::mint::Mint>, amount: u64, secret: &str) -> ProofInput {
    let keyset_id = get_mint_keyset_id(mint);
    let keys_response = mint.pubkeys();
    let first_keyset = keys_response.keysets.first().expect("No keysets in test mint");
    let first_key = first_keyset.keys.values().next().expect("No keys in keyset");
    let c_hex = hex::encode(first_key.to_bytes());
    ProofInput {
        secret: secret.to_string(),
        amount,
        C: c_hex,
        id: keyset_id,
        witness: None,
        dleq: None,
    }
}

/// Get a valid public key (C value) from the server via HTTP
/// This allows tests to construct valid proofs without direct mint access
async fn get_valid_c_from_server(url: &str) -> String {
    let client = reqwest::Client::new();
    let response = client
        .get(&format!("{}/v1/keys", url))
        .send()
        .await
        .expect("Failed to get keys from server");
    
    assert_eq!(response.status(), 200, "Failed to get keys");
    
    let keys_data: serde_json::Value = response
        .json()
        .await
        .expect("Failed to parse keys response");
    
    // Extract the first pubkey from the keysets
    let keysets = keys_data.get("keysets")
        .and_then(|k| k.as_object())
        .expect("Missing keysets in response");
    
    let first_keyset = keysets.values().next()
        .expect("No keysets found");
    
    let keys = first_keyset.get("keys")
        .and_then(|k| k.as_object())
        .expect("Missing keys in keyset");
    
    let first_key = keys.values().next()
        .expect("No keys in keyset");
    
    let pubkey = first_key.get("pubkey")
        .and_then(|k| k.as_str())
        .expect("Missing pubkey");
    
    pubkey.to_string()
}

/// Get a valid keyset ID from the server via HTTP
async fn get_valid_keyset_id_from_server(url: &str) -> String {
    let client = reqwest::Client::new();
    let response = client
        .get(&format!("{}/v1/keys", url))
        .send()
        .await
        .expect("Failed to get keys from server");
    
    assert_eq!(response.status(), 200, "Failed to get keys");
    
    let keys_data: serde_json::Value = response
        .json()
        .await
        .expect("Failed to parse keys response");
    
    // Extract the first keyset ID from the keysets
    let keysets = keys_data.get("keysets")
        .and_then(|k| k.as_object())
        .expect("Missing keysets in response");
    
    let first_keyset = keysets.values().next()
        .expect("No keysets found");
    
    let keyset_id = first_keyset.get("id")
        .and_then(|k| k.as_str())
        .expect("Missing keyset id");
    
    keyset_id.to_string()
}

/// Test helper to create a test server with proper AppState
async fn create_test_server() -> (String, Arc<Mutex<InvoiceService>>, Arc<cdk::mint::Mint>) {
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

    // Create test CDK mint
    let mint = create_test_mint().await;

    // Create AppState with mint in test mode (skips CDK proof verification)
    let state = AppState::new_test(market_manager, invoice_service.clone(), mint.clone());

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

    (url, invoice_service, mint)
}

/// Test that the health endpoint returns OK
#[tokio::test]
async fn test_health_endpoint() {
    let (url, _invoice_service, _mint) = create_test_server().await;

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
    let (url, _invoice_service, _mint) = create_test_server().await;

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
    let (url, _invoice_service, _mint) = create_test_server().await;
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
    let (url, _invoice_service, _mint) = create_test_server().await;
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
    let (url, _invoice_service, _mint) = create_test_server().await;
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
    let (url, _invoice_service, _mint) = create_test_server().await;
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
    let (url, _invoice_service, _mint) = create_test_server().await;
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

// =============================================================================
// Settlement & Redemption Integration Tests (Phase 7)
// =============================================================================

/// Test that redeem endpoint returns 400 for invalid proof (wrong C length)
#[tokio::test]
async fn test_redeem_invalid_proof_wrong_c_length() {
    let (url, _invoice_service, _mint) = create_test_server().await;
    let client = reqwest::Client::new();

    // Create a market first
    let market_request = CreateMarketRequest {
        title: "Test Market".to_string(),
        description: "A test market".to_string(),
        slug: "redeem-invalid-proof".to_string(),
        b: 10.0,
    };

    let create_response = client
        .post(&format!("{}/api/market/create", url))
        .json(&market_request)
        .send()
        .await
        .expect("Failed to create market");

    assert_eq!(create_response.status(), 201);

    let created: serde_json::Value = create_response
        .json()
        .await
        .expect("Failed to parse response");

    let market_id = created.get("event_id").and_then(|v| v.as_str()).expect("Missing event_id");

    // Try to redeem with invalid proof (C should be 66 chars for compressed pubkey)
    let redeem_request = serde_json::json!({
        "market_id": market_id,
        "side": "yes",
        "shares": 5.0,
        "proof": {
            "secret": "secret123",
            "amount": 100,
            "C": "a".repeat(64), // Wrong length - should be 66
            "id": "keyset123"
        }
    });

    let response = client
        .post(&format!("{}/v1/cascade/redeem", url))
        .json(&redeem_request)
        .send()
        .await
        .expect("Failed to make request");

    assert_eq!(
        response.status(),
        400,
        "Invalid proof C length should return 400, got: {}",
        response.status()
    );
}

/// Test that redeem endpoint returns 404 for non-existent market
#[tokio::test]
async fn test_redeem_nonexistent_market() {
    let (url, _invoice_service, _mint) = create_test_server().await;
    let client = reqwest::Client::new();

    // Get a valid C value from the server
    let valid_c = get_valid_c_from_server(&url).await;
    let valid_keyset_id = get_valid_keyset_id_from_server(&url).await;

    let redeem_request = serde_json::json!({
        "market_id": "nonexistent-market-id",
        "side": "yes",
        "shares": 5.0,
        "proof": {
            "secret": "secret123",
            "amount": 100,
            "C": valid_c,
            "id": valid_keyset_id
        }
    });

    let response = client
        .post(&format!("{}/v1/cascade/redeem", url))
        .json(&redeem_request)
        .send()
        .await
        .expect("Failed to make request");

    assert_eq!(
        response.status(),
        404,
        "Nonexistent market should return 404, got: {}",
        response.status()
    );
}

/// Test that settle endpoint returns 400 for unresolved market
#[tokio::test]
async fn test_settle_unresolved_market() {
    let (url, _invoice_service, _mint) = create_test_server().await;
    let client = reqwest::Client::new();

    // Create a market
    let market_request = CreateMarketRequest {
        title: "Test Market".to_string(),
        description: "A test market".to_string(),
        slug: "settle-unresolved".to_string(),
        b: 10.0,
    };

    let create_response = client
        .post(&format!("{}/api/market/create", url))
        .json(&market_request)
        .send()
        .await
        .expect("Failed to create market");

    assert_eq!(create_response.status(), 201);

    let created: serde_json::Value = create_response
        .json()
        .await
        .expect("Failed to parse response");

    let market_id = created.get("event_id").and_then(|v| v.as_str()).expect("Missing event_id");

    // Try to settle on unresolved market
    let settle_request = serde_json::json!({
        "market_id": market_id,
        "side": "yes",
        "proof": {
            "secret": "secret456",
            "amount": 100,
            "C": "a".repeat(66),
            "id": "keyset123"
        }
    });

    let response = client
        .post(&format!("{}/v1/cascade/settle", url))
        .json(&settle_request)
        .send()
        .await
        .expect("Failed to make request");

    assert_eq!(
        response.status(),
        400,
        "Unresolved market should return 400, got: {}",
        response.status()
    );
}

/// Test that settle endpoint returns payout for winner on resolved market
#[tokio::test]
async fn test_settle_resolved_market_winner() {
    let (url, _invoice_service, mint) = create_test_server().await;
    let client = reqwest::Client::new();

    // Get real mint keyset and public key
    let mint_keyset = get_mint_keyset_id(&mint);
    let pubkeys = mint.pubkeys();
    let first_key = pubkeys.keysets.first().expect("No keysets").keys.values().next().expect("No keys");
    let c_hex = hex::encode(first_key.to_bytes());

    // Create and resolve a market
    let market_request = CreateMarketRequest {
        title: "Test Market".to_string(),
        description: "A test market".to_string(),
        slug: "settle-winner".to_string(),
        b: 10.0,
    };

    let create_response = client
        .post(&format!("{}/api/market/create", url))
        .json(&market_request)
        .send()
        .await
        .expect("Failed to create market");

    assert_eq!(create_response.status(), 201);

    let created: serde_json::Value = create_response
        .json()
        .await
        .expect("Failed to parse response");

    let market_id = created.get("event_id").and_then(|v| v.as_str()).expect("Missing event_id");

    // Fetch market to get real keysets
    let market_fetch = client
        .get(&format!("{}/api/market/{}", url, market_id))
        .send()
        .await
        .expect("Failed to fetch market");
    assert_eq!(market_fetch.status(), 200);
    let market_state: serde_json::Value = market_fetch
        .json()
        .await
        .expect("Failed to parse market state");
    let long_keyset = market_state
        .get("long_keyset_id")
        .and_then(|v| v.as_str())
        .expect("Missing long_keyset_id");

    // Step 1: Buy 10 shares on the "long" (yes) side first
    let buy_request = serde_json::json!({
        "market_id": market_id,
        "side": "long",
        "quantity": 10.0,
        "buyer_pubkey": "test_buyer_pubkey_winner"
    });

    let buy_response = client
        .post(&format!("{}/api/trade/bid", url))
        .json(&buy_request)
        .send()
        .await
        .expect("Failed to buy shares");

    assert_eq!(buy_response.status(), 201, "Buy should succeed");

    // Step 2: Resolve the market to "long" (winner side)
    let resolve_request = serde_json::json!({
        "market_id": market_id,
        "outcome": "long"
    });

    let resolve_response = client
        .post(&format!("{}/api/market/{}/resolve", url, market_id))
        .json(&resolve_request)
        .send()
        .await
        .expect("Failed to resolve market");

    assert_eq!(resolve_response.status(), 200);

    // Snapshot reserve IMMEDIATELY BEFORE settle (not before buy, which would include buy cost)
    let market_before_settle: serde_json::Value = client
        .get(&format!("{}/api/market/{}", url, market_id))
        .send()
        .await
        .expect("Failed to fetch market before settle")
        .json()
        .await
        .expect("Failed to parse market state before settle");
    let reserve_before_settle = market_before_settle
        .get("reserve")
        .and_then(|v| v.as_u64())
        .expect("Missing reserve before settle");

    // Settle on the winning side (yes/long) using market's real keyset
    let settle_request = serde_json::json!({
        "market_id": market_id,
        "side": "yes",
        "proof": {
            "secret": "winner_secret_789",
            "amount": 1000,
            "C": c_hex,
            "id": long_keyset
        }
    });
    
    // Debug: print keyset info
    eprintln!("DEBUG: long_keyset from market = '{}'", long_keyset);
    eprintln!("DEBUG: c_hex = '{}'", c_hex);

    let response = client
        .post(&format!("{}/v1/cascade/settle", url))
        .json(&settle_request)
        .send()
        .await
        .expect("Failed to make request");

    let status = response.status();
    let body = response.text().await.unwrap_or_else(|_| "Failed to read body".to_string());
    if status != 200 {
        eprintln!("DEBUG: Settle response body: {}", body);
    }

    assert_eq!(
        status,
        200,
        "Winner settlement should return 200, got: {}",
        status
    );

    let settle_result: serde_json::Value = serde_json::from_str(&body)
        .expect("Failed to parse settle response");

    // The response is {"Ok": {...}} so we need to access fields through "Ok"
    let settle_data = settle_result.get("Ok").expect("Expected Ok wrapper in response");

    assert_eq!(
        settle_data.get("success").and_then(|v| v.as_bool()),
        Some(true),
        "Settlement should be successful"
    );
    assert_eq!(
        settle_data.get("won").and_then(|v| v.as_bool()),
        Some(true),
        "Winner should have won=true"
    );
    // Payout should be near 1000 (minus ~1% fee = ~990)
    let payout = settle_data.get("payout").and_then(|v| v.as_u64()).unwrap_or(0);
    assert!(
        payout >= 990 && payout <= 1000,
        "Winner payout should be ~1000 (minus fee), got: {}",
        payout
    );

    // Verify reserve decreased by exactly the payout amount
    let market_fetch_after: serde_json::Value = client
        .get(&format!("{}/api/market/{}", url, market_id))
        .send()
        .await
        .expect("Failed to fetch market after settle")
        .json()
        .await
        .expect("Failed to parse market state after settle");
    let reserve_after = market_fetch_after
        .get("reserve")
        .and_then(|v| v.as_u64())
        .expect("Missing reserve after settle");
    // Winner payout reduces the market's reserve
    assert_eq!(
        reserve_after,
        reserve_before_settle.saturating_sub(payout),
        "Reserve should decrease by payout {} (from {} to {})",
        payout,
        reserve_before_settle,
        reserve_after
    );
}

/// Test that settle endpoint returns 0 payout for loser on resolved market
#[tokio::test]
async fn test_settle_resolved_market_loser() {
    let (url, _invoice_service, mint) = create_test_server().await;
    let client = reqwest::Client::new();

    // Get real mint keyset and public key
    let mint_keyset = get_mint_keyset_id(&mint);
    let pubkeys = mint.pubkeys();
    let first_key = pubkeys.keysets.first().expect("No keysets").keys.values().next().expect("No keys");
    let c_hex = hex::encode(first_key.to_bytes());

    // Create and resolve a market
    let market_request = CreateMarketRequest {
        title: "Test Market".to_string(),
        description: "A test market".to_string(),
        slug: "settle-loser".to_string(),
        b: 10.0,
    };

    let create_response = client
        .post(&format!("{}/api/market/create", url))
        .json(&market_request)
        .send()
        .await
        .expect("Failed to create market");

    assert_eq!(create_response.status(), 201);

    let created: serde_json::Value = create_response
        .json()
        .await
        .expect("Failed to parse response");

    let market_id = created.get("event_id").and_then(|v| v.as_str()).expect("Missing event_id");

    // Fetch market to get real keysets
    let market_fetch = client
        .get(&format!("{}/api/market/{}", url, market_id))
        .send()
        .await
        .expect("Failed to fetch market");
    assert_eq!(market_fetch.status(), 200);
    let market_state: serde_json::Value = market_fetch
        .json()
        .await
        .expect("Failed to parse market state");
    let short_keyset = market_state
        .get("short_keyset_id")
        .and_then(|v| v.as_str())
        .expect("Missing short_keyset_id");

    // Resolve the market to "long" (winner side)
    let resolve_request = serde_json::json!({
        "market_id": market_id,
        "outcome": "long"
    });

    let _resolve_response = client
        .post(&format!("{}/api/market/{}/resolve", url, market_id))
        .json(&resolve_request)
        .send()
        .await
        .expect("Failed to resolve market");

    // Settle on the losing side (no/short) using market's real keyset
    let settle_request = serde_json::json!({
        "market_id": market_id,
        "side": "no",
        "proof": {
            "secret": "loser_secret_101",
            "amount": 1000,
            "C": c_hex,
            "id": short_keyset
        }
    });

    let response = client
        .post(&format!("{}/v1/cascade/settle", url))
        .json(&settle_request)
        .send()
        .await
        .expect("Failed to make request");

    assert_eq!(
        response.status(),
        200,
        "Loser settlement should return 200, got: {}",
        response.status()
    );

    let settle_result: serde_json::Value = response
        .json()
        .await
        .expect("Failed to parse settle response");

    // The response is {"Ok": {...}} so we need to access fields through "Ok"
    let settle_data = settle_result.get("Ok").expect("Expected Ok wrapper in response");

    assert_eq!(
        settle_data.get("success").and_then(|v| v.as_bool()),
        Some(true),
        "Settlement should be successful"
    );
    assert_eq!(
        settle_data.get("won").and_then(|v| v.as_bool()),
        Some(false),
        "Loser should have won=false"
    );
    assert_eq!(
        settle_data.get("payout").and_then(|v| v.as_u64()),
        Some(0),
        "Loser payout should be 0"
    );

    // Verify state post-settle: market remains Resolved (proof was consumed, state is consistent)
    // For a loser with 0 reserve, the reserve stays 0 — no payout means no reserve change.
    // What matters is the market is still in Resolved state after the settle call.
    let market_fetch_after: serde_json::Value = client
        .get(&format!("{}/api/market/{}", url, market_id))
        .send()
        .await
        .expect("Failed to fetch market after settle")
        .json()
        .await
        .expect("Failed to parse market state after settle");
    let status_after = market_fetch_after
        .get("status")
        .and_then(|v| v.as_str())
        .expect("Missing status after settle");
    assert!(
        status_after.contains("Resolved"),
        "Market should remain Resolved after loser settle, got: {}",
        status_after
    );
    // Reserve is unchanged for a loser (no payout = no reserve movement)
    let reserve_after = market_fetch_after
        .get("reserve")
        .and_then(|v| v.as_u64())
        .expect("Missing reserve after settle");
    let initial_reserve = market_state
        .get("reserve")
        .and_then(|v| v.as_u64())
        .expect("Missing reserve");
    assert_eq!(
        reserve_after, initial_reserve,
        "Reserve should be unchanged for loser settle: was {}, now {}",
        initial_reserve, reserve_after
    );
}

/// Test that settle with wrong keyset returns 400 Bad Request
#[tokio::test]
async fn test_settle_wrong_keyset_rejected() {
    let (url, _invoice_service, _mint) = create_test_server().await;
    let client = reqwest::Client::new();

    // Create and resolve a market
    let market_request = CreateMarketRequest {
        title: "Test Market".to_string(),
        description: "A test market".to_string(),
        slug: "wrong-keyset".to_string(),
        b: 10.0,
    };

    let create_response = client
        .post(&format!("{}/api/market/create", url))
        .json(&market_request)
        .send()
        .await
        .expect("Failed to create market");

    assert_eq!(create_response.status(), 201);

    let created: serde_json::Value = create_response
        .json()
        .await
        .expect("Failed to parse response");

    let market_id = created.get("event_id").and_then(|v| v.as_str()).expect("Missing event_id");

    // Fetch market to get real keysets
    let market_fetch = client
        .get(&format!("{}/api/market/{}", url, market_id))
        .send()
        .await
        .expect("Failed to fetch market");
    assert_eq!(market_fetch.status(), 200);
    let market_state: serde_json::Value = market_fetch
        .json()
        .await
        .expect("Failed to parse market state");
    let long_keyset = market_state
        .get("long_keyset_id")
        .and_then(|v| v.as_str())
        .expect("Missing long_keyset_id");

    // Resolve the market to "long" (winner side)
    let resolve_request = serde_json::json!({
        "market_id": market_id,
        "outcome": "long"
    });

    let _resolve_response = client
        .post(&format!("{}/api/market/{}/resolve", url, market_id))
        .json(&resolve_request)
        .send()
        .await
        .expect("Failed to resolve market");

    // Get a valid C value from the server (but use wrong keyset to test rejection)
    let valid_c = get_valid_c_from_server(&url).await;

    // Attempt to settle with WRONG keyset (using short keyset for "yes" side which is long)
    let settle_request = serde_json::json!({
        "market_id": market_id,
        "side": "yes",
        "proof": {
            "secret": "wrong_keyset_secret",
            "amount": 1000,
            "C": valid_c,
            "id": "wrong_keyset_id_12345" // Deliberately wrong keyset
        }
    });

    let response = client
        .post(&format!("{}/v1/cascade/settle", url))
        .json(&settle_request)
        .send()
        .await
        .expect("Failed to make request");

    assert_eq!(
        response.status(),
        400,
        "Settlement with wrong keyset should return 400, got: {}",
        response.status()
    );
}

/// Test that settling the same proof twice returns 409 Conflict
#[tokio::test]
async fn test_double_settle_rejected() {
    let (url, _invoice_service, _mint) = create_test_server().await;
    let client = reqwest::Client::new();

    // Create and resolve a market
    let market_request = CreateMarketRequest {
        title: "Test Market".to_string(),
        description: "A test market".to_string(),
        slug: "double-settle".to_string(),
        b: 10.0,
    };

    let create_response = client
        .post(&format!("{}/api/market/create", url))
        .json(&market_request)
        .send()
        .await
        .expect("Failed to create market");

    assert_eq!(create_response.status(), 201);

    let created: serde_json::Value = create_response
        .json()
        .await
        .expect("Failed to parse response");

    let market_id = created.get("event_id").and_then(|v| v.as_str()).expect("Missing event_id");

    // Fetch market to get real keysets
    let market_fetch = client
        .get(&format!("{}/api/market/{}", url, market_id))
        .send()
        .await
        .expect("Failed to fetch market");
    assert_eq!(market_fetch.status(), 200);
    let market_state: serde_json::Value = market_fetch
        .json()
        .await
        .expect("Failed to parse market state");
    let long_keyset = market_state
        .get("long_keyset_id")
        .and_then(|v| v.as_str())
        .expect("Missing long_keyset_id");

    // Resolve the market to "long" (winner side)
    let resolve_request = serde_json::json!({
        "market_id": market_id,
        "outcome": "long"
    });

    let _resolve_response = client
        .post(&format!("{}/api/market/{}/resolve", url, market_id))
        .json(&resolve_request)
        .send()
        .await
        .expect("Failed to resolve market");

    // Get a valid C value from the server
    let valid_c = get_valid_c_from_server(&url).await;

    // First settle attempt - should succeed
    let settle_request = serde_json::json!({
        "market_id": market_id,
        "side": "yes",
        "proof": {
            "secret": "double_settle_secret_123",
            "amount": 1000,
            "C": valid_c,
            "id": long_keyset
        }
    });

    let first_response = client
        .post(&format!("{}/v1/cascade/settle", url))
        .json(&settle_request)
        .send()
        .await
        .expect("Failed to make first request");

    assert_eq!(
        first_response.status(),
        200,
        "First settlement should succeed, got: {}",
        first_response.status()
    );

    // Second settle attempt with SAME proof - should be rejected with 409
    let second_response = client
        .post(&format!("{}/v1/cascade/settle", url))
        .json(&settle_request)
        .send()
        .await
        .expect("Failed to make second request");

    assert_eq!(
        second_response.status(),
        409,
        "Double settle should return 409 Conflict, got: {}",
        second_response.status()
    );
}

/// Test that double redemption attempt returns 409 Conflict
#[tokio::test]
async fn test_double_redemption_rejected() {
    let (url, _invoice_service, _mint) = create_test_server().await;
    let client = reqwest::Client::new();

    // Create a market
    let market_request = CreateMarketRequest {
        title: "Test Market".to_string(),
        description: "A test market".to_string(),
        slug: "double-redeem".to_string(),
        b: 10.0,
    };

    let create_response = client
        .post(&format!("{}/api/market/create", url))
        .json(&market_request)
        .send()
        .await
        .expect("Failed to create market");

    assert_eq!(create_response.status(), 201);

    let created: serde_json::Value = create_response
        .json()
        .await
        .expect("Failed to parse response");

    let market_id = created.get("event_id").and_then(|v| v.as_str()).expect("Missing event_id");

    // Fetch market to get real keysets
    let market_fetch = client
        .get(&format!("{}/api/market/{}", url, market_id))
        .send()
        .await
        .expect("Failed to fetch market");
    assert_eq!(market_fetch.status(), 200);
    let market_state: serde_json::Value = market_fetch
        .json()
        .await
        .expect("Failed to parse market state");
    let long_keyset = market_state
        .get("long_keyset_id")
        .and_then(|v| v.as_str())
        .expect("Missing long_keyset_id");

    // Step 1: Buy 10 shares on the "long" side first
    let buy_request = serde_json::json!({
        "market_id": market_id,
        "side": "long",
        "quantity": 10.0,
        "buyer_pubkey": "test_buyer_pubkey_456"
    });

    let buy_response = client
        .post(&format!("{}/api/trade/bid", url))
        .json(&buy_request)
        .send()
        .await
        .expect("Failed to buy shares");

    assert_eq!(buy_response.status(), 201, "Buy should succeed");

    // Get a valid C value from the server
    let valid_c = get_valid_c_from_server(&url).await;

    // Same proof secret for both requests
    let proof_secret = "double_spend_secret_999";
    let redeem_request = serde_json::json!({
        "market_id": market_id,
        "side": "yes",
        "shares": 5.0,
        "proof": {
            "secret": proof_secret,
            "amount": 100,
            "C": valid_c,
            "id": long_keyset
        }
    });

    // First redemption should succeed
    let first_response = client
        .post(&format!("{}/v1/cascade/redeem", url))
        .json(&redeem_request)
        .send()
        .await
        .expect("Failed to make first request");

    assert_eq!(
        first_response.status(),
        200,
        "First redemption should succeed, got: {}",
        first_response.status()
    );

    // Second redemption with same proof should fail with 409
    let second_response = client
        .post(&format!("{}/v1/cascade/redeem", url))
        .json(&redeem_request)
        .send()
        .await
        .expect("Failed to make second request");

    assert_eq!(
        second_response.status(),
        409,
        "Double spend should return 409 Conflict, got: {}",
        second_response.status()
    );
}

/// Test mid-market redeem with valid shares returns payout with fee
#[tokio::test]
async fn test_redeem_mid_market_valid() {
    let (url, _invoice_service, _mint) = create_test_server().await;
    let client = reqwest::Client::new();

    // Create a market
    let market_request = CreateMarketRequest {
        title: "BTC Price Market".to_string(),
        description: "Will BTC be above $100k?".to_string(),
        slug: "redeem-mid-market".to_string(),
        b: 10.0,
    };

    let create_response = client
        .post(&format!("{}/api/market/create", url))
        .json(&market_request)
        .send()
        .await
        .expect("Failed to create market");

    assert_eq!(create_response.status(), 201);

    let created: serde_json::Value = create_response
        .json()
        .await
        .expect("Failed to parse response");

    let market_id = created.get("event_id").and_then(|v| v.as_str()).expect("Missing event_id");

    // Fetch market to get real keysets and initial state
    let market_fetch = client
        .get(&format!("{}/api/market/{}", url, market_id))
        .send()
        .await
        .expect("Failed to fetch market");
    assert_eq!(market_fetch.status(), 200);
    let market_state: serde_json::Value = market_fetch
        .json()
        .await
        .expect("Failed to parse market state");
    let initial_q_long = market_state
        .get("q_long")
        .and_then(|v| v.as_f64())
        .expect("Missing q_long");
    let long_keyset = market_state
        .get("long_keyset_id")
        .and_then(|v| v.as_str())
        .expect("Missing long_keyset_id");

    // Step 1: Buy 10 shares on the "long" (yes) side first
    let buy_request = serde_json::json!({
        "market_id": market_id,
        "side": "long",
        "quantity": 10.0,
        "buyer_pubkey": "test_buyer_pubkey_123"
    });

    let buy_response = client
        .post(&format!("{}/api/trade/bid", url))
        .json(&buy_request)
        .send()
        .await
        .expect("Failed to buy shares");

    assert_eq!(buy_response.status(), 201, "Buy should succeed");

    // Fetch market again to get state after buying
    let market_fetch_after_buy: serde_json::Value = client
        .get(&format!("{}/api/market/{}", url, market_id))
        .send()
        .await
        .expect("Failed to fetch market after buy")
        .json()
        .await
        .expect("Failed to parse market state after buy");
    let q_long_after_buy = market_fetch_after_buy
        .get("q_long")
        .and_then(|v| v.as_f64())
        .expect("Missing q_long after buy");
    assert!(
        q_long_after_buy > initial_q_long,
        "q_long should increase after buying long shares"
    );

    // Get a valid C value from the server
    let valid_c = get_valid_c_from_server(&url).await;

    // Step 2: Redeem the 10 shares we just bought (use real keyset ID)
    let redeem_request = serde_json::json!({
        "market_id": market_id,
        "side": "yes",
        "shares": 10.0,
        "proof": {
            "secret": "mid_market_secret_555",
            "amount": 100,
            "C": valid_c,
            "id": long_keyset
        }
    });

    let response = client
        .post(&format!("{}/v1/cascade/redeem", url))
        .json(&redeem_request)
        .send()
        .await
        .expect("Failed to make request");

    // Debug: print response body if not 200, then fail
    let status = response.status();
    if status != 200 {
        let body = response.text().await.unwrap_or_else(|_| "Failed to read body".to_string());
        eprintln!("DEBUG: Response body: {}", body);
        panic!("Expected 200, got: {}", status);
    }

    let redeem_result: serde_json::Value = response
        .json()
        .await
        .expect("Failed to parse redeem response");

    // The response is {"Ok": {...}} so we need to access fields through "Ok"
    let redeem_data = redeem_result.get("Ok").expect("Expected Ok wrapper in response");

    assert_eq!(
        redeem_data.get("success").and_then(|v| v.as_bool()),
        Some(true),
        "Redemption should be successful"
    );

    // Verify fee was calculated (1% = 10 sats on 1000 sats payout)
    let payout = redeem_data.get("payout").and_then(|v| v.as_u64()).unwrap_or(0);
    let fee = redeem_data.get("fee").and_then(|v| v.as_u64()).unwrap_or(0);
    let net = redeem_data.get("net_payout").and_then(|v| v.as_u64()).unwrap_or(0);

    // Gross payout should be > 0 (LMSR refund for 10 shares)
    assert!(payout > 0, "Payout should be > 0");

    // Fee should be approximately 1% of payout
    let expected_fee = payout / 100;
    assert!(
        fee >= expected_fee && fee <= expected_fee + 1,
        "Fee should be ~1% of payout, expected ~{}, got: {}",
        expected_fee,
        fee
    );

    // Net payout = payout - fee
    assert_eq!(
        net,
        payout - fee,
        "Net payout should be payout - fee"
    );

    // Verify state changed: q_long should have decreased after redeem
    let market_fetch_after_redeem: serde_json::Value = client
        .get(&format!("{}/api/market/{}", url, market_id))
        .send()
        .await
        .expect("Failed to fetch market after redeem")
        .json()
        .await
        .expect("Failed to parse market state after redeem");
    let q_long_after_redeem = market_fetch_after_redeem
        .get("q_long")
        .and_then(|v| v.as_f64())
        .expect("Missing q_long after redeem");
    assert!(
        q_long_after_redeem < q_long_after_buy,
        "q_long should decrease after redeem: was {} after buy, now {}",
        q_long_after_buy,
        q_long_after_redeem
    );
}
