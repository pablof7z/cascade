//! Market types for Cascade markets.

use serde::{Deserialize, Serialize};

/// Market representing a binary prediction market.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Market {
    pub id: String,
    pub title: String,
    pub description: String,
    pub slug: String,
    pub event_id: String,
}

impl Market {
    pub fn new() -> Self {
        todo!("Implement Market::new")
    }
}

/// Create an empty market with default values.
pub fn create_empty_market() -> Market {
    todo!("Implement create_empty_market")
}
