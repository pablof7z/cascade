//! Escrow account system for holding sats pending Lightning payment
//!
//! This module manages the escrow state machine for trades:
//! - `pending` → Invoice created, awaiting payment
//! - `settled` → Payment received, funds released
//! - `refunded` → Invoice expired, funds returned
//! - `failed` → Payment failed or invalid

use crate::error::{CascadeError, Result};
use crate::lightning::types::{PaymentHash, Preimage};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Escrow state
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EscrowState {
    /// Awaiting lightning payment
    Pending,
    /// Payment received and verified
    Settled,
    /// Invoice expired, funds refunded
    Refunded,
    /// Payment failed or invalid
    Failed,
}

impl std::fmt::Display for EscrowState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EscrowState::Pending => write!(f, "pending"),
            EscrowState::Settled => write!(f, "settled"),
            EscrowState::Refunded => write!(f, "refunded"),
            EscrowState::Failed => write!(f, "failed"),
        }
    }
}

/// Escrow account holding funds pending lightning payment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EscrowAccount {
    /// Unique escrow ID
    pub id: String,
    /// Associated trade/order ID
    pub order_id: String,
    /// Market slug this escrow is for
    pub market_slug: String,
    /// Trading side (LONG/SHORT)
    pub side: String,
    /// Amount held in sats
    pub amount_sats: u64,
    /// Lightning payment hash
    pub payment_hash: String,
    /// BOLT 11 invoice
    pub invoice: String,
    /// Current state
    pub state: EscrowState,
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    /// Expiry timestamp
    pub expires_at: DateTime<Utc>,
    /// Settlement timestamp (if settled)
    pub settled_at: Option<DateTime<Utc>>,
    /// Refund timestamp (if refunded)
    pub refunded_at: Option<DateTime<Utc>>,
    /// Preimage (once revealed)
    pub preimage: Option<String>,
    /// Number of confirmation checks
    pub check_count: u32,
}

impl EscrowAccount {
    /// Create a new escrow account
    pub fn new(
        order_id: String,
        market_slug: String,
        side: String,
        amount_sats: u64,
        payment_hash: PaymentHash,
        invoice: String,
        expiry_seconds: i64,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            order_id,
            market_slug,
            side,
            amount_sats,
            payment_hash: payment_hash.to_hex(),
            invoice,
            state: EscrowState::Pending,
            created_at: now,
            expires_at: now + chrono::Duration::seconds(expiry_seconds),
            settled_at: None,
            refunded_at: None,
            preimage: None,
            check_count: 0,
        }
    }

    /// Check if escrow has expired
    pub fn is_expired(&self) -> bool {
        Utc::now() > self.expires_at && self.state == EscrowState::Pending
    }

    /// Check if escrow can be settled
    pub fn can_settle(&self) -> bool {
        self.state == EscrowState::Pending && !self.is_expired()
    }

    /// Settle the escrow with preimage verification
    pub fn settle(&mut self, preimage: &Preimage) -> Result<()> {
        // Check expiry - expired escrows cannot be settled, only refunded
        if self.is_expired() {
            return Err(CascadeError::invalid_input(
                "Escrow has expired, must be refunded".to_string()
            ));
        }

        if self.state != EscrowState::Pending {
            return Err(CascadeError::invalid_input(
                format!("Cannot settle escrow in state: {}", self.state)
            ));
        }

        // Verify preimage matches payment hash
        let computed_hash = preimage.payment_hash();
        if computed_hash.to_hex() != self.payment_hash {
            return Err(CascadeError::invalid_input("Invalid preimage".to_string()));
        }

        self.state = EscrowState::Settled;
        self.settled_at = Some(Utc::now());
        self.preimage = Some(preimage.to_hex());

        Ok(())
    }

    /// Refund the escrow after expiry
    pub fn refund(&mut self) -> Result<()> {
        if self.state != EscrowState::Pending {
            return Err(CascadeError::invalid_input(
                format!("Cannot refund escrow in state: {}", self.state)
            ));
        }

        if !self.is_expired() {
            return Err(CascadeError::invalid_input("Escrow not yet expired".to_string()));
        }

        self.state = EscrowState::Refunded;
        self.refunded_at = Some(Utc::now());

        Ok(())
    }

    /// Mark as failed
    pub fn fail(&mut self) -> Result<()> {
        if self.state == EscrowState::Settled {
            return Err(CascadeError::invalid_input("Cannot fail settled escrow".to_string()));
        }

        self.state = EscrowState::Failed;
        Ok(())
    }

    /// Increment check counter
    pub fn increment_check(&mut self) {
        self.check_count += 1;
    }

    /// Get remaining seconds until expiry
    pub fn remaining_seconds(&self) -> i64 {
        let now = Utc::now();
        if now >= self.expires_at {
            0
        } else {
            (self.expires_at - now).num_seconds()
        }
    }

    /// Get payment hash as typed value
    pub fn get_payment_hash(&self) -> Result<PaymentHash> {
        PaymentHash::from_hex(&self.payment_hash)
    }
}

/// Escrow manager for handling multiple escrow accounts
pub struct EscrowManager {
    /// Active escrow accounts
    escrows: std::collections::HashMap<String, EscrowAccount>,
    /// Default expiry in seconds
    default_expiry_seconds: i64,
}

impl EscrowManager {
    /// Create a new escrow manager
    pub fn new(default_expiry_seconds: i64) -> Self {
        Self {
            escrows: std::collections::HashMap::new(),
            default_expiry_seconds,
        }
    }

    /// Create a new escrow account
    pub fn create_escrow(
        &mut self,
        order_id: String,
        market_slug: String,
        side: String,
        amount_sats: u64,
        payment_hash: PaymentHash,
        invoice: String,
    ) -> EscrowAccount {
        let escrow = EscrowAccount::new(
            order_id,
            market_slug,
            side,
            amount_sats,
            payment_hash,
            invoice,
            self.default_expiry_seconds,
        );

        let id = escrow.id.clone();
        self.escrows.insert(id, escrow.clone());
        escrow
    }

    /// Get escrow by ID
    pub fn get_escrow(&self, escrow_id: &str) -> Option<&EscrowAccount> {
        self.escrows.get(escrow_id)
    }

    /// Get escrow by payment hash
    pub fn get_escrow_by_hash(&self, payment_hash: &str) -> Option<&EscrowAccount> {
        self.escrows.values().find(|e| e.payment_hash == payment_hash)
    }

    /// Get mutable escrow by ID
    pub fn get_escrow_mut(&mut self, escrow_id: &str) -> Option<&mut EscrowAccount> {
        self.escrows.get_mut(escrow_id)
    }

    /// Settle escrow with preimage
    pub fn settle_escrow(&mut self, escrow_id: &str, preimage: &Preimage) -> Result<()> {
        let escrow = self.escrows
            .get_mut(escrow_id)
            .ok_or_else(|| CascadeError::invalid_input("Escrow not found".to_string()))?;
        
        escrow.settle(preimage)
    }

    /// Settle escrow by payment hash
    pub fn settle_by_payment_hash(&mut self, payment_hash: &str, preimage: &Preimage) -> Result<EscrowAccount> {
        let escrow_id = self.escrows
            .iter()
            .find(|(_, e)| e.payment_hash == payment_hash)
            .map(|(id, _)| id.clone())
            .ok_or_else(|| CascadeError::invalid_input("Escrow not found".to_string()))?;

        {
            let escrow = self.escrows.get_mut(&escrow_id)
                .ok_or_else(|| CascadeError::invalid_input("Escrow not found".to_string()))?;
            escrow.settle(preimage)?;
        }

        Ok(self.escrows.get(&escrow_id).unwrap().clone())
    }

    /// Refund expired escrows
    pub fn refund_expired(&mut self) -> Vec<EscrowAccount> {
        let mut refunded = Vec::new();

        for escrow in self.escrows.values_mut() {
            if escrow.state == EscrowState::Pending && escrow.is_expired() {
                let _ = escrow.refund();
                refunded.push(escrow.clone());
            }
        }

        refunded
    }

    /// Get all pending escrows
    pub fn get_pending_escrows(&self) -> Vec<&EscrowAccount> {
        self.escrows
            .values()
            .filter(|e| e.state == EscrowState::Pending)
            .collect()
    }

    /// Get expired pending escrows
    pub fn get_expired_escrows(&self) -> Vec<&EscrowAccount> {
        self.escrows
            .values()
            .filter(|e| e.state == EscrowState::Pending && e.is_expired())
            .collect()
    }

    /// Clean up old settled/refunded escrows
    pub fn cleanup(&mut self, older_than_hours: i64) {
        let cutoff = Utc::now() - chrono::Duration::hours(older_than_hours);
        
        self.escrows.retain(|_, escrow| {
            match escrow.state {
                EscrowState::Settled => {
                    escrow.settled_at.map(|t| t > cutoff).unwrap_or(false)
                }
                EscrowState::Refunded => {
                    escrow.refunded_at.map(|t| t > cutoff).unwrap_or(false)
                }
                EscrowState::Failed => false, // Clean up failed immediately
                EscrowState::Pending => true, // Keep pending
            }
        });
    }

    /// Get total held sats in pending escrows
    pub fn total_held_sats(&self) -> u64 {
        self.escrows
            .values()
            .filter(|e| e.state == EscrowState::Pending)
            .map(|e| e.amount_sats)
            .sum()
    }

    /// Get escrow statistics
    pub fn get_stats(&self) -> EscrowStats {
        let mut stats = EscrowStats::default();
        
        for escrow in self.escrows.values() {
            match escrow.state {
                EscrowState::Pending => {
                    stats.pending_count += 1;
                    stats.pending_sats += escrow.amount_sats;
                    if escrow.is_expired() {
                        stats.expired_count += 1;
                    }
                }
                EscrowState::Settled => {
                    stats.settled_count += 1;
                    stats.settled_sats += escrow.amount_sats;
                }
                EscrowState::Refunded => {
                    stats.refunded_count += 1;
                    stats.refunded_sats += escrow.amount_sats;
                }
                EscrowState::Failed => {
                    stats.failed_count += 1;
                }
            }
        }
        
        stats
    }
}

/// Escrow statistics
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct EscrowStats {
    pub pending_count: u64,
    pub pending_sats: u64,
    pub settled_count: u64,
    pub settled_sats: u64,
    pub refunded_count: u64,
    pub refunded_sats: u64,
    pub failed_count: u64,
    pub expired_count: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_escrow_creation() {
        let preimage = Preimage::from_bytes([1u8; 32]);
        let payment_hash = preimage.payment_hash();
        
        let mut manager = EscrowManager::new(3600);
        let escrow = manager.create_escrow(
            "order-123".to_string(),
            "bitcoin-price-2024".to_string(),
            "LONG".to_string(),
            1000,
            payment_hash,
            "lnbc10u1...".to_string(),
        );

        assert_eq!(escrow.state, EscrowState::Pending);
        assert_eq!(escrow.amount_sats, 1000);
        assert!(!escrow.is_expired());
    }

    #[test]
    fn test_escrow_settle_with_valid_preimage() {
        let preimage = Preimage::from_bytes([42u8; 32]);
        let payment_hash = preimage.payment_hash();
        
        let mut manager = EscrowManager::new(3600);
        let escrow = manager.create_escrow(
            "order-123".to_string(),
            "bitcoin-price-2024".to_string(),
            "LONG".to_string(),
            1000,
            payment_hash,
            "lnbc10u1...".to_string(),
        );

        let escrow_id = escrow.id.clone();
        manager.settle_escrow(&escrow_id, &preimage).unwrap();

        let settled = manager.get_escrow(&escrow_id).unwrap();
        assert_eq!(settled.state, EscrowState::Settled);
        assert!(settled.preimage.is_some());
    }

    #[test]
    fn test_escrow_settle_with_wrong_preimage() {
        let correct = Preimage::from_bytes([42u8; 32]);
        let wrong = Preimage::from_bytes([99u8; 32]);
        let payment_hash = correct.payment_hash();
        
        let mut manager = EscrowManager::new(3600);
        let escrow = manager.create_escrow(
            "order-123".to_string(),
            "bitcoin-price-2024".to_string(),
            "LONG".to_string(),
            1000,
            payment_hash,
            "lnbc10u1...".to_string(),
        );

        let result = manager.settle_escrow(&escrow.id, &wrong);
        assert!(result.is_err());
    }

    #[test]
    fn test_escrow_by_payment_hash() {
        let preimage = Preimage::from_bytes([1u8; 32]);
        let payment_hash = preimage.payment_hash();
        let hash_hex = payment_hash.to_hex();
        
        let mut manager = EscrowManager::new(3600);
        manager.create_escrow(
            "order-123".to_string(),
            "market".to_string(),
            "SHORT".to_string(),
            500,
            payment_hash,
            "lnbc5u1...".to_string(),
        );

        let escrow = manager.get_escrow_by_hash(&hash_hex).unwrap();
        assert_eq!(escrow.order_id, "order-123");
    }

    #[test]
    fn test_escrow_stats() {
        let preimage = Preimage::from_bytes([1u8; 32]);
        let payment_hash = preimage.payment_hash();
        
        let mut manager = EscrowManager::new(3600);
        manager.create_escrow(
            "order-1".to_string(),
            "market1".to_string(),
            "LONG".to_string(),
            1000,
            payment_hash.clone(),
            "lnbc10u1...".to_string(),
        );
        manager.create_escrow(
            "order-2".to_string(),
            "market2".to_string(),
            "SHORT".to_string(),
            500,
            payment_hash.clone(),
            "lnbc5u1...".to_string(),
        );

        let stats = manager.get_stats();
        assert_eq!(stats.pending_count, 2);
        assert_eq!(stats.pending_sats, 1500);
    }
}
