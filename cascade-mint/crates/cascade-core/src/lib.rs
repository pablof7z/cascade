//! Cascade Core — LMSR prediction market engine for Cashu ecash mint
//!
//! This library provides the market logic, LMSR pricing engine, trade execution,
//! and database persistence for the Cascade Cashu mint.

pub mod db;
pub mod error;
pub mod lmsr;
pub mod market;
pub mod market_manager;
pub mod trade;

// Re-export commonly used types
pub use error::{CascadeError, Result};
pub use market::{Market, MarketStatus, Side};
pub use market_manager::MarketManager;
pub use trade::TradeExecutor;

/// Library version
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
