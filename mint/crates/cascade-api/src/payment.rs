use crate::fx::{FxQuoteEnvelope, FxQuoteService};
use anyhow::anyhow;
use async_trait::async_trait;
use cascade_core::invoice::InvoiceService;
use cascade_core::lightning::types::{InvoiceState, PaymentHash};
use cascade_core::product::FxQuoteSourceMetadata;
use cdk::Amount;
use cdk_common::database::DynMintDatabase;
use cdk_common::nuts::{CurrencyUnit, MeltQuoteState};
use cdk_common::payment::{
    self, Bolt11Settings, CreateIncomingPaymentResponse, Event, IncomingPaymentOptions,
    MakePaymentResponse, MintPayment, OutgoingPaymentOptions, PaymentIdentifier,
    PaymentQuoteResponse, SettingsResponse, WaitPaymentResponse,
};
use futures::Stream;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::pin::Pin;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use std::time::Duration;
use tokio::sync::{Mutex, RwLock};

const PROCESSOR_PRIMARY_NAMESPACE: &str = "cascade_usd_bolt11";
const INCOMING_SECONDARY_NAMESPACE: &str = "incoming";
const OUTGOING_SECONDARY_NAMESPACE: &str = "outgoing";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
enum StoredPaymentStatus {
    Unpaid,
    Paid,
    Failed,
    Expired,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StoredBolt11Payment {
    payment_hash: String,
    request: String,
    amount_minor: u64,
    amount_msat: u64,
    fee_minor: u64,
    #[serde(default)]
    reference_btc_usd_price: f64,
    source: String,
    spread_bps: u64,
    #[serde(default)]
    source_metadata: FxQuoteSourceMetadata,
    created_at: i64,
    expires_at: Option<u64>,
    status: StoredPaymentStatus,
    payment_proof: Option<String>,
}

#[derive(Clone)]
pub struct UsdBolt11PaymentProcessor {
    invoice_service: Arc<Mutex<InvoiceService>>,
    fx_service: Arc<FxQuoteService>,
    localstore: DynMintDatabase,
    pending_incoming: Arc<RwLock<HashSet<String>>>,
    wait_active: Arc<AtomicBool>,
    cancel_wait: Arc<AtomicBool>,
    paper_mode: bool,
    settings: SettingsResponse,
}

impl std::fmt::Debug for UsdBolt11PaymentProcessor {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("UsdBolt11PaymentProcessor")
            .field("paper_mode", &self.paper_mode)
            .finish_non_exhaustive()
    }
}

impl UsdBolt11PaymentProcessor {
    pub fn new(
        invoice_service: Arc<Mutex<InvoiceService>>,
        fx_service: Arc<FxQuoteService>,
        localstore: DynMintDatabase,
        paper_mode: bool,
    ) -> Self {
        Self {
            invoice_service,
            fx_service,
            localstore,
            pending_incoming: Arc::new(RwLock::new(HashSet::new())),
            wait_active: Arc::new(AtomicBool::new(false)),
            cancel_wait: Arc::new(AtomicBool::new(false)),
            paper_mode,
            settings: SettingsResponse {
                unit: CurrencyUnit::Usd.to_string(),
                bolt11: Some(Bolt11Settings {
                    mpp: false,
                    amountless: false,
                    invoice_description: true,
                }),
                bolt12: None,
                custom: Default::default(),
            },
        }
    }

    async fn read_payment(
        &self,
        secondary_namespace: &str,
        payment_hash: &str,
    ) -> Result<Option<StoredBolt11Payment>, payment::Error> {
        let stored = self
            .localstore
            .kv_read(
                PROCESSOR_PRIMARY_NAMESPACE,
                secondary_namespace,
                payment_hash,
            )
            .await
            .map_err(|error| payment::Error::Anyhow(anyhow!(error.to_string())))?;

        stored
            .map(|bytes| {
                serde_json::from_slice::<StoredBolt11Payment>(&bytes).map_err(payment::Error::from)
            })
            .transpose()
    }

    async fn write_payment(
        &self,
        secondary_namespace: &str,
        payment: &StoredBolt11Payment,
    ) -> Result<(), payment::Error> {
        let payload = serde_json::to_vec(payment)?;
        let mut tx = self
            .localstore
            .begin_transaction()
            .await
            .map_err(|error| payment::Error::Anyhow(anyhow!(error.to_string())))?;
        tx.kv_write(
            PROCESSOR_PRIMARY_NAMESPACE,
            secondary_namespace,
            &payment.payment_hash,
            &payload,
        )
        .await
        .map_err(|error| payment::Error::Anyhow(anyhow!(error.to_string())))?;
        tx.commit()
            .await
            .map_err(|error| payment::Error::Anyhow(anyhow!(error.to_string())))?;
        Ok(())
    }

    fn payment_identifier(payment_hash: &str) -> Result<PaymentIdentifier, payment::Error> {
        PaymentIdentifier::new("payment_hash", payment_hash)
    }

    fn payment_is_expired(payment: &StoredBolt11Payment) -> bool {
        payment
            .expires_at
            .is_some_and(|expires_at| expires_at <= chrono::Utc::now().timestamp().max(0) as u64)
    }

    async fn expire_payment_if_needed(
        &self,
        secondary_namespace: &str,
        payment: &mut StoredBolt11Payment,
    ) -> Result<bool, payment::Error> {
        if payment.status != StoredPaymentStatus::Unpaid || !Self::payment_is_expired(payment) {
            return Ok(false);
        }

        payment.status = StoredPaymentStatus::Expired;
        self.write_payment(secondary_namespace, payment).await?;
        Ok(true)
    }

    fn quote_extra_json(fx_quote: &FxQuoteEnvelope) -> serde_json::Value {
        serde_json::json!({
            "fx_quote_id": fx_quote.snapshot.id,
            "amount_minor": fx_quote.snapshot.amount_minor,
            "amount_msat": fx_quote.snapshot.amount_msat,
            "btc_usd_price": fx_quote.snapshot.btc_usd_price,
            "reference_btc_usd_price": fx_quote.snapshot.reference_btc_usd_price,
            "source": fx_quote.snapshot.source,
            "spread_bps": fx_quote.snapshot.spread_bps,
            "execution_spread_bps": fx_quote.snapshot.source_metadata.execution_spread_bps,
            "combination_policy": fx_quote.snapshot.source_metadata.combination_policy,
            "quote_direction": fx_quote.snapshot.source_metadata.quote_direction,
            "provider_count": fx_quote.snapshot.source_metadata.provider_count,
            "minimum_provider_count": fx_quote.snapshot.source_metadata.minimum_provider_count,
            "max_observation_age_seconds": fx_quote.snapshot.source_metadata.max_observation_age_seconds,
            "expires_at": fx_quote.snapshot.expires_at,
        })
    }

    async fn settle_incoming_if_paid(
        &self,
        payment_hash: &str,
        payment_identifier: &PaymentIdentifier,
    ) -> Result<Vec<WaitPaymentResponse>, payment::Error> {
        let Some(mut stored) = self
            .read_payment(INCOMING_SECONDARY_NAMESPACE, payment_hash)
            .await?
        else {
            return Ok(Vec::new());
        };

        if stored.status == StoredPaymentStatus::Paid {
            return Ok(vec![WaitPaymentResponse {
                payment_identifier: payment_identifier.clone(),
                payment_amount: Amount::new(stored.amount_minor, CurrencyUnit::Usd),
                payment_id: stored.payment_hash,
            }]);
        }
        if matches!(
            stored.status,
            StoredPaymentStatus::Failed | StoredPaymentStatus::Expired
        ) {
            return Ok(Vec::new());
        }

        if self
            .expire_payment_if_needed(INCOMING_SECONDARY_NAMESPACE, &mut stored)
            .await?
        {
            self.pending_incoming.write().await.remove(payment_hash);
            return Ok(Vec::new());
        }

        let invoice_state = {
            let invoice_service = self.invoice_service.lock().await;
            let payment_hash = PaymentHash::from_hex(payment_hash)
                .map_err(|error| payment::Error::Anyhow(anyhow!(error.to_string())))?;
            invoice_service
                .check_invoice_status(&payment_hash)
                .await
                .map_err(|error| payment::Error::Anyhow(anyhow!(error.to_string())))?
        };

        if invoice_state != InvoiceState::Settled {
            return Ok(Vec::new());
        }

        stored.status = StoredPaymentStatus::Paid;
        self.write_payment(INCOMING_SECONDARY_NAMESPACE, &stored)
            .await?;
        self.pending_incoming.write().await.remove(payment_hash);

        Ok(vec![WaitPaymentResponse {
            payment_identifier: payment_identifier.clone(),
            payment_amount: Amount::new(stored.amount_minor, CurrencyUnit::Usd),
            payment_id: stored.payment_hash,
        }])
    }
}

pub async fn store_locked_outgoing_bolt11_payment(
    localstore: DynMintDatabase,
    invoice: &cdk_common::Bolt11Invoice,
    amount_minor: u64,
    amount_msat: u64,
    fee_minor: u64,
    reference_btc_usd_price: f64,
    source: &str,
    spread_bps: u64,
    source_metadata: &FxQuoteSourceMetadata,
    created_at: i64,
    expires_at: Option<u64>,
) -> Result<(), payment::Error> {
    let payment_hash = invoice.payment_hash().to_string();
    let stored = StoredBolt11Payment {
        payment_hash: payment_hash.clone(),
        request: invoice.to_string(),
        amount_minor,
        amount_msat,
        fee_minor,
        reference_btc_usd_price,
        source: source.to_string(),
        spread_bps,
        source_metadata: source_metadata.clone(),
        created_at,
        expires_at,
        status: StoredPaymentStatus::Unpaid,
        payment_proof: None,
    };
    let payload = serde_json::to_vec(&stored)?;
    let mut tx = localstore
        .begin_transaction()
        .await
        .map_err(|error| payment::Error::Anyhow(anyhow!(error.to_string())))?;
    tx.kv_write(
        PROCESSOR_PRIMARY_NAMESPACE,
        OUTGOING_SECONDARY_NAMESPACE,
        &payment_hash,
        &payload,
    )
    .await
    .map_err(|error| payment::Error::Anyhow(anyhow!(error.to_string())))?;
    tx.commit()
        .await
        .map_err(|error| payment::Error::Anyhow(anyhow!(error.to_string())))?;
    Ok(())
}

#[async_trait]
impl MintPayment for UsdBolt11PaymentProcessor {
    type Err = payment::Error;

    async fn get_settings(&self) -> Result<SettingsResponse, Self::Err> {
        Ok(self.settings.clone())
    }

    async fn create_incoming_payment_request(
        &self,
        options: IncomingPaymentOptions,
    ) -> Result<CreateIncomingPaymentResponse, Self::Err> {
        let IncomingPaymentOptions::Bolt11(bolt11_options) = options else {
            return Err(payment::Error::UnsupportedPaymentOption);
        };

        if bolt11_options.amount.unit() != &CurrencyUnit::Usd {
            return Err(payment::Error::UnsupportedUnit);
        }

        let amount_minor = bolt11_options.amount.value();
        if amount_minor == 0 {
            return Err(payment::Error::Custom(
                "amount_minor_must_be_positive".to_string(),
            ));
        }

        let fx_quote = self
            .fx_service
            .quote_wallet_funding(amount_minor)
            .await
            .map_err(payment::Error::Custom)?;

        let now = chrono::Utc::now().timestamp().max(0) as u64;
        let expiry = bolt11_options
            .unix_expiry
            .unwrap_or(fx_quote.snapshot.expires_at.max(0) as u64);
        let expiry_seconds = expiry.saturating_sub(now).max(60);

        let invoice = {
            let mut invoice_service = self.invoice_service.lock().await;
            invoice_service
                .create_invoice(
                    fx_quote.snapshot.amount_msat,
                    bolt11_options.description.clone(),
                    Some(expiry_seconds),
                    self.paper_mode,
                )
                .await
                .map_err(|error| payment::Error::Anyhow(anyhow!(error.to_string())))?
        };

        let payment_hash = invoice.payment_hash.to_hex();
        let stored = StoredBolt11Payment {
            payment_hash: payment_hash.clone(),
            request: invoice.bolt11().to_string(),
            amount_minor,
            amount_msat: fx_quote.snapshot.amount_msat,
            fee_minor: 0,
            reference_btc_usd_price: fx_quote.snapshot.reference_btc_usd_price,
            source: fx_quote.snapshot.source.clone(),
            spread_bps: fx_quote.snapshot.spread_bps,
            source_metadata: fx_quote.snapshot.source_metadata.clone(),
            created_at: fx_quote.snapshot.created_at,
            expires_at: Some(expiry),
            status: StoredPaymentStatus::Unpaid,
            payment_proof: None,
        };
        self.write_payment(INCOMING_SECONDARY_NAMESPACE, &stored)
            .await?;
        self.pending_incoming
            .write()
            .await
            .insert(payment_hash.clone());

        Ok(CreateIncomingPaymentResponse {
            request_lookup_id: Self::payment_identifier(&payment_hash)?,
            request: stored.request,
            expiry: stored.expires_at,
            extra_json: Some(Self::quote_extra_json(&fx_quote)),
        })
    }

    async fn get_payment_quote(
        &self,
        unit: &CurrencyUnit,
        options: OutgoingPaymentOptions,
    ) -> Result<PaymentQuoteResponse, Self::Err> {
        let OutgoingPaymentOptions::Bolt11(bolt11_options) = options else {
            return Err(payment::Error::UnsupportedPaymentOption);
        };

        if unit != &CurrencyUnit::Usd {
            return Err(payment::Error::UnsupportedUnit);
        }

        let amount_msat = match bolt11_options.melt_options {
            Some(melt_options) => u64::from(melt_options.amount_msat()),
            None => bolt11_options
                .bolt11
                .amount_milli_satoshis()
                .ok_or_else(|| payment::Error::Custom("unknown_invoice_amount".to_string()))?,
        };

        let payment_hash = bolt11_options.bolt11.payment_hash().to_string();

        if let Some(mut stored) = self
            .read_payment(OUTGOING_SECONDARY_NAMESPACE, &payment_hash)
            .await?
        {
            let expired = self
                .expire_payment_if_needed(OUTGOING_SECONDARY_NAMESPACE, &mut stored)
                .await?;
            let status = match stored.status {
                StoredPaymentStatus::Unpaid => MeltQuoteState::Unpaid,
                StoredPaymentStatus::Paid => MeltQuoteState::Paid,
                StoredPaymentStatus::Failed | StoredPaymentStatus::Expired => {
                    MeltQuoteState::Failed
                }
            };
            return Ok(PaymentQuoteResponse {
                request_lookup_id: Some(Self::payment_identifier(&payment_hash)?),
                amount: Amount::new(stored.amount_minor, CurrencyUnit::Usd),
                fee: Amount::new(stored.fee_minor, CurrencyUnit::Usd),
                state: if expired {
                    MeltQuoteState::Failed
                } else {
                    status
                },
            });
        }

        let fx_quote = self
            .fx_service
            .quote_msat_to_minor(amount_msat)
            .await
            .map_err(payment::Error::Custom)?;

        let stored = StoredBolt11Payment {
            payment_hash: payment_hash.clone(),
            request: bolt11_options.bolt11.to_string(),
            amount_minor: fx_quote.snapshot.amount_minor,
            amount_msat,
            fee_minor: 0,
            reference_btc_usd_price: fx_quote.snapshot.reference_btc_usd_price,
            source: fx_quote.snapshot.source,
            spread_bps: fx_quote.snapshot.spread_bps,
            source_metadata: fx_quote.snapshot.source_metadata,
            created_at: fx_quote.snapshot.created_at,
            expires_at: Some(fx_quote.snapshot.expires_at.max(0) as u64),
            status: StoredPaymentStatus::Unpaid,
            payment_proof: None,
        };
        self.write_payment(OUTGOING_SECONDARY_NAMESPACE, &stored)
            .await?;

        Ok(PaymentQuoteResponse {
            request_lookup_id: Some(Self::payment_identifier(&payment_hash)?),
            amount: Amount::new(stored.amount_minor, CurrencyUnit::Usd),
            fee: Amount::new(stored.fee_minor, CurrencyUnit::Usd),
            state: MeltQuoteState::Unpaid,
        })
    }

    async fn make_payment(
        &self,
        unit: &CurrencyUnit,
        options: OutgoingPaymentOptions,
    ) -> Result<MakePaymentResponse, Self::Err> {
        let OutgoingPaymentOptions::Bolt11(bolt11_options) = options else {
            return Err(payment::Error::UnsupportedPaymentOption);
        };

        if unit != &CurrencyUnit::Usd {
            return Err(payment::Error::UnsupportedUnit);
        }

        let payment_hash = bolt11_options.bolt11.payment_hash().to_string();
        let mut stored = self
            .read_payment(OUTGOING_SECONDARY_NAMESPACE, &payment_hash)
            .await?
            .unwrap_or(StoredBolt11Payment {
                payment_hash: payment_hash.clone(),
                request: bolt11_options.bolt11.to_string(),
                amount_minor: 0,
                amount_msat: 0,
                fee_minor: 0,
                reference_btc_usd_price: 0.0,
                source: String::new(),
                spread_bps: 0,
                source_metadata: FxQuoteSourceMetadata::default(),
                created_at: chrono::Utc::now().timestamp(),
                expires_at: None,
                status: StoredPaymentStatus::Unpaid,
                payment_proof: None,
            });

        if stored.status == StoredPaymentStatus::Paid {
            return Err(payment::Error::InvoiceAlreadyPaid);
        }

        if self
            .expire_payment_if_needed(OUTGOING_SECONDARY_NAMESPACE, &mut stored)
            .await?
            || stored.status == StoredPaymentStatus::Expired
        {
            return Err(payment::Error::Custom("payment_quote_expired".to_string()));
        }

        let preimage = {
            let invoice_service = self.invoice_service.lock().await;
            invoice_service
                .pay_invoice(&stored.request)
                .await
                .map_err(|error| payment::Error::Anyhow(anyhow!(error.to_string())))?
        };

        stored.status = StoredPaymentStatus::Paid;
        stored.payment_proof = Some(preimage.to_hex());
        self.write_payment(OUTGOING_SECONDARY_NAMESPACE, &stored)
            .await?;

        Ok(MakePaymentResponse {
            payment_lookup_id: Self::payment_identifier(&payment_hash)?,
            payment_proof: stored.payment_proof,
            status: MeltQuoteState::Paid,
            total_spent: Amount::new(stored.amount_minor + stored.fee_minor, unit.clone()),
        })
    }

    async fn wait_payment_event(
        &self,
    ) -> Result<Pin<Box<dyn Stream<Item = Event> + Send>>, Self::Err> {
        self.cancel_wait.store(false, Ordering::SeqCst);
        self.wait_active.store(true, Ordering::SeqCst);

        let processor = self.clone();
        let stream = futures::stream::unfold(Vec::<Event>::new(), move |mut queued| {
            let processor = processor.clone();
            async move {
                loop {
                    if processor.cancel_wait.load(Ordering::SeqCst) {
                        processor.wait_active.store(false, Ordering::SeqCst);
                        return None;
                    }

                    if let Some(event) = queued.pop() {
                        return Some((event, queued));
                    }

                    let pending_hashes = processor
                        .pending_incoming
                        .read()
                        .await
                        .iter()
                        .cloned()
                        .collect::<Vec<_>>();

                    for payment_hash in pending_hashes {
                        let identifier = match Self::payment_identifier(&payment_hash) {
                            Ok(identifier) => identifier,
                            Err(_) => continue,
                        };
                        if let Ok(payments) = processor
                            .settle_incoming_if_paid(&payment_hash, &identifier)
                            .await
                        {
                            for payment in payments {
                                queued.push(Event::PaymentReceived(payment));
                            }
                        }
                    }

                    if !queued.is_empty() {
                        continue;
                    }

                    tokio::time::sleep(Duration::from_secs(1)).await;
                }
            }
        });

        Ok(Box::pin(stream))
    }

    fn is_wait_invoice_active(&self) -> bool {
        self.wait_active.load(Ordering::SeqCst)
    }

    fn cancel_wait_invoice(&self) {
        self.cancel_wait.store(true, Ordering::SeqCst);
    }

    async fn check_incoming_payment_status(
        &self,
        payment_identifier: &PaymentIdentifier,
    ) -> Result<Vec<WaitPaymentResponse>, Self::Err> {
        self.settle_incoming_if_paid(&payment_identifier.to_string(), payment_identifier)
            .await
    }

    async fn check_outgoing_payment(
        &self,
        payment_identifier: &PaymentIdentifier,
    ) -> Result<MakePaymentResponse, Self::Err> {
        let Some(mut stored) = self
            .read_payment(
                OUTGOING_SECONDARY_NAMESPACE,
                &payment_identifier.to_string(),
            )
            .await?
        else {
            return Ok(MakePaymentResponse {
                payment_lookup_id: payment_identifier.clone(),
                payment_proof: None,
                status: MeltQuoteState::Unknown,
                total_spent: Amount::new(0, CurrencyUnit::Usd),
            });
        };

        let _ = self
            .expire_payment_if_needed(OUTGOING_SECONDARY_NAMESPACE, &mut stored)
            .await?;

        let status = match stored.status {
            StoredPaymentStatus::Unpaid => MeltQuoteState::Unpaid,
            StoredPaymentStatus::Paid => MeltQuoteState::Paid,
            StoredPaymentStatus::Failed | StoredPaymentStatus::Expired => MeltQuoteState::Failed,
        };

        Ok(MakePaymentResponse {
            payment_lookup_id: payment_identifier.clone(),
            payment_proof: stored.payment_proof,
            status,
            total_spent: Amount::new(stored.amount_minor + stored.fee_minor, CurrencyUnit::Usd),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fx::{FxQuotePolicy, QuoteSource};
    use cascade_core::product::{
        FxQuoteDirection, FxQuoteObservation, FxQuoteSnapshot, FxQuoteSourceMetadata,
    };
    use cdk_common::payment::Bolt11IncomingPaymentOptions;
    use std::fs;
    use std::os::unix::fs::PermissionsExt;
    use std::path::PathBuf;

    #[derive(Debug)]
    struct StaticQuoteSource {
        id: &'static str,
        price: f64,
        observed_at: i64,
    }

    #[async_trait]
    impl QuoteSource for StaticQuoteSource {
        fn id(&self) -> &'static str {
            self.id
        }

        async fn fetch_observation(
            &self,
            _client: &reqwest::Client,
        ) -> Result<FxQuoteObservation, String> {
            Ok(FxQuoteObservation {
                source: self.id.to_string(),
                btc_usd_price: self.price,
                observed_at: self.observed_at,
            })
        }
    }

    fn test_fx_service() -> Arc<FxQuoteService> {
        Arc::new(
            FxQuoteService::with_sources(
                vec![Arc::new(StaticQuoteSource {
                    id: "test",
                    price: 50_000.0,
                    observed_at: chrono::Utc::now().timestamp(),
                })],
                FxQuotePolicy {
                    quote_ttl_seconds: 30,
                    max_provider_spread_bps: 500,
                    max_observation_age_seconds: 60,
                    min_provider_count: 1,
                    usd_to_msat_spread_bps: 100,
                    msat_to_usd_spread_bps: 100,
                },
            )
            .unwrap(),
        )
    }

    fn sample_fx_quote() -> FxQuoteEnvelope {
        FxQuoteEnvelope {
            snapshot: FxQuoteSnapshot {
                id: "fx-quote-1".to_string(),
                amount_minor: 2_500,
                amount_msat: 50_505_051,
                btc_usd_price: 49_500.0,
                reference_btc_usd_price: 50_000.0,
                source: "coinbase,kraken,bitstamp".to_string(),
                spread_bps: 400,
                observations: vec![FxQuoteObservation {
                    source: "coinbase".to_string(),
                    btc_usd_price: 50_000.0,
                    observed_at: 1_700_000_000,
                }],
                source_metadata: FxQuoteSourceMetadata {
                    combination_policy: "median_non_stale_major_providers_v1".to_string(),
                    quote_direction: FxQuoteDirection::UsdToMsat,
                    provider_count: 3,
                    minimum_provider_count: 2,
                    execution_spread_bps: 100,
                    max_observation_age_seconds: 60,
                },
                created_at: 1_700_000_000,
                expires_at: 1_700_000_030,
            },
        }
    }

    fn make_fake_lncli_path(name: &str) -> PathBuf {
        let unique = format!(
            "{name}-{}-{}",
            std::process::id(),
            chrono::Utc::now()
                .timestamp_nanos_opt()
                .unwrap_or_default()
                .abs()
        );
        std::env::temp_dir().join(unique)
    }

    async fn create_cli_invoice_service() -> Arc<Mutex<InvoiceService>> {
        let script_dir = make_fake_lncli_path("cascade-payment-fake-lncli");
        fs::create_dir_all(&script_dir).unwrap();

        let script_path = script_dir.join("lncli");
        fs::write(
            &script_path,
            r#"#!/usr/bin/env python3
import hashlib
import json
import sys

command = None
for arg in sys.argv[1:]:
    if arg in {"getinfo", "addinvoice", "payinvoice"}:
        command = arg
        break

if command == "getinfo":
    print(json.dumps({
        "identity_pubkey": "fake-lncli-pubkey",
        "alias": "fake-lncli",
        "num_active_channels": 0,
        "num_peers": 0,
        "block_height": 1
    }))
    sys.exit(0)

if command == "addinvoice":
    preimage = ""
    for arg in sys.argv[1:]:
        if arg.startswith("--preimage="):
            preimage = arg.split("=", 1)[1]
            break
    payment_hash = hashlib.sha256(bytes.fromhex(preimage)).hexdigest()
    print(json.dumps({
        "r_hash": payment_hash,
        "payment_request": f"lnsb1internal{payment_hash[:16]}"
    }))
    sys.exit(0)

if command == "payinvoice":
    sys.stderr.write("self-payment disabled in fake lncli\n")
    sys.exit(1)

sys.stderr.write(f"unsupported fake lncli command: {' '.join(sys.argv[1:])}\n")
sys.exit(1)
"#,
        )
        .unwrap();
        let mut permissions = fs::metadata(&script_path).unwrap().permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&script_path, permissions).unwrap();

        let cert_path = script_dir.join("tls.cert");
        fs::write(&cert_path, "fake-cert").unwrap();
        let macaroon_path = script_dir.join("admin.macaroon");
        fs::write(&macaroon_path, [1_u8, 2, 3, 4]).unwrap();

        let lnd_config = cascade_core::LndConfig {
            host: "127.0.0.1:10009".to_string(),
            cert_path: Some(cert_path.display().to_string()),
            macaroon_path: Some(macaroon_path.display().to_string()),
            tls_domain: None,
            network: Some("signet".to_string()),
            cli_path: Some(script_path.display().to_string()),
        };
        let mut lnd_client = cascade_core::lightning::lnd_client::LndClient::new(lnd_config);
        lnd_client.connect().await.unwrap();

        Arc::new(Mutex::new(InvoiceService::new(lnd_client, 3600, 40)))
    }

    #[test]
    fn quote_extra_json_omits_fallback_flag() {
        let payload = UsdBolt11PaymentProcessor::quote_extra_json(&sample_fx_quote());

        assert!(payload.get("fallback_used").is_none());
    }

    #[tokio::test]
    async fn create_incoming_payment_request_marks_invoice_internal_payable() {
        let invoice_service = create_cli_invoice_service().await;
        let localstore = Arc::new(cdk_sqlite::mint::memory::empty().await.unwrap());
        let processor = UsdBolt11PaymentProcessor::new(
            invoice_service.clone(),
            test_fx_service(),
            localstore,
            true,
        );

        let response = processor
            .create_incoming_payment_request(IncomingPaymentOptions::Bolt11(
                Bolt11IncomingPaymentOptions {
                    description: Some("Cascade sell withdrawal test".to_string()),
                    amount: Amount::new(2_500, CurrencyUnit::Usd),
                    unix_expiry: None,
                },
            ))
            .await
            .unwrap();

        let payment_result = {
            let invoice_service = invoice_service.lock().await;
            invoice_service.pay_invoice(&response.request).await
        };

        assert!(payment_result.is_ok());
    }
}
