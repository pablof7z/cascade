use cdk_common::nuts::CurrencyUnit;
use serde::{Deserialize, Serialize};

/// Market status enum
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MarketStatus {
    Active,
    Resolved,
    Archived,
}

impl std::fmt::Display for MarketStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MarketStatus::Active => write!(f, "active"),
            MarketStatus::Resolved => write!(f, "resolved"),
            MarketStatus::Archived => write!(f, "archived"),
        }
    }
}

impl std::str::FromStr for MarketStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "active" => Ok(MarketStatus::Active),
            "resolved" => Ok(MarketStatus::Resolved),
            "archived" => Ok(MarketStatus::Archived),
            _ => Err(format!("Invalid market status: {}", s)),
        }
    }
}

/// Trading side (position direction)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum Side {
    Long,
    Short,
}

impl std::fmt::Display for Side {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Side::Long => write!(f, "LONG"),
            Side::Short => write!(f, "SHORT"),
        }
    }
}

impl std::str::FromStr for Side {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_uppercase().as_str() {
            "LONG" => Ok(Side::Long),
            "SHORT" => Ok(Side::Short),
            _ => Err(format!("Invalid side: {}", s)),
        }
    }
}

/// Prediction market struct
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Market {
    /// Nostr event ID (hex) — canonical identifier
    pub event_id: String,
    /// d-tag from kind 982 event
    pub slug: String,
    /// Market title
    pub title: String,
    /// Market description
    pub description: String,
    /// LMSR sensitivity parameter
    pub b: f64,
    /// Outstanding LONG quantity
    pub q_long: f64,
    /// Outstanding SHORT quantity
    pub q_short: f64,
    /// Total sats backing this market
    pub reserve_sats: u64,
    /// Market status
    pub status: MarketStatus,
    /// Resolution outcome (if resolved)
    pub resolution_outcome: Option<Side>,
    /// hex pubkey of market creator
    pub creator_pubkey: String,
    /// Unix timestamp
    pub created_at: i64,
    /// CDK keyset ID for LONG unit
    pub long_keyset_id: String,
    /// CDK keyset ID for SHORT unit
    pub short_keyset_id: String,
    /// Unix timestamp when resolved (if resolved)
    pub resolved_at: Option<i64>,
}

impl Market {
    /// Create a new market with default values
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        event_id: String,
        slug: String,
        title: String,
        description: String,
        b: f64,
        creator_pubkey: String,
        long_keyset_id: String,
        short_keyset_id: String,
    ) -> Self {
        let now = chrono::Utc::now().timestamp();
        Market {
            event_id,
            slug,
            title,
            description,
            b,
            q_long: 0.0,
            q_short: 0.0,
            reserve_sats: 0,
            status: MarketStatus::Active,
            resolution_outcome: None,
            creator_pubkey,
            created_at: now,
            long_keyset_id,
            short_keyset_id,
            resolved_at: None,
        }
    }

    /// Get the LONG currency unit for this market
    pub fn long_unit(&self) -> CurrencyUnit {
        CurrencyUnit::Custom(format!("LONG_{}", self.slug))
    }

    /// Get the SHORT currency unit for this market
    pub fn short_unit(&self) -> CurrencyUnit {
        CurrencyUnit::Custom(format!("SHORT_{}", self.slug))
    }

    /// Get the currency unit for a given side
    pub fn unit_for_side(&self, side: Side) -> CurrencyUnit {
        match side {
            Side::Long => self.long_unit(),
            Side::Short => self.short_unit(),
        }
    }

    /// Check if the market is active
    pub fn is_active(&self) -> bool {
        self.status == MarketStatus::Active
    }

    /// Check if the market is resolved
    pub fn is_resolved(&self) -> bool {
        self.status == MarketStatus::Resolved
    }

    /// Resolve the market with the given outcome
    pub fn resolve(&mut self, outcome: Side) {
        self.status = MarketStatus::Resolved;
        self.resolution_outcome = Some(outcome);
        self.resolved_at = Some(chrono::Utc::now().timestamp());
    }
}

/// Trade direction for quotes
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TradeDirection {
    Buy,
    Sell,
}

impl std::fmt::Display for TradeDirection {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TradeDirection::Buy => write!(f, "buy"),
            TradeDirection::Sell => write!(f, "sell"),
        }
    }
}

impl std::str::FromStr for TradeDirection {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "buy" => Ok(TradeDirection::Buy),
            "sell" => Ok(TradeDirection::Sell),
            _ => Err(format!("Invalid trade direction: {}", s)),
        }
    }
}

/// Trade record for audit trail
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trade {
    pub id: String,
    pub market_slug: String,
    pub side: Side,
    pub direction: TradeDirection,
    pub amount: f64,
    pub cost_sats: i64,
    pub fee_sats: i64,
    pub total_sats: i64,
    pub q_long_before: f64,
    pub q_short_before: f64,
    pub q_long_after: f64,
    pub q_short_after: f64,
    pub created_at: i64,
}

impl Trade {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        market_slug: String,
        side: Side,
        direction: TradeDirection,
        amount: f64,
        cost_sats: i64,
        fee_sats: i64,
        q_long_before: f64,
        q_short_before: f64,
        q_long_after: f64,
        q_short_after: f64,
    ) -> Self {
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp();
        Trade {
            id,
            market_slug,
            side,
            direction,
            amount,
            cost_sats,
            fee_sats,
            total_sats: cost_sats + fee_sats,
            q_long_before,
            q_short_before,
            q_long_after,
            q_short_after,
            created_at: now,
        }
    }
}

/// LMSR state snapshot for price history
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LmsrSnapshot {
    pub id: Option<i64>,
    pub market_slug: String,
    pub q_long: f64,
    pub q_short: f64,
    pub price_long: f64,
    pub price_short: f64,
    pub reserve_sats: i64,
    pub snapshot_at: i64,
}

impl LmsrSnapshot {
    pub fn new(market: &Market, price_long: f64, price_short: f64) -> Self {
        let now = chrono::Utc::now().timestamp();
        LmsrSnapshot {
            id: None,
            market_slug: market.slug.clone(),
            q_long: market.q_long,
            q_short: market.q_short,
            price_long,
            price_short,
            reserve_sats: market.reserve_sats as i64,
            snapshot_at: now,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_market_status_display() {
        assert_eq!(MarketStatus::Active.to_string(), "active");
        assert_eq!(MarketStatus::Resolved.to_string(), "resolved");
        assert_eq!(MarketStatus::Archived.to_string(), "archived");
    }

    #[test]
    fn test_market_status_parse() {
        assert_eq!(
            "active".parse::<MarketStatus>().unwrap(),
            MarketStatus::Active
        );
        assert_eq!(
            "RESOLVED".parse::<MarketStatus>().unwrap(),
            MarketStatus::Resolved
        );
    }

    #[test]
    fn test_side_display() {
        assert_eq!(Side::Long.to_string(), "LONG");
        assert_eq!(Side::Short.to_string(), "SHORT");
    }

    #[test]
    fn test_side_parse() {
        assert_eq!("LONG".parse::<Side>().unwrap(), Side::Long);
        assert_eq!("short".parse::<Side>().unwrap(), Side::Short);
    }

    #[test]
    fn test_currency_units() {
        let market = Market::new(
            "event123".to_string(),
            "btc-100k".to_string(),
            "BTC above 100k".to_string(),
            "Will BTC reach 100k?".to_string(),
            0.0001,
            "creator123".to_string(),
            "keyset_long_123".to_string(),
            "keyset_short_456".to_string(),
        );

        assert_eq!(market.long_unit().to_string(), "long_btc-100k");
        assert_eq!(market.short_unit().to_string(), "short_btc-100k");

        assert_eq!(
            market.unit_for_side(Side::Long).to_string(),
            "long_btc-100k"
        );
        assert_eq!(
            market.unit_for_side(Side::Short).to_string(),
            "short_btc-100k"
        );
    }

    #[test]
    fn test_market_serialization() {
        let market = Market::new(
            "event123".to_string(),
            "btc-100k".to_string(),
            "BTC above 100k".to_string(),
            "Will BTC reach 100k?".to_string(),
            0.0001,
            "creator123".to_string(),
            "keyset_long_123".to_string(),
            "keyset_short_456".to_string(),
        );

        let json = serde_json::to_string(&market).unwrap();
        let parsed: Market = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.slug, market.slug);
        assert_eq!(parsed.b, market.b);
        assert_eq!(parsed.status, market.status);
    }
}
