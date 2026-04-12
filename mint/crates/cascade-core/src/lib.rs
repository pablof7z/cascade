//! Cascade Core — LMSR prediction market engine for Cashu ecash mint
//!
//! This library provides the market logic, LMSR pricing engine, trade execution,
//! database persistence, and Lightning integration for the Cascade Cashu mint.

pub mod db;
pub mod error;
pub mod escrow;
pub mod invoice;
pub mod lightning;
pub mod lmsr;
pub mod market;
pub mod market_manager;
pub mod product;
pub mod trade;

// Re-export commonly used types
pub use error::{CascadeError, Result};
pub use escrow::{EscrowAccount, EscrowManager, EscrowState, EscrowStats};
pub use invoice::{InvoiceService, LightningOrder, OrderState};
pub use lightning::{
    HtlcHandler, InvoiceState, LightningInvoice, LndClient, LndConfig, PaymentHash, PaymentStatus,
    Preimage,
};
pub use lmsr::LmsrEngine;
pub use market::{Market, MarketStatus, Side};
pub use market_manager::MarketManager;
pub use product::{
    FxQuoteSnapshot, MarketLaunchState, MarketPosition, MarketTradeRecord, MarketVisibility,
    TradeQuoteSnapshot, WalletBalanceRecord, WalletFundingEvent, WalletTopupQuote,
    WalletTopupStatus,
};
pub use trade::TradeExecutor;

/// Library version
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
