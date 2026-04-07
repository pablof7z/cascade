//! HTLC (Hash-Time-Locked Contract) handler for NUT-05
//!
//! Implements Hash-Time-Locked Contracts per Cashu NUT-05 specification
//! for lightning payment integration.

use crate::error::{CascadeError, Result};
use super::types::{PaymentHash, PaymentStatus, Preimage, HtlcInfo};

/// HTLC condition types per NUT-05
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HtlcCondition {
    /// Hash lock (payment hash)
    HashLock(PaymentHash),
    /// Time lock (CLTV expiry)
    TimeLock(u64),
    /// Combined hash and time lock
    HashTimeLock {
        hash: PaymentHash,
        cltv_expiry: u64,
    },
}

/// HTLC witness/proof for claiming
#[derive(Debug, Clone)]
pub struct HtlcWitness {
    /// The preimage that unlocks the hash lock
    pub preimage: Preimage,
    /// Optional signature (for P2PK conditions)
    pub signature: Option<Vec<u8>>,
}

impl HtlcWitness {
    /// Create a new witness from preimage
    pub fn new(preimage: Preimage) -> Self {
        Self {
            preimage,
            signature: None,
        }
    }

    /// Verify the witness against a condition
    pub fn verify(&self, condition: &HtlcCondition) -> bool {
        match condition {
            HtlcCondition::HashLock(expected_hash) => {
                let actual_hash = self.preimage.payment_hash();
                actual_hash.bytes == expected_hash.bytes
            }
            HtlcCondition::TimeLock(_) => {
                // Time lock is satisfied by HTLC expiry, witness not needed for hash
                true
            }
            HtlcCondition::HashTimeLock { hash, .. } => {
                let actual_hash = self.preimage.payment_hash();
                actual_hash.bytes == hash.bytes
            }
        }
    }
}

/// HTLC state machine
#[derive(Debug, Clone)]
pub struct HtlcState {
    /// Current state
    pub status: PaymentStatus,
    /// HTLC condition
    pub condition: HtlcCondition,
    /// Amount in msats
    pub amount_msat: u64,
    /// Creation timestamp
    pub created_at: i64,
    /// Expiry timestamp
    pub expiry_time: i64,
    /// Settled timestamp (if settled)
    pub settled_at: Option<i64>,
    /// Refunded timestamp (if refunded)
    pub refunded_at: Option<i64>,
}

impl HtlcState {
    /// Create a new HTLC with hash lock
    pub fn new_hash_lock(
        payment_hash: PaymentHash,
        amount_msat: u64,
        expiry_seconds: u64,
    ) -> Self {
        let now = chrono::Utc::now().timestamp();
        Self {
            status: PaymentStatus::Pending,
            condition: HtlcCondition::HashLock(payment_hash),
            amount_msat,
            created_at: now,
            expiry_time: now + expiry_seconds as i64,
            settled_at: None,
            refunded_at: None,
        }
    }

    /// Create a new HTLC with hash-time lock (NUT-05 standard)
    pub fn new_hash_time_lock(
        payment_hash: PaymentHash,
        amount_msat: u64,
        cltv_expiry: u64,
        expiry_seconds: u64,
    ) -> Self {
        let now = chrono::Utc::now().timestamp();
        Self {
            status: PaymentStatus::Pending,
            condition: HtlcCondition::HashTimeLock {
                hash: payment_hash,
                cltv_expiry,
            },
            amount_msat,
            created_at: now,
            expiry_time: now + expiry_seconds as i64,
            settled_at: None,
            refunded_at: None,
        }
    }

    /// Check if HTLC has expired
    pub fn is_expired(&self) -> bool {
        chrono::Utc::now().timestamp() > self.expiry_time
    }

    /// Claim HTLC with preimage witness
    pub fn claim(&mut self, witness: &HtlcWitness) -> Result<()> {
        // Check if already settled or refunded
        if self.status == PaymentStatus::Settled {
            return Err(CascadeError::invalid_input("HTLC already settled".to_string()));
        }
        if self.status == PaymentStatus::Refunded {
            return Err(CascadeError::invalid_input("HTLC already refunded".to_string()));
        }

        // Check if HTLC has expired - expired HTLCs cannot be claimed, only refunded
        if self.is_expired() {
            return Err(CascadeError::invalid_input("HTLC has expired, must be refunded".to_string()));
        }

        // Verify witness satisfies condition
        if !witness.verify(&self.condition) {
            return Err(CascadeError::invalid_input("Invalid HTLC witness".to_string()));
        }

        // Mark as settled
        self.status = PaymentStatus::Settled;
        self.settled_at = Some(chrono::Utc::now().timestamp());

        Ok(())
    }

    /// Refund HTLC after expiry
    pub fn refund(&mut self) -> Result<()> {
        // Check if already settled
        if self.status == PaymentStatus::Settled {
            return Err(CascadeError::invalid_input("Cannot refund settled HTLC".to_string()));
        }

        // Check if expired
        if !self.is_expired() {
            return Err(CascadeError::invalid_input("HTLC not yet expired".to_string()));
        }

        // Mark as refunded
        self.status = PaymentStatus::Refunded;
        self.refunded_at = Some(chrono::Utc::now().timestamp());

        Ok(())
    }

    /// Fail HTLC (before expiry)
    pub fn fail(&mut self) -> Result<()> {
        if self.status == PaymentStatus::Settled {
            return Err(CascadeError::invalid_input("Cannot fail settled HTLC".to_string()));
        }

        self.status = PaymentStatus::Failed;
        Ok(())
    }

    /// Get remaining time until expiry (in seconds)
    pub fn remaining_seconds(&self) -> i64 {
        let now = chrono::Utc::now().timestamp();
        (self.expiry_time - now).max(0)
    }

    /// Convert to HtlcInfo for serialization
    pub fn to_info(&self, payment_hash: PaymentHash) -> HtlcInfo {
        HtlcInfo {
            payment_hash,
            amount_msat: self.amount_msat,
            cltv_expiry: match &self.condition {
                HtlcCondition::HashTimeLock { cltv_expiry, .. } => *cltv_expiry,
                HtlcCondition::TimeLock(expiry) => *expiry,
                HtlcCondition::HashLock(_) => 0,
            },
            status: self.status,
            forwarded_at: None,
            settled_at: self.settled_at,
            expiry_time: Some(self.expiry_time),
        }
    }
}

/// HTLC handler for managing multiple HTLCs
pub struct HtlcHandler {
    /// Active HTLCs indexed by payment hash
    htlcs: std::collections::HashMap<String, HtlcState>,
    /// Default expiry in seconds
    default_expiry: u64,
}

impl HtlcHandler {
    /// Create a new HTLC handler
    pub fn new(default_expiry_seconds: u64) -> Self {
        Self {
            htlcs: std::collections::HashMap::new(),
            default_expiry: default_expiry_seconds,
        }
    }

    /// Create a new HTLC for a payment
    pub fn create_htlc(
        &mut self,
        payment_hash: PaymentHash,
        amount_msat: u64,
        cltv_expiry: Option<u64>,
    ) -> HtlcState {
        let state = match cltv_expiry {
            Some(expiry) => HtlcState::new_hash_time_lock(
                payment_hash.clone(),
                amount_msat,
                expiry,
                self.default_expiry,
            ),
            None => HtlcState::new_hash_lock(
                payment_hash.clone(),
                amount_msat,
                self.default_expiry,
            ),
        };

        let hash_hex = payment_hash.to_hex();
        self.htlcs.insert(hash_hex, state.clone());
        state
    }

    /// Get HTLC by payment hash
    pub fn get_htlc(&self, payment_hash: &PaymentHash) -> Option<&HtlcState> {
        let hash_hex = payment_hash.to_hex();
        self.htlcs.get(&hash_hex)
    }

    /// Get mutable HTLC by payment hash
    pub fn get_htlc_mut(&mut self, payment_hash: &PaymentHash) -> Option<&mut HtlcState> {
        let hash_hex = payment_hash.to_hex();
        self.htlcs.get_mut(&hash_hex)
    }

    /// Claim HTLC with preimage
    pub fn claim_htlc(&mut self, preimage: &Preimage) -> Result<HtlcInfo> {
        let payment_hash = preimage.payment_hash();
        let hash_hex = payment_hash.to_hex();

        let state = self.htlcs
            .get_mut(&hash_hex)
            .ok_or_else(|| CascadeError::invalid_input("HTLC not found".to_string()))?;

        let witness = HtlcWitness::new(preimage.clone());
        state.claim(&witness)?;

        Ok(state.to_info(payment_hash))
    }

    /// Check and expire old HTLCs, return expired ones
    pub fn check_expired(&mut self) -> Vec<HtlcInfo> {
        let now = chrono::Utc::now().timestamp();
        let mut expired = Vec::new();

        for (hash_hex, state) in &mut self.htlcs {
            if state.status == PaymentStatus::Pending && state.expiry_time <= now {
                let _ = state.refund();
                if let Ok(hash) = PaymentHash::from_hex(hash_hex) {
                    expired.push(state.to_info(hash));
                }
            }
        }

        expired
    }

    /// Get all pending HTLCs
    pub fn get_pending_htlcs(&self) -> Vec<(PaymentHash, &HtlcState)> {
        self.htlcs
            .iter()
            .filter_map(|(hex, state)| {
                if state.status == PaymentStatus::Pending {
                    PaymentHash::from_hex(hex).ok().map(|hash| (hash, state))
                } else {
                    None
                }
            })
            .collect()
    }

    /// Remove settled/refunded HTLCs older than given timestamp
    pub fn cleanup(&mut self, older_than: i64) {
        self.htlcs.retain(|_, state| {
            match state.status {
                PaymentStatus::Settled => {
                    state.settled_at.map(|t| t > older_than).unwrap_or(true)
                }
                PaymentStatus::Refunded => {
                    state.refunded_at.map(|t| t > older_than).unwrap_or(true)
                }
                _ => true,
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_htlc_claim_with_valid_preimage() {
        let mut handler = HtlcHandler::new(3600);
        let preimage = Preimage::from_bytes([42u8; 32]);
        let payment_hash = preimage.payment_hash();

        let state = handler.create_htlc(payment_hash.clone(), 100000, None);
        assert_eq!(state.status, PaymentStatus::Pending);

        let info = handler.claim_htlc(&preimage).unwrap();
        assert_eq!(info.status, PaymentStatus::Settled);
    }

    #[test]
    fn test_htlc_claim_with_wrong_preimage() {
        let mut handler = HtlcHandler::new(3600);
        let correct_preimage = Preimage::from_bytes([42u8; 32]);
        let wrong_preimage = Preimage::from_bytes([99u8; 32]);
        let payment_hash = correct_preimage.payment_hash();

        handler.create_htlc(payment_hash.clone(), 100000, None);

        let result = handler.claim_htlc(&wrong_preimage);
        assert!(result.is_err());
    }

    #[test]
    fn test_htlc_hash_time_lock() {
        let mut handler = HtlcHandler::new(3600);
        let preimage = Preimage::from_bytes([1u8; 32]);
        let payment_hash = preimage.payment_hash();

        let state = handler.create_htlc(payment_hash.clone(), 50000, Some(100));
        assert_eq!(state.status, PaymentStatus::Pending);

        let witness = HtlcWitness::new(preimage);
        assert!(witness.verify(&state.condition));
    }
}
