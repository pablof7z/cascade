//! LMSR (Logarithmic Market Scoring Rule) pricing engine
//!
//! Implements the standard LMSR market maker formula:
//! cost(q_long, q_short) = b * ln(exp(q_long/b) + exp(q_short/b))
//!
//! Price for long: P(L) = exp(q_long/b) / (exp(q_long/b) + exp(q_short/b))
//! Price for short: P(S) = exp(q_short/b) / (exp(q_long/b) + exp(q_short/b))

use crate::error::{CascadeError, Result};

/// LMSR pricing engine
#[derive(Debug, Clone)]
pub struct LmsrEngine {
    /// Market parameter — controls depth and liquidity
    /// Larger b = flatter AMM curve = deeper market
    b: f64,
}

impl LmsrEngine {
    /// Create a new LMSR engine with parameter b
    pub fn new(b: f64) -> Result<Self> {
        if b <= 0.0 {
            return Err(CascadeError::lmsr("b parameter must be positive"));
        }
        Ok(Self { b })
    }

    /// Get the parameter b
    pub fn b(&self) -> f64 {
        self.b
    }

    /// Cost function: C(q_long, q_short) = b * ln(exp(q_long/b) + exp(q_short/b))
    /// This is the cumulative cost paid by all traders.
    fn cost_function(&self, q_long: f64, q_short: f64) -> Result<f64> {
        // log_sum_exp avoids overflow: ln(e^a + e^b) = max(a,b) + ln(e^(a-max) + e^(b-max))
        // Here a = q_long/b, b = q_short/b
        let a = q_long / self.b;
        let b = q_short / self.b;
        let max = a.max(b);

        if !max.is_finite() {
            return Err(CascadeError::CostCalculationFailed(
                "Quantity too large (overflow)".to_string(),
            ));
        }

        let log_sum = max + ((a - max).exp() + (b - max).exp()).ln();
        let cost = self.b * log_sum;

        if !cost.is_finite() {
            return Err(CascadeError::CostCalculationFailed(
                "Cost calculation resulted in non-finite value".to_string(),
            ));
        }

        Ok(cost)
    }

    /// Price of long at given quantities: P(L) = exp(q_long/b) / (exp(q_long/b) + exp(q_short/b))
    pub fn price_long(&self, q_long: f64, q_short: f64) -> Result<f64> {
        // Use log-sum-exp trick to avoid overflow: p = exp(a) / (exp(a) + exp(b))
        // = exp(a - max(a,b)) / (exp(a-max) + exp(b-max))
        let a = q_long / self.b;
        let b = q_short / self.b;
        let max = a.max(b);
        let denom = (a - max).exp() + (b - max).exp();

        if !denom.is_finite() {
            return Err(CascadeError::CostCalculationFailed(
                "Long price calculation failed".to_string(),
            ));
        }

        // numerator = exp(a - max(a,b))
        let price = (a - max).exp() / denom;

        if !price.is_finite() {
            return Err(CascadeError::CostCalculationFailed(
                "Long price calculation failed".to_string(),
            ));
        }

        Ok(price)
    }

    /// Price of short at given quantities: P(S) = exp(q_short/b) / (exp(q_long/b) + exp(q_short/b))
    pub fn price_short(&self, q_long: f64, q_short: f64) -> Result<f64> {
        // Use log-sum-exp trick to avoid overflow: p = exp(b) / (exp(a) + exp(b))
        // = exp(b - max(a,b)) / (exp(a-max) + exp(b-max))
        let a = q_long / self.b;
        let b = q_short / self.b;
        let max = a.max(b);
        let denom = (a - max).exp() + (b - max).exp();

        if !denom.is_finite() {
            return Err(CascadeError::CostCalculationFailed(
                "Short price calculation failed".to_string(),
            ));
        }

        // numerator = exp(b - max(a,b))
        let price = (b - max).exp() / denom;

        if !price.is_finite() {
            return Err(CascadeError::CostCalculationFailed(
                "Short price calculation failed".to_string(),
            ));
        }

        Ok(price)
    }

    /// Get both prices at once
    pub fn get_prices(&self, q_long: f64, q_short: f64) -> Result<(f64, f64)> {
        let p_long = self.price_long(q_long, q_short)?;
        let p_short = self.price_short(q_long, q_short)?;
        Ok((p_long, p_short))
    }

    /// Calculate cost to buy `amount` of long tokens
    /// Cost = C(q_long + amount, q_short) - C(q_long, q_short)
    pub fn calculate_buy_cost(&self, q_long: f64, q_short: f64, amount: f64) -> Result<u64> {
        if amount <= 0.0 {
            return Err(CascadeError::invalid_trade("Buy amount must be positive"));
        }

        let cost_before = self.cost_function(q_long, q_short)?;
        let cost_after = self.cost_function(q_long + amount, q_short)?;
        let cost_sats = cost_after - cost_before;

        if cost_sats < 0.0 {
            return Err(CascadeError::CostCalculationFailed(
                "Cost calculation resulted in negative value".to_string(),
            ));
        }

        // Ceiling for buys (round up to favor market maker)
        Ok(cost_sats.ceil() as u64)
    }

    /// Calculate sats refunded for selling `amount` of long tokens
    /// Refund = C(q_long, q_short) - C(q_long - amount, q_short)
    pub fn calculate_sell_refund(&self, q_long: f64, q_short: f64, amount: f64) -> Result<u64> {
        if amount <= 0.0 {
            return Err(CascadeError::invalid_trade("Sell amount must be positive"));
        }

        if amount > q_long {
            return Err(CascadeError::InsufficientFunds {
                need: amount.ceil() as u64,
                have: q_long.floor() as u64,
            });
        }

        let cost_before = self.cost_function(q_long, q_short)?;
        let cost_after = self.cost_function(q_long - amount, q_short)?;
        let refund_sats = cost_before - cost_after;

        if refund_sats < 0.0 {
            return Err(CascadeError::CostCalculationFailed(
                "Refund calculation resulted in negative value".to_string(),
            ));
        }

        // Floor for sells (round down to favor market maker)
        Ok(refund_sats.floor() as u64)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lmsr_creation() {
        let engine = LmsrEngine::new(10.0).unwrap();
        assert_eq!(engine.b(), 10.0);

        // Invalid b should error
        assert!(LmsrEngine::new(0.0).is_err());
        assert!(LmsrEngine::new(-5.0).is_err());
    }

    #[test]
    fn test_prices_at_equilibrium() {
        let engine = LmsrEngine::new(10.0).unwrap();

        // At q_long = q_short, prices should be 0.5 each
        let (p_long, p_short) = engine.get_prices(10.0, 10.0).unwrap();
        assert!((p_long - 0.5).abs() < 0.0001);
        assert!((p_short - 0.5).abs() < 0.0001);
        assert!((p_long + p_short - 1.0).abs() < 0.0001);
    }

    #[test]
    fn test_price_sum() {
        let engine = LmsrEngine::new(10.0).unwrap();

        // Prices should always sum to ~1.0
        for q_l in [0.0, 5.0, 10.0, 20.0, 50.0] {
            for q_s in [0.0, 5.0, 10.0, 20.0, 50.0] {
                let (p_long, p_short) = engine.get_prices(q_l, q_s).unwrap();
                assert!(
                    (p_long + p_short - 1.0).abs() < 0.0001,
                    "Price sum failed at q_long={}, q_short={}: {} + {} = {}",
                    q_l,
                    q_s,
                    p_long,
                    p_short,
                    p_long + p_short
                );
            }
        }
    }

    #[test]
    fn test_buy_cost() {
        let engine = LmsrEngine::new(10.0).unwrap();

        // First purchase of 10 long tokens from (0, 0)
        let cost = engine.calculate_buy_cost(0.0, 0.0, 10.0).unwrap();
        assert!(cost > 0);

        // Cost increases with more quantity
        let cost2 = engine.calculate_buy_cost(0.0, 0.0, 20.0).unwrap();
        assert!(cost2 > cost);
    }

    #[test]
    fn test_sell_cost() {
        let engine = LmsrEngine::new(10.0).unwrap();

        // Can't sell without owning
        assert!(engine.calculate_sell_refund(0.0, 0.0, 10.0).is_err());

        // Selling 10 of 20
        let refund = engine.calculate_sell_refund(20.0, 0.0, 10.0).unwrap();
        assert!(refund > 0);
    }

    #[test]
    fn test_roundtrip_buy_sell() {
        let engine = LmsrEngine::new(10.0).unwrap();

        // Buy 10 tokens at q=(0,0)
        let buy_cost = engine.calculate_buy_cost(0.0, 0.0, 10.0).unwrap();

        // Sell them back at q=(10,0)
        let sell_refund = engine.calculate_sell_refund(10.0, 0.0, 10.0).unwrap();

        // Due to ceiling/floor rounding, refund may be slightly less
        assert!(sell_refund <= buy_cost);
        assert!(sell_refund as i64 - buy_cost as i64 >= -1); // Off by at most 1 sat
    }
}
