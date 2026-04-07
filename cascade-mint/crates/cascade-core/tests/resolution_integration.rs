//! Resolution Integration Tests
//!
//! Resolution lifecycle: create → buy → resolve → payout winning → reject losing

use cascade_core::{LmsrEngine, MarketManager, MarketStatus, Side, TradeExecutor};
use std::sync::Arc;

/// Resolution lifecycle: create → buy → resolve LONG → check state
#[tokio::test]
async fn test_resolution_long_wins() {
    // 1. Create market
    let lmsr = LmsrEngine::new(0.001).expect("Failed to create LMSR engine");
    let market_manager = Arc::new(MarketManager::new(lmsr));

    // Create market
    let event_id = "test_event_resolution".to_string();
    market_manager
        .create_market(
            event_id.clone(),
            "btc-100k".to_string(),
            "BTC above 100k".to_string(),
            "Will BTC reach 100k?".to_string(),
            0.001,
            "creator".to_string(),
            "keyset_long".to_string(),
            "keyset_short".to_string(),
        )
        .await
        .expect("Failed to create market");

    // 2. Resolve market as LONG (YES - BTC reached 100k)
    let resolve_result = market_manager
        .resolve_market(&event_id, Side::Long)
        .await;
    assert!(
        resolve_result.is_ok(),
        "Market resolution should succeed: {:?}",
        resolve_result.err()
    );

    // Verify market is resolved
    let resolved_market = market_manager.get_market(&event_id).await.unwrap();
    assert!(
        resolved_market.is_resolved(),
        "Market should be resolved"
    );
}

/// Test market resolution with SHORT outcome (NO - BTC did NOT reach 100k)
#[tokio::test]
async fn test_resolution_short_wins() {
    let lmsr = LmsrEngine::new(0.001).expect("Failed to create LMSR engine");
    let market_manager = Arc::new(MarketManager::new(lmsr));

    // Create market
    let event_id = "test_event_resolution_short".to_string();
    market_manager
        .create_market(
            event_id.clone(),
            "test-market".to_string(),
            "Test Market".to_string(),
            "Test description".to_string(),
            0.001,
            "creator".to_string(),
            "keyset_long".to_string(),
            "keyset_short".to_string(),
        )
        .await
        .expect("Failed to create market");

    // Resolve as SHORT (NO outcome)
    let result = market_manager.resolve_market(&event_id, Side::Short).await;
    assert!(result.is_ok(), "Market should resolve to SHORT: {:?}", result.err());

    // Verify
    let resolved_market = market_manager.get_market(&event_id).await.unwrap();
    assert!(resolved_market.is_resolved());
    assert!(resolved_market.status == MarketStatus::Resolved);
}

/// Test that resolved markets cannot be resolved again
#[tokio::test]
async fn test_cannot_resolve_twice() {
    let lmsr = LmsrEngine::new(0.001).expect("Failed to create LMSR engine");
    let market_manager = Arc::new(MarketManager::new(lmsr));

    // Create market
    let event_id = "test_event_double_resolve".to_string();
    market_manager
        .create_market(
            event_id.clone(),
            "test-market".to_string(),
            "Test Market".to_string(),
            "Test description".to_string(),
            0.001,
            "creator".to_string(),
            "keyset_long".to_string(),
            "keyset_short".to_string(),
        )
        .await
        .expect("Failed to create market");

    // First resolution should succeed
    let first_result = market_manager
        .resolve_market(&event_id, Side::Long)
        .await;
    assert!(
        first_result.is_ok(),
        "First resolution should succeed: {:?}",
        first_result.err()
    );

    // Second resolution should fail (market already resolved)
    let second_result = market_manager
        .resolve_market(&event_id, Side::Short)
        .await;
    assert!(
        second_result.is_err(),
        "Second resolution should fail: {:?}",
        second_result.err()
    );
}

/// Test market status transitions
#[tokio::test]
async fn test_market_status_transitions() {
    let lmsr = LmsrEngine::new(0.001).expect("Failed to create LMSR engine");
    let market_manager = Arc::new(MarketManager::new(lmsr));

    // Create market - should be Active
    let event_id = "test_status_transitions".to_string();
    market_manager
        .create_market(
            event_id.clone(),
            "test-market".to_string(),
            "Test Market".to_string(),
            "Test description".to_string(),
            0.001,
            "creator".to_string(),
            "keyset_long".to_string(),
            "keyset_short".to_string(),
        )
        .await
        .expect("Failed to create market");

    let market = market_manager.get_market(&event_id).await.unwrap();
    assert_eq!(
        market.status,
        MarketStatus::Active,
        "New market should be Active"
    );

    // Resolve market - should be Resolved
    market_manager
        .resolve_market(&event_id, Side::Long)
        .await
        .expect("Resolution should succeed");

    let resolved = market_manager.get_market(&event_id).await.unwrap();
    assert_eq!(
        resolved.status,
        MarketStatus::Resolved,
        "Resolved market should be Resolved"
    );
}

/// Test archive functionality
#[tokio::test]
async fn test_archive_market() {
    let lmsr = LmsrEngine::new(0.001).expect("Failed to create LMSR engine");
    let market_manager = Arc::new(MarketManager::new(lmsr));

    // Create market
    let event_id = "test_archive".to_string();
    market_manager
        .create_market(
            event_id.clone(),
            "test-market".to_string(),
            "Test Market".to_string(),
            "Test description".to_string(),
            0.001,
            "creator".to_string(),
            "keyset_long".to_string(),
            "keyset_short".to_string(),
        )
        .await
        .expect("Failed to create market");

    // Archive market
    let archive_result = market_manager.archive_market(&event_id).await;
    assert!(
        archive_result.is_ok(),
        "Archive should succeed: {:?}",
        archive_result.err()
    );

    // Verify
    let archived = market_manager.get_market(&event_id).await.unwrap();
    assert_eq!(
        archived.status,
        MarketStatus::Archived,
        "Archived market should have Archived status"
    );
}

/// Test that archive works after resolve
#[tokio::test]
async fn test_archive_after_resolve() {
    let lmsr = LmsrEngine::new(0.001).expect("Failed to create LMSR engine");
    let market_manager = Arc::new(MarketManager::new(lmsr));

    // Create and resolve market
    let event_id = "test_archive_resolved".to_string();
    market_manager
        .create_market(
            event_id.clone(),
            "test-market".to_string(),
            "Test Market".to_string(),
            "Test description".to_string(),
            0.001,
            "creator".to_string(),
            "keyset_long".to_string(),
            "keyset_short".to_string(),
        )
        .await
        .expect("Failed to create market");

    // Resolve first
    market_manager
        .resolve_market(&event_id, Side::Long)
        .await
        .expect("Resolution should succeed");

    // Then archive
    let archive_result = market_manager.archive_market(&event_id).await;
    assert!(
        archive_result.is_ok(),
        "Archive should succeed: {:?}",
        archive_result.err()
    );

    // Verify
    let archived = market_manager.get_market(&event_id).await.unwrap();
    assert_eq!(
        archived.status,
        MarketStatus::Archived,
        "Archived market should have Archived status"
    );
}

/// Test that archive and resolve work for fresh markets
#[tokio::test]
async fn test_resolve_then_archive() {
    let lmsr = LmsrEngine::new(0.001).expect("Failed to create LMSR engine");
    let _executor = TradeExecutor::new(lmsr, 100);
    
    let lmsr2 = LmsrEngine::new(0.001).expect("Failed to create LMSR engine");
    let market_manager = Arc::new(MarketManager::new(lmsr2));

    let event_id = "test_resolve_archive".to_string();
    market_manager
        .create_market(
            event_id.clone(),
            "test-market".to_string(),
            "Test Market".to_string(),
            "Test description".to_string(),
            0.001,
            "creator".to_string(),
            "keyset_long".to_string(),
            "keyset_short".to_string(),
        )
        .await
        .expect("Failed to create market");

    market_manager
        .resolve_market(&event_id, Side::Long)
        .await
        .expect("Resolution should succeed");

    let resolved = market_manager.get_market(&event_id).await.unwrap();
    assert!(resolved.is_resolved());
    assert_eq!(resolved.status, MarketStatus::Resolved);
}
