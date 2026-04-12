//! LND client for Lightning Network operations
//!
//! Provides integration with the Lightning Network Daemon (LND) for invoice creation,
//! payment monitoring, and preimage verification.
//!
//! Note: This is a placeholder implementation. Full LND integration requires
//! tonic-prost bindings for gRPC communication (NIP-47). The module provides
//! the interface and types, with actual gRPC connectivity to be implemented.

use crate::error::{CascadeError, Result};
use crate::lightning::types::{InvoiceState, LightningInvoice, PaymentHash, Preimage};
use std::sync::Arc;
use tokio::sync::RwLock;

/// LND connection configuration
#[derive(Debug, Clone)]
pub struct LndConfig {
    /// LND host address (e.g., "localhost:10009")
    pub host: String,
    /// TLS certificate path
    pub cert_path: Option<String>,
    /// Macaroon path for authentication
    pub macaroon_path: Option<String>,
    /// TLS domain name
    pub tls_domain: Option<String>,
}

impl Default for LndConfig {
    fn default() -> Self {
        Self {
            host: "localhost:10009".to_string(),
            cert_path: None,
            macaroon_path: None,
            tls_domain: None,
        }
    }
}

/// LND client wrapper
///
/// This is a placeholder that provides the interface for LND operations.
/// Full gRPC implementation using tonic/prost is pending.
#[derive(Debug, Clone)]
pub struct LndClient {
    /// Configuration
    config: LndConfig,
    /// Whether connected
    connected: bool,
    /// Macaroon for authentication (hex-encoded)
    macaroon: Option<String>,
}

impl LndClient {
    /// Create a new LND client from config
    pub fn new(config: LndConfig) -> Self {
        Self {
            config,
            connected: false,
            macaroon: None,
        }
    }

    /// Connect to LND and establish gRPC channel
    ///
    /// Note: Full implementation requires tonic + prost for LND gRPC API.
    /// This is a placeholder that sets the connected flag.
    pub async fn connect(&mut self) -> Result<()> {
        // TODO: Implement full gRPC connection with tonic
        // Example with tonic (requires tonic + prost dependencies):
        // let channel = tonic::transport::Channel::from_static(&self.config.host)
        //     .tls_config(...)
        //     .connect()
        //     .await?;

        // Load macaroon
        if let Some(path) = &self.config.macaroon_path {
            let macaroon = tokio::fs::read(path).await.map_err(|e| {
                CascadeError::PaymentError(format!("Failed to read macaroon: {}", e))
            })?;
            self.macaroon = Some(hex::encode(&macaroon));
        }

        self.connected = true;
        Ok(())
    }

    /// Check if client is connected
    pub fn is_connected(&self) -> bool {
        self.connected
    }

    /// Get invoice state from LND
    ///
    /// TODO: Implement with LND routerrpc::LookupInvoiceV2
    pub async fn get_invoice(
        &self,
        _payment_hash: &PaymentHash,
    ) -> Result<Option<LightningInvoice>> {
        if !self.connected {
            return Err(CascadeError::PaymentError(
                "Not connected to LND".to_string(),
            ));
        }
        // TODO: Call LND via gRPC
        Err(CascadeError::PaymentError(
            "LND invoice lookup not implemented - requires tonic gRPC".to_string(),
        ))
    }

    /// Add an invoice to LND
    ///
    /// TODO: Implement with LND lnrpc::AddInvoiceV2
    pub async fn add_invoice(
        &self,
        amount_msat: u64,
        description: Option<String>,
        expiry_seconds: Option<u64>,
        cltv_expiry: Option<u64>,
    ) -> Result<LightningInvoice> {
        if !self.connected {
            return Err(CascadeError::PaymentError(
                "Not connected to LND".to_string(),
            ));
        }

        // Generate a payment hash for the mock invoice
        let mut hash_bytes = [0u8; 32];
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(chrono::Utc::now().timestamp().to_le_bytes());
        let result = hasher.finalize();
        hash_bytes.copy_from_slice(&result);
        let payment_hash = PaymentHash::from_bytes(hash_bytes);

        Ok(LightningInvoice {
            payment_request: format!("lnbc{}1p...", amount_msat / 1000), // Mock BOLT11
            payment_hash,
            amount_msat,
            created_at: chrono::Utc::now().timestamp(),
            expiry_seconds: expiry_seconds.unwrap_or(3600),
            cltv_expiry,
            description,
            state: InvoiceState::Open,
        })
    }

    /// Verify a payment preimage against payment hash
    pub async fn verify_preimage(
        &self,
        preimage: &Preimage,
        payment_hash: &PaymentHash,
    ) -> Result<bool> {
        // Verify preimage matches hash (sync operation)
        let computed_hash = preimage.payment_hash();
        Ok(computed_hash.bytes == payment_hash.bytes)
    }

    /// Wait for invoice to be settled
    ///
    /// TODO: Implement with LND invoice subscription
    pub async fn wait_for_settlement(
        &self,
        payment_hash: &PaymentHash,
        timeout_seconds: u64,
    ) -> Result<LightningInvoice> {
        let start = chrono::Utc::now().timestamp();
        let deadline = start + timeout_seconds as i64;

        while chrono::Utc::now().timestamp() < deadline {
            if let Some(invoice) = self.get_invoice(payment_hash).await? {
                if invoice.state == InvoiceState::Settled {
                    return Ok(invoice);
                }
            }
            tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
        }

        Err(CascadeError::PaymentError(
            "Invoice settlement timeout".to_string(),
        ))
    }

    /// Decode a BOLT 11 invoice
    ///
    /// TODO: Implement invoice decoding
    pub async fn decode_invoice(&self, _invoice: &str) -> Result<LightningInvoice> {
        if !self.connected {
            return Err(CascadeError::PaymentError(
                "Not connected to LND".to_string(),
            ));
        }
        Err(CascadeError::PaymentError(
            "Invoice decoding not implemented".to_string(),
        ))
    }

    /// Get the LND node info
    ///
    /// TODO: Implement with LND lnrpc::GetInfo
    pub async fn get_info(&self) -> Result<LndNodeInfo> {
        if !self.connected {
            return Err(CascadeError::PaymentError(
                "Not connected to LND".to_string(),
            ));
        }
        Err(CascadeError::PaymentError(
            "LND get_info not implemented - requires tonic gRPC".to_string(),
        ))
    }
}

/// LND node information
#[derive(Debug, Clone)]
pub struct LndNodeInfo {
    /// Node's pubkey
    pub pubkey: String,
    /// Node's alias
    pub alias: String,
    /// Number of active channels
    pub num_active_channels: u32,
    /// Number of peers
    pub num_peers: u32,
    /// Block height
    pub block_height: u32,
}

/// Shared LND client for use across the application
pub type SharedLndClient = Arc<RwLock<LndClient>>;

/// Create a shared LND client
pub fn create_shared_client(config: LndConfig) -> SharedLndClient {
    Arc::new(RwLock::new(LndClient::new(config)))
}

#[cfg(test)]
mod tests {
    use super::*;

    // ============================================================================
    // LndConfig Tests
    // ============================================================================

    #[test]
    fn test_lnd_config_default() {
        let config = LndConfig::default();
        assert_eq!(config.host, "localhost:10009");
        assert!(config.cert_path.is_none());
        assert!(config.macaroon_path.is_none());
        assert!(config.tls_domain.is_none());
    }

    #[test]
    fn test_lnd_config_with_tls() {
        let config = LndConfig {
            host: "lnd.example.com:10009".to_string(),
            cert_path: Some("/path/to/tls.cert".to_string()),
            macaroon_path: None,
            tls_domain: Some("lnd.example.com".to_string()),
        };
        assert_eq!(config.host, "lnd.example.com:10009");
        assert!(config.cert_path.is_some());
        assert!(config.tls_domain.is_some());
    }

    #[test]
    fn test_lnd_config_with_macaroon() {
        let config = LndConfig {
            host: "localhost:10009".to_string(),
            cert_path: None,
            macaroon_path: Some("/path/to/admin.macaroon".to_string()),
            tls_domain: None,
        };
        assert!(config.macaroon_path.is_some());
        assert_eq!(
            config.macaroon_path.as_ref().unwrap(),
            "/path/to/admin.macaroon"
        );
    }

    #[test]
    fn test_lnd_config_clone() {
        let config = LndConfig {
            host: "test:10009".to_string(),
            cert_path: Some("cert".to_string()),
            macaroon_path: Some("mac".to_string()),
            tls_domain: Some("domain".to_string()),
        };
        let cloned = config.clone();
        assert_eq!(config.host, cloned.host);
        assert_eq!(config.cert_path, cloned.cert_path);
    }

    #[test]
    fn test_lnd_config_debug() {
        let config = LndConfig::default();
        let debug_str = format!("{:?}", config);
        assert!(debug_str.contains("LndConfig"));
    }

    // ============================================================================
    // LndClient Tests
    // ============================================================================

    #[test]
    fn test_lnd_client_not_connected() {
        let config = LndConfig::default();
        let client = LndClient::new(config);
        assert!(!client.is_connected());
    }

    #[test]
    fn test_lnd_client_creation() {
        let config = LndConfig {
            host: "localhost:10009".to_string(),
            cert_path: Some("/path/to/cert".to_string()),
            macaroon_path: Some("/path/to/macaroon".to_string()),
            tls_domain: None,
        };
        let client = LndClient::new(config.clone());
        assert!(!client.is_connected());
    }

    #[test]
    fn test_preimage_verification() {
        let preimage = Preimage::from_bytes([42u8; 32]);
        let payment_hash = preimage.payment_hash();

        // Sync verification
        let computed_hash = preimage.payment_hash();
        assert_eq!(computed_hash.bytes, payment_hash.bytes);
    }

    #[test]
    fn test_preimage_verification_failure() {
        let preimage = Preimage::from_bytes([42u8; 32]);
        let wrong_hash = PaymentHash::from_bytes([99u8; 32]);

        let computed_hash = preimage.payment_hash();
        assert_ne!(computed_hash.bytes, wrong_hash.bytes);
    }

    // ============================================================================
    // SharedLndClient Tests
    // ============================================================================

    #[test]
    fn test_create_shared_client() {
        let config = LndConfig::default();
        let shared = create_shared_client(config);

        // Verify it's a valid Arc<RwLock<LndClient>>
        assert!(Arc::strong_count(&shared) >= 1);
    }

    #[test]
    fn test_shared_client_clone() {
        let config = LndConfig::default();
        let shared1 = create_shared_client(config);
        let _shared2 = shared1.clone();

        // Both should point to the same data
        assert_eq!(Arc::strong_count(&shared1), 2);
    }

    // ============================================================================
    // LndNodeInfo Tests
    // ============================================================================

    #[test]
    fn test_lnd_node_info_creation() {
        let info = LndNodeInfo {
            pubkey: "02abc123...".to_string(),
            alias: "my-lnd-node".to_string(),
            num_active_channels: 5,
            num_peers: 3,
            block_height: 800000,
        };

        assert_eq!(info.pubkey, "02abc123...");
        assert_eq!(info.alias, "my-lnd-node");
        assert_eq!(info.num_active_channels, 5);
        assert_eq!(info.num_peers, 3);
        assert_eq!(info.block_height, 800000);
    }

    #[test]
    fn test_lnd_node_info_debug() {
        let info = LndNodeInfo {
            pubkey: "pubkey".to_string(),
            alias: "alias".to_string(),
            num_active_channels: 0,
            num_peers: 0,
            block_height: 0,
        };
        let debug_str = format!("{:?}", info);
        assert!(debug_str.contains("LndNodeInfo"));
    }

    #[test]
    fn test_lnd_node_info_clone() {
        let info = LndNodeInfo {
            pubkey: "pubkey".to_string(),
            alias: "alias".to_string(),
            num_active_channels: 10,
            num_peers: 5,
            block_height: 700000,
        };
        let cloned = info.clone();
        assert_eq!(info.pubkey, cloned.pubkey);
        assert_eq!(info.alias, cloned.alias);
        assert_eq!(info.num_active_channels, cloned.num_active_channels);
    }

    // ============================================================================
    // Async LndClient Tests (using tokio::test)
    // ============================================================================

    #[tokio::test]
    async fn test_lnd_client_connect_default_config() {
        let config = LndConfig::default();
        let mut client = LndClient::new(config);

        // Should succeed with default config (no macaroon file needed)
        let result = client.connect().await;
        assert!(result.is_ok());
        assert!(client.is_connected());
    }

    #[tokio::test]
    async fn test_lnd_client_add_invoice_when_connected() {
        let config = LndConfig::default();
        let mut client = LndClient::new(config);

        client.connect().await.unwrap();

        let invoice = client
            .add_invoice(
                100_000, // 100k msat
                Some("Test invoice".to_string()),
                Some(3600), // 1 hour expiry
                Some(144),  // CLTV expiry
            )
            .await
            .unwrap();

        assert_eq!(invoice.amount_msat, 100_000);
        assert_eq!(invoice.state, InvoiceState::Open);
        assert!(invoice.payment_request.starts_with("lnbc"));
        assert!(invoice.description.is_some());
    }

    #[tokio::test]
    async fn test_lnd_client_add_invoice_without_optional_params() {
        let config = LndConfig::default();
        let mut client = LndClient::new(config);

        client.connect().await.unwrap();

        let invoice = client.add_invoice(50_000, None, None, None).await.unwrap();

        assert_eq!(invoice.amount_msat, 50_000);
        assert_eq!(invoice.state, InvoiceState::Open);
        assert_eq!(invoice.expiry_seconds, 3600); // Default expiry
        assert!(invoice.cltv_expiry.is_none());
    }

    #[tokio::test]
    async fn test_lnd_client_add_invoice_creates_unique_hashes() {
        let config = LndConfig::default();
        let mut client = LndClient::new(config);

        client.connect().await.unwrap();

        // Create first invoice
        let invoice1 = client.add_invoice(100_000, None, None, None).await.unwrap();

        // Wait for timestamp to advance (timestamps are in seconds)
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;

        // Create second invoice
        let invoice2 = client.add_invoice(100_000, None, None, None).await.unwrap();

        // Each should have a unique payment hash
        assert_ne!(invoice1.payment_hash, invoice2.payment_hash);
    }

    #[tokio::test]
    async fn test_lnd_client_verify_preimage_valid() {
        let config = LndConfig::default();
        let mut client = LndClient::new(config);

        client.connect().await.unwrap();

        let preimage = Preimage::from_bytes([0xAB; 32]);
        let payment_hash = preimage.payment_hash();

        let is_valid = client
            .verify_preimage(&preimage, &payment_hash)
            .await
            .unwrap();
        assert!(is_valid);
    }

    #[tokio::test]
    async fn test_lnd_client_verify_preimage_invalid() {
        let config = LndConfig::default();
        let mut client = LndClient::new(config);

        client.connect().await.unwrap();

        let preimage = Preimage::from_bytes([0xAB; 32]);
        let wrong_hash = PaymentHash::from_bytes([0xCD; 32]);

        let is_valid = client
            .verify_preimage(&preimage, &wrong_hash)
            .await
            .unwrap();
        assert!(!is_valid);
    }

    #[tokio::test]
    async fn test_lnd_client_get_invoice_not_connected() {
        let config = LndConfig::default();
        let client = LndClient::new(config);

        let hash = PaymentHash::from_bytes([0u8; 32]);
        let result = client.get_invoice(&hash).await;

        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.to_string().contains("Not connected"));
    }

    #[tokio::test]
    async fn test_lnd_client_decode_invoice_not_connected() {
        let config = LndConfig::default();
        let client = LndClient::new(config);

        let result = client.decode_invoice("lnbc1...").await;

        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.to_string().contains("Not connected"));
    }

    #[tokio::test]
    async fn test_lnd_client_get_info_not_connected() {
        let config = LndConfig::default();
        let client = LndClient::new(config);

        let result = client.get_info().await;

        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.to_string().contains("Not connected"));
    }

    #[tokio::test]
    async fn test_lnd_client_wait_for_settlement_timeout() {
        let config = LndConfig::default();
        let mut client = LndClient::new(config);

        client.connect().await.unwrap();

        let hash = PaymentHash::from_bytes([0u8; 32]);

        // Use a short timeout
        let result = client.wait_for_settlement(&hash, 1).await;

        // Should fail due to timeout
        assert!(result.is_err());
    }

    // ============================================================================
    // Integration: Invoice Creation and Verification Flow
    // ============================================================================

    #[tokio::test]
    async fn test_invoice_creation_and_verification_flow() {
        let config = LndConfig::default();
        let mut client = LndClient::new(config);

        // Connect
        client.connect().await.unwrap();

        // Create invoice
        let invoice = client
            .add_invoice(
                500_000, // 500k msat
                Some("Test payment".to_string()),
                Some(7200),
                Some(200),
            )
            .await
            .unwrap();

        // Verify invoice state
        assert!(invoice.is_payable());
        assert_eq!(invoice.amount_sats(), 500); // 500k msat = 500 sats

        // Simulate payment by creating a preimage that matches the hash
        // Note: In real usage, the preimage comes from the payer
        let payment_preimage = Preimage::from_bytes([0x12; 32]);

        // Verify preimage (should fail since we used a different hash)
        let is_valid = client
            .verify_preimage(&payment_preimage, &invoice.payment_hash)
            .await
            .unwrap();
        assert!(!is_valid);
    }
}
