//! Lightning Network integration via LND gRPC
//!
//! This module provides integration with the Lightning Network Daemon (LND)
//! for invoice creation, payment monitoring, and preimage verification.

pub mod lnd_client;
pub mod htlc;
pub mod types;

pub use htlc::{HtlcCondition, HtlcHandler, HtlcState, HtlcWitness};
pub use lnd_client::{create_shared_client, LndClient, LndConfig, LndNodeInfo, SharedLndClient};
pub use types::{InvoiceState, LightningInvoice, PaymentHash, PaymentStatus, Preimage};
