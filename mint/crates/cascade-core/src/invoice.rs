//! Invoice generation and management for Lightning trades
//!
//! This module handles:
//! - BOLT 11 invoice generation via LND
//! - NIP-47 Lightning address/payment request format
//! - Invoice tracking and state management

use crate::error::{CascadeError, Result};
use crate::escrow::{EscrowAccount, EscrowManager};
use crate::lightning::lnd_client::LndClient;
use crate::lightning::types::{InvoiceState, LightningInvoice, PaymentHash, Preimage};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Trade order state
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OrderState {
    /// Order created, invoice pending
    Created,
    /// Invoice generated, awaiting payment
    InvoicePending,
    /// Payment received, awaiting confirmation
    PaymentReceived,
    /// Order fulfilled, tokens minted
    Fulfilled,
    /// Order cancelled
    Cancelled,
    /// Order expired
    Expired,
}

impl std::fmt::Display for OrderState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            OrderState::Created => write!(f, "created"),
            OrderState::InvoicePending => write!(f, "invoice_pending"),
            OrderState::PaymentReceived => write!(f, "payment_received"),
            OrderState::Fulfilled => write!(f, "fulfilled"),
            OrderState::Cancelled => write!(f, "cancelled"),
            OrderState::Expired => write!(f, "expired"),
        }
    }
}

/// Trade order with Lightning payment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LightningOrder {
    /// Unique order ID
    pub id: String,
    /// Market slug
    pub market_slug: String,
    /// Trading side (LONG/SHORT)
    pub side: String,
    /// Amount in sats
    pub amount_sats: u64,
    /// Fee in sats
    pub fee_sats: u64,
    /// Total amount to pay
    pub total_sats: u64,
    /// Escrow account ID
    pub escrow_id: String,
    /// Lightning invoice
    pub invoice: String,
    /// Payment hash
    pub payment_hash: String,
    /// Order state
    pub state: OrderState,
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    /// Expiry timestamp
    pub expires_at: DateTime<Utc>,
    /// Fulfillment timestamp
    pub fulfilled_at: Option<DateTime<Utc>>,
    /// Preimage once revealed
    pub preimage: Option<String>,
    /// NIP-47 request ID (if applicable)
    pub nip47_request_id: Option<String>,
    /// User's pubkey (from NIP-46 or NIP-07)
    pub user_pubkey: Option<String>,
}

impl LightningOrder {
    /// Create a new lightning order
    pub fn new(
        market_slug: String,
        side: String,
        amount_sats: u64,
        fee_sats: u64,
        escrow: &EscrowAccount,
        invoice: &LightningInvoice,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            market_slug,
            side,
            amount_sats,
            fee_sats,
            total_sats: amount_sats + fee_sats,
            escrow_id: escrow.id.clone(),
            invoice: invoice.bolt11().to_string(),
            payment_hash: invoice.payment_hash.to_hex(),
            state: OrderState::InvoicePending,
            created_at: now,
            expires_at: escrow.expires_at,
            fulfilled_at: None,
            preimage: None,
            nip47_request_id: None,
            user_pubkey: None,
        }
    }

    /// Check if order is payable
    pub fn is_payable(&self) -> bool {
        self.state == OrderState::InvoicePending && Utc::now() < self.expires_at
    }

    /// Get remaining seconds
    pub fn remaining_seconds(&self) -> i64 {
        let now = Utc::now();
        if now >= self.expires_at {
            0
        } else {
            (self.expires_at - now).num_seconds()
        }
    }

    /// Mark as fulfilled
    pub fn fulfill(&mut self, preimage: &Preimage) {
        self.state = OrderState::Fulfilled;
        self.fulfilled_at = Some(Utc::now());
        self.preimage = Some(preimage.to_hex());
    }

    /// Mark as expired
    pub fn expire(&mut self) {
        self.state = OrderState::Expired;
    }

    /// Mark as cancelled
    pub fn cancel(&mut self) {
        self.state = OrderState::Cancelled;
    }
}

/// Invoice generator service
pub struct InvoiceService {
    /// LND client
    lnd_client: LndClient,
    /// Escrow manager
    escrow_manager: EscrowManager,
    /// Default invoice expiry in seconds
    default_expiry_seconds: u64,
    /// CLTV delta for HTLCs
    cltv_delta: u64,
    /// Orders indexed by order ID
    orders: std::collections::HashMap<String, LightningOrder>,
    /// Order lookup by payment hash
    orders_by_payment_hash: std::collections::HashMap<String, String>,
}

impl InvoiceService {
    /// Create a new invoice service
    pub fn new(lnd_client: LndClient, default_expiry_seconds: u64, cltv_delta: u64) -> Self {
        Self {
            lnd_client,
            escrow_manager: EscrowManager::new(default_expiry_seconds as i64),
            default_expiry_seconds,
            cltv_delta,
            orders: std::collections::HashMap::new(),
            orders_by_payment_hash: std::collections::HashMap::new(),
        }
    }

    pub async fn create_invoice(
        &mut self,
        amount_msat: u64,
        description: Option<String>,
        expiry_seconds: Option<u64>,
    ) -> Result<LightningInvoice> {
        self.lnd_client
            .add_invoice(
                amount_msat,
                description,
                expiry_seconds.or(Some(self.default_expiry_seconds)),
                Some(self.cltv_delta),
            )
            .await
    }

    pub async fn pay_invoice(&self, invoice: &str) -> Result<Preimage> {
        self.lnd_client.pay_invoice(invoice).await
    }

    /// Generate an invoice for a trade
    pub async fn generate_trade_invoice(
        &mut self,
        order_id: String,
        market_slug: String,
        side: String,
        amount_sats: u64,
        fee_sats: u64,
        description: Option<String>,
    ) -> Result<(LightningOrder, LightningInvoice)> {
        let total_sats = amount_sats + fee_sats;
        let amount_msat = total_sats * 1000;

        // Generate invoice via LND
        let invoice = self
            .lnd_client
            .add_invoice(
                amount_msat,
                description.or_else(|| {
                    Some(format!(
                        "Cascade: {} {} for {}",
                        side, amount_sats, market_slug
                    ))
                }),
                Some(self.default_expiry_seconds),
                Some(self.cltv_delta),
            )
            .await?;

        let payment_hash = invoice.payment_hash.clone();

        // Create escrow
        let escrow = self.escrow_manager.create_escrow(
            order_id.clone(),
            market_slug.clone(),
            side.clone(),
            total_sats,
            payment_hash,
            invoice.bolt11().to_string(),
        );

        // Create order
        let order =
            LightningOrder::new(market_slug, side, amount_sats, fee_sats, &escrow, &invoice);

        Ok((order, invoice))
    }

    /// Verify payment and settle escrow
    pub async fn verify_and_settle(
        &mut self,
        _order_id: &str,
        preimage: Preimage,
    ) -> Result<LightningOrder> {
        let payment_hash = preimage.payment_hash();

        // Settle escrow
        let _escrow = self
            .escrow_manager
            .settle_by_payment_hash(&payment_hash.to_hex(), &preimage)?;

        // Find order (would need to store orders somewhere)
        // For now, return a placeholder
        Err(CascadeError::invalid_input(
            "Order lookup not implemented".to_string(),
        ))
    }

    /// Check invoice status via LND
    pub async fn check_invoice_status(&self, payment_hash: &PaymentHash) -> Result<InvoiceState> {
        match self.lnd_client.get_invoice(payment_hash).await? {
            Some(invoice) => Ok(invoice.state),
            None => Err(CascadeError::invalid_input("Invoice not found".to_string())),
        }
    }

    /// Create a Lightning order and store it
    #[allow(clippy::too_many_arguments)]
    pub async fn create_lightning_order(
        &mut self,
        _market_id: &str,
        market_slug: &str,
        side: &str,
        amount_sats: u64,
        fee_sats: u64,
        order_id: &str,
        user_pubkey: String,
        expires_at: i64,
    ) -> Result<LightningOrder> {
        let total_sats = amount_sats + fee_sats;
        let amount_msat = total_sats * 1000;

        // Generate invoice via LND
        let invoice = self
            .lnd_client
            .add_invoice(
                amount_msat,
                Some(format!(
                    "Cascade: {} {} for {}",
                    side, amount_sats, market_slug
                )),
                Some(self.default_expiry_seconds),
                Some(self.cltv_delta),
            )
            .await?;

        let payment_hash = invoice.payment_hash.clone();
        let payment_hash_hex = payment_hash.to_hex();

        // Create escrow
        let escrow = self.escrow_manager.create_escrow(
            order_id.to_string(),
            market_slug.to_string(),
            side.to_string(),
            total_sats,
            payment_hash.clone(),
            invoice.bolt11().to_string(),
        );

        // Create order (used below with correct ID)
        let _order = LightningOrder::new(
            market_slug.to_string(),
            side.to_string(),
            amount_sats,
            fee_sats,
            &escrow,
            &invoice,
        );

        // Override the order_id with the provided one (not a new UUID)
        let order_id_to_use = order_id.to_string();

        // Create a new order with the correct ID
        let final_order = LightningOrder {
            id: order_id_to_use.clone(),
            market_slug: market_slug.to_string(),
            side: side.to_string(),
            amount_sats,
            fee_sats,
            total_sats,
            escrow_id: escrow.id.clone(),
            invoice: invoice.bolt11().to_string(),
            payment_hash: payment_hash_hex.clone(),
            state: OrderState::InvoicePending,
            created_at: chrono::Utc::now(),
            expires_at: chrono::DateTime::from_timestamp(expires_at, 0)
                .unwrap_or_else(|| chrono::Utc::now() + chrono::Duration::hours(1)),
            fulfilled_at: None,
            preimage: None,
            nip47_request_id: None,
            user_pubkey: Some(user_pubkey),
        };

        // Store the order
        self.orders
            .insert(order_id_to_use.clone(), final_order.clone());
        self.orders_by_payment_hash
            .insert(payment_hash_hex, order_id_to_use);

        Ok(final_order)
    }

    /// Get invoice status as a string (for API response)
    pub async fn get_invoice_status(&self, payment_hash: &str) -> Result<String> {
        // First check our local orders
        if let Some(order_id) = self.orders_by_payment_hash.get(payment_hash) {
            if let Some(order) = self.orders.get(order_id) {
                return Ok(format!("{:?}", order.state).to_lowercase());
            }
        }

        // Check via LND
        match PaymentHash::from_hex(payment_hash) {
            Ok(hash) => {
                let state = self.check_invoice_status(&hash).await?;
                Ok(match state {
                    InvoiceState::Open => "open",
                    InvoiceState::Settled => "settled",
                    InvoiceState::Cancelled => "cancelled",
                    InvoiceState::Expired => "expired",
                }
                .to_string())
            }
            Err(_) => Err(CascadeError::invalid_input(
                "Invalid payment hash".to_string(),
            )),
        }
    }

    /// Settle an order by order ID
    pub async fn settle_by_order_id(
        &mut self,
        order_id: &str,
        preimage: &Preimage,
    ) -> Result<LightningOrder> {
        // Look up the order
        let order = self
            .orders
            .get_mut(order_id)
            .ok_or_else(|| CascadeError::invalid_input("Order not found".to_string()))?;

        // Check order state
        if order.state == OrderState::Fulfilled {
            return Err(CascadeError::invalid_input(
                "Order already fulfilled".to_string(),
            ));
        }
        if order.state == OrderState::Expired {
            return Err(CascadeError::invalid_input("Order has expired".to_string()));
        }
        if order.state == OrderState::Cancelled {
            return Err(CascadeError::invalid_input(
                "Order was cancelled".to_string(),
            ));
        }

        // Settle the escrow
        self.escrow_manager
            .settle_by_payment_hash(&order.payment_hash, preimage)?;

        // Update the order
        order.fulfill(preimage);

        Ok(order.clone())
    }

    /// Expire old orders and refund escrows
    pub fn process_expired(&mut self) -> Vec<EscrowAccount> {
        // Refund expired escrows
        let refunded = self.escrow_manager.refund_expired();

        // Clean up old settled/refunded escrows (keep last 24 hours)
        self.escrow_manager.cleanup(24);

        refunded
    }

    /// Get pending orders count
    pub fn pending_orders_count(&self) -> usize {
        self.escrow_manager.get_pending_escrows().len()
    }

    /// Get total held sats
    pub fn total_held_sats(&self) -> u64 {
        self.escrow_manager.total_held_sats()
    }

    /// Get escrow manager reference
    pub fn escrow_manager(&self) -> &EscrowManager {
        &self.escrow_manager
    }

    /// Get mutable escrow manager
    pub fn escrow_manager_mut(&mut self) -> &mut EscrowManager {
        &mut self.escrow_manager
    }
}

/// NIP-47 payment request format
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NIP47PaymentRequest {
    /// Amount in satoshis
    pub amount: u64,
    /// Payment request/invoice
    pub payment_request: String,
    /// Optional description
    pub description: Option<String>,
    /// Expiry timestamp
    pub expiry: Option<i64>,
}

impl NIP47PaymentRequest {
    /// Parse from JSON
    pub fn from_json(json: &str) -> Result<Self> {
        serde_json::from_str(json)
            .map_err(|e| CascadeError::invalid_input(format!("Invalid NIP-47 JSON: {}", e)))
    }

    /// Serialize to JSON
    pub fn to_json(&self) -> Result<String> {
        serde_json::to_string(self).map_err(|e| CascadeError::SerializationError(e.to_string()))
    }
}

/// NIP-47 response wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NIP47Response {
    /// Response type
    pub type_: String,
    /// Amount (for amount request)
    pub amount: Option<u64>,
    /// Payment request (for invoice response)
    pub invoice: Option<String>,
    /// Error message (for error response)
    pub error: Option<NIP47Error>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NIP47Error {
    pub code: String,
    pub message: String,
}

impl NIP47Response {
    /// Create success response with invoice
    pub fn success_invoice(invoice: String, amount: Option<u64>) -> Self {
        Self {
            type_: "invoice".to_string(),
            amount,
            invoice: Some(invoice),
            error: None,
        }
    }

    /// Create error response
    pub fn error(code: &str, message: &str) -> Self {
        Self {
            type_: "error".to_string(),
            amount: None,
            invoice: None,
            error: Some(NIP47Error {
                code: code.to_string(),
                message: message.to_string(),
            }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_nip47_payment_request() {
        let req = NIP47PaymentRequest {
            amount: 1000,
            payment_request: "lnbc10u1...".to_string(),
            description: Some("Test payment".to_string()),
            expiry: None,
        };

        let json = req.to_json().unwrap();
        let parsed = NIP47PaymentRequest::from_json(&json).unwrap();
        assert_eq!(parsed.amount, 1000);
    }

    #[test]
    fn test_nip47_response_success() {
        let resp = NIP47Response::success_invoice("lnbc10u1...".to_string(), Some(1000));
        assert_eq!(resp.type_, "invoice");
        assert!(resp.invoice.is_some());
        assert!(resp.error.is_none());
    }

    #[test]
    fn test_nip47_response_error() {
        let resp = NIP47Response::error("NOT_FOUND", "Invoice not found");
        assert_eq!(resp.type_, "error");
        assert!(resp.error.is_some());
        assert_eq!(resp.error.as_ref().unwrap().code, "NOT_FOUND");
    }

    #[test]
    fn test_lightning_order_is_payable() {
        let order = LightningOrder {
            id: "test".to_string(),
            market_slug: "test-market".to_string(),
            side: "LONG".to_string(),
            amount_sats: 1000,
            fee_sats: 10,
            total_sats: 1010,
            escrow_id: "escrow-1".to_string(),
            invoice: "lnbc10u1...".to_string(),
            payment_hash: "abc123".to_string(),
            state: OrderState::InvoicePending,
            created_at: Utc::now(),
            expires_at: Utc::now() + chrono::Duration::hours(1),
            fulfilled_at: None,
            preimage: None,
            nip47_request_id: None,
            user_pubkey: None,
        };

        assert!(order.is_payable());
        assert!(order.remaining_seconds() > 0);
    }
}
