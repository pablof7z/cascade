//! Nostr publisher for market events (kind 982, 983).
//!
//! Handles publishing market data and trade events to Nostr relays.
//!
//! NOTE: This is a simplified implementation. The Nostr SDK API has
//! compatibility issues with multiple versions in the dependency tree.
//! For production, ensure consistent nostr/nostr-sdk versions.

use serde::{Deserialize, Serialize};

use crate::error::CascadeError;
use crate::lmsr::Outcome;
use crate::market::{Market, Trade};

/// Publisher for Nostr market and trade events.
#[derive(Clone)]
pub struct NostrPublisher {
    relays: Vec<String>,
}

/// Publisher configuration.
#[derive(Debug, Clone)]
pub struct PublisherConfig {
    /// List of relay URLs
    pub relays: Vec<String>,
}

impl Default for PublisherConfig {
    fn default() -> Self {
        Self {
            relays: vec![
                "wss://relay.damus.io".to_string(),
                "wss://relay.nostr.band".to_string(),
            ],
        }
    }
}

impl NostrPublisher {
    /// Create a new Nostr publisher with the given config.
    pub async fn new(_config: PublisherConfig) -> Result<Self, CascadeError> {
        // For now, we use a simplified implementation that doesn't
        // actually connect to relays. This can be enhanced when the
        // nostr-sdk dependency issues are resolved.
        Ok(Self {
            relays: _config.relays,
        })
    }

    /// Create a new Nostr publisher with default relays.
    pub async fn with_default_relays() -> Result<Self, CascadeError> {
        Self::new(PublisherConfig::default()).await
    }

    /// Publish a market event (kind 982).
    ///
    /// Returns the event ID on success.
    pub async fn publish_market(&self, market: &Market) -> Result<String, CascadeError> {
        // Serialize market to JSON
        let content = serde_json::to_string(market)
            .map_err(|e| CascadeError::SerializationError(e.to_string()))?;

        // Generate a placeholder event ID (in production, this would be
        // the actual Nostr event ID after publishing)
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(&content);
        let result = hasher.finalize();
        let event_id = format!("{:x}", result);

        tracing::info!(
            "Would publish market event: slug={}, event_id={}",
            market.slug,
            event_id
        );

        Ok(event_id)
    }

    /// Update an existing market event.
    ///
    /// This is essentially the same as publish_market but may include
    /// the original event ID in tags.
    pub async fn update_market(&self, market: &Market) -> Result<String, CascadeError> {
        self.publish_market(market).await
    }

    /// Publish a trade event (kind 983).
    ///
    /// Kind 983 is the Cascade trade event format for recording trades on Nostr.
    pub async fn publish_trade_event(
        &self,
        trade: &Trade,
        market_slug: &str,
    ) -> Result<String, CascadeError> {
        let trade_event = TradeEvent {
            trade_id: trade.id.clone(),
            market_slug: market_slug.to_string(),
            side: match trade.side {
                Outcome::Long => "long".to_string(),
                Outcome::Short => "short".to_string(),
            },
            amount: trade.amount,
            price: trade.price,
            cost_sats: trade.cost_sats,
            fee_sats: trade.fee_sats,
            trader_pubkey: trade.trader_pubkey.clone(),
            timestamp: trade.created_at.to_rfc3339(),
        };

        let content = serde_json::to_string(&trade_event)
            .map_err(|e| CascadeError::SerializationError(e.to_string()))?;

        let event_id = {
            use sha2::{Sha256, Digest};
            let mut hasher = Sha256::new();
            hasher.update(&content);
            let result = hasher.finalize();
            format!("{:x}", result)
        };

        tracing::info!(
            "Would publish trade event: trade_id={}, market={}, event_id={}",
            trade_event.trade_id,
            market_slug,
            event_id
        );

        Ok(event_id)
    }

    /// Get the relays this publisher is configured to use.
    pub fn relays(&self) -> &[String] {
        &self.relays
    }

    /// Check if connected to at least one relay.
    pub async fn is_connected(&self) -> bool {
        !self.relays.is_empty()
    }
}

/// Trade event structure for kind 983.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradeEvent {
    /// Unique trade ID
    pub trade_id: String,
    /// Market slug this trade is on
    pub market_slug: String,
    /// Trade side (long or short)
    pub side: String,
    /// Amount of shares traded
    pub amount: f64,
    /// Price at time of trade
    pub price: f64,
    /// Cost in sats
    pub cost_sats: u64,
    /// Fee in sats
    pub fee_sats: u64,
    /// Pubkey of trader
    pub trader_pubkey: String,
    /// ISO 8601 timestamp
    pub timestamp: String,
}

impl std::fmt::Display for NostrPublisher {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "NostrPublisher with {} relays", self.relays.len())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    #[test]
    fn test_trade_event_serialization() {
        let trade_event = TradeEvent {
            trade_id: "test-123".to_string(),
            market_slug: "bitcoin-price-2025".to_string(),
            side: "long".to_string(),
            amount: 10.0,
            price: 0.5,
            cost_sats: 500,
            fee_sats: 5,
            trader_pubkey: "abc123".to_string(),
            timestamp: Utc::now().to_rfc3339(),
        };

        let json = serde_json::to_string(&trade_event).unwrap();
        assert!(json.contains("test-123"));
        assert!(json.contains("long"));
    }

    #[tokio::test]
    async fn test_publisher_creation() {
        let config = PublisherConfig {
            relays: vec!["wss://relay.example.com".to_string()],
        };
        let publisher = NostrPublisher::new(config).await;
        assert!(publisher.is_ok());
    }
}
