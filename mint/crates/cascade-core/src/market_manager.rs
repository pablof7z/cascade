//! Market management — create, retrieve, and update markets

use crate::error::Result;
use crate::lmsr::LmsrEngine;
use crate::market::{Market, MarketStatus, Side};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Manages all markets and their state
pub struct MarketManager {
    /// In-memory market store (keyed by event_id)
    markets: Arc<RwLock<HashMap<String, Market>>>,

    /// LMSR engine for this instance
    lmsr: LmsrEngine,
}

impl MarketManager {
    /// Create a new market manager
    pub fn new(lmsr: LmsrEngine) -> Self {
        Self {
            markets: Arc::new(RwLock::new(HashMap::new())),
            lmsr,
        }
    }

    /// Create a new market
    #[allow(clippy::too_many_arguments)]
    pub async fn create_market(
        &self,
        event_id: String,
        slug: String,
        title: String,
        description: String,
        b: f64,
        creator_pubkey: String,
        long_keyset_id: String,
        short_keyset_id: String,
    ) -> Result<Market> {
        let market = Market::new(
            event_id.clone(),
            slug,
            title,
            description,
            b,
            creator_pubkey,
            long_keyset_id,
            short_keyset_id,
        );

        let mut markets = self.markets.write().await;
        if markets.contains_key(&event_id) {
            return Err(crate::error::CascadeError::InvalidInput(
                "Market already exists".to_string(),
            ));
        }

        markets.insert(event_id, market.clone());
        Ok(market)
    }

    /// Load or replace an existing market from persistent storage.
    pub async fn load_market(&self, market: Market) {
        let mut markets = self.markets.write().await;
        markets.insert(market.event_id.clone(), market);
    }

    /// Get a market by event ID
    pub async fn get_market(&self, event_id: &str) -> Result<Market> {
        let markets = self.markets.read().await;
        markets
            .get(event_id)
            .cloned()
            .ok_or_else(|| crate::error::CascadeError::MarketNotFound(event_id.to_string()))
    }

    /// List all markets
    pub async fn list_markets(&self) -> Result<Vec<Market>> {
        let markets = self.markets.read().await;
        Ok(markets.values().cloned().collect())
    }

    /// List active markets only
    pub async fn list_active_markets(&self) -> Result<Vec<Market>> {
        let markets = self.markets.read().await;
        Ok(markets
            .values()
            .filter(|m| m.is_active())
            .cloned()
            .collect())
    }

    /// Update market LMSR state after a trade
    pub async fn update_lmsr_state(
        &self,
        event_id: &str,
        delta_long: f64,
        delta_short: f64,
        reserve_delta: i64,
    ) -> Result<()> {
        let mut markets = self.markets.write().await;
        let market = markets
            .get_mut(event_id)
            .ok_or_else(|| crate::error::CascadeError::MarketNotFound(event_id.to_string()))?;

        market.q_long += delta_long;
        market.q_short += delta_short;

        if reserve_delta >= 0 {
            market.reserve_sats += reserve_delta as u64;
        } else {
            market.reserve_sats = market.reserve_sats.saturating_sub((-reserve_delta) as u64);
        }

        Ok(())
    }

    /// Resolve a market
    pub async fn resolve_market(&self, event_id: &str, outcome: Side) -> Result<()> {
        let mut markets = self.markets.write().await;
        let market = markets
            .get_mut(event_id)
            .ok_or_else(|| crate::error::CascadeError::MarketNotFound(event_id.to_string()))?;

        if !market.is_active() {
            return Err(crate::error::CascadeError::MarketNotActive(
                event_id.to_string(),
            ));
        }

        market.resolve(outcome);
        Ok(())
    }

    /// Archive a market (no more trades, ready for deletion)
    pub async fn archive_market(&self, event_id: &str) -> Result<()> {
        let mut markets = self.markets.write().await;
        let market = markets
            .get_mut(event_id)
            .ok_or_else(|| crate::error::CascadeError::MarketNotFound(event_id.to_string()))?;

        market.status = MarketStatus::Archived;
        Ok(())
    }

    /// Get LMSR engine
    pub fn lmsr(&self) -> &LmsrEngine {
        &self.lmsr
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_create_and_get_market() {
        let lmsr = LmsrEngine::new(10.0).unwrap();
        let manager = MarketManager::new(lmsr);

        let market = manager
            .create_market(
                "evt123".to_string(),
                "btc-100k".to_string(),
                "Will BTC reach $100k?".to_string(),
                "A market about Bitcoin".to_string(),
                10.0,
                "creator".to_string(),
                "keyset_long".to_string(),
                "keyset_short".to_string(),
            )
            .await
            .unwrap();

        assert_eq!(market.event_id, "evt123");

        let retrieved = manager.get_market("evt123").await.unwrap();
        assert_eq!(retrieved.event_id, "evt123");
    }

    #[tokio::test]
    async fn test_list_markets() {
        let lmsr = LmsrEngine::new(10.0).unwrap();
        let manager = MarketManager::new(lmsr);

        manager
            .create_market(
                "evt1".to_string(),
                "m1".to_string(),
                "Market 1".to_string(),
                "".to_string(),
                10.0,
                "creator".to_string(),
                "keyset_long".to_string(),
                "keyset_short".to_string(),
            )
            .await
            .unwrap();

        manager
            .create_market(
                "evt2".to_string(),
                "m2".to_string(),
                "Market 2".to_string(),
                "".to_string(),
                10.0,
                "creator".to_string(),
                "keyset_long".to_string(),
                "keyset_short".to_string(),
            )
            .await
            .unwrap();

        let markets = manager.list_markets().await.unwrap();
        assert_eq!(markets.len(), 2);
    }

    #[tokio::test]
    async fn test_update_lmsr_state() {
        let lmsr = LmsrEngine::new(10.0).unwrap();
        let manager = MarketManager::new(lmsr);

        manager
            .create_market(
                "evt123".to_string(),
                "btc".to_string(),
                "BTC Market".to_string(),
                "".to_string(),
                10.0,
                "creator".to_string(),
                "keyset_long".to_string(),
                "keyset_short".to_string(),
            )
            .await
            .unwrap();

        manager
            .update_lmsr_state("evt123", 10.0, 0.0, 1000)
            .await
            .unwrap();

        let market = manager.get_market("evt123").await.unwrap();
        assert_eq!(market.q_long, 10.0);
        assert_eq!(market.reserve_sats, 1000);
    }

    #[tokio::test]
    async fn test_resolve_market() {
        let lmsr = LmsrEngine::new(10.0).unwrap();
        let manager = MarketManager::new(lmsr);

        manager
            .create_market(
                "evt123".to_string(),
                "btc".to_string(),
                "BTC Market".to_string(),
                "".to_string(),
                10.0,
                "creator".to_string(),
                "keyset_long".to_string(),
                "keyset_short".to_string(),
            )
            .await
            .unwrap();

        manager.resolve_market("evt123", Side::Long).await.unwrap();

        let market = manager.get_market("evt123").await.unwrap();
        assert!(market.is_resolved());
        assert_eq!(market.resolution_outcome, Some(Side::Long));
    }
}
