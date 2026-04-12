//! LND client for Lightning Network operations
//!
//! The production path shells out to `lncli` with the configured TLS certificate,
//! macaroon, and network so the mint can create and inspect real invoices.
//! Tests and in-memory servers can still run without local LND credentials by
//! falling back to a mock backend that stores invoices in-process.

use crate::error::{CascadeError, Result};
use crate::lightning::types::{InvoiceState, LightningInvoice, PaymentHash, Preimage};
use serde::Deserialize;
use std::collections::HashMap;
use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::process::Command;
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
    /// Network to pass through to lncli when known.
    pub network: Option<String>,
    /// Optional absolute path to lncli. Falls back to PATH/common locations.
    pub cli_path: Option<String>,
}

impl Default for LndConfig {
    fn default() -> Self {
        Self {
            host: "localhost:10009".to_string(),
            cert_path: None,
            macaroon_path: None,
            tls_domain: None,
            network: None,
            cli_path: None,
        }
    }
}

#[derive(Debug, Clone)]
enum LndBackend {
    Mock {
        invoices: Arc<RwLock<HashMap<String, LightningInvoice>>>,
        preimages: Arc<RwLock<HashMap<String, Preimage>>>,
    },
    Cli {
        lncli_path: String,
    },
}

impl Default for LndBackend {
    fn default() -> Self {
        Self::Mock {
            invoices: Arc::new(RwLock::new(HashMap::new())),
            preimages: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}

#[derive(Debug, Clone)]
struct IssuedInvoiceRecord {
    invoice: LightningInvoice,
    preimage: Preimage,
    internal_payable: bool,
}

/// LND client wrapper
#[derive(Debug, Clone)]
pub struct LndClient {
    /// Configuration
    config: LndConfig,
    /// Whether connected
    connected: bool,
    /// Macaroon for authentication (hex-encoded)
    macaroon: Option<String>,
    /// Selected backend implementation
    backend: LndBackend,
    /// Locally tracked invoices created by this client, keyed by payment hash hex.
    issued_invoices: Arc<RwLock<HashMap<String, IssuedInvoiceRecord>>>,
}

#[derive(Debug)]
struct CliCommandResult {
    stdout: String,
    stderr: String,
    success: bool,
}

#[derive(Debug, Deserialize)]
struct AddInvoiceResponse {
    r_hash: String,
    payment_request: String,
}

#[derive(Debug, Deserialize)]
struct LookupInvoiceResponse {
    #[serde(default)]
    memo: String,
    r_hash: String,
    #[serde(default)]
    value_msat: String,
    #[serde(default)]
    creation_date: String,
    #[serde(default)]
    expiry: String,
    #[serde(default)]
    payment_request: String,
    #[serde(default)]
    cltv_expiry: String,
    #[serde(default)]
    settled: bool,
    #[serde(default)]
    state: String,
}

#[derive(Debug, Deserialize)]
struct DecodePayReqResponse {
    payment_hash: String,
    #[serde(default)]
    num_msat: String,
    #[serde(default)]
    timestamp: String,
    #[serde(default)]
    expiry: String,
    #[serde(default)]
    description: String,
    #[serde(default)]
    cltv_expiry: String,
}

#[derive(Debug, Deserialize)]
struct PayInvoiceResponse {
    payment_hash: String,
    #[serde(default)]
    payment_preimage: String,
    #[serde(default)]
    value_msat: String,
    #[serde(default)]
    fee_msat: String,
    #[serde(default)]
    payment_request: String,
    #[serde(default)]
    status: String,
    #[serde(default)]
    failure_reason: String,
}

#[derive(Debug, Deserialize)]
struct GetInfoResponse {
    identity_pubkey: String,
    alias: String,
    num_active_channels: u32,
    num_peers: u32,
    block_height: u32,
}

impl LndClient {
    /// Create a new LND client from config
    pub fn new(config: LndConfig) -> Self {
        Self {
            config,
            connected: false,
            macaroon: None,
            backend: LndBackend::default(),
            issued_invoices: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Connect to LND and establish the invoice backend.
    pub async fn connect(&mut self) -> Result<()> {
        if let Some(path) = self
            .config
            .macaroon_path
            .as_deref()
            .filter(|path| !path.is_empty())
        {
            let macaroon = tokio::fs::read(path)
                .await
                .map_err(|e| CascadeError::PaymentError(format!("Failed to read macaroon: {e}")))?;
            self.macaroon = Some(hex::encode(&macaroon));
        }

        let has_real_credentials = self
            .config
            .cert_path
            .as_deref()
            .is_some_and(|path| !path.trim().is_empty())
            && self
                .config
                .macaroon_path
                .as_deref()
                .is_some_and(|path| !path.trim().is_empty());

        if !has_real_credentials {
            self.connected = true;
            return Ok(());
        }

        let lncli_path = self.resolve_lncli_path()?;
        let probe = self
            .run_cli_command_with_path(&lncli_path, &[String::from("getinfo")])
            .await?;
        if !probe.success {
            return Err(CascadeError::PaymentError(format!(
                "Failed to connect to LND via lncli: {}",
                cli_error_message(&probe)
            )));
        }
        let _: GetInfoResponse = parse_cli_json(&probe)?;

        self.backend = LndBackend::Cli { lncli_path };
        self.connected = true;
        Ok(())
    }

    /// Check if client is connected
    pub fn is_connected(&self) -> bool {
        self.connected
    }

    /// Get invoice state from LND
    pub async fn get_invoice(
        &self,
        payment_hash: &PaymentHash,
    ) -> Result<Option<LightningInvoice>> {
        self.ensure_connected()?;

        let payment_hash_hex = payment_hash.to_hex();
        if let Some(record) = self
            .issued_invoices
            .read()
            .await
            .get(&payment_hash_hex)
            .cloned()
        {
            let normalized = self.normalize_invoice(record.invoice);
            if normalized.state != InvoiceState::Open {
                return Ok(Some(normalized));
            }
        }

        match &self.backend {
            LndBackend::Mock { invoices, .. } => {
                let stored = invoices.read().await.get(&payment_hash_hex).cloned();
                Ok(stored.map(|invoice| self.normalize_invoice(invoice)))
            }
            LndBackend::Cli { lncli_path } => {
                let args = vec![
                    "lookupinvoice".to_string(),
                    format!("--rhash={}", payment_hash.to_hex()),
                ];
                let result = self.run_cli_command_with_path(lncli_path, &args).await?;
                if !result.success {
                    if is_invoice_not_found(&result.stderr) || is_invoice_not_found(&result.stdout)
                    {
                        return Ok(None);
                    }
                    return Err(CascadeError::PaymentError(format!(
                        "LND lookupinvoice failed: {}",
                        cli_error_message(&result)
                    )));
                }

                let raw: LookupInvoiceResponse = parse_cli_json(&result)?;
                let invoice = self.invoice_from_lookup(raw)?;
                self.upsert_issued_invoice(invoice.clone(), None, false)
                    .await;
                Ok(Some(invoice))
            }
        }
    }

    /// Add an invoice to LND
    pub async fn add_invoice(
        &self,
        amount_msat: u64,
        description: Option<String>,
        expiry_seconds: Option<u64>,
        cltv_expiry: Option<u64>,
        internal_payable: bool,
    ) -> Result<LightningInvoice> {
        self.ensure_connected()?;

        match &self.backend {
            LndBackend::Mock {
                invoices,
                preimages,
            } => {
                let (invoice, preimage) =
                    self.create_mock_invoice(amount_msat, description, expiry_seconds, cltv_expiry);
                invoices
                    .write()
                    .await
                    .insert(invoice.payment_hash.to_hex(), invoice.clone());
                preimages
                    .write()
                    .await
                    .insert(invoice.payment_hash.to_hex(), preimage.clone());
                self.upsert_issued_invoice(invoice.clone(), Some(preimage), internal_payable)
                    .await;
                Ok(invoice)
            }
            LndBackend::Cli { lncli_path } => {
                let preimage = self.generate_preimage(amount_msat);
                let payment_hash = preimage.payment_hash();
                let mut args = vec![
                    "addinvoice".to_string(),
                    format!("--amt_msat={amount_msat}"),
                    format!("--preimage={}", preimage.to_hex()),
                ];
                if let Some(description) = description.clone().filter(|memo| !memo.is_empty()) {
                    args.push(format!("--memo={description}"));
                }
                if let Some(expiry_seconds) = expiry_seconds {
                    args.push(format!("--expiry={expiry_seconds}"));
                }
                if let Some(cltv_expiry) = cltv_expiry {
                    args.push(format!("--cltv_expiry_delta={cltv_expiry}"));
                }

                let result = self.run_cli_command_with_path(lncli_path, &args).await?;
                if !result.success {
                    return Err(CascadeError::PaymentError(format!(
                        "LND addinvoice failed: {}",
                        cli_error_message(&result)
                    )));
                }

                let raw: AddInvoiceResponse = parse_cli_json(&result)?;
                let invoice = LightningInvoice {
                    payment_request: raw.payment_request,
                    payment_hash: PaymentHash::from_hex(&raw.r_hash)?,
                    amount_msat,
                    created_at: chrono::Utc::now().timestamp(),
                    expiry_seconds: expiry_seconds.unwrap_or(86_400),
                    cltv_expiry,
                    description,
                    state: InvoiceState::Open,
                };
                if invoice.payment_hash != payment_hash {
                    return Err(CascadeError::PaymentError(
                        "LND addinvoice returned a payment hash different from the requested preimage"
                            .to_string(),
                    ));
                }
                self.upsert_issued_invoice(invoice.clone(), Some(preimage), internal_payable)
                    .await;
                Ok(invoice)
            }
        }
    }

    /// Verify a payment preimage against payment hash
    pub async fn verify_preimage(
        &self,
        preimage: &Preimage,
        payment_hash: &PaymentHash,
    ) -> Result<bool> {
        let computed_hash = preimage.payment_hash();
        Ok(computed_hash.bytes == payment_hash.bytes)
    }

    /// Wait for invoice to be settled
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

    /// Decode a BOLT11 invoice
    pub async fn decode_invoice(&self, invoice: &str) -> Result<LightningInvoice> {
        self.ensure_connected()?;

        match &self.backend {
            LndBackend::Mock { invoices, .. } => invoices
                .read()
                .await
                .values()
                .find(|stored| stored.payment_request == invoice)
                .cloned()
                .map(|stored| self.normalize_invoice(stored))
                .ok_or_else(|| {
                    CascadeError::PaymentError(
                        "Invoice decoding not available for unknown mock invoice".into(),
                    )
                }),
            LndBackend::Cli { lncli_path } => {
                let args = vec!["decodepayreq".to_string(), invoice.to_string()];
                let result = self.run_cli_command_with_path(lncli_path, &args).await?;
                if !result.success {
                    return Err(CascadeError::PaymentError(format!(
                        "LND decodepayreq failed: {}",
                        cli_error_message(&result)
                    )));
                }

                let raw: DecodePayReqResponse = parse_cli_json(&result)?;
                Ok(LightningInvoice {
                    payment_request: invoice.to_string(),
                    payment_hash: PaymentHash::from_hex(&raw.payment_hash)?,
                    amount_msat: parse_u64_field("num_msat", &raw.num_msat)?,
                    created_at: parse_i64_field("timestamp", &raw.timestamp)?,
                    expiry_seconds: parse_u64_field("expiry", &raw.expiry)?,
                    cltv_expiry: optional_u64_field(&raw.cltv_expiry)?,
                    description: empty_string_to_none(raw.description),
                    state: InvoiceState::Open,
                })
            }
        }
    }

    /// Pay a BOLT11 invoice and return the resulting preimage when settled.
    pub async fn pay_invoice(&self, invoice: &str) -> Result<Preimage> {
        self.ensure_connected()?;

        if let Some(preimage) = self.try_pay_internal_invoice(invoice).await? {
            return Ok(preimage);
        }

        match &self.backend {
            LndBackend::Mock {
                invoices,
                preimages,
            } => {
                let mut invoices_guard = invoices.write().await;
                let Some((payment_hash_hex, stored_invoice)) = invoices_guard
                    .iter_mut()
                    .find(|(_, stored)| stored.payment_request == invoice)
                else {
                    return Err(CascadeError::PaymentError(
                        "Mock invoice not found".to_string(),
                    ));
                };

                let normalized = self.normalize_invoice(stored_invoice.clone());
                if normalized.state != InvoiceState::Open {
                    return Err(CascadeError::PaymentError(format!(
                        "Mock invoice is not payable: {:?}",
                        normalized.state
                    )));
                }

                stored_invoice.state = InvoiceState::Settled;
                let payment_hash_hex = payment_hash_hex.clone();
                drop(invoices_guard);

                preimages
                    .read()
                    .await
                    .get(&payment_hash_hex)
                    .cloned()
                    .ok_or_else(|| {
                        CascadeError::PaymentError(
                            "Mock preimage not found for invoice".to_string(),
                        )
                    })
            }
            LndBackend::Cli { lncli_path } => {
                let args = vec![
                    "payinvoice".to_string(),
                    "--force".to_string(),
                    "--allow_self_payment".to_string(),
                    "--json".to_string(),
                    invoice.to_string(),
                ];
                let result = self.run_cli_command_with_path(lncli_path, &args).await?;
                let raw: PayInvoiceResponse = parse_cli_json(&result).map_err(|error| {
                    CascadeError::PaymentError(format!(
                        "LND payinvoice failed: {}",
                        if result.success {
                            error.to_string()
                        } else {
                            cli_error_message(&result)
                        }
                    ))
                })?;

                if !raw.status.eq_ignore_ascii_case("SUCCEEDED") {
                    let reason = if !raw.failure_reason.trim().is_empty() {
                        raw.failure_reason
                    } else if !result.success {
                        cli_error_message(&result)
                    } else {
                        format!("unexpected_payment_status: {}", raw.status)
                    };
                    return Err(CascadeError::PaymentError(format!(
                        "LND payinvoice failed: {reason}"
                    )));
                }

                if raw.payment_hash.trim().is_empty() || raw.payment_request.trim().is_empty() {
                    return Err(CascadeError::PaymentError(
                        "LND payinvoice returned an incomplete payment result".to_string(),
                    ));
                }

                let _ = parse_u64_field("value_msat", &raw.value_msat)?;
                let _ = parse_u64_field("fee_msat", &raw.fee_msat)?;

                let trimmed_preimage = raw.payment_preimage.trim();
                if trimmed_preimage.is_empty()
                    || trimmed_preimage
                        == "0000000000000000000000000000000000000000000000000000000000000000"
                {
                    return Err(CascadeError::PaymentError(
                        "LND payinvoice returned an empty preimage".to_string(),
                    ));
                }

                Preimage::from_hex(trimmed_preimage)
            }
        }
    }

    /// Get the LND node info
    pub async fn get_info(&self) -> Result<LndNodeInfo> {
        self.ensure_connected()?;

        match &self.backend {
            LndBackend::Mock { .. } => Ok(LndNodeInfo {
                pubkey: "mock-lnd-node".to_string(),
                alias: "mock-lnd".to_string(),
                num_active_channels: 0,
                num_peers: 0,
                block_height: 0,
            }),
            LndBackend::Cli { lncli_path } => {
                let result = self
                    .run_cli_command_with_path(lncli_path, &[String::from("getinfo")])
                    .await?;
                if !result.success {
                    return Err(CascadeError::PaymentError(format!(
                        "LND getinfo failed: {}",
                        cli_error_message(&result)
                    )));
                }

                let raw: GetInfoResponse = parse_cli_json(&result)?;
                Ok(LndNodeInfo {
                    pubkey: raw.identity_pubkey,
                    alias: raw.alias,
                    num_active_channels: raw.num_active_channels,
                    num_peers: raw.num_peers,
                    block_height: raw.block_height,
                })
            }
        }
    }

    fn ensure_connected(&self) -> Result<()> {
        if self.connected {
            Ok(())
        } else {
            Err(CascadeError::PaymentError(
                "Not connected to LND".to_string(),
            ))
        }
    }

    fn create_mock_invoice(
        &self,
        amount_msat: u64,
        description: Option<String>,
        expiry_seconds: Option<u64>,
        cltv_expiry: Option<u64>,
    ) -> (LightningInvoice, Preimage) {
        let preimage = self.generate_preimage(amount_msat);
        let payment_hash = preimage.payment_hash();

        (
            LightningInvoice {
                payment_request: format!(
                    "lnbc{}1p{}",
                    amount_msat / 1000,
                    &payment_hash.to_hex()[..16]
                ),
                payment_hash,
                amount_msat,
                created_at: chrono::Utc::now().timestamp(),
                expiry_seconds: expiry_seconds.unwrap_or(3600),
                cltv_expiry,
                description,
                state: InvoiceState::Open,
            },
            preimage,
        )
    }

    fn generate_preimage(&self, amount_msat: u64) -> Preimage {
        let mut preimage_bytes = [0u8; 32];
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(
            chrono::Utc::now()
                .timestamp_nanos_opt()
                .unwrap_or_default()
                .to_le_bytes(),
        );
        hasher.update(amount_msat.to_le_bytes());
        let result = hasher.finalize();
        preimage_bytes.copy_from_slice(&result);
        Preimage::from_bytes(preimage_bytes)
    }

    async fn upsert_issued_invoice(
        &self,
        invoice: LightningInvoice,
        preimage: Option<Preimage>,
        internal_payable: bool,
    ) {
        let initial_preimage = preimage
            .clone()
            .unwrap_or_else(|| Preimage::from_bytes([0u8; 32]));
        let payment_hash_hex = invoice.payment_hash.to_hex();
        let mut issued = self.issued_invoices.write().await;
        let record = issued
            .entry(payment_hash_hex)
            .or_insert_with(|| IssuedInvoiceRecord {
                invoice: invoice.clone(),
                preimage: initial_preimage,
                internal_payable,
            });
        record.invoice = invoice;
        record.internal_payable = record.internal_payable || internal_payable;
        if let Some(preimage) = preimage {
            record.preimage = preimage;
        }
    }

    async fn try_pay_internal_invoice(&self, invoice: &str) -> Result<Option<Preimage>> {
        let mut issued = self.issued_invoices.write().await;
        let Some(record) = issued
            .values_mut()
            .find(|record| record.invoice.payment_request == invoice)
        else {
            return Ok(None);
        };

        let normalized = self.normalize_invoice(record.invoice.clone());
        if normalized.state != InvoiceState::Open {
            return Err(CascadeError::PaymentError(format!(
                "Invoice is not payable: {:?}",
                normalized.state
            )));
        }
        if !record.internal_payable {
            return Ok(None);
        }

        record.invoice.state = InvoiceState::Settled;
        Ok(Some(record.preimage.clone()))
    }

    fn normalize_invoice(&self, mut invoice: LightningInvoice) -> LightningInvoice {
        if invoice.state == InvoiceState::Open
            && invoice.created_at + invoice.expiry_seconds as i64 <= chrono::Utc::now().timestamp()
        {
            invoice.state = InvoiceState::Expired;
        }
        invoice
    }

    fn invoice_from_lookup(&self, raw: LookupInvoiceResponse) -> Result<LightningInvoice> {
        let created_at = parse_i64_field("creation_date", &raw.creation_date)?;
        let expiry_seconds = parse_u64_field("expiry", &raw.expiry)?;
        let state = parse_lookup_state(&raw.state, raw.settled, created_at, expiry_seconds);

        Ok(LightningInvoice {
            payment_request: raw.payment_request,
            payment_hash: PaymentHash::from_hex(&raw.r_hash)?,
            amount_msat: parse_u64_field("value_msat", &raw.value_msat)?,
            created_at,
            expiry_seconds,
            cltv_expiry: optional_u64_field(&raw.cltv_expiry)?,
            description: empty_string_to_none(raw.memo),
            state,
        })
    }

    fn resolve_lncli_path(&self) -> Result<String> {
        if let Some(explicit) = self
            .config
            .cli_path
            .as_deref()
            .filter(|path| !path.trim().is_empty())
        {
            if Path::new(explicit).exists() {
                return Ok(explicit.to_string());
            }
            return Err(CascadeError::PaymentError(format!(
                "Configured lncli binary does not exist: {explicit}"
            )));
        }

        if let Ok(env_path) = std::env::var("LNCLI_BIN") {
            if Path::new(&env_path).exists() {
                return Ok(env_path);
            }
        }

        if let Some(path) = lookup_in_path("lncli") {
            return Ok(path);
        }

        let mut candidates: Vec<PathBuf> = Vec::new();
        if let Some(home) = std::env::var_os("HOME") {
            candidates.push(PathBuf::from(&home).join("bin/lncli"));
            candidates.push(PathBuf::from(&home).join(".local/bin/lncli"));
        }
        candidates.push(PathBuf::from("/opt/homebrew/bin/lncli"));
        candidates.push(PathBuf::from("/usr/local/bin/lncli"));
        candidates.push(PathBuf::from("/usr/bin/lncli"));

        for candidate in candidates {
            if candidate.exists() {
                return Ok(candidate.to_string_lossy().into_owned());
            }
        }

        Err(CascadeError::PaymentError(
            "Unable to locate lncli. Set lnd.cli_path or LNCLI_BIN.".to_string(),
        ))
    }

    fn build_cli_args(&self) -> Vec<String> {
        let mut args = vec![format!("--rpcserver={}", self.config.host)];

        if let Some(cert_path) = self
            .config
            .cert_path
            .as_deref()
            .filter(|path| !path.trim().is_empty())
        {
            args.push(format!("--tlscertpath={cert_path}"));
        }

        if let Some(macaroon_path) = self
            .config
            .macaroon_path
            .as_deref()
            .filter(|path| !path.trim().is_empty())
        {
            args.push(format!("--macaroonpath={macaroon_path}"));
        }

        args.push("--chain=bitcoin".to_string());

        if let Some(network) = self.network_name() {
            args.push(format!("--network={network}"));
        }

        args
    }

    fn network_name(&self) -> Option<String> {
        if let Some(network) = self
            .config
            .network
            .as_deref()
            .map(str::trim)
            .filter(|network| !network.is_empty())
        {
            return Some(network.to_string());
        }

        let infer_from = self
            .config
            .macaroon_path
            .as_deref()
            .or(self.config.cert_path.as_deref())?;
        for network in [
            "signet", "testnet4", "testnet", "mainnet", "regtest", "simnet",
        ] {
            if infer_from.contains(network) {
                return Some(network.to_string());
            }
        }

        None
    }

    async fn run_cli_command_with_path(
        &self,
        lncli_path: &str,
        command_args: &[String],
    ) -> Result<CliCommandResult> {
        let mut args = self.build_cli_args();
        args.extend(command_args.iter().cloned());

        let output = Command::new(OsString::from(lncli_path))
            .args(&args)
            .output()
            .await
            .map_err(|error| {
                CascadeError::PaymentError(format!(
                    "Failed to execute lncli at {lncli_path}: {error}"
                ))
            })?;

        Ok(CliCommandResult {
            stdout: String::from_utf8_lossy(&output.stdout).trim().to_string(),
            stderr: String::from_utf8_lossy(&output.stderr).trim().to_string(),
            success: output.status.success(),
        })
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

fn parse_cli_json<T: for<'de> Deserialize<'de>>(result: &CliCommandResult) -> Result<T> {
    serde_json::from_str(&result.stdout).map_err(|error| {
        CascadeError::PaymentError(format!(
            "Failed to parse lncli JSON: {error}. stdout: {}",
            result.stdout
        ))
    })
}

fn parse_lookup_state(
    state: &str,
    settled: bool,
    created_at: i64,
    expiry_seconds: u64,
) -> InvoiceState {
    if settled || state.eq_ignore_ascii_case("SETTLED") {
        return InvoiceState::Settled;
    }
    if state.eq_ignore_ascii_case("CANCELED") || state.eq_ignore_ascii_case("CANCELLED") {
        return InvoiceState::Cancelled;
    }
    if created_at + expiry_seconds as i64 <= chrono::Utc::now().timestamp() {
        return InvoiceState::Expired;
    }
    InvoiceState::Open
}

fn optional_u64_field(raw: &str) -> Result<Option<u64>> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }

    let value = parse_u64_field("numeric", trimmed)?;
    if value == 0 {
        Ok(None)
    } else {
        Ok(Some(value))
    }
}

fn parse_u64_field(field: &str, value: &str) -> Result<u64> {
    value.parse::<u64>().map_err(|error| {
        CascadeError::PaymentError(format!(
            "Invalid {field} value from lncli: {value} ({error})"
        ))
    })
}

fn parse_i64_field(field: &str, value: &str) -> Result<i64> {
    value.parse::<i64>().map_err(|error| {
        CascadeError::PaymentError(format!(
            "Invalid {field} value from lncli: {value} ({error})"
        ))
    })
}

fn empty_string_to_none(value: String) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn lookup_in_path(binary: &str) -> Option<String> {
    let path_var = std::env::var_os("PATH")?;
    for path in std::env::split_paths(&path_var) {
        let candidate = path.join(binary);
        if candidate.exists() {
            return Some(candidate.to_string_lossy().into_owned());
        }
    }
    None
}

fn cli_error_message(result: &CliCommandResult) -> String {
    if !result.stderr.is_empty() {
        result.stderr.clone()
    } else if !result.stdout.is_empty() {
        result.stdout.clone()
    } else {
        "unknown lncli failure".to_string()
    }
}

fn is_invoice_not_found(message: &str) -> bool {
    let lowered = message.to_ascii_lowercase();
    lowered.contains("invoice not found")
        || lowered.contains("unable to locate invoice")
        || lowered.contains("there are no existing invoices")
        || lowered.contains("unable to find invoice")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lnd_config_default() {
        let config = LndConfig::default();
        assert_eq!(config.host, "localhost:10009");
        assert!(config.cert_path.is_none());
        assert!(config.macaroon_path.is_none());
        assert!(config.tls_domain.is_none());
        assert!(config.network.is_none());
        assert!(config.cli_path.is_none());
    }

    #[tokio::test]
    async fn test_mock_connect_without_credentials() {
        let mut client = LndClient::new(LndConfig::default());
        client.connect().await.unwrap();
        assert!(client.is_connected());
    }

    #[tokio::test]
    async fn test_mock_add_and_lookup_invoice_roundtrip() {
        let mut client = LndClient::new(LndConfig::default());
        client.connect().await.unwrap();

        let invoice = client
            .add_invoice(
                25_000,
                Some("Cascade test invoice".to_string()),
                Some(120),
                Some(40),
                false,
            )
            .await
            .unwrap();

        assert!(invoice.bolt11().starts_with("lnbc"));
        assert_eq!(invoice.amount_msat, 25_000);
        assert_eq!(invoice.description.as_deref(), Some("Cascade test invoice"));
        assert_eq!(invoice.state, InvoiceState::Open);

        let looked_up = client
            .get_invoice(&invoice.payment_hash)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(looked_up.payment_hash, invoice.payment_hash);
        assert_eq!(looked_up.amount_msat, invoice.amount_msat);
        assert_eq!(looked_up.description, invoice.description);
    }

    #[tokio::test]
    async fn test_mock_pay_invoice_settles_invoice() {
        let mut client = LndClient::new(LndConfig::default());
        client.connect().await.unwrap();

        let invoice = client
            .add_invoice(
                10_000,
                Some("Cascade pay test".to_string()),
                Some(120),
                Some(40),
                true,
            )
            .await
            .unwrap();

        let preimage = client.pay_invoice(invoice.bolt11()).await.unwrap();
        assert_eq!(preimage.payment_hash(), invoice.payment_hash);

        let looked_up = client
            .get_invoice(&invoice.payment_hash)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(looked_up.state, InvoiceState::Settled);
    }

    #[tokio::test]
    async fn test_mock_pay_unknown_invoice_fails() {
        let mut client = LndClient::new(LndConfig::default());
        client.connect().await.unwrap();

        let error = client
            .pay_invoice("lnbc1definitelynotreal")
            .await
            .unwrap_err()
            .to_string();
        assert!(error.contains("Mock invoice not found"));
    }

    #[test]
    fn test_parse_lookup_state_expired() {
        let created_at = chrono::Utc::now().timestamp() - 600;
        let state = parse_lookup_state("OPEN", false, created_at, 60);
        assert_eq!(state, InvoiceState::Expired);
    }

    #[test]
    fn test_lookup_in_path_misses_unknown_binary() {
        assert!(lookup_in_path("definitely-not-a-real-lncli-binary").is_none());
    }
}
