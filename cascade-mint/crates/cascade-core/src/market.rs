//! Market types for Cascade prediction markets.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::error::MarketStatus;
use crate::lmsr::{Outcome, LmsrCalculator, DEFAULT_SENSITIVITY};

/// Default liquidity parameter for new markets (b = 0.0001).
pub const DEFAULT_LIQUIDITY: f64 = DEFAULT_SENSITIVITY;

/// Default reserve in sats for new markets.
pub const DEFAULT_RESERVE_SATS: u64 = 10_000;

/// A binary prediction market with LMSR market maker.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Market {
    /// Nostr event ID (kind 982) for this market
    pub event_id: String,

    /// Unique slug identifier for the market (d-tag value)
    pub slug: String,

    /// Market title/question
    pub title: String,

    /// Market description/details
    pub description: String,

    /// Mint URL for the sat keyset
    pub mint: String,

    /// Optional image URL for the market
    pub image: Option<String>,

    /// Pubkey of the market creator
    pub creator_pubkey: String,

    /// When the market was created
    pub created_at: DateTime<Utc>,

    /// LMSR liquidity/sensitivity parameter (default 0.0001)
    /// Higher values = more liquidity = tighter spreads
    pub b: f64,

    /// Total outstanding LONG (YES) shares (q_long in LMSR notation)
    pub q_long: f64,

    /// Total outstanding SHORT (NO) shares (q_short in LMSR notation)
    pub q_short: f64,

    /// Reserve pool in sats (accumulated from trades)
    pub reserve_sats: u64,

    /// Market status
    pub status: MarketStatus,

    /// Resolution outcome (true = YES wins, false = NO wins)
    /// Only set when status == Resolved
    pub outcome: Option<bool>,

    /// When the market was resolved
    pub resolved_at: Option<DateTime<Utc>>,

    /// Optional end date for the market question
    pub end_date: Option<DateTime<Utc>>,
}

impl Market {
    /// Create a new market with default LMSR parameters.
    pub fn new(
        slug: String,
        title: String,
        description: String,
        mint: String,
        creator_pubkey: String,
    ) -> Self {
        Self {
            event_id: String::new(),
            slug,
            title,
            description,
            mint,
            image: None,
            creator_pubkey,
            created_at: Utc::now(),
            b: DEFAULT_LIQUIDITY,
            q_long: 0.0,
            q_short: 0.0,
            reserve_sats: DEFAULT_RESERVE_SATS,
            status: MarketStatus::Open,
            outcome: None,
            resolved_at: None,
            end_date: None,
        }
    }

    /// Create a market with custom LMSR parameters.
    pub fn with_liquidity(
        slug: String,
        title: String,
        description: String,
        mint: String,
        creator_pubkey: String,
        b: f64,
        reserve_sats: u64,
    ) -> Self {
        Self {
            event_id: String::new(),
            slug,
            title,
            description,
            mint,
            image: None,
            creator_pubkey,
            created_at: Utc::now(),
            b,
            q_long: 0.0,
            q_short: 0.0,
            reserve_sats,
            status: MarketStatus::Open,
            outcome: None,
            resolved_at: None,
            end_date: None,
        }
    }

    /// Get the current LONG (YES) price.
    pub fn long_price(&self) -> f64 {
        LmsrCalculator::new(self.b).price_yes(self.q_long, self.q_short)
    }

    /// Get the current SHORT (NO) price.
    pub fn short_price(&self) -> f64 {
        LmsrCalculator::new(self.b).price_no(self.q_long, self.q_short)
    }

    /// Check if the market is open for trading.
    pub fn is_open(&self) -> bool {
        self.status == MarketStatus::Open
    }

    /// Check if the market has been resolved.
    pub fn is_resolved(&self) -> bool {
        self.status == MarketStatus::Resolved
    }

    /// Calculate the cost to buy a position.
    ///
    /// Returns (cost_sats, new_q_long, new_q_short).
    /// Cost is rounded up (ceiling) to favor the mint.
    pub fn calculate_buy_cost(&self, side: Outcome, amount: f64) -> Result<BuyCost, String> {
        if amount <= 0.0 {
            return Err("Amount must be positive".to_string());
        }

        let calculator = LmsrCalculator::new(self.b);

        match side {
            Outcome::Long => {
                let cost = calculator.cost(self.q_long + amount, self.q_short)
                    - calculator.cost(self.q_long, self.q_short);
                let cost_sats = cost.ceil() as u64;
                Ok(BuyCost {
                    cost_sats,
                    new_q_long: self.q_long + amount,
                    new_q_short: self.q_short,
                })
            }
            Outcome::Short => {
                let cost = calculator.cost(self.q_long, self.q_short + amount)
                    - calculator.cost(self.q_long, self.q_short);
                let cost_sats = cost.ceil() as u64;
                Ok(BuyCost {
                    cost_sats,
                    new_q_long: self.q_long,
                    new_q_short: self.q_short + amount,
                })
            }
        }
    }

    /// Calculate the refund for selling (redeeming) a position.
    ///
    /// Returns (refund_sats, new_q_long, new_q_short).
    /// Refund is rounded down (floor) to favor the mint.
    pub fn calculate_sell_refund(&self, side: Outcome, amount: f64) -> Result<SellRefund, String> {
        if amount <= 0.0 {
            return Err("Amount must be positive".to_string());
        }

        let calculator = LmsrCalculator::new(self.b);

        match side {
            Outcome::Long => {
                if self.q_long < amount {
                    return Err(format!(
                        "Cannot sell {} LONG, only {} outstanding",
                        amount, self.q_long
                    ));
                }
                let refund = calculator.cost(self.q_long, self.q_short)
                    - calculator.cost(self.q_long - amount, self.q_short);
                let refund_sats = refund.floor() as u64;
                Ok(SellRefund {
                    refund_sats,
                    new_q_long: self.q_long - amount,
                    new_q_short: self.q_short,
                })
            }
            Outcome::Short => {
                if self.q_short < amount {
                    return Err(format!(
                        "Cannot sell {} SHORT, only {} outstanding",
                        amount, self.q_short
                    ));
                }
                let refund = calculator.cost(self.q_long, self.q_short)
                    - calculator.cost(self.q_long, self.q_short - amount);
                let refund_sats = refund.floor() as u64;
                Ok(SellRefund {
                    refund_sats,
                    new_q_long: self.q_long,
                    new_q_short: self.q_short - amount,
                })
            }
        }
    }

    /// Resolve the market with the given outcome.
    pub fn resolve(&mut self, outcome: bool) {
        self.status = MarketStatus::Resolved;
        self.outcome = Some(outcome);
        self.resolved_at = Some(Utc::now());
    }

    /// Cancel the market (no resolution).
    pub fn cancel(&mut self) {
        self.status = MarketStatus::Cancelled;
        self.resolved_at = Some(Utc::now());
    }
}

/// Result of calculating buy cost.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuyCost {
    /// Cost in sats (rounded up)
    pub cost_sats: u64,
    /// New q_long after purchase
    pub new_q_long: f64,
    /// New q_short after purchase
    pub new_q_short: f64,
}

/// Result of calculating sell refund.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SellRefund {
    /// Refund in sats (rounded down)
    pub refund_sats: u64,
    /// New q_long after sale
    pub new_q_long: f64,
    /// New q_short after sale
    pub new_q_short: f64,
}

/// A trade on a market.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trade {
    /// Unique trade ID
    pub id: String,
    /// Market slug
    pub market_slug: String,
    /// Which side was traded
    pub side: Outcome,
    /// Amount of shares traded
    pub amount: f64,
    /// Price at time of trade (0.0 to 1.0)
    pub price: f64,
    /// Cost in sats
    pub cost_sats: u64,
    /// Fee in sats
    pub fee_sats: u64,
    /// Total sats involved
    pub total_sats: u64,
    /// Pubkey of the trader
    pub trader_pubkey: String,
    /// When the trade was executed
    pub created_at: DateTime<Utc>,
}

impl Trade {
    /// Create a new trade.
    pub fn new(
        market_slug: String,
        side: Outcome,
        amount: f64,
        price: f64,
        cost_sats: u64,
        fee_sats: u64,
        trader_pubkey: String,
    ) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            market_slug,
            side,
            amount,
            price,
            cost_sats,
            fee_sats,
            total_sats: cost_sats + fee_sats,
            trader_pubkey,
            created_at: Utc::now(),
        }
    }
}

/// A position held by a user.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    /// Market slug
    pub market_slug: String,
    /// Which side
    pub side: Outcome,
    /// Amount of shares held
    pub amount: f64,
    /// Average cost basis in sats
    pub cost_basis: u64,
    /// Pubkey of the holder
    pub holder_pubkey: String,
}

/// Calculate the fee for a trade (1% of cost, rounded up).
pub fn calculate_trade_fee(cost_sats: u64, percent: u64) -> u64 {
    ((cost_sats as f64 * percent as f64) / 100.0).ceil() as u64
}

/// Create an empty market with default values (for testing).
pub fn create_empty_market() -> Market {
    Market::new(
        "new-market".to_string(),
        "New Market".to_string(),
        "Description".to_string(),
        "https://mint.example.com".to_string(),
        "0000000000000000000000000000000000000000000000000000000000000000".to_string(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_market_new() {
        let market = Market::new(
            "test-market".to_string(),
            "Test Market".to_string(),
            "Will it happen?".to_string(),
            "https://mint.example.com".to_string(),
            "abc123".to_string(),
        );

        assert_eq!(market.slug, "test-market");
        assert_eq!(market.title, "Test Market");
        assert!(market.is_open());
        assert_eq!(market.q_long, 0.0);
        assert_eq!(market.q_short, 0.0);
        assert_eq!(market.b, DEFAULT_LIQUIDITY);
    }

    #[test]
    fn test_initial_prices_equal() {
        let market = Market::new(
            "test".to_string(),
            "Test".to_string(),
            "?".to_string(),
            "mint".to_string(),
            "pk".to_string(),
        );

        let long_price = market.long_price();
        let short_price = market.short_price();

        assert!((long_price - 0.5).abs() < 1e-10);
        assert!((short_price - 0.5).abs() < 1e-10);
    }

    #[test]
    fn test_prices_sum_to_one() {
        let market = Market::new(
            "test".to_string(),
            "Test".to_string(),
            "?".to_string(),
            "mint".to_string(),
            "pk".to_string(),
        );

        let sum = market.long_price() + market.short_price();
        assert!((sum - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_buy_cost_positive() {
        let mut market = Market::new(
            "test".to_string(),
            "Test".to_string(),
            "?".to_string(),
            "mint".to_string(),
            "pk".to_string(),
        );
        market.q_long = 100.0;
        market.q_short = 100.0;

        let result = market.calculate_buy_cost(Outcome::Long, 10.0).unwrap();
        assert!(result.cost_sats > 0);
    }

    #[test]
    fn test_resolve_market() {
        let mut market = Market::new(
            "test".to_string(),
            "Test".to_string(),
            "?".to_string(),
            "mint".to_string(),
            "pk".to_string(),
        );

        market.resolve(true);
        assert!(market.is_resolved());
        assert_eq!(market.outcome, Some(true));
        assert!(market.resolved_at.is_some());
    }

    #[test]
    fn test_cancel_market() {
        let mut market = Market::new(
            "test".to_string(),
            "Test".to_string(),
            "?".to_string(),
            "mint".to_string(),
            "pk".to_string(),
        );

        market.cancel();
        assert_eq!(market.status, MarketStatus::Cancelled);
        assert!(market.resolved_at.is_some());
    }

    #[test]
    fn test_trade_fee() {
        assert_eq!(calculate_trade_fee(100, 1), 1);  // 1%
        assert_eq!(calculate_trade_fee(1000, 1), 10); // 1%
        assert_eq!(calculate_trade_fee(99, 1), 1);   // Rounds up
    }
}
