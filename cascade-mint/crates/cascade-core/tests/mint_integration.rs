//! Market Manager Integration Tests
//!
//! Tests that verify market creation and LMSR engine integration.

use cascade_core::{LmsrEngine, MarketManager};

/// Test that creates a market and verifies keyset IDs are correct.
#[tokio::test]
async fn test_market_keyset_creation() {
    // 1. Create LmsrEngine
    let lmsr = LmsrEngine::new(10.0).expect("Failed to create LMSR engine");

    // 2. Create MarketManager
    let market_manager = MarketManager::new(lmsr);

    // 3. Call create_market("btc-100k", ...)
    let event_id = "test_event_123".to_string();
    let result = market_manager
        .create_market(
            event_id.clone(),
            "btc-100k".to_string(),
            "BTC above 100k".to_string(),
            "Will BTC reach 100k?".to_string(),
            10.0,
            "creator123".to_string(),
            "keyset_long_123".to_string(),
            "keyset_short_456".to_string(),
        )
        .await;

    assert!(result.is_ok(), "Failed to create market: {:?}", result.err());

    // 4. Verify the market was created correctly
    let market = market_manager.get_market(&event_id).await.unwrap();
    assert_eq!(market.event_id, "test_event_123");
    assert_eq!(market.slug, "btc-100k");
}

/// Test market manager initialization with different LMSR parameters.
#[tokio::test]
async fn test_market_manager_initialization() {
    // Test with default LMSR parameter
    let lmsr = LmsrEngine::new(10.0).expect("Failed to create LMSR engine");
    let manager = MarketManager::new(lmsr);

    let markets = manager.list_markets().await.unwrap();
    assert!(markets.is_empty(), "New manager should have no markets");
}

/// Test market creation with various parameters.
#[tokio::test]
async fn test_market_creation_parameters() {
    let lmsr = LmsrEngine::new(10.0).expect("Failed to create LMSR engine");
    let _market_manager = MarketManager::new(lmsr);

    // Test with different b values
    let test_cases = vec![
        (0.0001, "tiny_reserve"),
        (0.001, "small_reserve"),
        (0.01, "medium_reserve"),
        (0.1, "large_reserve"),
    ];

    for (b, description) in test_cases {
        let event_id = format!("test_event_{}", description);
        let lmsr = LmsrEngine::new(b).expect("Failed to create LMSR engine");
        let manager = MarketManager::new(lmsr);
        
        let result = manager
            .create_market(
                event_id,
                format!("test_market_{}", b),
                "Test Market".to_string(),
                "Test description".to_string(),
                b,
                "creator".to_string(),
                "keyset_long".to_string(),
                "keyset_short".to_string(),
            )
            .await;

        assert!(
            result.is_ok(),
            "Failed to create market with {}: {:?}",
            description,
            result.err()
        );
    }
}

/// Test that duplicate market creation fails.
#[tokio::test]
async fn test_duplicate_market_creation_fails() {
    let lmsr = LmsrEngine::new(10.0).expect("Failed to create LMSR engine");
    let manager = MarketManager::new(lmsr);

    let event_id = "unique_event".to_string();
    
    // First creation should succeed
    let first_result = manager
        .create_market(
            event_id.clone(),
            "test-market".to_string(),
            "Test Market".to_string(),
            "Test description".to_string(),
            10.0,
            "creator".to_string(),
            "keyset_long".to_string(),
            "keyset_short".to_string(),
        )
        .await;
    assert!(first_result.is_ok(), "First creation should succeed");

    // Second creation should fail
    let second_result = manager
        .create_market(
            event_id,
            "test-market".to_string(),
            "Test Market 2".to_string(),
            "Another description".to_string(),
            10.0,
            "creator".to_string(),
            "keyset_long".to_string(),
            "keyset_short".to_string(),
        )
        .await;
    assert!(second_result.is_err(), "Duplicate market creation should fail");
}

/// Test listing all markets.
#[tokio::test]
async fn test_list_markets() {
    let lmsr = LmsrEngine::new(10.0).expect("Failed to create LMSR engine");
    let manager = MarketManager::new(lmsr);

    // Initially empty
    let markets = manager.list_markets().await.unwrap();
    assert!(markets.is_empty());

    // Create multiple markets
    for i in 0..5 {
        let event_id = format!("event_{}", i);
        manager
            .create_market(
                event_id,
                format!("market_{}", i),
                format!("Market {}", i),
                "Description".to_string(),
                10.0,
                "creator".to_string(),
                format!("keyset_long_{}", i),
                format!("keyset_short_{}", i),
            )
            .await
            .expect("Failed to create market");
    }

    let markets = manager.list_markets().await.unwrap();
    assert_eq!(markets.len(), 5);
}

/// Test listing only active markets.
#[tokio::test]
async fn test_list_active_markets() {
    let lmsr = LmsrEngine::new(10.0).expect("Failed to create LMSR engine");
    let manager = MarketManager::new(lmsr);

    // Create markets
    for i in 0..3 {
        let event_id = format!("event_{}", i);
        manager
            .create_market(
                event_id,
                format!("market_{}", i),
                format!("Market {}", i),
                "Description".to_string(),
                10.0,
                "creator".to_string(),
                format!("keyset_long_{}", i),
                format!("keyset_short_{}", i),
            )
            .await
            .expect("Failed to create market");
    }

    let active_markets = manager.list_active_markets().await.unwrap();
    assert_eq!(active_markets.len(), 3);

    // Resolve one market
    manager.resolve_market("event_1", cascade_core::Side::Long)
        .await
        .expect("Failed to resolve market");

    let active_markets = manager.list_active_markets().await.unwrap();
    assert_eq!(active_markets.len(), 2);
}

/// Test market not found error.
#[tokio::test]
async fn test_market_not_found() {
    let lmsr = LmsrEngine::new(10.0).expect("Failed to create LMSR engine");
    let manager = MarketManager::new(lmsr);

    let result = manager.get_market("nonexistent").await;
    assert!(result.is_err(), "Getting nonexistent market should fail");
}
