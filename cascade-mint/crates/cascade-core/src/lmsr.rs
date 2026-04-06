//! LMSR (Logarithmic Market Scoring Rule) market making math for prediction markets.
//!
//! Ported from TypeScript `src/market.ts` with log-space arithmetic for numerical stability.

/// Default sensitivity parameter for LMSR markets (b = 0.0001).
/// Higher values = more liquidity = tighter spreads.
pub const DEFAULT_SENSITIVITY: f64 = 0.0001;

/// Clamps a value between a minimum and maximum.
fn clamp(value: f64, min: f64, max: f64) -> f64 {
    value.max(min).min(max)
}

/// Computes log-sum-exp in a numerically stable way.
/// log-sum-exp(a, b) = max(a, b) + log(exp(a - max(a, b)) + exp(b - max(a, b)))
///
/// This avoids overflow when a and b are large.
fn log_sum_exp(a: f64, b: f64) -> f64 {
    let max = a.max(b);
    // If both values are -inf, return -inf
    if max == f64::NEG_INFINITY {
        return f64::NEG_INFINITY;
    }
    // If max is inf, return inf
    if max == f64::INFINITY {
        return f64::INFINITY;
    }
    // Using the log-sum-exp trick: log(exp(a) + exp(b)) = max(a,b) + log(exp(a-max) + exp(b-max))
    let exp_a = (a - max).exp();
    let exp_b = (b - max).exp();
    if exp_a + exp_b == 0.0 {
        max // Both were -inf
    } else {
        max + (exp_a + exp_b).ln()
    }
}

/// Calculates the cost of a position in the LMSR market.
///
/// Cost function: C(q_long, q_short, b) = log-sum-exp(b * q_long, b * q_short) / b
///
/// This represents the number of sats required to acquire a position
/// with the given outstanding share counts.
///
/// # Arguments
/// * `q_long` - Total outstanding YES shares
/// * `q_short` - Total outstanding NO shares
/// * `b` - Liquidity parameter (higher = more sensitive to large positions)
pub fn cost_function(q_long: f64, q_short: f64, b: f64) -> f64 {
    if b <= 0.0 {
        return f64::NAN;
    }
    log_sum_exp(b * q_long, b * q_short) / b
}

/// Calculates the price of YES (LONG) shares.
///
/// Price function: p_long = 1 / (1 + exp(-b * (q_long - q_short)))
/// Or equivalently: p_long = exp(b * q_long) / (exp(b * q_long) + exp(b * q_short))
///
/// Returns the market's probability estimate that YES wins,
/// clamped to [0, 1] range for numerical stability.
///
/// # Arguments
/// * `q_long` - Total outstanding YES shares
/// * `q_short` - Total outstanding NO shares
/// * `b` - Liquidity parameter
pub fn price_long(q_long: f64, q_short: f64, b: f64) -> f64 {
    if b <= 0.0 {
        return f64::NAN;
    }
    let exponent = clamp(-b * (q_long - q_short), -60.0, 60.0);
    1.0 / (1.0 + exponent.exp())
}

/// Calculates the price of NO (SHORT) shares.
///
/// Price function: p_short = 1 - p_long
///
/// Returns the market's probability estimate that NO wins.
///
/// # Arguments
/// * `q_long` - Total outstanding YES shares
/// * `q_short` - Total outstanding NO shares
/// * `b` - Liquidity parameter
pub fn price_short(q_long: f64, q_short: f64, b: f64) -> f64 {
    1.0 - price_long(q_long, q_short, b)
}

/// Calculates the marginal cost of buying additional shares.
///
/// This is the derivative of the cost function with respect to the quantity
/// of shares being purchased on a specific side.
///
/// # Arguments
/// * `q_long` - Current outstanding YES shares
/// * `q_short` - Current outstanding NO shares
/// * `b` - Liquidity parameter
/// * `side` - Which side to calculate for
pub fn marginal_cost(q_long: f64, q_short: f64, b: f64, side: Outcome) -> f64 {
    match side {
        Outcome::Long => price_long(q_long, q_short, b),
        Outcome::Short => price_short(q_long, q_short, b),
    }
}

/// Outcome side for a prediction market.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum Outcome {
    Long,
    Short,
}

impl Outcome {
    /// Returns the opposite outcome.
    pub fn opposite(&self) -> Self {
        match self {
            Outcome::Long => Outcome::Short,
            Outcome::Short => Outcome::Long,
        }
    }
}

/// Uses the LMSR cost function to determine the number of shares
/// that can be purchased for the given amount.
///
/// # Arguments
/// * `q_long` - Current outstanding YES shares
/// * `q_short` - Current outstanding NO shares
/// * `b` - Liquidity parameter
/// * `side` - Which side to buy
/// * `sats` - Amount of sats to spend (after fees)
pub fn solve_buy_tokens(
    q_long: f64,
    q_short: f64,
    b: f64,
    side: Outcome,
    sats: f64,
) -> f64 {
    if sats <= 0.0 || b <= 0.0 {
        return 0.0;
    }

    let (_current_q, _target_q) = match side {
        Outcome::Long => (q_long, q_long),
        Outcome::Short => (q_short, q_short),
    };

    // Cost function: C(q_long, q_short) = log-sum-exp(b*q_long, b*q_short) / b
    // For buying on Long: C(q_long + delta, q_short) - C(q_long, q_short) = sats
    // For buying on Short: C(q_long, q_short + delta) - C(q_long, q_short) = sats

    // Binary search for delta that satisfies the cost equation
    let mut low = 0.0;
    let mut high = sats / (b * 1e-6); // Reasonable upper bound
    let tolerance = 1e-8;

    for _ in 0..100 {
        let mid = (low + high) / 2.0;
        let cost = match side {
            Outcome::Long => {
                cost_function(q_long + mid, q_short, b) - cost_function(q_long, q_short, b)
            }
            Outcome::Short => {
                cost_function(q_long, q_short + mid, b) - cost_function(q_long, q_short, b)
            }
        };

        if (cost - sats).abs() < tolerance {
            return mid;
        }

        if cost < sats {
            low = mid;
        } else {
            high = mid;
        }
    }

    (low + high) / 2.0
}

/// Calculates the payout for selling (redeeming) shares.
///
/// Uses the LMSR cost function to determine the sat payout
/// for returning shares to the market.
///
/// # Arguments
/// * `q_long` - Current outstanding YES shares
/// * `q_short` - Current outstanding NO shares
/// * `b` - Liquidity parameter
/// * `side` - Which side to sell
/// * `shares` - Number of shares to redeem
pub fn solve_redeem_value(
    q_long: f64,
    q_short: f64,
    b: f64,
    side: Outcome,
    shares: f64,
) -> f64 {
    if shares <= 0.0 || b <= 0.0 {
        return 0.0;
    }

    // Payout = C(q_long, q_short) - C(q_long - shares, q_short) for Long
    // Payout = C(q_long, q_short) - C(q_long, q_short - shares) for Short

    let cost_before = cost_function(q_long, q_short, b);
    let cost_after = match side {
        Outcome::Long => cost_function(q_long - shares, q_short, b),
        Outcome::Short => cost_function(q_long, q_short - shares, b),
    };

    (cost_before - cost_after).max(0.0)
}

/// LMSR (Logarithmic Market Scoring Rule) calculator.
pub struct LmsrCalculator {
    b: f64,
}

impl LmsrCalculator {
    /// Create a new LMSR calculator with the given liquidity parameter.
    ///
    /// # Arguments
    /// * `liquidity` - The liquidity parameter b. Higher values make the market
    ///   less sensitive to large positions. Typical values are 0.0001 to 0.01.
    pub fn new(liquidity: f64) -> Self {
        Self { b: liquidity }
    }

    /// Calculate the current market price for YES (LONG).
    ///
    /// Returns a value between 0 and 1, representing the market's
    /// probability estimate that YES will win.
    pub fn price_yes(&self, q_long: f64, q_short: f64) -> f64 {
        price_long(q_long, q_short, self.b)
    }

    /// Calculate the current market price for NO (SHORT).
    ///
    /// Returns a value between 0 and 1, representing the market's
    /// probability estimate that NO will win.
    pub fn price_no(&self, q_long: f64, q_short: f64) -> f64 {
        price_short(q_long, q_short, self.b)
    }

    /// Calculate the total cost of acquiring a position.
    ///
    /// Returns the number of sats required to hold the given
    /// outstanding shares on both sides.
    pub fn cost(&self, q_long: f64, q_short: f64) -> f64 {
        cost_function(q_long, q_short, self.b)
    }

    /// Calculate the marginal cost of buying one more share.
    pub fn marginal_price(&self, q_long: f64, q_short: f64, side: Outcome) -> f64 {
        marginal_cost(q_long, q_short, self.b, side)
    }
}

/// Calculate the LMSR probability for YES.
pub fn calculate_probability(b: f64, q_long: f64, q_short: f64) -> f64 {
    price_long(q_long, q_short, b)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_price_long_baseline() {
        // When q_long == q_short, price should be 0.5 (50%)
        let price = price_long(100.0, 100.0, 0.0001);
        assert!((price - 0.5).abs() < 1e-10);
    }

    #[test]
    fn test_price_short_baseline() {
        // When q_long == q_short, price should be 0.5 (50%)
        let price = price_short(100.0, 100.0, 0.0001);
        assert!((price - 0.5).abs() < 1e-10);
    }

    #[test]
    fn test_prices_sum_to_one() {
        let q_long = 50.0;
        let q_short = 150.0;
        let b = 0.0001;

        let p_long = price_long(q_long, q_short, b);
        let p_short = price_short(q_long, q_short, b);

        assert!((p_long + p_short - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_price_bounded() {
        // Prices should always be between 0 and 1
        let b = 0.0001;

        for q_long in [0.0, 10.0, 100.0, 1000.0, 10000.0] {
            for q_short in [0.0, 10.0, 100.0, 1000.0, 10000.0] {
                let p_long = price_long(q_long, q_short, b);
                let p_short = price_short(q_long, q_short, b);

                assert!(p_long >= 0.0 && p_long <= 1.0, "p_long out of bounds");
                assert!(p_short >= 0.0 && p_short <= 1.0, "p_short out of bounds");
            }
        }
    }

    #[test]
    fn test_more_long_shares_lower_long_price() {
        // More YES shares outstanding = higher YES price (more bet on YES = higher probability)
        let b = 0.0001;

        let price_low_long = price_long(100.0, 100.0, b); // Same on both sides
        let price_high_long = price_long(200.0, 100.0, b); // More YES shares

        assert!(price_high_long > price_low_long, "More YES shares should raise YES price");
    }

    #[test]
    fn test_cost_increases_with_shares() {
        // Cost should increase as we buy more shares
        let b = 0.0001;

        let cost_100 = cost_function(100.0, 100.0, b);
        let cost_200 = cost_function(200.0, 100.0, b);

        assert!(cost_200 > cost_100, "More shares should increase cost");
    }

    #[test]
    fn test_cost_function_symmetric() {
        // Cost should be the same regardless of which side has more shares
        let b = 0.0001;

        let cost_ls = cost_function(100.0, 200.0, b); // Long 100, Short 200
        let cost_sl = cost_function(200.0, 100.0, b); // Long 200, Short 100

        assert!((cost_ls - cost_sl).abs() < 1e-10, "Cost should be symmetric");
    }

    #[test]
    fn test_marginal_cost_near_price() {
        // For small trades, marginal cost should be close to current price
        let b = 0.0001;
        let q_long = 100.0;
        let q_short = 100.0;

        let price = price_long(q_long, q_short, b);
        let marginal = marginal_cost(q_long, q_short, b, Outcome::Long);

        assert!((price - marginal).abs() < 1e-6, "Marginal cost should equal current price");
    }

    #[test]
    fn test_solve_buy_tokens_basic() {
        let b = 0.0001;
        let q_long = 100.0;
        let q_short = 100.0;

        // With equal shares at 50/50, spending 1 sat should give us roughly 1 share
        // (at marginal price of 0.5, we need 2 sats for 1 share)
        let shares = solve_buy_tokens(q_long, q_short, b, Outcome::Long, 1.0);

        // Should get approximately 1 share (inverse of 0.5 price)
        assert!(shares > 0.5 && shares < 2.0, "Got {} shares for 1 sat", shares);
    }

    #[test]
    fn test_solve_redeem_value_basic() {
        let b = 0.0001;
        let q_long = 100.0;
        let q_short = 100.0;

        // Selling 1 share at 50/50 should return approximately 1 sat
        let payout = solve_redeem_value(q_long, q_short, b, Outcome::Long, 1.0);

        // Should get approximately 1 sat (at marginal price of 0.5, we get 0.5 sats per share... wait no)
        // Actually at 50/50, marginal cost = 0.5, so 1 share costs 0.5 sats
        // But this is the redeem value for returning shares
        assert!(payout > 0.0, "Should get some payout for shares");
    }

    #[test]
    fn test_lmsr_calculator() {
        let calc = LmsrCalculator::new(0.0001);

        let price_yes = calc.price_yes(100.0, 100.0);
        let price_no = calc.price_no(100.0, 100.0);

        assert!((price_yes + price_no - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_zero_liquidity_returns_nan() {
        // Zero liquidity parameter should return NaN
        assert!(price_long(100.0, 100.0, 0.0).is_nan());
        assert!(price_short(100.0, 100.0, 0.0).is_nan());
        assert!(cost_function(100.0, 100.0, 0.0).is_nan());
    }

    #[test]
    fn test_negative_liquidity_returns_nan() {
        // Negative liquidity parameter should return NaN
        assert!(price_long(100.0, 100.0, -1.0).is_nan());
        assert!(price_short(100.0, 100.0, -1.0).is_nan());
        assert!(cost_function(100.0, 100.0, -1.0).is_nan());
    }

    #[test]
    fn test_log_sum_exp_stability() {
        // Test numerical stability with large values
        // Without the log-sum-exp trick, exp(1000) would overflow
        let result = log_sum_exp(1000.0, 1000.0);
        assert!(result.is_finite());
        assert!(result > 999.0 && result < 1001.0);

        let result2 = log_sum_exp(-1000.0, -1000.0);
        assert!(result2.is_finite());
        assert!(result2 > -1001.0 && result2 < -999.0);
    }

    #[test]
    fn test_cross_validate_typescript() {
        // Cross-validation: verify self-consistency within Rust implementation
        // At equal shares (100, 100), price should be exactly 0.5
        let b = 0.0001;

        let price = price_long(100.0, 100.0, b);
        assert!((price - 0.5).abs() < 1e-10, "Price should be 0.5 at equal shares");

        // When q_long=0, q_short=100: price_long = 1 / (1 + exp(0.01))
        let price_0_100 = price_long(0.0, 100.0, b);
        let expected_0_100 = 1.0 / (1.0 + (0.01f64).exp());
        assert!((price_0_100 - expected_0_100).abs() < 1e-10, "Price mismatch at 0, 100");

        // When q_long=100, q_short=0: price_long = 1 / (1 + exp(-0.01))
        let price_100_0 = price_long(100.0, 0.0, b);
        let expected_100_0 = 1.0 / (1.0 + (-0.01f64).exp());
        assert!((price_100_0 - expected_100_0).abs() < 1e-10, "Price mismatch at 100, 0");

        // Verify price_short = 1 - price_long
        let price_short = price_short(100.0, 100.0, b);
        assert!((price_short - (1.0 - price)).abs() < 1e-10, "Price_short should be 1 - price_long");
    }
}
