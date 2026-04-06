//! Trade execution for market orders.

use crate::error::CascadeError;
use serde::{Deserialize, Serialize};

/// A trade order on a market.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trade {
    pub id: String,
    pub market_id: String,
    pub outcome: bool,
    pub amount: u64,
    pub price: f64,
}

impl Trade {
    /// Create a new trade.
    pub fn new(_market_id: String, _outcome: bool, _amount: u64) -> Self {
        todo!("Implement Trade::new")
    }

    /// Execute the trade.
    pub fn execute(&self) -> Result<(), CascadeError> {
        todo!("Implement Trade::execute")
    }
}
