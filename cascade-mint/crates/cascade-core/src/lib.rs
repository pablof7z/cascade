//! Cascade Core - Core library for Cascade prediction markets.
//!
//! This crate provides the core functionality for running prediction markets
//! using the LMSR (Logarithmic Market Scoring Rule) market maker algorithm.

pub mod error;
pub mod market;
pub mod market_manager;
pub mod lmsr;
pub mod trade;
pub mod db;
pub mod nostr_publisher;

// Re-export commonly used types
pub use error::{CascadeError, MarketStatus};
pub use lmsr::{Outcome, LmsrCalculator, DEFAULT_SENSITIVITY};
pub use market::{Market, Trade, BuyCost, SellRefund, calculate_trade_fee};
pub use market_manager::MarketManager;
pub use db::Database;
pub use nostr_publisher::{NostrPublisher, PublisherConfig};
