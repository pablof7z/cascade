//! Market manager for handling market operations.
//!
//! Coordinates between the database layer and the LMSR pricing engine.
//! Provides high-level operations for creating, trading, and resolving markets.

use std::sync::Arc;

use crate::db::Database;
use crate::error::{CascadeError, MarketStatus};
use crate::lmsr::{Outcome, LmsrCalculator};
use crate::market::{Market, SellRefund, Trade, calculate_trade_fee};

/// Manager for market operations.
///
/// Handles CRUD operations on markets, trade execution, and market resolution.
#[derive(Clone)]
pub struct MarketManager {
    db: Arc<Database>,
}

impl MarketManager {
    /// Create a new market manager with the given database.
    pub fn new(db: Database) -> Self {
        Self { db: Arc::new(db) }
    }

    /// Create a new market manager from a database arc.
    pub fn from_db(db: Arc<Database>) -> Self {
        Self { db }
    }

    // ==================== MARKET CRUD ====================

    /// Create a new market.
    ///
    /// The market is initialized with default LMSR parameters and saved to the database.
    pub async fn create_market(
        &self,
        slug: String,
        title: String,
        description: String,
        mint: String,
        creator_pubkey: String,
    ) -> Result<Market, CascadeError> {
        // Check if market with this slug already exists
        if self.db.get_market(&slug).await?.is_some() {
            return Err(CascadeError::InvalidInput {
                reason: format!("Market with slug '{}' already exists", slug),
            });
        }

        let market = Market::new(slug, title, description, mint, creator_pubkey);
        self.db.save_market(&market).await?;

        Ok(market)
    }

    /// Create a new market with custom LMSR parameters.
    pub async fn create_market_with_params(
        &self,
        slug: String,
        title: String,
        description: String,
        mint: String,
        creator_pubkey: String,
        b: f64,
        reserve_sats: u64,
    ) -> Result<Market, CascadeError> {
        // Validate b parameter
        if b <= 0.0 {
            return Err(CascadeError::InvalidInput {
                reason: "Liquidity parameter b must be positive".to_string(),
            });
        }

        // Check if market with this slug already exists
        if self.db.get_market(&slug).await?.is_some() {
            return Err(CascadeError::InvalidInput {
                reason: format!("Market with slug '{}' already exists", slug),
            });
        }

        let market = Market::with_liquidity(slug, title, description, mint, creator_pubkey, b, reserve_sats);
        self.db.save_market(&market).await?;

        Ok(market)
    }

    /// Get a market by slug.
    pub async fn get_market(&self, slug: &str) -> Result<Option<Market>, CascadeError> {
        self.db.get_market(slug).await
    }

    /// Get a market by event ID.
    pub async fn get_market_by_event_id(&self, event_id: &str) -> Result<Option<Market>, CascadeError> {
        self.db.get_market_by_event_id(event_id).await
    }

    /// Get all markets.
    pub async fn get_all_markets(&self) -> Result<Vec<Market>, CascadeError> {
        self.db.get_all_markets().await
    }

    /// Get all open markets.
    pub async fn get_open_markets(&self) -> Result<Vec<Market>, CascadeError> {
        self.db.get_open_markets().await
    }

    /// Update the event ID for a market (after publishing to Nostr).
    pub async fn set_event_id(&self, slug: &str, event_id: String) -> Result<(), CascadeError> {
        let mut market = self.db.get_market(slug).await?
            .ok_or_else(|| CascadeError::MarketNotFound { slug: slug.to_string() })?;

        market.event_id = event_id;
        self.db.save_market(&market).await?;

        Ok(())
    }

    // ==================== TRADING OPERATIONS ====================

    /// Get current prices for a market.
    pub async fn get_prices(&self, slug: &str) -> Result<MarketPrices, CascadeError> {
        let market = self.db.get_market(slug).await?
            .ok_or_else(|| CascadeError::MarketNotFound { slug: slug.to_string() })?;

        let calculator = LmsrCalculator::new(market.b);

        Ok(MarketPrices {
            long_price: calculator.price_yes(market.q_long, market.q_short),
            short_price: calculator.price_no(market.q_long, market.q_short),
            q_long: market.q_long,
            q_short: market.q_short,
            b: market.b,
        })
    }

    /// Calculate the cost to buy a position.
    ///
    /// Returns the cost in sats and the new LMSR state after the purchase.
    pub async fn calculate_buy_cost(
        &self,
        slug: &str,
        side: Outcome,
        amount: f64,
    ) -> Result<TradeCost, CascadeError> {
        let market = self.db.get_market(slug).await?
            .ok_or_else(|| CascadeError::MarketNotFound { slug: slug.to_string() })?;

        if !market.is_open() {
            return Err(CascadeError::MarketNotActive {
                slug: slug.to_string(),
                status: market.status,
            });
        }

        let cost = market.calculate_buy_cost(side, amount)
            .map_err(|e| CascadeError::InvalidInput { reason: e })?;

        let fee_sats = calculate_trade_fee(cost.cost_sats, 1); // 1% fee

        Ok(TradeCost {
            cost_sats: cost.cost_sats,
            fee_sats,
            total_sats: cost.cost_sats + fee_sats,
            new_q_long: cost.new_q_long,
            new_q_short: cost.new_q_short,
            new_reserve: market.reserve_sats + cost.cost_sats,
        })
    }

    /// Execute a buy trade.
    ///
    /// This is the core trade execution function. After validation:
    /// 1. Calculates LMSR cost
    /// 2. Updates LMSR state
    /// 3. Records the trade
    /// 4. Returns the trade result
    pub async fn execute_buy(
        &self,
        slug: &str,
        side: Outcome,
        amount: f64,
        trader_pubkey: String,
    ) -> Result<TradeResult, CascadeError> {
        let market = self.db.get_market(slug).await?
            .ok_or_else(|| CascadeError::MarketNotFound { slug: slug.to_string() })?;

        if !market.is_open() {
            return Err(CascadeError::MarketNotActive {
                slug: slug.to_string(),
                status: market.status,
            });
        }

        // Calculate cost
        let cost = market.calculate_buy_cost(side, amount)
            .map_err(|e| CascadeError::InvalidInput { reason: e })?;

        let fee_sats = calculate_trade_fee(cost.cost_sats, 1);
        let total_sats = cost.cost_sats + fee_sats;
        let new_reserve = market.reserve_sats + cost.cost_sats;

        // Get price for recording
        let calculator = LmsrCalculator::new(market.b);
        let price = match side {
            Outcome::Long => calculator.price_yes(cost.new_q_long, cost.new_q_short),
            Outcome::Short => calculator.price_no(cost.new_q_long, cost.new_q_short),
        };

        // Create trade record
        let trade = Trade::new(
            slug.to_string(),
            side,
            amount,
            price,
            cost.cost_sats,
            fee_sats,
            trader_pubkey,
        );

        // Update LMSR state
        self.db.update_lmsr_state(slug, cost.new_q_long, cost.new_q_short, new_reserve).await?;

        // Save trade
        self.db.save_trade(&trade).await?;

        // Get updated prices
        let new_prices = MarketPrices {
            long_price: calculator.price_yes(cost.new_q_long, cost.new_q_short),
            short_price: calculator.price_no(cost.new_q_long, cost.new_q_short),
            q_long: cost.new_q_long,
            q_short: cost.new_q_short,
            b: market.b,
        };

        Ok(TradeResult {
            trade_id: trade.id,
            cost_sats: cost.cost_sats,
            fee_sats,
            total_sats,
            amount,
            side,
            new_prices,
        })
    }

    /// Calculate the refund for selling a position.
    pub async fn calculate_sell_refund(
        &self,
        slug: &str,
        side: Outcome,
        amount: f64,
    ) -> Result<SellRefund, CascadeError> {
        let market = self.db.get_market(slug).await?
            .ok_or_else(|| CascadeError::MarketNotFound { slug: slug.to_string() })?;

        if !market.is_open() {
            return Err(CascadeError::MarketNotActive {
                slug: slug.to_string(),
                status: market.status,
            });
        }

        market.calculate_sell_refund(side, amount)
            .map_err(|e| CascadeError::InvalidTrade { reason: e })
    }

    /// Execute a sell trade.
    pub async fn execute_sell(
        &self,
        slug: &str,
        side: Outcome,
        amount: f64,
        trader_pubkey: String,
    ) -> Result<SellResult, CascadeError> {
        let market = self.db.get_market(slug).await?
            .ok_or_else(|| CascadeError::MarketNotFound { slug: slug.to_string() })?;

        if !market.is_open() {
            return Err(CascadeError::MarketNotActive {
                slug: slug.to_string(),
                status: market.status,
            });
        }

        // Calculate refund
        let refund = market.calculate_sell_refund(side, amount)
            .map_err(|e| CascadeError::InvalidTrade { reason: e })?;

        let fee_sats = calculate_trade_fee(refund.refund_sats, 1);
        let total_refund = refund.refund_sats.saturating_sub(fee_sats);
        let new_reserve = market.reserve_sats.saturating_sub(refund.refund_sats);

        // Get price for recording
        let calculator = LmsrCalculator::new(market.b);
        let price = match side {
            Outcome::Long => calculator.price_yes(refund.new_q_long, refund.new_q_short),
            Outcome::Short => calculator.price_no(refund.new_q_long, refund.new_q_short),
        };

        // Create trade record (negative amount for sells)
        let trade = Trade::new(
            slug.to_string(),
            side,
            -amount, // Negative for sells
            price,
            refund.refund_sats,
            fee_sats,
            trader_pubkey,
        );

        // Update LMSR state
        self.db.update_lmsr_state(slug, refund.new_q_long, refund.new_q_short, new_reserve).await?;

        // Save trade
        self.db.save_trade(&trade).await?;

        Ok(SellResult {
            trade_id: trade.id,
            refund_sats: refund.refund_sats,
            fee_sats,
            total_refund,
            amount,
            side,
        })
    }

    // ==================== MARKET RESOLUTION ====================

    /// Resolve a market with the given outcome.
    ///
    /// - `outcome == true`: YES (LONG) wins
    /// - `outcome == false`: NO (SHORT) wins
    pub async fn resolve_market(&self, slug: &str, outcome: bool) -> Result<Market, CascadeError> {
        let market = self.db.get_market(slug).await?
            .ok_or_else(|| CascadeError::MarketNotFound { slug: slug.to_string() })?;

        if !market.is_open() {
            return Err(CascadeError::InvalidInput {
                reason: format!("Cannot resolve market with status {:?}", market.status),
            });
        }

        let mut updated_market = market.clone();
        updated_market.resolve(outcome);

        self.db.save_market(&updated_market).await?;

        Ok(updated_market)
    }

    /// Cancel a market (no resolution, refunds all positions).
    pub async fn cancel_market(&self, slug: &str) -> Result<Market, CascadeError> {
        let market = self.db.get_market(slug).await?
            .ok_or_else(|| CascadeError::MarketNotFound { slug: slug.to_string() })?;

        if !market.is_open() {
            return Err(CascadeError::InvalidInput {
                reason: format!("Cannot cancel market with status {:?}", market.status),
            });
        }

        let mut updated_market = market.clone();
        updated_market.cancel();

        self.db.save_market(&updated_market).await?;

        Ok(updated_market)
    }

    /// Archive a market (soft delete).
    pub async fn archive_market(&self, slug: &str) -> Result<Market, CascadeError> {
        let market = self.db.get_market(slug).await?
            .ok_or_else(|| CascadeError::MarketNotFound { slug: slug.to_string() })?;

        let mut updated_market = market.clone();
        updated_market.status = MarketStatus::Archived;

        self.db.save_market(&updated_market).await?;

        Ok(updated_market)
    }

    /// Permanently delete a market and all associated trades.
    pub async fn delete_market(&self, slug: &str) -> Result<(), CascadeError> {
        // Verify market exists
        if self.db.get_market(slug).await?.is_none() {
            return Err(CascadeError::MarketNotFound { slug: slug.to_string() });
        }

        self.db.delete_market(slug).await
    }

    // ==================== TRADE HISTORY ====================

    /// Get all trades for a market.
    pub async fn get_trades(&self, slug: &str) -> Result<Vec<Trade>, CascadeError> {
        // Verify market exists
        if self.db.get_market(slug).await?.is_none() {
            return Err(CascadeError::MarketNotFound { slug: slug.to_string() });
        }

        self.db.get_trades(slug).await
    }

    /// Get trades for a specific trader.
    pub async fn get_trader_trades(&self, trader_pubkey: &str) -> Result<Vec<Trade>, CascadeError> {
        self.db.get_trader_trades(trader_pubkey).await
    }
}

// ==================== RESULT TYPES ====================

/// Current market prices.
#[derive(Debug, Clone)]
pub struct MarketPrices {
    /// Current LONG (YES) price (0.0 to 1.0)
    pub long_price: f64,
    /// Current SHORT (NO) price (0.0 to 1.0)
    pub short_price: f64,
    /// Total outstanding LONG shares
    pub q_long: f64,
    /// Total outstanding SHORT shares
    pub q_short: f64,
    /// LMSR liquidity parameter
    pub b: f64,
}

/// Result of calculating trade cost.
#[derive(Debug, Clone)]
pub struct TradeCost {
    /// Base cost in sats
    pub cost_sats: u64,
    /// Fee in sats (1%)
    pub fee_sats: u64,
    /// Total sats required
    pub total_sats: u64,
    /// New q_long after trade
    pub new_q_long: f64,
    /// New q_short after trade
    pub new_q_short: f64,
    /// New reserve after trade
    pub new_reserve: u64,
}

/// Result of executing a buy trade.
#[derive(Debug, Clone)]
pub struct TradeResult {
    /// Trade ID
    pub trade_id: String,
    /// Base cost in sats
    pub cost_sats: u64,
    /// Fee in sats
    pub fee_sats: u64,
    /// Total sats paid
    pub total_sats: u64,
    /// Amount of shares purchased
    pub amount: f64,
    /// Which side was bought
    pub side: Outcome,
    /// New prices after trade
    pub new_prices: MarketPrices,
}

/// Result of executing a sell trade.
#[derive(Debug, Clone)]
pub struct SellResult {
    /// Trade ID
    pub trade_id: String,
    /// Base refund in sats
    pub refund_sats: u64,
    /// Fee deducted
    pub fee_sats: u64,
    /// Total refund received
    pub total_refund: u64,
    /// Amount of shares sold
    pub amount: f64,
    /// Which side was sold
    pub side: Outcome,
}

#[cfg(test)]
mod tests {
    use super::*;

    // Note: Tests require a database connection
    // Integration tests should be in cascade-api or a separate test module

    #[test]
    fn test_trade_cost_calculation() {
        // Test that cost calculation works without DB
        let market = Market::new(
            "test".to_string(),
            "Test".to_string(),
            "?".to_string(),
            "mint".to_string(),
            "pk".to_string(),
        );

        let cost = market.calculate_buy_cost(Outcome::Long, 100.0).unwrap();
        assert!(cost.cost_sats > 0);
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

        assert!(market.is_open());
        market.resolve(true);
        assert!(market.is_resolved());
        assert_eq!(market.outcome, Some(true));
    }
}
