//! Trade execution and settlement logic

use crate::error::Result;
use crate::market::{Market, Side};
use crate::lmsr::LmsrEngine;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

/// Represents a trade (buy or sell)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trade {
    /// Unique trade ID
    pub id: String,

    /// Market this trade is for
    pub market_id: String,

    /// Buyer's pubkey (empty for anonymous in v1)
    pub buyer_pubkey: String,

    /// Side being bought
    pub side: Side,

    /// Quantity of tokens purchased
    pub quantity: f64,

    /// Sats paid
    pub cost_sats: u64,

    /// Fee paid to mint (included in cost_sats)
    pub fee_sats: u64,

    /// Total sats (cost + fee)
    pub total_sats: u64,

    /// Timestamp of trade
    pub created_at: DateTime<Utc>,
}

/// Represents a resolution payout
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Payout {
    /// Unique payout ID
    pub id: String,

    /// Market this is for
    pub market_id: String,

    /// Pubkey receiving payout
    pub recipient_pubkey: String,

    /// Side that won
    pub winning_side: Side,

    /// Number of winning tokens being redeemed
    pub winning_tokens: f64,

    /// Sats paid out
    pub payout_sats: u64,

    /// Timestamp of payout
    pub created_at: DateTime<Utc>,
}

/// Trade executor — handles buy/sell/resolution
pub struct TradeExecutor {
    lmsr: LmsrEngine,
    fee_bps: u16, // Fee in basis points (100 bps = 1%)
}

impl TradeExecutor {
    /// Create a new trade executor
    pub fn new(lmsr: LmsrEngine, fee_bps: u16) -> Self {
        Self { lmsr, fee_bps }
    }

    /// Calculate fee in sats
    fn calculate_fee(&self, amount_sats: u64) -> u64 {
        ((amount_sats as f64) * (self.fee_bps as f64 / 10000.0)).ceil() as u64
    }

    /// Get current prices (long, short) for market state
    pub fn get_prices(&self, q_long: f64, q_short: f64) -> crate::error::Result<(f64, f64)> {
        self.lmsr.get_prices(q_long, q_short)
    }

    /// Calculate total cost including fee
    pub fn calculate_total_cost(&self, q_long: f64, q_short: f64, amount: f64) -> crate::error::Result<u64> {
        let cost = self.lmsr.calculate_buy_cost(q_long, q_short, amount)?;
        Ok(cost + self.calculate_fee(cost))
    }

    /// Execute a buy order
    pub fn execute_buy(
        &self,
        market: &Market,
        side: Side,
        quantity: f64,
        buyer_pubkey: String,
    ) -> Result<Trade> {
        // Get current quantities
        let (q_long, q_short) = match side {
            Side::Long => (market.q_long, market.q_short),
            Side::Short => (market.q_short, market.q_long),
        };

        // Calculate cost
        let cost_before_fee = self.lmsr.calculate_buy_cost(q_long, q_short, quantity)?;
        let fee = self.calculate_fee(cost_before_fee);
        let total_cost = cost_before_fee + fee;

        let trade = Trade {
            id: uuid::Uuid::new_v4().to_string(),
            market_id: market.event_id.clone(),
            buyer_pubkey,
            side,
            quantity,
            cost_sats: total_cost,
            fee_sats: fee,
            total_sats: total_cost + fee,
            created_at: Utc::now(),
        };

        Ok(trade)
    }

    /// Execute a sell order
    pub fn execute_sell(
        &self,
        market: &Market,
        side: Side,
        quantity: f64,
        seller_pubkey: String,
    ) -> Result<Trade> {
        // Get current quantities
        let (q_long, q_short) = match side {
            Side::Long => (market.q_long, market.q_short),
            Side::Short => (market.q_short, market.q_long),
        };

        // Calculate refund
        let refund_before_fee = self.lmsr.calculate_sell_refund(q_long, q_short, quantity)?;
        let fee = self.calculate_fee(refund_before_fee);
        let net_refund = refund_before_fee.saturating_sub(fee);

        let trade = Trade {
            id: uuid::Uuid::new_v4().to_string(),
            market_id: market.event_id.clone(),
            buyer_pubkey: seller_pubkey, // Reuse field for seller
            side,
            quantity: -quantity, // Negative quantity indicates sell
            cost_sats: net_refund,
            fee_sats: fee,
            total_sats: refund_before_fee,
            created_at: Utc::now(),
        };

        Ok(trade)
    }

    /// Execute a resolution payout
    pub fn execute_resolution_payout(
        &self,
        market: &Market,
        recipient_pubkey: String,
        winning_tokens: f64,
    ) -> Result<Payout> {
        let winning_side = market
            .resolution_outcome
            .ok_or_else(|| crate::error::CascadeError::MarketNotActive(
                market.event_id.clone(),
            ))?;

        // 1:1 payout for winning tokens
        let payout_sats = winning_tokens.ceil() as u64;

        let payout = Payout {
            id: uuid::Uuid::new_v4().to_string(),
            market_id: market.event_id.clone(),
            recipient_pubkey,
            winning_side,
            winning_tokens,
            payout_sats,
            created_at: Utc::now(),
        };

        Ok(payout)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fee_calculation() {
        let lmsr = LmsrEngine::new(10.0).unwrap();
        let executor = TradeExecutor::new(lmsr, 100); // 1% fee

        let fee = executor.calculate_fee(10000);
        assert_eq!(fee, 100);

        let fee = executor.calculate_fee(10001);
        assert_eq!(fee, 101);
    }
}
