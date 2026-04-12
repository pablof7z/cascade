//! Lightning types and data structures

use serde::{Deserialize, Serialize};

/// Lightning invoice state
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum InvoiceState {
    /// Invoice is open and awaiting payment
    Open,
    /// Invoice has been settled (payment received)
    Settled,
    /// Invoice has been cancelled
    Cancelled,
    /// Invoice expired
    Expired,
}

/// Payment status for HTLC tracking
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PaymentStatus {
    /// Payment is pending (HTLC in flight)
    Pending,
    /// Payment settled successfully
    Settled,
    /// Payment failed or timed out
    Failed,
    /// Payment refunded
    Refunded,
}

/// Preimage for payment proof (32 bytes)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Preimage {
    /// Raw 32-byte preimage
    pub bytes: [u8; 32],
}

impl Preimage {
    /// Create preimage from 32-byte array
    pub fn from_bytes(bytes: [u8; 32]) -> Self {
        Self { bytes }
    }

    /// Create preimage from hex string
    pub fn from_hex(hex: &str) -> Result<Self, crate::error::CascadeError> {
        let bytes = hex::decode(hex).map_err(|e| {
            crate::error::CascadeError::invalid_input(format!("Invalid hex: {}", e))
        })?;
        if bytes.len() != 32 {
            return Err(crate::error::CascadeError::invalid_input(
                "Preimage must be 32 bytes".to_string(),
            ));
        }
        let mut arr = [0u8; 32];
        arr.copy_from_slice(&bytes);
        Ok(Self { bytes: arr })
    }

    /// Get preimage as hex string
    pub fn to_hex(&self) -> String {
        hex::encode(self.bytes)
    }

    /// Compute payment hash from preimage (SHA256)
    pub fn payment_hash(&self) -> PaymentHash {
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(self.bytes);
        let result = hasher.finalize();
        PaymentHash::from_bytes(result.into())
    }
}

impl std::fmt::Display for Preimage {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.to_hex())
    }
}

/// Payment hash (32 bytes, SHA256 of preimage)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PaymentHash {
    /// Raw 32-byte payment hash
    pub bytes: [u8; 32],
}

impl PaymentHash {
    /// Create payment hash from 32-byte array
    pub fn from_bytes(bytes: [u8; 32]) -> Self {
        Self { bytes }
    }

    /// Create payment hash from hex string
    pub fn from_hex(hex: &str) -> Result<Self, crate::error::CascadeError> {
        let bytes = hex::decode(hex).map_err(|e| {
            crate::error::CascadeError::invalid_input(format!("Invalid hex: {}", e))
        })?;
        if bytes.len() != 32 {
            return Err(crate::error::CascadeError::invalid_input(
                "Payment hash must be 32 bytes".to_string(),
            ));
        }
        let mut arr = [0u8; 32];
        arr.copy_from_slice(&bytes);
        Ok(Self { bytes: arr })
    }

    /// Get payment hash as hex string
    pub fn to_hex(&self) -> String {
        hex::encode(self.bytes)
    }
}

impl std::fmt::Display for PaymentHash {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.to_hex())
    }
}

/// Lightning invoice representation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LightningInvoice {
    /// LND payment request (BOLT 11 encoded)
    pub payment_request: String,
    /// Payment hash (r_hash)
    pub payment_hash: PaymentHash,
    /// Amount in millisatoshis
    pub amount_msat: u64,
    /// Invoice creation timestamp
    pub created_at: i64,
    /// Invoice expiry time (in seconds)
    pub expiry_seconds: u64,
    /// Optional CLTV expiry for HTLC
    pub cltv_expiry: Option<u64>,
    /// Optional description/memo
    pub description: Option<String>,
    /// Invoice state
    pub state: InvoiceState,
}

impl LightningInvoice {
    /// Check if invoice is payable (open state)
    pub fn is_payable(&self) -> bool {
        self.state == InvoiceState::Open
    }

    /// Get the BOLT 11 invoice string
    pub fn bolt11(&self) -> &str {
        &self.payment_request
    }

    /// Get amount in sats
    pub fn amount_sats(&self) -> u64 {
        self.amount_msat / 1000
    }
}

/// HTLC (Hash-Time-Locked Contract) information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HtlcInfo {
    /// Payment hash
    pub payment_hash: PaymentHash,
    /// Amount in millisatoshis
    pub amount_msat: u64,
    /// CLTV expiry height
    pub cltv_expiry: u64,
    /// HTLC state
    pub status: PaymentStatus,
    /// Forwarding time (if forwarded)
    pub forwarded_at: Option<i64>,
    /// Settlement time (if settled)
    pub settled_at: Option<i64>,
    /// Expiry time
    pub expiry_time: Option<i64>,
}

#[cfg(test)]
mod tests {
    use super::*;

    // ============================================================================
    // Preimage Tests
    // ============================================================================

    #[test]
    fn test_preimage_hex_roundtrip() {
        let preimage = Preimage::from_bytes([0u8; 32]);
        let hex = preimage.to_hex();
        let recovered = Preimage::from_hex(&hex).unwrap();
        assert_eq!(preimage.bytes, recovered.bytes);
    }

    #[test]
    fn test_preimage_from_hex_valid() {
        let hex = "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20";
        let preimage = Preimage::from_hex(hex).unwrap();
        assert_eq!(preimage.to_hex(), hex);
    }

    #[test]
    fn test_preimage_from_hex_invalid_length() {
        let hex = "0102030405060708090a0b0c0d0e0f10"; // Only 16 bytes
        let result = Preimage::from_hex(hex);
        assert!(result.is_err());
    }

    #[test]
    fn test_preimage_from_hex_invalid_characters() {
        let hex = "zzzz0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"; // Invalid hex chars
        let result = Preimage::from_hex(hex);
        assert!(result.is_err());
    }

    #[test]
    fn test_preimage_payment_hash_derivation() {
        let preimage = Preimage::from_bytes([42u8; 32]);
        let hash = preimage.payment_hash();

        // Verify the hash is deterministic
        let hash2 = preimage.payment_hash();
        assert_eq!(hash, hash2);
    }

    #[test]
    fn test_preimage_display() {
        let preimage = Preimage::from_bytes([0xAB; 32]);
        let display = format!("{}", preimage);
        assert_eq!(display.len(), 64); // 32 bytes = 64 hex chars
        assert!(display.starts_with("ab"));
    }

    #[test]
    fn test_preimage_different_inputs_produce_different_hashes() {
        let preimage1 = Preimage::from_bytes([1u8; 32]);
        let preimage2 = Preimage::from_bytes([2u8; 32]);

        let hash1 = preimage1.payment_hash();
        let hash2 = preimage2.payment_hash();

        assert_ne!(hash1, hash2);
    }

    // ============================================================================
    // PaymentHash Tests
    // ============================================================================

    #[test]
    fn test_payment_hash_from_hex_valid() {
        let hex = "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20";
        let hash = PaymentHash::from_hex(hex).unwrap();
        assert_eq!(hash.to_hex(), hex);
    }

    #[test]
    fn test_payment_hash_from_hex_invalid_length() {
        let hex = "0102030405060708090a0b0c0d0e0f10"; // Only 16 bytes
        let result = PaymentHash::from_hex(hex);
        assert!(result.is_err());
    }

    #[test]
    fn test_payment_hash_from_hex_invalid_characters() {
        let hex = "xyzq0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"; // Invalid hex
        let result = PaymentHash::from_hex(hex);
        assert!(result.is_err());
    }

    #[test]
    fn test_payment_hash_display() {
        let hash = PaymentHash::from_bytes([0xCD; 32]);
        let display = format!("{}", hash);
        assert_eq!(display.len(), 64);
        assert!(display.starts_with("cd"));
    }

    #[test]
    fn test_payment_hash_equality() {
        let hash1 = PaymentHash::from_bytes([0xAB; 32]);
        let hash2 = PaymentHash::from_bytes([0xAB; 32]);
        let hash3 = PaymentHash::from_bytes([0xCD; 32]);

        assert_eq!(hash1, hash2);
        assert_ne!(hash1, hash3);
    }

    #[test]
    fn test_payment_hash_roundtrip() {
        let original = PaymentHash::from_bytes([
            0x12, 0x34, 0x56, 0x78, 0x9A, 0xBC, 0xDE, 0xF0, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66,
            0x77, 0x88, 0x99, 0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF, 0x00, 0x01, 0x02, 0x03, 0x04,
            0x05, 0x06, 0x07, 0x08,
        ]);
        let hex = original.to_hex();
        let recovered = PaymentHash::from_hex(&hex).unwrap();
        assert_eq!(original, recovered);
    }

    // ============================================================================
    // LightningInvoice Tests
    // ============================================================================

    #[test]
    fn test_lightning_invoice_is_payable() {
        let invoice = LightningInvoice {
            payment_request: "lnbc100...".to_string(),
            payment_hash: PaymentHash::from_bytes([0u8; 32]),
            amount_msat: 100_000,
            created_at: 0,
            expiry_seconds: 3600,
            cltv_expiry: Some(144),
            description: Some("Test invoice".to_string()),
            state: InvoiceState::Open,
        };
        assert!(invoice.is_payable());
    }

    #[test]
    fn test_lightning_invoice_not_payable_when_settled() {
        let invoice = LightningInvoice {
            payment_request: "lnbc100...".to_string(),
            payment_hash: PaymentHash::from_bytes([0u8; 32]),
            amount_msat: 100_000,
            created_at: 0,
            expiry_seconds: 3600,
            cltv_expiry: None,
            description: None,
            state: InvoiceState::Settled,
        };
        assert!(!invoice.is_payable());
    }

    #[test]
    fn test_lightning_invoice_not_payable_when_expired() {
        let invoice = LightningInvoice {
            payment_request: "lnbc100...".to_string(),
            payment_hash: PaymentHash::from_bytes([0u8; 32]),
            amount_msat: 100_000,
            created_at: 0,
            expiry_seconds: 3600,
            cltv_expiry: None,
            description: None,
            state: InvoiceState::Expired,
        };
        assert!(!invoice.is_payable());
    }

    #[test]
    fn test_lightning_invoice_not_payable_when_cancelled() {
        let invoice = LightningInvoice {
            payment_request: "lnbc100...".to_string(),
            payment_hash: PaymentHash::from_bytes([0u8; 32]),
            amount_msat: 100_000,
            created_at: 0,
            expiry_seconds: 3600,
            cltv_expiry: None,
            description: None,
            state: InvoiceState::Cancelled,
        };
        assert!(!invoice.is_payable());
    }

    #[test]
    fn test_lightning_invoice_amount_sats() {
        let invoice = LightningInvoice {
            payment_request: "lnbc100...".to_string(),
            payment_hash: PaymentHash::from_bytes([0u8; 32]),
            amount_msat: 100_500, // 100.5 sats
            created_at: 0,
            expiry_seconds: 3600,
            cltv_expiry: None,
            description: None,
            state: InvoiceState::Open,
        };
        assert_eq!(invoice.amount_sats(), 100); // Floor division
    }

    #[test]
    fn test_lightning_invoice_bolt11() {
        let invoice = LightningInvoice {
            payment_request: "lnbc1pvlluezsp5w0".to_string(),
            payment_hash: PaymentHash::from_bytes([0u8; 32]),
            amount_msat: 100_000,
            created_at: 0,
            expiry_seconds: 3600,
            cltv_expiry: None,
            description: None,
            state: InvoiceState::Open,
        };
        assert_eq!(invoice.bolt11(), "lnbc1pvlluezsp5w0");
    }

    #[test]
    fn test_lightning_invoice_serde_roundtrip() {
        let invoice = LightningInvoice {
            payment_request: "lnbc100...".to_string(),
            payment_hash: PaymentHash::from_bytes([0xAB; 32]),
            amount_msat: 100_000,
            created_at: 1234567890,
            expiry_seconds: 3600,
            cltv_expiry: Some(144),
            description: Some("Test".to_string()),
            state: InvoiceState::Open,
        };

        let json = serde_json::to_string(&invoice).unwrap();
        let recovered: LightningInvoice = serde_json::from_str(&json).unwrap();

        assert_eq!(invoice.payment_request, recovered.payment_request);
        assert_eq!(invoice.payment_hash, recovered.payment_hash);
        assert_eq!(invoice.amount_msat, recovered.amount_msat);
        assert_eq!(invoice.state, recovered.state);
    }

    // ============================================================================
    // InvoiceState Tests
    // ============================================================================

    #[test]
    fn test_invoice_state_serde() {
        let states = vec![
            InvoiceState::Open,
            InvoiceState::Settled,
            InvoiceState::Cancelled,
            InvoiceState::Expired,
        ];

        for state in states {
            let json = serde_json::to_string(&state).unwrap();
            let recovered: InvoiceState = serde_json::from_str(&json).unwrap();
            assert_eq!(state, recovered);
        }
    }

    // ============================================================================
    // PaymentStatus Tests
    // ============================================================================

    #[test]
    fn test_payment_status_serde() {
        let statuses = vec![
            PaymentStatus::Pending,
            PaymentStatus::Settled,
            PaymentStatus::Failed,
            PaymentStatus::Refunded,
        ];

        for status in statuses {
            let json = serde_json::to_string(&status).unwrap();
            let recovered: PaymentStatus = serde_json::from_str(&json).unwrap();
            assert_eq!(status, recovered);
        }
    }

    // ============================================================================
    // HtlcInfo Tests
    // ============================================================================

    #[test]
    fn test_htlc_info_creation() {
        let htlc = HtlcInfo {
            payment_hash: PaymentHash::from_bytes([0xAB; 32]),
            amount_msat: 50_000,
            cltv_expiry: 144,
            status: PaymentStatus::Pending,
            forwarded_at: None,
            settled_at: None,
            expiry_time: Some(1234567890),
        };

        assert_eq!(htlc.amount_msat, 50_000);
        assert_eq!(htlc.status, PaymentStatus::Pending);
        assert!(htlc.forwarded_at.is_none());
    }

    #[test]
    fn test_htlc_info_settled() {
        let htlc = HtlcInfo {
            payment_hash: PaymentHash::from_bytes([0xCD; 32]),
            amount_msat: 75_000,
            cltv_expiry: 200,
            status: PaymentStatus::Settled,
            forwarded_at: Some(1234567800),
            settled_at: Some(1234567890),
            expiry_time: None,
        };

        assert_eq!(htlc.status, PaymentStatus::Settled);
        assert!(htlc.forwarded_at.is_some());
        assert!(htlc.settled_at.is_some());
    }
}
