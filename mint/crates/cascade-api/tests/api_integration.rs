//! API Integration Tests for Cascade Cashu Mint
//!
//! Tests that verify the Cashu API endpoints work correctly.
//! These tests start a local server and make HTTP requests to it.

use async_trait::async_trait;
use axum::{
    extract::{Json, State},
    http::{HeaderMap, Method, Uri},
    Router,
};
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use bitcoin::secp256k1::{Keypair, Message, Secp256k1, SecretKey, XOnlyPublicKey};
use cdk::amount::{FeeAndAmounts, SplitTarget};
use cdk::dhke::construct_proofs;
use cdk::mint::{MintBuilder, MintMeltLimits, UnitConfig};
use cdk::nuts::{BlindSignature, CurrencyUnit, KeySet, KeysResponse, PreMintSecrets, Proof};
use cdk::Amount;
use cdk_common::nut00::KnownMethod;
use cdk_common::nuts::PaymentMethod;
use cdk_common::Bolt11Invoice;
use hmac::{Hmac, Mac};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::PathBuf;
use std::str::FromStr;
use std::sync::{Arc, OnceLock};
use tokio::net::TcpListener;
use tokio::sync::Mutex;

type HmacSha256 = Hmac<Sha256>;
type SharedInvoiceService = Arc<Mutex<cascade_core::invoice::InvoiceService>>;

#[derive(Clone)]
struct ProductTestContext {
    url: String,
    invoice_service: SharedInvoiceService,
    fx_service: Arc<cascade_api::fx::FxQuoteService>,
    market_manager: Arc<cascade_core::MarketManager>,
    mint: Arc<cdk::mint::Mint>,
    cascade_db: Arc<cascade_core::db::CascadeDatabase>,
}

const TEST_USD_DENOMINATIONS: &[u64] = &[
    1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192,
];
const TEST_MARKET_DENOMINATIONS: &[u64] = &[
    1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072,
    262144, 524288, 1048576,
];
static TEST_INVOICE_SERVICES: OnceLock<Mutex<HashMap<String, SharedInvoiceService>>> =
    OnceLock::new();

#[derive(Debug)]
struct TestQuoteSource {
    id: &'static str,
    price: f64,
    observed_at: i64,
}

#[async_trait]
impl cascade_api::fx::QuoteSource for TestQuoteSource {
    fn id(&self) -> &'static str {
        self.id
    }

    async fn fetch_observation(
        &self,
        _client: &reqwest::Client,
    ) -> Result<cascade_core::product::FxQuoteObservation, String> {
        Ok(cascade_core::product::FxQuoteObservation {
            source: self.id.to_string(),
            btc_usd_price: self.price,
            observed_at: self.observed_at,
        })
    }
}

fn test_invoice_services() -> &'static Mutex<HashMap<String, SharedInvoiceService>> {
    TEST_INVOICE_SERVICES.get_or_init(|| Mutex::new(HashMap::new()))
}

async fn register_test_invoice_service(url: &str, invoice_service: SharedInvoiceService) {
    test_invoice_services()
        .lock()
        .await
        .insert(url.to_string(), invoice_service);
}

async fn lookup_test_invoice_service(url: &str) -> Option<SharedInvoiceService> {
    test_invoice_services().lock().await.get(url).cloned()
}

fn test_fx_service() -> Arc<cascade_api::fx::FxQuoteService> {
    let now = chrono::Utc::now().timestamp();
    Arc::new(
        cascade_api::fx::FxQuoteService::with_sources(
            vec![
                Arc::new(TestQuoteSource {
                    id: "test-a",
                    price: 49_900.0,
                    observed_at: now,
                }),
                Arc::new(TestQuoteSource {
                    id: "test-b",
                    price: 50_000.0,
                    observed_at: now,
                }),
                Arc::new(TestQuoteSource {
                    id: "test-c",
                    price: 50_100.0,
                    observed_at: now,
                }),
            ],
            cascade_api::fx::FxQuotePolicy {
                quote_ttl_seconds: 900,
                max_provider_spread_bps: 500,
                max_observation_age_seconds: 60,
                min_provider_count: 2,
                usd_to_msat_spread_bps: 100,
                msat_to_usd_spread_bps: 100,
            },
        )
        .unwrap(),
    )
}

/// Test helper to create a test server
async fn create_test_server() -> String {
    // Create a simple router for basic endpoint testing
    let app = Router::new()
        .route("/health", axum::routing::get(|| async { "OK" }))
        .route("/v1/info", axum::routing::get(|| async { 
            r#"{"name":"Cascade Test Mint","version":"0.1.0","description":"Test mint for integration tests"}"#
        }))
        .route("/evt123/v1/keys", axum::routing::get(|| async {
            r#"{"market_id":"evt123","long_keyset":{"id":"long-keyset","unit":"LONG_test-market","outcome":"long","keys":{"1":{"pubkey":"02aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}}},"short_keyset":{"id":"short-keyset","unit":"SHORT_test-market","outcome":"short","keys":{"1":{"pubkey":"03bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}}}}"#
        }));

    // Bind to a random available port
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let url = format!("http://{}", addr);

    // Spawn the server
    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    // Give the server a moment to start
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    url
}

async fn create_product_test_server() -> String {
    create_product_test_server_with_funding(None, None, "signet").await
}

async fn create_product_test_server_with_stripe(
    stripe_config: Option<cascade_api::stripe::StripeConfig>,
) -> String {
    create_product_test_server_with_funding(stripe_config, None, "signet").await
}

async fn create_product_test_server_with_usdc(
    usdc_config: Option<cascade_api::usdc::UsdcConfig>,
    network_type: &'static str,
) -> String {
    create_product_test_server_with_funding(None, usdc_config, network_type).await
}

async fn create_product_test_server_with_usdc_bundle(
    usdc_config: Option<cascade_api::usdc::UsdcConfig>,
    network_type: &'static str,
) -> (String, Arc<Mutex<cascade_core::invoice::InvoiceService>>) {
    create_product_test_server_bundle_with_funding(None, usdc_config, network_type).await
}

async fn create_product_test_server_with_funding(
    stripe_config: Option<cascade_api::stripe::StripeConfig>,
    usdc_config: Option<cascade_api::usdc::UsdcConfig>,
    network_type: &'static str,
) -> String {
    create_product_test_server_bundle_with_funding(stripe_config, usdc_config, network_type)
        .await
        .0
}

async fn create_product_test_server_bundle_with_funding(
    stripe_config: Option<cascade_api::stripe::StripeConfig>,
    usdc_config: Option<cascade_api::usdc::UsdcConfig>,
    network_type: &'static str,
) -> (String, Arc<Mutex<cascade_core::invoice::InvoiceService>>) {
    let context =
        create_product_test_context_with_funding(stripe_config, usdc_config, network_type).await;
    (context.url, context.invoice_service)
}

async fn create_product_test_server_bundle_with_invoice_service(
    stripe_config: Option<cascade_api::stripe::StripeConfig>,
    usdc_config: Option<cascade_api::usdc::UsdcConfig>,
    network_type: &'static str,
    invoice_service: SharedInvoiceService,
) -> (String, SharedInvoiceService) {
    let context = create_product_test_context_with_invoice_service(
        stripe_config,
        usdc_config,
        network_type,
        invoice_service,
    )
    .await;
    (context.url, context.invoice_service)
}

async fn create_product_test_context_with_funding(
    stripe_config: Option<cascade_api::stripe::StripeConfig>,
    usdc_config: Option<cascade_api::usdc::UsdcConfig>,
    network_type: &'static str,
) -> ProductTestContext {
    let cdk_db = Arc::new(cdk_sqlite::mint::memory::empty().await.unwrap());
    let mut builder = MintBuilder::new(cdk_db.clone());
    builder
        .configure_unit(
            CurrencyUnit::Sat,
            UnitConfig {
                amounts: vec![1, 2, 4, 8, 16, 32, 64, 128],
                input_fee_ppk: 0,
            },
        )
        .unwrap();
    builder
        .configure_unit(
            CurrencyUnit::Usd,
            UnitConfig {
                amounts: vec![
                    1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192,
                ],
                input_fee_ppk: 0,
            },
        )
        .unwrap();

    let lnd_config = cascade_core::LndConfig {
        host: "127.0.0.1:10009".to_string(),
        cert_path: None,
        macaroon_path: None,
        tls_domain: None,
        network: Some(network_type.to_string()),
        cli_path: None,
    };
    let mut lnd_client = cascade_core::lightning::lnd_client::LndClient::new(lnd_config.clone());
    lnd_client.connect().await.unwrap();
    let invoice_service = Arc::new(Mutex::new(cascade_core::invoice::InvoiceService::new(
        lnd_client, 3600, 40,
    )));
    create_product_test_context_with_invoice_service(
        stripe_config,
        usdc_config,
        network_type,
        invoice_service,
    )
    .await
}

async fn create_product_test_context_with_invoice_service(
    stripe_config: Option<cascade_api::stripe::StripeConfig>,
    usdc_config: Option<cascade_api::usdc::UsdcConfig>,
    network_type: &'static str,
    invoice_service: SharedInvoiceService,
) -> ProductTestContext {
    let cdk_db = Arc::new(cdk_sqlite::mint::memory::empty().await.unwrap());
    let mut builder = MintBuilder::new(cdk_db.clone());
    builder
        .configure_unit(
            CurrencyUnit::Sat,
            UnitConfig {
                amounts: vec![1, 2, 4, 8, 16, 32, 64, 128],
                input_fee_ppk: 0,
            },
        )
        .unwrap();
    builder
        .configure_unit(
            CurrencyUnit::Usd,
            UnitConfig {
                amounts: vec![
                    1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192,
                ],
                input_fee_ppk: 0,
            },
        )
        .unwrap();

    let fx_service = test_fx_service();
    builder
        .add_payment_processor(
            CurrencyUnit::Usd,
            PaymentMethod::Known(KnownMethod::Bolt11),
            MintMeltLimits::new(1, 100_000_000),
            Arc::new(cascade_api::payment::UsdBolt11PaymentProcessor::new(
                invoice_service.clone(),
                fx_service.clone(),
                cdk_db.clone(),
                network_type == "signet",
            )),
        )
        .await
        .unwrap();

    let seed = [7_u8; 32];
    let advertised_mint_info = builder.current_mint_info();
    let mint = Arc::new(
        builder
            .build_with_seed(cdk_db.clone(), &seed)
            .await
            .unwrap(),
    );
    mint.set_mint_info(advertised_mint_info).await.unwrap();
    let cascade_db = Arc::new(
        cascade_core::db::CascadeDatabase::connect("sqlite::memory:")
            .await
            .unwrap(),
    );
    cascade_db.run_migrations().await.unwrap();
    let market_manager = Arc::new(cascade_core::MarketManager::new(
        cascade_core::LmsrEngine::new(10.0).unwrap(),
    ));

    let app = cascade_api::build_server(
        market_manager.clone(),
        invoice_service.clone(),
        fx_service.clone(),
        stripe_config,
        usdc_config,
        mint.clone(),
        cascade_db.clone(),
        network_type,
        "http://127.0.0.1:0",
    )
    .await
    .unwrap();

    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let url = format!("http://{}", addr);
    register_test_invoice_service(&url, invoice_service.clone()).await;

    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    ProductTestContext {
        url,
        invoice_service,
        fx_service,
        market_manager,
        mint,
        cascade_db,
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

async fn create_cli_invoice_service_requiring_internal_settlement(
    network_type: &'static str,
) -> SharedInvoiceService {
    let script_dir = make_fake_lncli_path("cascade-fake-lncli");
    fs::create_dir_all(&script_dir).unwrap();

    let script_path = script_dir.join("lncli");
    fs::write(
        &script_path,
        r#"#!/usr/bin/env python3
import hashlib
import json
import sys
import time

command = None
for arg in sys.argv[1:]:
    if arg in {"getinfo", "addinvoice", "lookupinvoice", "payinvoice"}:
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

if command == "lookupinvoice":
    payment_hash = ""
    for arg in sys.argv[1:]:
        if arg.startswith("--rhash="):
            payment_hash = arg.split("=", 1)[1]
            break
    print(json.dumps({
        "memo": "fake invoice",
        "r_hash": payment_hash,
        "value_msat": "2500000",
        "creation_date": str(int(time.time())),
        "expiry": "3600",
        "payment_request": f"lnsb1internal{payment_hash[:16]}",
        "cltv_expiry": "40",
        "settled": False,
        "state": "OPEN"
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
        network: Some(network_type.to_string()),
        cli_path: Some(script_path.display().to_string()),
    };
    let mut lnd_client = cascade_core::lightning::lnd_client::LndClient::new(lnd_config);
    lnd_client.connect().await.unwrap();

    Arc::new(Mutex::new(cascade_core::invoice::InvoiceService::new(
        lnd_client, 3600, 40,
    )))
}

async fn create_mock_stripe_server() -> String {
    create_mock_stripe_server_with_risk_level("normal").await
}

async fn create_mock_stripe_server_with_risk_level(risk_level: &'static str) -> String {
    let app = Router::new()
        .route(
            "/v1/checkout/sessions",
            axum::routing::post(|| async move {
                let expires_at = chrono::Utc::now().timestamp() + 1800;
                axum::Json(serde_json::json!({
                    "id": "cs_test_cascade",
                    "url": "https://checkout.stripe.test/cs_test_cascade",
                    "expires_at": expires_at
                }))
            }),
        )
        .route(
            "/v1/payment_intents/{id}",
            axum::routing::get(
                move |axum::extract::Path(id): axum::extract::Path<String>| async move {
                    axum::Json(serde_json::json!({
                        "id": id,
                        "latest_charge": {
                            "outcome": {
                                "risk_level": risk_level
                            }
                        }
                    }))
                },
            ),
        );

    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let url = format!("http://{}", addr);

    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    url
}

fn stripe_signature(secret: &str, body: &str, timestamp: i64) -> String {
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).unwrap();
    mac.update(format!("{timestamp}.{body}").as_bytes());
    let signature = hex::encode(mac.finalize().into_bytes());
    format!("t={timestamp},v1={signature}")
}

fn sample_market_event(event_id: &str, slug: &str, pubkey: &str) -> serde_json::Value {
    sample_market_event_with_metadata(
        event_id,
        slug,
        pubkey,
        "Test Market",
        "A market created in tests.",
        &[],
    )
}

fn sample_market_event_with_metadata(
    event_id: &str,
    slug: &str,
    pubkey: &str,
    title: &str,
    description: &str,
    extra_tags: &[Value],
) -> serde_json::Value {
    let mut tags = vec![
        json!(["d", slug]),
        json!(["title", title]),
        json!(["description", description]),
        json!(["status", "open"]),
    ];
    tags.extend(extra_tags.iter().cloned());

    serde_json::json!({
        "id": event_id,
        "pubkey": pubkey,
        "created_at": 1_712_800_000_i64,
        "kind": 982,
        "content": "A signed market body for tests.",
        "sig": "00",
        "tags": tags
    })
}

fn secret_key_from_byte(byte: u8) -> SecretKey {
    SecretKey::from_slice(&[byte; 32]).unwrap()
}

fn pubkey_from_secret_key(secret_key: &SecretKey) -> String {
    let secp = Secp256k1::new();
    let keypair = Keypair::from_secret_key(&secp, secret_key);
    XOnlyPublicKey::from_keypair(&keypair).0.to_string()
}

fn nip98_authorization_header(secret_key: &SecretKey, method: &Method, url: &str) -> String {
    let secp = Secp256k1::new();
    let keypair = Keypair::from_secret_key(&secp, secret_key);
    let pubkey = XOnlyPublicKey::from_keypair(&keypair).0.to_string();
    let created_at = chrono::Utc::now().timestamp();
    let tags = vec![
        vec!["u".to_string(), url.to_string()],
        vec!["method".to_string(), method.as_str().to_string()],
    ];
    let serialized =
        serde_json::to_string(&json!([0, pubkey, created_at, 27_235, tags, ""])).unwrap();
    let event_id = hex::encode(Sha256::digest(serialized.as_bytes()));
    let digest = hex::decode(&event_id).unwrap();
    let message = Message::from_digest_slice(&digest).unwrap();
    let signature = secp
        .sign_schnorr_no_aux_rand(&message, &keypair)
        .to_string();
    let auth_event = json!({
        "id": event_id,
        "pubkey": pubkey,
        "created_at": created_at,
        "kind": 27_235,
        "tags": tags,
        "content": "",
        "sig": signature,
    });

    format!(
        "Nostr {}",
        BASE64_STANDARD.encode(serde_json::to_vec(&auth_event).unwrap())
    )
}

async fn create_wallet_funding_and_get_proofs(
    client: &reqwest::Client,
    url: &str,
    pubkey: &str,
    amount_minor: u64,
) -> serde_json::Value {
    create_wallet_funding_and_get_proofs_with_invoice_service(
        client,
        url,
        pubkey,
        amount_minor,
        None,
    )
    .await
}

async fn create_wallet_funding_and_get_proofs_with_invoice_service(
    client: &reqwest::Client,
    url: &str,
    pubkey: &str,
    amount_minor: u64,
    invoice_service: Option<&SharedInvoiceService>,
) -> serde_json::Value {
    let quote_response = client
        .post(format!("{url}/v1/mint/quote/bolt11"))
        .json(&serde_json::json!({
            "pubkey": pubkey,
            "amount": amount_minor,
            "unit": "usd"
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(quote_response.status(), 200);
    let quote_payload: serde_json::Value = quote_response.json().await.unwrap();
    let quote_id = quote_payload["quote"].as_str().unwrap();

    let invoice_service = match invoice_service {
        Some(invoice_service) => Some(invoice_service.clone()),
        None => lookup_test_invoice_service(url).await,
    };
    if let (Some(invoice_service), Some(invoice)) =
        (invoice_service, quote_payload["request"].as_str())
    {
        invoice_service
            .lock()
            .await
            .pay_invoice(invoice)
            .await
            .unwrap();
    }

    let paid_quote = wait_for_mint_quote_state(client, url, quote_id, &["PAID"]).await;
    mint_funding_quote_and_get_proofs(client, url, &paid_quote, amount_minor).await
}

async fn create_signet_funding_and_get_proofs(
    client: &reqwest::Client,
    url: &str,
    pubkey: &str,
    amount_minor: u64,
) -> serde_json::Value {
    create_wallet_funding_and_get_proofs(client, url, pubkey, amount_minor).await
}

async fn fetch_active_usd_keyset(client: &reqwest::Client, url: &str) -> KeySet {
    let response = client.get(format!("{url}/v1/keys")).send().await.unwrap();
    assert_eq!(response.status(), 200);

    let payload: KeysResponse = response.json().await.unwrap();
    payload
        .keysets
        .into_iter()
        .find(|keyset| keyset.unit == CurrencyUnit::Usd && keyset.active.unwrap_or(false))
        .expect("active usd keyset")
}

async fn fetch_market_keyset(
    client: &reqwest::Client,
    url: &str,
    event_id: &str,
    side: &str,
) -> KeySet {
    let response = client
        .get(format!("{url}/{event_id}/v1/keys"))
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), 200);
    let payload: Value = response.json().await.unwrap();
    let payload = payload.get("Ok").cloned().unwrap_or(payload);
    let keyset = match side.to_ascii_lowercase().as_str() {
        "long" => payload["long_keyset"].clone(),
        "short" => payload["short_keyset"].clone(),
        other => panic!("unsupported side {other}; expected long or short"),
    };

    let id = keyset["id"].as_str().unwrap();
    let unit = keyset["unit"].as_str().unwrap();
    let keys = keyset["keys"]
        .as_object()
        .unwrap()
        .iter()
        .map(|(amount, public_key)| {
            (
                amount.clone(),
                Value::String(public_key["pubkey"].as_str().unwrap().to_string()),
            )
        })
        .collect::<serde_json::Map<String, Value>>();

    serde_json::from_value(json!({
        "id": id,
        "unit": unit,
        "active": true,
        "keys": keys
    }))
    .unwrap()
}

fn prepare_outputs(keyset: &KeySet, amount: u64, denominations: &[u64]) -> (Value, PreMintSecrets) {
    let pre_mint = PreMintSecrets::random(
        keyset.id,
        Amount::from(amount),
        &SplitTarget::default(),
        &FeeAndAmounts::from((0, denominations.to_vec())),
    )
    .unwrap();

    (
        serde_json::to_value(pre_mint.blinded_messages()).unwrap(),
        pre_mint,
    )
}

fn proofs_from_signatures(
    signatures: &Value,
    pre_mint: &PreMintSecrets,
    keyset: &KeySet,
) -> Vec<Proof> {
    let signatures: Vec<BlindSignature> = serde_json::from_value(signatures.clone()).unwrap();
    construct_proofs(signatures, pre_mint.rs(), pre_mint.secrets(), &keyset.keys).unwrap()
}

fn proof_amount_total(proofs: &[Proof]) -> u64 {
    proofs.iter().map(|proof| proof.amount.to_u64()).sum()
}

async fn create_public_market_with_seed(
    client: &reqwest::Client,
    url: &str,
    creator: &str,
    event_id: &str,
    slug: &str,
    title: &str,
    description: &str,
    raw_event: Value,
    spend_minor: u64,
) -> serde_json::Value {
    let create_response = client
        .post(format!("{url}/api/product/markets"))
        .json(&json!({
            "event_id": event_id,
            "title": title,
            "description": description,
            "slug": slug,
            "body": format!("{title} body"),
            "creator_pubkey": creator,
            "raw_event": raw_event,
            "b": 10.0
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(create_response.status(), 201);

    let funding_proofs: Vec<Proof> = serde_json::from_value(
        create_signet_funding_and_get_proofs(client, url, creator, 10_000).await,
    )
    .unwrap();
    let usd_keyset = fetch_active_usd_keyset(client, url).await;
    let market_keyset = fetch_market_keyset(client, url, event_id, "long").await;

    let quote_response = client
        .post(format!("{url}/api/trades/quote"))
        .json(&json!({
            "event_id": event_id,
            "side": "long",
            "spend_minor": spend_minor
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(quote_response.status(), 200);
    let quote_payload: serde_json::Value = quote_response.json().await.unwrap();

    let (issued_outputs, _) = prepare_outputs(
        &market_keyset,
        quote_payload["quantity_minor"].as_u64().unwrap(),
        TEST_MARKET_DENOMINATIONS,
    );
    let change_minor = proof_amount_total(&funding_proofs).saturating_sub(spend_minor);
    let change_outputs = if change_minor > 0 {
        prepare_outputs(&usd_keyset, change_minor, TEST_USD_DENOMINATIONS).0
    } else {
        json!([])
    };

    let buy_response = client
        .post(format!("{url}/api/trades/buy"))
        .json(&json!({
            "event_id": event_id,
            "pubkey": creator,
            "side": "long",
            "spend_minor": spend_minor,
            "proofs": funding_proofs,
            "issued_outputs": issued_outputs,
            "change_outputs": change_outputs
        }))
        .send()
        .await
        .unwrap();
    let buy_status = buy_response.status();
    let buy_payload: serde_json::Value = buy_response.json().await.unwrap();
    assert_eq!(buy_status, 201, "buy payload: {buy_payload}");
    assert_eq!(buy_payload["market"]["visibility"].as_str(), Some("public"));

    buy_payload
}

async fn wait_for_mint_quote_state_for_method(
    client: &reqwest::Client,
    url: &str,
    method: &str,
    quote_id: &str,
    expected_states: &[&str],
) -> serde_json::Value {
    let mut last_payload = serde_json::Value::Null;
    for _ in 0..50 {
        let response = client
            .get(format!("{url}/v1/mint/quote/{method}/{quote_id}"))
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), 200);
        let payload: serde_json::Value = response.json().await.unwrap();
        last_payload = payload.clone();
        if expected_states.contains(&payload["state"].as_str().unwrap_or_default()) {
            return payload;
        }
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    }

    panic!(
        "mint quote {quote_id} did not reach expected state in time; last payload: {last_payload}"
    );
}

async fn wait_for_mint_quote_state(
    client: &reqwest::Client,
    url: &str,
    quote_id: &str,
    expected_states: &[&str],
) -> serde_json::Value {
    wait_for_mint_quote_state_for_method(client, url, "bolt11", quote_id, expected_states).await
}

async fn wait_for_melt_quote_state(
    client: &reqwest::Client,
    url: &str,
    quote_id: &str,
    expected_states: &[&str],
) -> serde_json::Value {
    let mut last_payload = serde_json::Value::Null;
    for _ in 0..50 {
        let response = client
            .get(format!("{url}/v1/melt/quote/bolt11/{quote_id}"))
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), 200);
        let payload: serde_json::Value = response.json().await.unwrap();
        last_payload = payload.clone();
        if expected_states.contains(&payload["state"].as_str().unwrap_or_default()) {
            return payload;
        }
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    }

    panic!(
        "melt quote {quote_id} did not reach expected state in time; last payload: {last_payload}"
    );
}

async fn mint_funding_quote_and_get_proofs_for_method(
    client: &reqwest::Client,
    url: &str,
    method: &str,
    quote_payload: &serde_json::Value,
    amount_minor: u64,
) -> serde_json::Value {
    let keyset = fetch_active_usd_keyset(client, url).await;
    let pre_mint = PreMintSecrets::random(
        keyset.id,
        Amount::from(amount_minor),
        &SplitTarget::default(),
        &FeeAndAmounts::from((0, TEST_USD_DENOMINATIONS.to_vec())),
    )
    .unwrap();

    let outputs = serde_json::to_value(pre_mint.blinded_messages()).unwrap();
    let mint_response = client
        .post(format!("{url}/v1/mint/{method}"))
        .json(&serde_json::json!({
            "quote": quote_payload["quote"].as_str().unwrap(),
            "outputs": outputs
        }))
        .send()
        .await
        .unwrap();
    let mint_status = mint_response.status();
    let mint_payload: serde_json::Value = mint_response.json().await.unwrap();
    assert_eq!(mint_status, 200, "mint payload: {mint_payload}");
    let signatures: Vec<BlindSignature> =
        serde_json::from_value(mint_payload["signatures"].clone()).unwrap();
    let proofs =
        construct_proofs(signatures, pre_mint.rs(), pre_mint.secrets(), &keyset.keys).unwrap();
    serde_json::to_value(proofs).unwrap()
}

async fn mint_funding_quote_and_get_proofs(
    client: &reqwest::Client,
    url: &str,
    quote_payload: &serde_json::Value,
    amount_minor: u64,
) -> serde_json::Value {
    mint_funding_quote_and_get_proofs_for_method(client, url, "bolt11", quote_payload, amount_minor)
        .await
}

/// Test that the health endpoint returns OK
#[tokio::test]
async fn test_health_endpoint() {
    let url = create_test_server().await;

    let client = reqwest::Client::new();
    let response = client
        .get(&format!("{}/health", url))
        .send()
        .await
        .expect("Failed to make request");

    assert_eq!(response.status(), 200, "Health endpoint should return 200");

    let body = response.text().await.expect("Failed to read body");
    assert_eq!(body, "OK", "Health endpoint should return OK");
}

/// Test that the mint info endpoint returns valid JSON
#[tokio::test]
async fn test_mint_info_endpoint() {
    let url = create_test_server().await;

    let client = reqwest::Client::new();
    let response = client
        .get(&format!("{}/v1/info", url))
        .send()
        .await
        .expect("Failed to make request");

    assert_eq!(
        response.status(),
        200,
        "Mint info endpoint should return 200"
    );

    let body = response.text().await.expect("Failed to read body");

    // Verify it's valid JSON with expected fields
    let json: serde_json::Value =
        serde_json::from_str(&body).expect("Response should be valid JSON");

    assert!(
        json.get("name").is_some(),
        "Response should contain 'name' field"
    );
    assert!(
        json.get("version").is_some(),
        "Response should contain 'version' field"
    );
}

/// Test that the keys endpoint returns valid JSON
#[tokio::test]
async fn test_keys_endpoint() {
    let url = create_test_server().await;

    let client = reqwest::Client::new();
    let response = client
        .get(&format!("{}/evt123/v1/keys", url))
        .send()
        .await
        .expect("Failed to make request");

    assert_eq!(response.status(), 200, "Keys endpoint should return 200");

    let body = response.text().await.expect("Failed to read body");

    // Verify it's valid JSON
    let json: serde_json::Value =
        serde_json::from_str(&body).expect("Response should be valid JSON");

    assert_eq!(
        json.get("market_id").and_then(|value| value.as_str()),
        Some("evt123")
    );
    assert!(
        json.get("long_keyset").is_some(),
        "Response should contain 'long_keyset' field"
    );
    assert!(
        json.get("short_keyset").is_some(),
        "Response should contain 'short_keyset' field"
    );
}

/// Test that 404 is returned for unknown routes
#[tokio::test]
async fn test_unknown_route_returns_404() {
    let url = create_test_server().await;

    let client = reqwest::Client::new();
    let response = client
        .get(&format!("{}/nonexistent", url))
        .send()
        .await
        .expect("Failed to make request");

    assert_eq!(response.status(), 404, "Unknown routes should return 404");
}

/// Test cascade-specific routes exist
#[tokio::test]
async fn test_cascade_routes_exist() {
    // Create a test server with cascade-style routes
    let app = Router::new()
        .route(
            "/api/price/{currency}",
            axum::routing::get(|| async { r#"{"usd":50000.0,"btc":1.0}"# }),
        )
        .route(
            "/api/market/create",
            axum::routing::post(|| async {
                r#"{"id":"test-market","slug":"test-market","status":"active"}"#
            }),
        )
        .route(
            "/api/market/{id}",
            axum::routing::get(|| async {
                r#"{"id":"test-market","title":"Test Market","status":"active"}"#
            }),
        )
        .route("/health", axum::routing::get(|| async { "OK" }));

    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let url = format!("http://{}", addr);

    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    let client = reqwest::Client::new();

    // Test price endpoint
    let response = client
        .get(&format!("{}/api/price/btc", url))
        .send()
        .await
        .expect("Failed to make request");
    assert_eq!(response.status(), 200, "Price endpoint should return 200");

    // Test market create endpoint
    let response = client
        .post(&format!("{}/api/market/create", url))
        .json(&serde_json::json!({
            "event_id": "evt123",
            "slug": "test-market",
            "title": "Test Market",
            "description": "Test description",
            "b": 10.0
        }))
        .send()
        .await
        .expect("Failed to make request");
    assert_eq!(
        response.status(),
        200,
        "Market create endpoint should return 200"
    );

    // Test market get endpoint
    let response = client
        .get(&format!("{}/api/market/test-market", url))
        .send()
        .await
        .expect("Failed to make request");
    assert_eq!(
        response.status(),
        200,
        "Market get endpoint should return 200"
    );
}

/// Test that invalid JSON in request body returns error
#[tokio::test]
async fn test_invalid_json_returns_error() {
    let app = Router::new().route(
        "/api/market/create",
        axum::routing::post(
            |axum::extract::Json(payload): axum::extract::Json<serde_json::Value>| async move {
                format!("Received: {:?}", payload)
            },
        ),
    );

    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let url = format!("http://{}", addr);

    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    let client = reqwest::Client::new();

    // Send invalid JSON
    let response = client
        .post(&format!("{}/api/market/create", url))
        .header("Content-Type", "application/json")
        .body("not valid json {{{")
        .send()
        .await
        .expect("Failed to make request");

    // Should return a client error (4xx) for malformed JSON
    assert!(
        response.status().is_client_error(),
        "Invalid JSON should return client error, got: {}",
        response.status()
    );
}

/// Test concurrent requests are handled correctly
#[tokio::test]
async fn test_concurrent_requests() {
    let app = Router::new().route("/health", axum::routing::get(|| async { "OK" }));

    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let url = format!("http://{}", addr);

    let app_for_server = app.clone();
    tokio::spawn(async move {
        axum::serve(listener, app_for_server).await.unwrap();
    });

    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    let url_clone = url.clone();

    // Make 10 concurrent requests
    let handles: Vec<_> = (0..10)
        .map(|_| {
            let url = url_clone.clone();
            tokio::spawn(async move {
                let client = reqwest::Client::new();
                client
                    .get(&format!("{}/health", url))
                    .send()
                    .await
                    .expect("Failed to make request")
            })
        })
        .collect();

    // Wait for all requests to complete
    let mut success_count = 0;
    for handle in handles {
        let response = handle.await.expect("Task failed");
        if response.status() == 200 {
            success_count += 1;
        }
    }

    // All requests should succeed
    assert_eq!(
        success_count, 10,
        "All 10 concurrent requests should succeed"
    );
}

/// Test that Content-Type is correctly set in responses
#[tokio::test]
async fn test_content_type_header() {
    let app = Router::new().route(
        "/v1/info",
        axum::routing::get(|| async {
            (
                [("Content-Type", "application/json")],
                r#"{"name":"Test Mint"}"#,
            )
        }),
    );

    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let url = format!("http://{}", addr);

    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    let client = reqwest::Client::new();
    let response = client
        .get(&format!("{}/v1/info", url))
        .send()
        .await
        .expect("Failed to make request");

    assert_eq!(response.status(), 200);

    let content_type = response
        .headers()
        .get("Content-Type")
        .expect("Content-Type header should be present");

    assert!(
        content_type.to_str().unwrap().contains("application/json"),
        "Content-Type should be application/json"
    );
}

#[tokio::test]
async fn test_pending_market_stays_private_until_first_trade() {
    let url = create_product_test_server().await;
    let client = reqwest::Client::new();
    let creator_secret = secret_key_from_byte(1);
    let creator = pubkey_from_secret_key(&creator_secret);
    let viewer_secret = secret_key_from_byte(2);
    let event_id = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    let slug = "pending-market";

    let create_response = client
        .post(format!("{url}/api/product/markets"))
        .json(&serde_json::json!({
            "event_id": event_id,
            "title": "Pending Market",
            "description": "Not public yet",
            "slug": slug,
            "body": "Pending body",
            "creator_pubkey": creator,
            "raw_event": sample_market_event(event_id, slug, &creator),
            "b": 10.0
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(create_response.status(), 201);
    let created: serde_json::Value = create_response.json().await.unwrap();
    assert_eq!(
        created.get("visibility").and_then(|value| value.as_str()),
        Some("pending")
    );

    let feed_response = client
        .get(format!("{url}/api/product/feed"))
        .send()
        .await
        .unwrap();
    assert_eq!(feed_response.status(), 200);
    let feed_payload: serde_json::Value = feed_response.json().await.unwrap();
    assert_eq!(
        feed_payload["markets"].as_array().map(|items| items.len()),
        Some(0)
    );

    let pending_detail_url = format!("{url}/api/product/markets/{event_id}/pending/{creator}");
    let pending_detail_response = client
        .get(&pending_detail_url)
        .header(
            "authorization",
            nip98_authorization_header(&creator_secret, &Method::GET, &pending_detail_url),
        )
        .send()
        .await
        .unwrap();
    assert_eq!(pending_detail_response.status(), 200);
    let pending_detail_payload: serde_json::Value = pending_detail_response.json().await.unwrap();
    assert_eq!(
        pending_detail_payload["market"]["visibility"].as_str(),
        Some("pending")
    );
    assert_eq!(
        pending_detail_payload["trades"]
            .as_array()
            .map(|items| items.len()),
        Some(0)
    );

    let forbidden_pending_detail_response = client
        .get(&pending_detail_url)
        .header(
            "authorization",
            nip98_authorization_header(&viewer_secret, &Method::GET, &pending_detail_url),
        )
        .send()
        .await
        .unwrap();
    assert_eq!(forbidden_pending_detail_response.status(), 401);

    let anonymous_pending_detail_response = client.get(&pending_detail_url).send().await.unwrap();
    assert_eq!(anonymous_pending_detail_response.status(), 401);
}

#[tokio::test]
async fn test_product_read_models_support_pagination_search_and_activity_without_pending_leaks() {
    let url = create_product_test_server().await;
    let client = reqwest::Client::new();
    let macro_creator = "1111111111111111111111111111111111111111111111111111111111111111";
    let ai_creator = "2222222222222222222222222222222222222222222222222222222222222222";
    let pending_creator = "3333333333333333333333333333333333333333333333333333333333333333";

    create_public_market_with_seed(
        &client,
        &url,
        macro_creator,
        "4444444444444444444444444444444444444444444444444444444444444444",
        "macro-shock",
        "Macro Shock",
        "Macro market",
        sample_market_event_with_metadata(
            "4444444444444444444444444444444444444444444444444444444444444444",
            "macro-shock",
            macro_creator,
            "Macro Shock",
            "Macro market",
            &[json!(["t", "macro"]), json!(["c", "economy"])],
        ),
        4_000,
    )
    .await;

    create_public_market_with_seed(
        &client,
        &url,
        ai_creator,
        "5555555555555555555555555555555555555555555555555555555555555555",
        "ai-chip-cycle",
        "AI Chip Cycle",
        "AI market",
        sample_market_event_with_metadata(
            "5555555555555555555555555555555555555555555555555555555555555555",
            "ai-chip-cycle",
            ai_creator,
            "AI Chip Cycle",
            "AI market",
            &[json!(["t", "ai"]), json!(["c", "chips"])],
        ),
        4_500,
    )
    .await;

    let pending_event_id = "6666666666666666666666666666666666666666666666666666666666666666";
    let pending_slug = "hidden-pending";
    let pending_create_response = client
        .post(format!("{url}/api/product/markets"))
        .json(&json!({
            "event_id": pending_event_id,
            "title": "Hidden Pending",
            "description": "Should stay private",
            "slug": pending_slug,
            "body": "pending",
            "creator_pubkey": pending_creator,
            "raw_event": sample_market_event_with_metadata(
                pending_event_id,
                pending_slug,
                pending_creator,
                "Hidden Pending",
                "Should stay private",
                &[json!(["t", "macro"])]
            ),
            "b": 10.0
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(pending_create_response.status(), 201);

    let feed_response = client
        .get(format!(
            "{url}/api/product/feed?market_limit=1&market_offset=0&trade_limit=1&trade_offset=0"
        ))
        .send()
        .await
        .unwrap();
    assert_eq!(feed_response.status(), 200);
    let feed_payload: serde_json::Value = feed_response.json().await.unwrap();
    assert_eq!(
        feed_payload["markets"].as_array().map(|items| items.len()),
        Some(1)
    );
    assert_eq!(
        feed_payload["trades"].as_array().map(|items| items.len()),
        Some(1)
    );
    assert_eq!(feed_payload["next_market_offset"].as_u64(), Some(1));
    assert_eq!(feed_payload["next_trade_offset"].as_u64(), Some(1));

    let search_response = client
        .get(format!("{url}/api/product/markets/search?q=macro&limit=10"))
        .send()
        .await
        .unwrap();
    assert_eq!(search_response.status(), 200);
    let search_payload: serde_json::Value = search_response.json().await.unwrap();
    assert_eq!(
        search_payload["markets"]
            .as_array()
            .map(|items| items.len()),
        Some(1)
    );
    assert_eq!(
        search_payload["markets"][0]["slug"].as_str(),
        Some("macro-shock")
    );

    let hidden_search_response = client
        .get(format!(
            "{url}/api/product/markets/search?q=hidden&limit=10"
        ))
        .send()
        .await
        .unwrap();
    assert_eq!(hidden_search_response.status(), 200);
    let hidden_search_payload: serde_json::Value = hidden_search_response.json().await.unwrap();
    assert_eq!(
        hidden_search_payload["markets"]
            .as_array()
            .map(|items| items.len()),
        Some(0)
    );

    let activity_response = client
        .get(format!("{url}/api/product/activity?limit=2&offset=0"))
        .send()
        .await
        .unwrap();
    assert_eq!(activity_response.status(), 200);
    let activity_payload: serde_json::Value = activity_response.json().await.unwrap();
    assert_eq!(
        activity_payload["items"]
            .as_array()
            .map(|items| items.len()),
        Some(2)
    );
    assert_eq!(activity_payload["next_offset"].as_u64(), Some(2));
    assert!(activity_payload["items"]
        .as_array()
        .unwrap()
        .iter()
        .all(|item| item["market"]["event_id"].as_str() != Some(pending_event_id)));

    let activity_page_two_response = client
        .get(format!("{url}/api/product/activity?limit=2&offset=2"))
        .send()
        .await
        .unwrap();
    assert_eq!(activity_page_two_response.status(), 200);
    let activity_page_two_payload: serde_json::Value =
        activity_page_two_response.json().await.unwrap();
    assert_eq!(
        activity_page_two_payload["items"]
            .as_array()
            .map(|items| items.len()),
        Some(2)
    );
}

#[tokio::test]
async fn test_paper_wallet_buy_and_sell_flow() {
    let url = create_product_test_server().await;
    let client = reqwest::Client::new();
    let creator = "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
    let event_id = "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";
    let slug = "paper-flow-market";

    client
        .post(format!("{url}/api/product/markets"))
        .json(&serde_json::json!({
            "event_id": event_id,
            "title": "Paper Flow Market",
            "description": "Exercise the signet paper flow",
            "slug": slug,
            "body": "Paper body",
            "creator_pubkey": creator,
            "raw_event": sample_market_event(event_id, slug, creator),
            "b": 10.0
        }))
        .send()
        .await
        .unwrap();

    let funding_proofs: Vec<Proof> = serde_json::from_value(
        create_signet_funding_and_get_proofs(&client, &url, creator, 10_000).await,
    )
    .unwrap();
    let usd_keyset = fetch_active_usd_keyset(&client, &url).await;
    let market_keyset = fetch_market_keyset(&client, &url, event_id, "long").await;

    let buy_quote_response = client
        .post(format!("{url}/api/trades/quote"))
        .json(&serde_json::json!({
            "event_id": event_id,
            "side": "long",
            "spend_minor": 8000
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(buy_quote_response.status(), 200);
    let buy_quote_payload: serde_json::Value = buy_quote_response.json().await.unwrap();
    let (issued_outputs, issued_pre_mint) = prepare_outputs(
        &market_keyset,
        buy_quote_payload["quantity_minor"].as_u64().unwrap(),
        TEST_MARKET_DENOMINATIONS,
    );
    let (change_outputs, change_pre_mint) = prepare_outputs(
        &usd_keyset,
        proof_amount_total(&funding_proofs).saturating_sub(8000),
        TEST_USD_DENOMINATIONS,
    );

    let buy_response = client
        .post(format!("{url}/api/trades/buy"))
        .json(&serde_json::json!({
            "event_id": event_id,
            "pubkey": creator,
            "side": "long",
            "spend_minor": 8000,
            "proofs": funding_proofs,
            "issued_outputs": issued_outputs,
            "change_outputs": change_outputs
        }))
        .send()
        .await
        .unwrap();
    let buy_status = buy_response.status();
    let buy_payload: serde_json::Value = buy_response.json().await.unwrap();
    assert_eq!(buy_status, 201, "buy payload: {buy_payload}");
    assert_eq!(buy_payload["market"]["visibility"].as_str(), Some("public"));
    assert_eq!(
        buy_payload["settlement"]["mode"].as_str(),
        Some("bolt11_wallet_to_market")
    );
    assert_eq!(
        buy_payload["settlement"]["rail"].as_str(),
        Some("lightning")
    );
    assert_eq!(
        buy_payload["settlement"]["settlement_minor"].as_u64(),
        Some(8000)
    );
    assert!(buy_payload["settlement"]["invoice"].as_str().is_some());
    assert!(buy_payload["settlement"]["payment_hash"].as_str().is_some());
    assert_eq!(
        buy_payload["settlement"]["metadata"]["payer_role"].as_str(),
        Some("wallet_mint")
    );
    assert_eq!(
        buy_payload["settlement"]["metadata"]["receiver_role"].as_str(),
        Some("market_mint")
    );
    assert_eq!(
        buy_payload["settlement"]["metadata"]["invoice_state"].as_str(),
        Some("settled")
    );
    assert!(buy_payload["settlement"]["metadata"]["melt_quote_id"]
        .as_str()
        .is_some());
    let first_quantity = buy_quote_payload["quantity"].as_f64().unwrap();
    let issued_market_proofs = proofs_from_signatures(
        &buy_payload["issued"]["signatures"],
        &issued_pre_mint,
        &market_keyset,
    );
    let _buy_change_proofs = proofs_from_signatures(
        &buy_payload["change"]["signatures"],
        &change_pre_mint,
        &usd_keyset,
    );
    assert!(first_quantity > 0.0);

    let feed_response = client
        .get(format!("{url}/api/product/feed"))
        .send()
        .await
        .unwrap();
    let feed_payload: serde_json::Value = feed_response.json().await.unwrap();
    assert_eq!(
        feed_payload["markets"].as_array().map(|items| items.len()),
        Some(1)
    );
    assert_eq!(
        feed_payload["trades"].as_array().map(|items| items.len()),
        Some(1)
    );

    let sell_quote_response = client
        .post(format!("{url}/api/trades/sell/quote"))
        .json(&serde_json::json!({
            "event_id": event_id,
            "side": "long",
            "quantity": first_quantity / 2.0
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(sell_quote_response.status(), 200);
    let sell_quote_payload: serde_json::Value = sell_quote_response.json().await.unwrap();
    assert!(sell_quote_payload
        .as_object()
        .unwrap()
        .get("current_price_long_ppm")
        .is_some());
    assert!(sell_quote_payload
        .as_object()
        .unwrap()
        .get("current_price_yes_ppm")
        .is_none());
    let (sell_issued_outputs, sell_issued_pre_mint) = prepare_outputs(
        &usd_keyset,
        sell_quote_payload["net_minor"].as_u64().unwrap(),
        TEST_USD_DENOMINATIONS,
    );
    let (sell_change_outputs, sell_change_pre_mint) = prepare_outputs(
        &market_keyset,
        proof_amount_total(&issued_market_proofs)
            .saturating_sub(sell_quote_payload["quantity_minor"].as_u64().unwrap()),
        TEST_MARKET_DENOMINATIONS,
    );
    let sell_input_proofs = issued_market_proofs.clone();

    let sell_response = client
        .post(format!("{url}/api/trades/sell"))
        .json(&serde_json::json!({
            "event_id": event_id,
            "pubkey": creator,
            "side": "long",
            "quantity": first_quantity / 2.0,
            "request_id": "paper-sell-request-1",
            "proofs": sell_input_proofs.clone(),
            "issued_outputs": sell_issued_outputs.clone(),
            "change_outputs": sell_change_outputs.clone()
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(sell_response.status(), 201);
    let sell_payload: serde_json::Value = sell_response.json().await.unwrap();
    let _sell_usd_proofs = proofs_from_signatures(
        &sell_payload["issued"]["signatures"],
        &sell_issued_pre_mint,
        &usd_keyset,
    );
    let _sell_market_change_proofs = proofs_from_signatures(
        &sell_payload["change"]["signatures"],
        &sell_change_pre_mint,
        &market_keyset,
    );
    assert_eq!(
        sell_payload["settlement"]["mode"].as_str(),
        Some("bolt11_market_to_wallet")
    );
    assert_eq!(
        sell_payload["settlement"]["rail"].as_str(),
        Some("lightning")
    );
    assert!(sell_payload["settlement"]["invoice"].as_str().is_some());
    assert!(sell_payload["settlement"]["payment_hash"]
        .as_str()
        .is_some());
    assert_eq!(
        sell_payload["settlement"]["metadata"]["payer_role"].as_str(),
        Some("market_mint")
    );
    assert_eq!(
        sell_payload["settlement"]["metadata"]["receiver_role"].as_str(),
        Some("wallet_mint")
    );
    assert_eq!(
        sell_payload["settlement"]["metadata"]["invoice_state"].as_str(),
        Some("settled")
    );
    assert!(
        sell_payload["settlement"]["metadata"]["wallet_mint_quote_id"]
            .as_str()
            .is_some()
    );
    assert_eq!(
        sell_payload["settlement"]["metadata"]["wallet_mint_quote_state"].as_str(),
        Some("ISSUED")
    );
    assert_eq!(
        sell_payload["settlement"]["metadata"]["payment_execution"].as_str(),
        Some("market_reserve_invoice_service")
    );
    assert!(sell_payload["market"]
        .as_object()
        .unwrap()
        .get("price_long_ppm")
        .is_some());
    assert!(sell_payload["market"]
        .as_object()
        .unwrap()
        .get("price_yes_ppm")
        .is_none());
    let sell_direction_tag = sell_payload["trade"]["tags"].as_array().and_then(|tags| {
        tags.iter().find_map(|tag| {
            let tag = tag.as_array()?;
            if tag.first()?.as_str()? == "direction" {
                tag.get(1)?.as_str()
            } else {
                None
            }
        })
    });
    assert_eq!(sell_direction_tag, Some("long"));
    let wallet_mint_quote_id = sell_payload["settlement"]["metadata"]["wallet_mint_quote_id"]
        .as_str()
        .unwrap()
        .to_string();
    assert_eq!(
        sell_payload["settlement"]["metadata"]["wallet_mint_quote_redeem_route"].as_str(),
        Some(format!("/v1/mint/quote/wallet/{wallet_mint_quote_id}").as_str())
    );
    assert_eq!(
        sell_payload["settlement"]["metadata"]["wallet_mint_issue_route"].as_str(),
        Some("/v1/mint/wallet")
    );

    let wallet_quote_response = client
        .get(format!("{url}/v1/mint/quote/wallet/{wallet_mint_quote_id}"))
        .send()
        .await
        .unwrap();
    assert_eq!(wallet_quote_response.status(), 200);
    let wallet_quote_payload: serde_json::Value = wallet_quote_response.json().await.unwrap();
    assert_eq!(wallet_quote_payload["state"].as_str(), Some("ISSUED"));

    let sell_request_status_response = client
        .get(format!("{url}/api/trades/requests/paper-sell-request-1"))
        .send()
        .await
        .unwrap();
    assert_eq!(sell_request_status_response.status(), 200);
    let sell_request_status_payload: serde_json::Value =
        sell_request_status_response.json().await.unwrap();
    assert_eq!(
        sell_request_status_payload["status"].as_str(),
        Some("complete")
    );
    assert_eq!(
        sell_request_status_payload["issued"],
        sell_payload["issued"]
    );
    assert_eq!(
        sell_request_status_payload["change"],
        sell_payload["change"]
    );

    let replay_sell_response = client
        .post(format!("{url}/api/trades/sell"))
        .json(&serde_json::json!({
            "event_id": event_id,
            "pubkey": creator,
            "side": "long",
            "quantity": first_quantity / 2.0,
            "request_id": "paper-sell-request-1",
            "proofs": sell_input_proofs,
            "issued_outputs": [],
            "change_outputs": []
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(replay_sell_response.status(), 200);
    let replay_sell_payload: serde_json::Value = replay_sell_response.json().await.unwrap();
    assert_eq!(replay_sell_payload["issued"], sell_payload["issued"]);
    assert_eq!(replay_sell_payload["change"], sell_payload["change"]);

    let detail_response = client
        .get(format!("{url}/api/product/markets/slug/{slug}"))
        .send()
        .await
        .unwrap();
    assert_eq!(detail_response.status(), 200);
    let detail_payload: serde_json::Value = detail_response.json().await.unwrap();
    assert_eq!(
        detail_payload["trades"].as_array().map(|items| items.len()),
        Some(2)
    );
}

#[tokio::test]
async fn test_coordinator_trade_routes_and_status() {
    let url = create_product_test_server().await;
    let client = reqwest::Client::new();
    let creator = "1212121212121212121212121212121212121212121212121212121212121212";
    let event_id = "3434343434343434343434343434343434343434343434343434343434343434";
    let slug = "coordinator-trade-market";

    client
        .post(format!("{url}/api/product/markets"))
        .json(&serde_json::json!({
            "event_id": event_id,
            "title": "Coordinator Trade Market",
            "description": "Exercise coordinator routes",
            "slug": slug,
            "body": "Coordinator body",
            "creator_pubkey": creator,
            "raw_event": sample_market_event(event_id, slug, creator),
            "b": 10.0
        }))
        .send()
        .await
        .unwrap();

    let funding_proofs: Vec<Proof> = serde_json::from_value(
        create_signet_funding_and_get_proofs(&client, &url, creator, 10_000).await,
    )
    .unwrap();

    let quote_response = client
        .post(format!("{url}/api/trades/quote"))
        .json(&serde_json::json!({
            "event_id": event_id,
            "side": "long",
            "spend_minor": 4000
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(quote_response.status(), 200);
    let quote_payload: serde_json::Value = quote_response.json().await.unwrap();
    assert_eq!(quote_payload["trade_type"].as_str(), Some("buy"));
    assert!(quote_payload["quantity"].as_f64().unwrap() > 0.0);
    assert_eq!(quote_payload["settlement_minor"].as_u64(), Some(4000));
    assert!(quote_payload["settlement_msat"].as_u64().unwrap() > 0);
    assert!(quote_payload["settlement_fee_msat"].as_u64().unwrap() > 0);
    assert!(quote_payload["fx_quote_id"].as_str().is_some());
    assert!(quote_payload["fx_source"].as_str().is_some());
    assert!(quote_payload["btc_usd_price"].as_f64().unwrap() > 0.0);
    assert!(quote_payload["spread_bps"].as_u64().is_some());
    assert!(
        quote_payload["fx_metadata"]["reference_btc_usd_price"]
            .as_f64()
            .unwrap()
            > 0.0
    );
    assert!(quote_payload["fx_metadata"]["execution_spread_bps"]
        .as_u64()
        .is_some());
    assert_eq!(
        quote_payload["fx_metadata"]["quote_direction"].as_str(),
        Some("usd_to_msat")
    );
    assert!(quote_payload["fx_metadata"]["combination_policy"]
        .as_str()
        .is_some());
    assert!(quote_payload["marginal_price_before_ppm"].as_u64().unwrap() > 0);
    assert!(quote_payload["marginal_price_after_ppm"].as_u64().unwrap() > 0);
    assert!(quote_payload["fx_observations"].as_array().is_some());
    let buy_quote_id = quote_payload["quote_id"].as_str().unwrap().to_string();
    assert_eq!(quote_payload["status"].as_str(), Some("open"));

    let quote_status_response = client
        .get(format!("{url}/api/trades/quotes/{buy_quote_id}"))
        .send()
        .await
        .unwrap();
    assert_eq!(quote_status_response.status(), 200);
    let quote_status_payload: serde_json::Value = quote_status_response.json().await.unwrap();
    assert_eq!(
        quote_status_payload["quote_id"].as_str(),
        Some(buy_quote_id.as_str())
    );
    assert_eq!(
        quote_status_payload["fx_quote_id"].as_str(),
        quote_payload["fx_quote_id"].as_str()
    );
    assert_eq!(
        quote_status_payload["fx_metadata"]["reference_btc_usd_price"].as_f64(),
        quote_payload["fx_metadata"]["reference_btc_usd_price"].as_f64()
    );
    let usd_keyset = fetch_active_usd_keyset(&client, &url).await;
    let market_keyset = fetch_market_keyset(&client, &url, event_id, "long").await;
    let (issued_outputs, issued_pre_mint) = prepare_outputs(
        &market_keyset,
        quote_payload["quantity_minor"].as_u64().unwrap(),
        TEST_MARKET_DENOMINATIONS,
    );
    let (change_outputs, change_pre_mint) = prepare_outputs(
        &usd_keyset,
        proof_amount_total(&funding_proofs)
            .saturating_sub(quote_payload["spend_minor"].as_u64().unwrap()),
        TEST_USD_DENOMINATIONS,
    );

    let buy_response = client
        .post(format!("{url}/api/trades/buy"))
        .json(&serde_json::json!({
            "event_id": event_id,
            "pubkey": creator,
            "side": "long",
            "spend_minor": 4000,
            "quote_id": buy_quote_id,
            "proofs": funding_proofs,
            "issued_outputs": issued_outputs,
            "change_outputs": change_outputs
        }))
        .send()
        .await
        .unwrap();
    let buy_status = buy_response.status();
    let buy_payload: serde_json::Value = buy_response.json().await.unwrap();
    assert_eq!(buy_status, 201, "buy payload: {buy_payload}");
    let trade_id = buy_payload["trade"]["id"].as_str().unwrap().to_string();
    let quantity = quote_payload["quantity"].as_f64().unwrap();
    let issued_market_proofs = proofs_from_signatures(
        &buy_payload["issued"]["signatures"],
        &issued_pre_mint,
        &market_keyset,
    );
    let _buy_change_proofs = proofs_from_signatures(
        &buy_payload["change"]["signatures"],
        &change_pre_mint,
        &usd_keyset,
    );
    assert_eq!(buy_payload["market"]["visibility"].as_str(), Some("public"));

    let trade_status_response = client
        .get(format!("{url}/api/trades/{trade_id}"))
        .send()
        .await
        .unwrap();
    assert_eq!(trade_status_response.status(), 200);
    let trade_status_payload: serde_json::Value = trade_status_response.json().await.unwrap();
    assert_eq!(
        trade_status_payload["trade"]["id"].as_str(),
        Some(trade_id.as_str())
    );
    assert_eq!(
        trade_status_payload["settlement"]["trade_id"].as_str(),
        Some(trade_id.as_str())
    );
    assert_eq!(
        trade_status_payload["settlement"]["mode"].as_str(),
        Some("bolt11_wallet_to_market")
    );
    assert_eq!(
        trade_status_payload["settlement"]["rail"].as_str(),
        Some("lightning")
    );
    assert!(trade_status_payload["settlement"]["invoice"]
        .as_str()
        .is_some());
    assert!(trade_status_payload["settlement"]["payment_hash"]
        .as_str()
        .is_some());
    assert_eq!(
        trade_status_payload["settlement"]["metadata"]["payer_role"].as_str(),
        Some("wallet_mint")
    );
    assert_eq!(
        trade_status_payload["settlement"]["metadata"]["receiver_role"].as_str(),
        Some("market_mint")
    );
    assert_eq!(
        trade_status_payload["settlement"]["metadata"]["invoice_state"].as_str(),
        Some("settled")
    );
    assert!(
        trade_status_payload["settlement"]["metadata"]["melt_quote_id"]
            .as_str()
            .is_some()
    );
    assert_eq!(
        trade_status_payload["market"]["event_id"].as_str(),
        Some(event_id)
    );

    let executed_quote_status_response = client
        .get(format!(
            "{url}/api/trades/quotes/{}",
            quote_payload["quote_id"].as_str().unwrap()
        ))
        .send()
        .await
        .unwrap();
    assert_eq!(executed_quote_status_response.status(), 200);
    let executed_quote_status_payload: serde_json::Value =
        executed_quote_status_response.json().await.unwrap();
    assert_eq!(
        executed_quote_status_payload["status"].as_str(),
        Some("executed")
    );
    assert_eq!(
        executed_quote_status_payload["trade_id"].as_str(),
        Some(trade_id.as_str())
    );

    let sell_quote_response = client
        .post(format!("{url}/api/trades/sell/quote"))
        .json(&serde_json::json!({
            "event_id": event_id,
            "side": "long",
            "quantity": quantity / 2.0
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(sell_quote_response.status(), 200);
    let sell_quote_payload: serde_json::Value = sell_quote_response.json().await.unwrap();
    assert_eq!(sell_quote_payload["trade_type"].as_str(), Some("sell"));
    assert!(sell_quote_payload["net_minor"].as_u64().unwrap() > 0);
    assert_eq!(
        sell_quote_payload["settlement_minor"].as_u64(),
        sell_quote_payload["net_minor"].as_u64()
    );
    assert!(sell_quote_payload["settlement_msat"].as_u64().unwrap() > 0);
    let sell_quote_id = sell_quote_payload["quote_id"].as_str().unwrap().to_string();
    let (sell_issued_outputs, sell_issued_pre_mint) = prepare_outputs(
        &usd_keyset,
        sell_quote_payload["net_minor"].as_u64().unwrap(),
        TEST_USD_DENOMINATIONS,
    );
    let (sell_change_outputs, sell_change_pre_mint) = prepare_outputs(
        &market_keyset,
        proof_amount_total(&issued_market_proofs)
            .saturating_sub(sell_quote_payload["quantity_minor"].as_u64().unwrap()),
        TEST_MARKET_DENOMINATIONS,
    );

    let sell_response = client
        .post(format!("{url}/api/trades/sell"))
        .json(&serde_json::json!({
            "event_id": event_id,
            "pubkey": creator,
            "side": "long",
            "quantity": quantity / 2.0,
            "quote_id": sell_quote_id,
            "proofs": issued_market_proofs,
            "issued_outputs": sell_issued_outputs,
            "change_outputs": sell_change_outputs
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(sell_response.status(), 201);
    let sell_payload: serde_json::Value = sell_response.json().await.unwrap();
    let _sell_usd_proofs = proofs_from_signatures(
        &sell_payload["issued"]["signatures"],
        &sell_issued_pre_mint,
        &usd_keyset,
    );
    let _sell_market_change_proofs = proofs_from_signatures(
        &sell_payload["change"]["signatures"],
        &sell_change_pre_mint,
        &market_keyset,
    );
    assert_eq!(
        sell_payload["settlement"]["mode"].as_str(),
        Some("bolt11_market_to_wallet")
    );
    assert!(
        sell_payload["settlement"]["metadata"]["wallet_mint_quote_id"]
            .as_str()
            .is_some()
    );
    assert_eq!(
        sell_payload["settlement"]["metadata"]["wallet_mint_quote_state"].as_str(),
        Some("ISSUED")
    );

    let executed_sell_quote_status_response = client
        .get(format!(
            "{url}/api/trades/quotes/{}",
            sell_quote_payload["quote_id"].as_str().unwrap()
        ))
        .send()
        .await
        .unwrap();
    assert_eq!(executed_sell_quote_status_response.status(), 200);
    let executed_sell_quote_status_payload: serde_json::Value =
        executed_sell_quote_status_response.json().await.unwrap();
    assert_eq!(
        executed_sell_quote_status_payload["status"].as_str(),
        Some("executed")
    );
}

#[tokio::test]
async fn test_signet_lightning_funding_quote_auto_pays_after_status_poll() {
    let (url, _) = create_product_test_server_bundle_with_funding(None, None, "signet").await;
    let client = reqwest::Client::new();
    let pubkey = "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

    let quote_response = client
        .post(format!("{url}/v1/mint/quote/bolt11"))
        .json(&serde_json::json!({
            "pubkey": pubkey,
            "amount": 2500,
            "unit": "usd"
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(quote_response.status(), 200);
    let quote_payload: serde_json::Value = quote_response.json().await.unwrap();
    let quote_id = quote_payload["quote"].as_str().unwrap().to_string();
    assert_eq!(quote_payload["state"].as_str(), Some("UNPAID"));
    let invoice = quote_payload["request"].as_str().unwrap();
    assert!(Bolt11Invoice::from_str(invoice).is_ok());
    assert_eq!(quote_payload["amount"].as_u64(), Some(2500));
    assert_eq!(quote_payload["unit"].as_str(), Some("usd"));

    let get_quote_response = client
        .get(format!("{url}/v1/mint/quote/bolt11/{quote_id}"))
        .send()
        .await
        .unwrap();
    assert_eq!(get_quote_response.status(), 200);
    let get_quote_payload: serde_json::Value = get_quote_response.json().await.unwrap();
    assert_eq!(get_quote_payload["quote"].as_str(), Some(quote_id.as_str()));
    assert_eq!(get_quote_payload["state"].as_str(), Some("UNPAID"));

    let paid_quote = wait_for_mint_quote_state(&client, &url, &quote_id, &["PAID"]).await;
    assert_eq!(paid_quote["quote"].as_str(), Some(quote_id.as_str()));
    assert_eq!(paid_quote["state"].as_str(), Some("PAID"));
    let minted_proofs = mint_funding_quote_and_get_proofs(&client, &url, &paid_quote, 2500).await;
    assert!(minted_proofs.as_array().is_some());

    let issued_quote = wait_for_mint_quote_state(&client, &url, &quote_id, &["ISSUED"]).await;
    assert_eq!(issued_quote["state"].as_str(), Some("ISSUED"));

    let funding_status_response = client
        .get(format!("{url}/api/portfolio/funding/{quote_id}"))
        .send()
        .await
        .unwrap();
    assert_eq!(funding_status_response.status(), 200);
    let funding_status_payload: serde_json::Value = funding_status_response.json().await.unwrap();
    assert_eq!(funding_status_payload["status"].as_str(), Some("complete"));
}

#[tokio::test]
async fn test_signet_lightning_funding_quote_auto_pays_with_cli_backend_when_self_pay_fails() {
    let invoice_service = create_cli_invoice_service_requiring_internal_settlement("signet").await;
    let (url, _) = create_product_test_server_bundle_with_invoice_service(
        None,
        None,
        "signet",
        invoice_service,
    )
    .await;
    let client = reqwest::Client::new();

    let quote_response = client
        .post(format!("{url}/v1/mint/quote/bolt11"))
        .json(&serde_json::json!({
            "pubkey": "fake-cli-internal-payment-user",
            "amount": 2500,
            "unit": "usd"
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(quote_response.status(), 200);

    let quote_payload: serde_json::Value = quote_response.json().await.unwrap();
    let quote_id = quote_payload["quote"].as_str().unwrap().to_string();
    assert_eq!(quote_payload["state"].as_str(), Some("UNPAID"));

    let paid_quote = wait_for_mint_quote_state(&client, &url, &quote_id, &["PAID"]).await;
    assert_eq!(paid_quote["state"].as_str(), Some("PAID"));
}

#[tokio::test]
async fn test_product_mint_info_advertises_bolt11_mint_and_melt() {
    let url = create_product_test_server().await;
    let client = reqwest::Client::new();

    let response = client.get(format!("{url}/v1/info")).send().await.unwrap();
    assert_eq!(response.status(), 200);

    let payload: serde_json::Value = response.json().await.unwrap();
    let nut04_methods = payload["nuts"]["4"]["methods"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    let nut05_methods = payload["nuts"]["5"]["methods"]
        .as_array()
        .cloned()
        .unwrap_or_default();

    assert!(nut04_methods.iter().any(|method| {
        method["method"].as_str() == Some("bolt11") && method["unit"].as_str() == Some("usd")
    }));
    assert!(nut05_methods.iter().any(|method| {
        method["method"].as_str() == Some("bolt11") && method["unit"].as_str() == Some("usd")
    }));
}

#[tokio::test]
async fn test_standard_bolt11_melt_routes_pay_invoice() {
    let (url, invoice_service) =
        create_product_test_server_bundle_with_funding(None, None, "signet").await;
    let client = reqwest::Client::new();

    let invoice = {
        let mut invoice_service = invoice_service.lock().await;
        invoice_service
            .create_invoice(
                1_750_000,
                Some("Cascade melt integration test".to_string()),
                Some(1800),
                false,
            )
            .await
            .unwrap()
    };

    let melt_quote_response = client
        .post(format!("{url}/v1/melt/quote/bolt11"))
        .json(&serde_json::json!({
            "request": invoice.bolt11().to_string(),
            "unit": "usd"
        }))
        .send()
        .await
        .unwrap();
    let melt_quote_status = melt_quote_response.status();
    let melt_quote_body = melt_quote_response.text().await.unwrap();
    assert_eq!(melt_quote_status, 200, "{melt_quote_body}");
    let melt_quote_payload: serde_json::Value = serde_json::from_str(&melt_quote_body).unwrap();
    let melt_quote_id = melt_quote_payload["quote"].as_str().unwrap().to_string();
    assert_eq!(melt_quote_payload["state"].as_str(), Some("UNPAID"));
    assert_eq!(
        melt_quote_payload["request"].as_str(),
        Some(invoice.bolt11())
    );

    let funding_amount_minor = melt_quote_payload["amount"].as_u64().unwrap()
        + melt_quote_payload["fee_reserve"].as_u64().unwrap_or(0);
    let funding_proofs = create_signet_funding_and_get_proofs(
        &client,
        &url,
        "9999999999999999999999999999999999999999999999999999999999999999",
        funding_amount_minor,
    )
    .await;

    let melt_response = client
        .post(format!("{url}/v1/melt/bolt11"))
        .json(&serde_json::json!({
            "quote": melt_quote_id,
            "inputs": funding_proofs
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(melt_response.status(), 200);
    let melt_payload: serde_json::Value = melt_response.json().await.unwrap();
    assert_eq!(melt_payload["state"].as_str(), Some("PAID"));
    assert!(melt_payload["payment_preimage"].as_str().is_some());

    let paid_quote = wait_for_melt_quote_state(
        &client,
        &url,
        melt_payload["quote"].as_str().unwrap(),
        &["PAID"],
    )
    .await;
    assert_eq!(paid_quote["state"].as_str(), Some("PAID"));
    assert!(paid_quote["payment_preimage"].as_str().is_some());

    let settled_invoice = {
        let invoice_service = invoice_service.lock().await;
        invoice_service
            .check_invoice_status(&invoice.payment_hash)
            .await
            .unwrap()
    };
    assert_eq!(
        settled_invoice,
        cascade_core::lightning::types::InvoiceState::Settled
    );
}

#[tokio::test]
async fn test_runtime_reports_actual_edition_and_funding_rails() {
    let url = create_product_test_server().await;
    let client = reqwest::Client::new();

    let response = client
        .get(format!("{url}/api/product/runtime"))
        .send()
        .await
        .unwrap();

    assert_eq!(response.status(), 200);
    let payload: serde_json::Value = response.json().await.unwrap();
    assert_eq!(payload["edition"].as_str(), Some("signet"));
    assert_eq!(payload["network"].as_str(), Some("signet"));
    assert_eq!(payload["proof_custody"].as_str(), Some("browser_local"));
    assert_eq!(
        payload["funding"]["lightning"]["available"].as_bool(),
        Some(true)
    );
    assert_eq!(
        payload["funding"]["stripe"]["available"].as_bool(),
        Some(false)
    );
    assert_eq!(
        payload["funding"]["usdc"]["available"].as_bool(),
        Some(false)
    );
    assert_eq!(
        payload["funding"]["usdc"]["reason"].as_str(),
        Some("usdc_mainnet_only")
    );
}

#[tokio::test]
async fn test_lightning_funding_request_id_is_idempotent() {
    let (url, invoice_service) =
        create_product_test_server_bundle_with_funding(None, None, "signet").await;
    let client = reqwest::Client::new();
    let pubkey = "efefefefefefefefefefefefefefefefefefefefefefefefefefefefefefefef";
    let request_id = "funding-request-idempotent-1";

    let first_response = client
        .post(format!("{url}/v1/mint/quote/bolt11"))
        .json(&serde_json::json!({
            "pubkey": pubkey,
            "amount": 2500,
            "unit": "usd",
            "request_id": request_id
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(first_response.status(), 200);
    let first_payload: serde_json::Value = first_response.json().await.unwrap();
    let quote_id = first_payload["quote"].as_str().unwrap().to_string();
    let invoice = first_payload["request"].as_str().unwrap().to_string();
    assert_eq!(first_payload["state"].as_str(), Some("UNPAID"));

    let second_response = client
        .post(format!("{url}/v1/mint/quote/bolt11"))
        .json(&serde_json::json!({
            "pubkey": pubkey,
            "amount": 2500,
            "unit": "usd",
            "request_id": request_id
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(second_response.status(), 200);
    let second_payload: serde_json::Value = second_response.json().await.unwrap();
    assert_eq!(second_payload["quote"].as_str(), Some(quote_id.as_str()));
    assert_eq!(second_payload["request"].as_str(), Some(invoice.as_str()));
    assert_eq!(second_payload["state"].as_str(), Some("UNPAID"));

    let request_status_response = client
        .get(format!("{url}/api/portfolio/funding/requests/{request_id}"))
        .send()
        .await
        .unwrap();
    assert_eq!(request_status_response.status(), 200);
    let request_status_payload: serde_json::Value = request_status_response.json().await.unwrap();
    assert_eq!(request_status_payload["status"].as_str(), Some("complete"));
    assert_eq!(
        request_status_payload["funding"]["id"].as_str(),
        Some(quote_id.as_str())
    );

    invoice_service
        .lock()
        .await
        .pay_invoice(&invoice)
        .await
        .unwrap();

    let paid_quote = wait_for_mint_quote_state(&client, &url, &quote_id, &["PAID"]).await;
    assert_eq!(paid_quote["state"].as_str(), Some("PAID"));
    let minted_proofs = mint_funding_quote_and_get_proofs(&client, &url, &paid_quote, 2500).await;
    assert!(minted_proofs.as_array().is_some());

    let issued_quote = wait_for_mint_quote_state(&client, &url, &quote_id, &["ISSUED"]).await;
    assert_eq!(issued_quote["state"].as_str(), Some("ISSUED"));
}

#[tokio::test]
async fn test_lightning_funding_mint_replays_issued_signatures() {
    let (url, invoice_service) =
        create_product_test_server_bundle_with_funding(None, None, "signet").await;
    let client = reqwest::Client::new();

    let quote_response = client
        .post(format!("{url}/v1/mint/quote/bolt11"))
        .json(&serde_json::json!({
            "pubkey": "replay-issued-funding-user",
            "amount": 2500,
            "unit": "usd"
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(quote_response.status(), 200);
    let quote_payload: serde_json::Value = quote_response.json().await.unwrap();
    let quote_id = quote_payload["quote"].as_str().unwrap().to_string();
    let invoice = quote_payload["request"].as_str().unwrap().to_string();

    invoice_service
        .lock()
        .await
        .pay_invoice(&invoice)
        .await
        .unwrap();

    let paid_quote = wait_for_mint_quote_state(&client, &url, &quote_id, &["PAID"]).await;
    let keyset = fetch_active_usd_keyset(&client, &url).await;
    let (outputs, pre_mint) = prepare_outputs(&keyset, 2500, TEST_USD_DENOMINATIONS);

    let first_mint_response = client
        .post(format!("{url}/v1/mint/bolt11"))
        .json(&serde_json::json!({
            "quote": quote_id,
            "outputs": outputs.clone()
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(first_mint_response.status(), 200);
    let first_mint_payload: serde_json::Value = first_mint_response.json().await.unwrap();
    let _proofs = proofs_from_signatures(&first_mint_payload["signatures"], &pre_mint, &keyset);

    let second_mint_response = client
        .post(format!("{url}/v1/mint/bolt11"))
        .json(&serde_json::json!({
            "quote": paid_quote["quote"].as_str().unwrap(),
            "outputs": outputs
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(second_mint_response.status(), 200);
    let second_mint_payload: serde_json::Value = second_mint_response.json().await.unwrap();
    assert_eq!(
        second_mint_payload["signatures"],
        first_mint_payload["signatures"]
    );
}

#[tokio::test]
async fn test_stripe_funding_completes_from_webhook() {
    let stripe_base_url = create_mock_stripe_server().await;
    let webhook_secret = "whsec_test_cascade";
    let url = create_product_test_server_with_stripe(Some(cascade_api::stripe::StripeConfig {
        secret_key: "sk_test_cascade".to_string(),
        webhook_secret: webhook_secret.to_string(),
        success_url: "https://cascade.test/portfolio?stripe=success&funding_id={FUNDING_ID}"
            .to_string(),
        cancel_url: "https://cascade.test/portfolio?stripe=cancel&funding_id={FUNDING_ID}"
            .to_string(),
        base_url: stripe_base_url,
        checkout_expiry_seconds: 1800,
        product_name: "Cascade Portfolio Funding".to_string(),
        max_funding_minor: 10_000,
        window_limit_minor: 25_000,
        window_seconds: 24 * 60 * 60,
        allowed_risk_levels: vec!["normal".to_string()],
    }))
    .await;
    let client = reqwest::Client::new();
    let pubkey = "f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0";
    let request_id = "stripe-funding-request-1";

    let create_response = client
        .post(format!("{url}/api/portfolio/funding/stripe"))
        .json(&serde_json::json!({
            "pubkey": pubkey,
            "amount_minor": 4200,
            "request_id": request_id
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(create_response.status(), 201);
    let create_payload: serde_json::Value = create_response.json().await.unwrap();
    let funding_id = create_payload["id"].as_str().unwrap().to_string();
    assert_eq!(create_payload["status"].as_str(), Some("pending"));
    assert_eq!(create_payload["rail"].as_str(), Some("stripe"));
    assert_eq!(
        create_payload["checkout_session_id"].as_str(),
        Some("cs_test_cascade")
    );
    assert_eq!(
        create_payload["checkout_url"].as_str(),
        Some("https://checkout.stripe.test/cs_test_cascade")
    );
    assert!(create_payload["invoice"].is_null());
    assert!(create_payload["fx_quote_id"].is_null());

    let request_status_response = client
        .get(format!("{url}/api/portfolio/funding/requests/{request_id}"))
        .send()
        .await
        .unwrap();
    assert_eq!(request_status_response.status(), 200);
    let request_status_payload: serde_json::Value = request_status_response.json().await.unwrap();
    assert_eq!(request_status_payload["status"].as_str(), Some("complete"));
    assert_eq!(
        request_status_payload["funding"]["id"].as_str(),
        Some(funding_id.as_str())
    );

    let event_body = serde_json::json!({
        "id": "evt_stripe_checkout_completed",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": "cs_test_cascade",
                "client_reference_id": funding_id,
                "payment_status": "paid",
                "payment_intent": "pi_test_cascade",
                "expires_at": chrono::Utc::now().timestamp() + 1800,
                "metadata": {
                    "funding_id": request_status_payload["funding"]["id"].as_str().unwrap()
                }
            }
        }
    })
    .to_string();
    let timestamp = chrono::Utc::now().timestamp();
    let signature = stripe_signature(webhook_secret, &event_body, timestamp);

    let webhook_response = client
        .post(format!("{url}/api/portfolio/funding/stripe/webhook"))
        .header("stripe-signature", signature)
        .header("content-type", "application/json")
        .body(event_body)
        .send()
        .await
        .unwrap();
    assert_eq!(webhook_response.status(), 200);

    let funding_status_response = client
        .get(format!("{url}/api/portfolio/funding/{funding_id}"))
        .send()
        .await
        .unwrap();
    assert_eq!(funding_status_response.status(), 200);
    let funding_status_payload: serde_json::Value = funding_status_response.json().await.unwrap();
    assert_eq!(funding_status_payload["status"].as_str(), Some("paid"));
    assert_eq!(
        funding_status_payload["risk_level"].as_str(),
        Some("normal")
    );
    assert!(funding_status_payload.get("issued_proofs").is_none());

    let paid_quote =
        wait_for_mint_quote_state_for_method(&client, &url, "stripe", &funding_id, &["PAID"]).await;
    assert_eq!(paid_quote["quote"].as_str(), Some(funding_id.as_str()));
    assert_eq!(paid_quote["state"].as_str(), Some("PAID"));
    assert_eq!(
        paid_quote["checkout_session_id"].as_str(),
        Some("cs_test_cascade")
    );

    let minted_proofs =
        mint_funding_quote_and_get_proofs_for_method(&client, &url, "stripe", &paid_quote, 4200)
            .await;
    assert!(minted_proofs.as_array().is_some());

    let issued_quote =
        wait_for_mint_quote_state_for_method(&client, &url, "stripe", &funding_id, &["ISSUED"])
            .await;
    assert_eq!(issued_quote["state"].as_str(), Some("ISSUED"));

    let completed_funding_status_response = client
        .get(format!("{url}/api/portfolio/funding/{funding_id}"))
        .send()
        .await
        .unwrap();
    assert_eq!(completed_funding_status_response.status(), 200);
    let completed_funding_status_payload: serde_json::Value =
        completed_funding_status_response.json().await.unwrap();
    assert_eq!(
        completed_funding_status_payload["status"].as_str(),
        Some("complete")
    );
}

#[tokio::test]
async fn test_stripe_funding_moves_to_review_required_for_high_risk() {
    let stripe_base_url = create_mock_stripe_server_with_risk_level("highest").await;
    let webhook_secret = "whsec_test_cascade";
    let url = create_product_test_server_with_stripe(Some(cascade_api::stripe::StripeConfig {
        secret_key: "sk_test_cascade".to_string(),
        webhook_secret: webhook_secret.to_string(),
        success_url: "https://cascade.test/portfolio?stripe=success&funding_id={FUNDING_ID}"
            .to_string(),
        cancel_url: "https://cascade.test/portfolio?stripe=cancel&funding_id={FUNDING_ID}"
            .to_string(),
        base_url: stripe_base_url,
        checkout_expiry_seconds: 1800,
        product_name: "Cascade Portfolio Funding".to_string(),
        max_funding_minor: 10_000,
        window_limit_minor: 25_000,
        window_seconds: 24 * 60 * 60,
        allowed_risk_levels: vec!["normal".to_string()],
    }))
    .await;
    let client = reqwest::Client::new();
    let pubkey = "1111111111111111111111111111111111111111111111111111111111111111";

    let create_response = client
        .post(format!("{url}/api/portfolio/funding/stripe"))
        .json(&serde_json::json!({
            "pubkey": pubkey,
            "amount_minor": 4200
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(create_response.status(), 201);
    let create_payload: serde_json::Value = create_response.json().await.unwrap();
    let funding_id = create_payload["id"].as_str().unwrap().to_string();

    let event_body = serde_json::json!({
        "id": "evt_stripe_checkout_high_risk",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": "cs_test_cascade",
                "client_reference_id": funding_id,
                "payment_status": "paid",
                "payment_intent": "pi_test_high_risk",
                "expires_at": chrono::Utc::now().timestamp() + 1800,
                "metadata": {
                    "funding_id": create_payload["id"].as_str().unwrap()
                }
            }
        }
    })
    .to_string();
    let timestamp = chrono::Utc::now().timestamp();
    let signature = stripe_signature(webhook_secret, &event_body, timestamp);

    let webhook_response = client
        .post(format!("{url}/api/portfolio/funding/stripe/webhook"))
        .header("stripe-signature", signature)
        .header("content-type", "application/json")
        .body(event_body)
        .send()
        .await
        .unwrap();
    assert_eq!(webhook_response.status(), 200);
    let webhook_payload: serde_json::Value = webhook_response.json().await.unwrap();
    assert_eq!(webhook_payload["status"].as_str(), Some("review_required"));

    let funding_status_response = client
        .get(format!("{url}/api/portfolio/funding/{funding_id}"))
        .send()
        .await
        .unwrap();
    assert_eq!(funding_status_response.status(), 200);
    let funding_status_payload: serde_json::Value = funding_status_response.json().await.unwrap();
    assert_eq!(
        funding_status_payload["status"].as_str(),
        Some("review_required")
    );
    assert_eq!(
        funding_status_payload["risk_level"].as_str(),
        Some("highest")
    );
    assert!(funding_status_payload.get("issued_proofs").is_none());
}

#[tokio::test]
async fn test_usdc_deposit_intent_unavailable_on_signet() {
    let url = create_product_test_server().await;
    let client = reqwest::Client::new();

    let response = client
        .post(format!("{url}/api/portfolio/funding/usdc/deposit-intents"))
        .json(&serde_json::json!({
            "pubkey": "usdc-signet-user",
            "requested_wallet_amount_minor": 5000
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(response.status(), 503);
    let payload: serde_json::Value = response.json().await.unwrap();
    assert_eq!(payload["error"].as_str(), Some("usdc_mainnet_only"));
}

#[tokio::test]
async fn test_usdc_deposit_intent_create_and_fetch() {
    let url = create_product_test_server_with_usdc(
        Some(cascade_api::usdc::UsdcConfig {
            network: "base".to_string(),
            asset: "USDC".to_string(),
            treasury_address: "0x1111111111111111111111111111111111111111".to_string(),
            deposit_intent_expiry_seconds: 3600,
            withdrawals_enabled: false,
        }),
        "mainnet",
    )
    .await;
    let client = reqwest::Client::new();

    let create_response = client
        .post(format!("{url}/api/portfolio/funding/usdc/deposit-intents"))
        .json(&serde_json::json!({
            "pubkey": "usdc-mainnet-user",
            "requested_wallet_amount_minor": 12500,
            "provider": "moonpay"
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(create_response.status(), 201);
    let create_payload: serde_json::Value = create_response.json().await.unwrap();
    let intent_id = create_payload["id"].as_str().unwrap().to_string();
    assert_eq!(create_payload["asset"].as_str(), Some("USDC"));
    assert_eq!(create_payload["network"].as_str(), Some("base"));
    assert_eq!(
        create_payload["destination_address"].as_str(),
        Some("0x1111111111111111111111111111111111111111")
    );
    assert_eq!(create_payload["provider"].as_str(), Some("moonpay"));
    assert_eq!(create_payload["status"].as_str(), Some("pending"));
    assert_eq!(
        create_payload["requested_wallet_amount_minor"].as_u64(),
        Some(12_500)
    );

    let get_response = client
        .get(format!(
            "{url}/api/portfolio/funding/usdc/deposit-intents/{intent_id}"
        ))
        .send()
        .await
        .unwrap();
    assert_eq!(get_response.status(), 200);
    let get_payload: serde_json::Value = get_response.json().await.unwrap();
    assert_eq!(get_payload["id"].as_str(), Some(intent_id.as_str()));
    assert_eq!(get_payload["status"].as_str(), Some("pending"));
    assert_eq!(get_payload["provider"].as_str(), Some("moonpay"));
    assert!(get_payload["expires_at"].as_i64().is_some());
}

#[tokio::test]
async fn test_usdc_withdrawal_unavailable_on_signet() {
    let url = create_product_test_server().await;
    let client = reqwest::Client::new();

    let response = client
        .post(format!("{url}/api/portfolio/withdrawals/usdc"))
        .json(&serde_json::json!({
            "pubkey": "usdc-signet-user",
            "amount_minor": 5000,
            "destination_address": "0x1111111111111111111111111111111111111111",
            "proofs": [
                {
                    "amount": 1,
                    "id": "deadbeef",
                    "secret": "secret",
                    "C": "02aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                    "witness": null,
                    "dleq": null
                }
            ],
            "change_outputs": []
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(response.status(), 503);
    let payload: serde_json::Value = response.json().await.unwrap();
    assert_eq!(payload["error"].as_str(), Some("usdc_mainnet_only"));
}

#[tokio::test]
async fn test_usdc_withdrawal_requires_explicit_enablement() {
    let (url, invoice_service) = create_product_test_server_with_usdc_bundle(
        Some(cascade_api::usdc::UsdcConfig {
            network: "base".to_string(),
            asset: "USDC".to_string(),
            treasury_address: "0x1111111111111111111111111111111111111111".to_string(),
            deposit_intent_expiry_seconds: 3600,
            withdrawals_enabled: false,
        }),
        "mainnet",
    )
    .await;
    let client = reqwest::Client::new();
    let proofs = create_wallet_funding_and_get_proofs_with_invoice_service(
        &client,
        &url,
        "usdc-mainnet-user",
        5000,
        Some(&invoice_service),
    )
    .await;

    let response = client
        .post(format!("{url}/api/portfolio/withdrawals/usdc"))
        .json(&serde_json::json!({
            "pubkey": "usdc-mainnet-user",
            "amount_minor": 2500,
            "destination_address": "0x1111111111111111111111111111111111111111",
            "proofs": proofs,
            "change_outputs": []
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(response.status(), 503);
    let payload: serde_json::Value = response.json().await.unwrap();
    assert_eq!(
        payload["error"].as_str(),
        Some("usdc_withdrawals_unavailable")
    );
}

#[tokio::test]
async fn test_usdc_withdrawal_create_fetch_and_idempotency() {
    let (url, invoice_service) = create_product_test_server_with_usdc_bundle(
        Some(cascade_api::usdc::UsdcConfig {
            network: "base".to_string(),
            asset: "USDC".to_string(),
            treasury_address: "0x1111111111111111111111111111111111111111".to_string(),
            deposit_intent_expiry_seconds: 3600,
            withdrawals_enabled: true,
        }),
        "mainnet",
    )
    .await;
    let client = reqwest::Client::new();
    let pubkey = "usdc-withdraw-mainnet-user";
    let proofs = create_wallet_funding_and_get_proofs_with_invoice_service(
        &client,
        &url,
        pubkey,
        5000,
        Some(&invoice_service),
    )
    .await;
    let usd_keyset = fetch_active_usd_keyset(&client, &url).await;
    let (change_outputs, _) = prepare_outputs(&usd_keyset, 1000, TEST_USD_DENOMINATIONS);

    let request_body = serde_json::json!({
        "pubkey": pubkey,
        "amount_minor": 4000,
        "destination_address": "0x2222222222222222222222222222222222222222",
        "proofs": proofs,
        "change_outputs": change_outputs,
        "provider": "manual",
        "request_id": "usdc-withdrawal-1"
    });

    let create_response = client
        .post(format!("{url}/api/portfolio/withdrawals/usdc"))
        .json(&request_body)
        .send()
        .await
        .unwrap();
    assert_eq!(create_response.status(), 202);
    let create_payload: serde_json::Value = create_response.json().await.unwrap();
    let withdrawal_id = create_payload["id"].as_str().unwrap().to_string();
    assert_eq!(create_payload["status"].as_str(), Some("pending"));
    assert_eq!(create_payload["asset"].as_str(), Some("USDC"));
    assert_eq!(create_payload["network"].as_str(), Some("base"));
    assert_eq!(
        create_payload["destination_address"].as_str(),
        Some("0x2222222222222222222222222222222222222222")
    );
    assert_eq!(create_payload["amount_minor"].as_u64(), Some(4_000));
    assert_eq!(create_payload["asset_units"].as_u64(), Some(40_000_000));
    assert_eq!(create_payload["provider"].as_str(), Some("manual"));
    assert_eq!(
        create_payload["request_id"].as_str(),
        Some("usdc-withdrawal-1")
    );
    let change_amount = create_payload["change"]["signatures"]
        .as_array()
        .unwrap()
        .iter()
        .map(|signature| signature["amount"].as_u64().unwrap())
        .sum::<u64>();
    assert_eq!(change_amount, 1000);

    let get_response = client
        .get(format!(
            "{url}/api/portfolio/withdrawals/usdc/{withdrawal_id}"
        ))
        .send()
        .await
        .unwrap();
    assert_eq!(get_response.status(), 200);
    let get_payload: serde_json::Value = get_response.json().await.unwrap();
    assert_eq!(get_payload["id"].as_str(), Some(withdrawal_id.as_str()));
    assert_eq!(get_payload["status"].as_str(), Some("pending"));
    assert_eq!(get_payload["change"]["unit"].as_str(), Some("usd"));

    let request_lookup_response = client
        .get(format!(
            "{url}/api/portfolio/withdrawals/usdc/requests/usdc-withdrawal-1"
        ))
        .send()
        .await
        .unwrap();
    assert_eq!(request_lookup_response.status(), 200);
    let request_lookup_payload: serde_json::Value = request_lookup_response.json().await.unwrap();
    assert_eq!(
        request_lookup_payload["id"].as_str(),
        Some(withdrawal_id.as_str())
    );

    let replay_response = client
        .post(format!("{url}/api/portfolio/withdrawals/usdc"))
        .json(&request_body)
        .send()
        .await
        .unwrap();
    assert_eq!(replay_response.status(), 200);
    let replay_payload: serde_json::Value = replay_response.json().await.unwrap();
    assert_eq!(replay_payload["id"].as_str(), Some(withdrawal_id.as_str()));
    assert_eq!(replay_payload["status"].as_str(), Some("pending"));
}

#[tokio::test]
async fn test_trade_execution_requires_input_proofs() {
    let url = create_product_test_server().await;
    let client = reqwest::Client::new();
    let creator = "abababababababababababababababababababababababababababababababab";
    let event_id = "cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd";
    let slug = "proof-required-market";

    client
        .post(format!("{url}/api/product/markets"))
        .json(&serde_json::json!({
            "event_id": event_id,
            "title": "Proof Required Market",
            "description": "Trade execution must require input proofs",
            "slug": slug,
            "body": "Proof-required body",
            "creator_pubkey": creator,
            "raw_event": sample_market_event(event_id, slug, creator),
            "b": 10.0
        }))
        .send()
        .await
        .unwrap();

    let buy_response = client
        .post(format!("{url}/api/trades/buy"))
        .json(&serde_json::json!({
            "event_id": event_id,
            "pubkey": creator,
            "side": "long",
            "spend_minor": 4000
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(buy_response.status(), 400);
    let buy_payload: serde_json::Value = buy_response.json().await.unwrap();
    assert_eq!(buy_payload["error"].as_str(), Some("input_proofs_required"));

    let sell_response = client
        .post(format!("{url}/api/trades/sell"))
        .json(&serde_json::json!({
            "event_id": event_id,
            "pubkey": creator,
            "side": "long",
            "quantity": 1.0
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(sell_response.status(), 400);
    let sell_payload: serde_json::Value = sell_response.json().await.unwrap();
    assert_eq!(
        sell_payload["error"].as_str(),
        Some("input_proofs_required")
    );
}

#[tokio::test]
async fn test_trade_request_id_is_idempotent() {
    let url = create_product_test_server().await;
    let client = reqwest::Client::new();
    let creator = "5656565656565656565656565656565656565656565656565656565656565656";
    let event_id = "7878787878787878787878787878787878787878787878787878787878787878";
    let slug = "trade-request-idempotency-market";
    let request_id = "req-buy-idempotent-1";

    client
        .post(format!("{url}/api/product/markets"))
        .json(&serde_json::json!({
            "event_id": event_id,
            "title": "Trade Request Idempotency Market",
            "description": "Ensure duplicate request ids do not double execute",
            "slug": slug,
            "body": "Trade request idempotency body",
            "creator_pubkey": creator,
            "raw_event": sample_market_event(event_id, slug, creator),
            "b": 10.0
        }))
        .send()
        .await
        .unwrap();

    let funding_proofs: Vec<Proof> = serde_json::from_value(
        create_signet_funding_and_get_proofs(&client, &url, creator, 10_000).await,
    )
    .unwrap();
    let usd_keyset = fetch_active_usd_keyset(&client, &url).await;
    let market_keyset = fetch_market_keyset(&client, &url, event_id, "long").await;
    let buy_quote_response = client
        .post(format!("{url}/api/trades/quote"))
        .json(&serde_json::json!({
            "event_id": event_id,
            "side": "long",
            "spend_minor": 4000
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(buy_quote_response.status(), 200);
    let buy_quote_payload: serde_json::Value = buy_quote_response.json().await.unwrap();
    let (issued_outputs, _issued_pre_mint) = prepare_outputs(
        &market_keyset,
        buy_quote_payload["quantity_minor"].as_u64().unwrap(),
        TEST_MARKET_DENOMINATIONS,
    );
    let (change_outputs, _change_pre_mint) = prepare_outputs(
        &usd_keyset,
        proof_amount_total(&funding_proofs).saturating_sub(4000),
        TEST_USD_DENOMINATIONS,
    );

    let first_buy_response = client
        .post(format!("{url}/api/trades/buy"))
        .json(&serde_json::json!({
            "event_id": event_id,
            "pubkey": creator,
            "side": "long",
            "spend_minor": 4000,
            "request_id": request_id,
            "proofs": funding_proofs.clone(),
            "issued_outputs": issued_outputs,
            "change_outputs": change_outputs
        }))
        .send()
        .await
        .unwrap();
    let first_buy_status = first_buy_response.status();
    let first_buy_payload: serde_json::Value = first_buy_response.json().await.unwrap();
    assert_eq!(first_buy_status, 201, "buy payload: {first_buy_payload}");
    let trade_id = first_buy_payload["trade"]["id"]
        .as_str()
        .unwrap()
        .to_string();

    let second_buy_response = client
        .post(format!("{url}/api/trades/buy"))
        .json(&serde_json::json!({
            "event_id": event_id,
            "pubkey": creator,
            "side": "long",
            "spend_minor": 4000,
            "request_id": request_id,
            "proofs": funding_proofs,
            "issued_outputs": [],
            "change_outputs": []
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(second_buy_response.status(), 200);
    let second_buy_payload: serde_json::Value = second_buy_response.json().await.unwrap();
    assert_eq!(
        second_buy_payload["trade"]["id"].as_str(),
        Some(trade_id.as_str())
    );
    assert_eq!(second_buy_payload["issued"], first_buy_payload["issued"]);
    assert_eq!(second_buy_payload["change"], first_buy_payload["change"]);

    let request_status_response = client
        .get(format!("{url}/api/trades/requests/{request_id}"))
        .send()
        .await
        .unwrap();
    assert_eq!(request_status_response.status(), 200);
    let request_status_payload: serde_json::Value = request_status_response.json().await.unwrap();
    assert_eq!(request_status_payload["status"].as_str(), Some("complete"));
    assert_eq!(
        request_status_payload["trade"]["id"].as_str(),
        Some(trade_id.as_str())
    );
    assert_eq!(
        request_status_payload["issued"],
        first_buy_payload["issued"]
    );
    assert_eq!(
        request_status_payload["change"],
        first_buy_payload["change"]
    );

    let detail_response = client
        .get(format!("{url}/api/product/markets/slug/{slug}"))
        .send()
        .await
        .unwrap();
    assert_eq!(detail_response.status(), 200);
    let detail_payload: serde_json::Value = detail_response.json().await.unwrap();
    assert_eq!(
        detail_payload["trades"].as_array().map(|items| items.len()),
        Some(1)
    );
}

#[tokio::test]
async fn test_trade_request_replays_buy_after_pre_issuance_checkpoint() {
    let context = create_product_test_context_with_funding(None, None, "signet").await;
    let url = context.url.clone();
    let client = reqwest::Client::new();
    let creator = "6767676767676767676767676767676767676767676767676767676767676767";
    let event_id = "8989898989898989898989898989898989898989898989898989898989898989";
    let slug = "trade-request-buy-restart-replay";
    let request_id = "req-buy-restart-replay-1";
    let trade_id = "trade-buy-restart-replay-1";

    client
        .post(format!("{url}/api/product/markets"))
        .json(&serde_json::json!({
            "event_id": event_id,
            "title": "Trade Request Buy Restart Replay Market",
            "description": "Replay a persisted buy request after a pre-issuance checkpoint",
            "slug": slug,
            "body": "Trade request restart replay body",
            "creator_pubkey": creator,
            "raw_event": sample_market_event(event_id, slug, creator),
            "b": 10.0
        }))
        .send()
        .await
        .unwrap();

    let market_keyset = fetch_market_keyset(&client, &url, event_id, "long").await;
    let buy_quote_response = client
        .post(format!("{url}/api/trades/quote"))
        .json(&serde_json::json!({
            "event_id": event_id,
            "side": "long",
            "spend_minor": 4000
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(buy_quote_response.status(), 200);
    let buy_quote_payload: serde_json::Value = buy_quote_response.json().await.unwrap();
    let buy_quote: cascade_api::types::ProductTradeQuoteResponse =
        serde_json::from_value(buy_quote_payload).unwrap();
    let (issued_outputs, _issued_pre_mint) = prepare_outputs(
        &market_keyset,
        buy_quote.quantity_minor,
        TEST_MARKET_DENOMINATIONS,
    );

    context
        .cascade_db
        .create_trade_execution_request(
            request_id,
            creator,
            event_id,
            "buy",
            "long",
            Some(4000),
            None,
        )
        .await
        .unwrap();

    let market = context
        .cascade_db
        .get_market(event_id)
        .await
        .unwrap()
        .unwrap();
    let settlement = cascade_core::product::TradeSettlementInsert {
        quote_id: buy_quote.quote_id.clone(),
        pubkey: creator.to_string(),
        market_event_id: event_id.to_string(),
        trade_type: "buy".to_string(),
        side: "long".to_string(),
        rail: "lightning".to_string(),
        mode: "bolt11_wallet_to_market".to_string(),
        settlement_minor: buy_quote.settlement_minor,
        settlement_msat: buy_quote.settlement_msat,
        settlement_fee_msat: buy_quote.settlement_fee_msat,
        fx_quote_id: buy_quote.fx_quote_id.clone(),
        invoice: Some("lnbc1tradebuyrestartreplay".to_string()),
        payment_hash: Some("trade-buy-restart-replay-payment-hash".to_string()),
        metadata_json: Some(
            serde_json::json!({
                "payer_role": "wallet_mint",
                "receiver_role": "market_mint",
                "invoice_state": "settled",
                "issued_bundle_request": {
                    "unit": format!("long_{slug}"),
                    "outputs": issued_outputs
                }
            })
            .to_string(),
        ),
    };
    let raw_event_json = serde_json::json!({
        "id": trade_id,
        "pubkey": creator,
        "kind": 983,
        "content": "",
        "tags": [
            ["e", event_id],
            ["p", creator],
            ["direction", "long"]
        ]
    })
    .to_string();

    context
        .cascade_db
        .apply_trade_execution_snapshots(
            trade_id,
            chrono::Utc::now().timestamp(),
            buy_quote.quote_id.as_deref(),
            creator,
            &market,
            "long",
            "buy",
            buy_quote.spend_minor,
            buy_quote.fee_minor,
            buy_quote.quantity,
            buy_quote.marginal_price_after_ppm,
            &raw_event_json,
            market.q_long + buy_quote.quantity,
            market.q_short,
            market.reserve_sats.saturating_add(buy_quote.spend_minor),
            Some(&settlement),
        )
        .await
        .unwrap();
    context
        .cascade_db
        .complete_trade_execution_request(request_id, trade_id, None)
        .await
        .unwrap();

    let restarted_state = cascade_api::routes::AppState::new_test(
        context.market_manager.clone(),
        context.invoice_service.clone(),
        context.fx_service.clone(),
        None,
        None,
        context.mint.clone(),
        context.cascade_db.clone(),
    );
    let replay_request = cascade_api::types::ProductCoordinatorBuyRequest {
        event_id: event_id.to_string(),
        pubkey: creator.to_string(),
        side: "long".to_string(),
        spend_minor: 4000,
        proofs: Vec::new(),
        issued_outputs: Vec::new(),
        change_outputs: Vec::new(),
        quote_id: buy_quote.quote_id.clone(),
        request_id: Some(request_id.to_string()),
    };

    let (first_status, Json(first_payload)) = cascade_api::handlers::product::buy_trade(
        State(restarted_state.clone()),
        HeaderMap::new(),
        Method::POST,
        Uri::from_static("/api/trades/buy"),
        Json(replay_request),
    )
    .await;
    assert_eq!(first_status, axum::http::StatusCode::OK);
    assert_eq!(first_payload["trade"]["id"].as_str(), Some(trade_id));
    assert_eq!(
        first_payload["issued"]["unit"].as_str(),
        Some(format!("long_{slug}").as_str())
    );
    assert!(
        first_payload["issued"]["signatures"]
            .as_array()
            .is_some_and(|items| !items.is_empty()),
        "buy replay should recover issued signatures: {first_payload}"
    );

    let replay_response = client
        .post(format!("{url}/api/trades/buy"))
        .json(&serde_json::json!({
            "event_id": event_id,
            "pubkey": creator,
            "side": "long",
            "spend_minor": 4000,
            "request_id": request_id,
            "proofs": [],
            "issued_outputs": [],
            "change_outputs": []
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(replay_response.status(), 200);
    let replay_payload: serde_json::Value = replay_response.json().await.unwrap();
    assert_eq!(replay_payload["trade"]["id"].as_str(), Some(trade_id));
    assert_eq!(replay_payload["issued"], first_payload["issued"]);

    let request_status_response = client
        .get(format!("{url}/api/trades/requests/{request_id}"))
        .send()
        .await
        .unwrap();
    assert_eq!(request_status_response.status(), 200);
    let request_status_payload: serde_json::Value = request_status_response.json().await.unwrap();
    assert_eq!(request_status_payload["status"].as_str(), Some("complete"));
    assert_eq!(
        request_status_payload["trade"]["id"].as_str(),
        Some(trade_id)
    );
    assert_eq!(request_status_payload["issued"], first_payload["issued"]);
}

#[tokio::test]
async fn test_lightning_fx_quote_preview() {
    let url = create_product_test_server().await;
    let client = reqwest::Client::new();

    let response = client
        .get(format!("{url}/api/product/fx/lightning/2500"))
        .send()
        .await
        .unwrap();

    assert_eq!(response.status(), 200);
    let payload: serde_json::Value = response.json().await.unwrap();
    assert_eq!(payload["amount_minor"].as_u64(), Some(2500));
    assert!(payload["amount_msat"].as_u64().unwrap() > 0);
    assert!(payload["btc_usd_price"].as_f64().unwrap() > 0.0);
    assert!(
        payload["metadata"]["reference_btc_usd_price"]
            .as_f64()
            .unwrap()
            > 0.0
    );
    assert!(payload["metadata"]["execution_spread_bps"]
        .as_u64()
        .is_some());
    assert!(payload["metadata"]["provider_count"].as_u64().is_some());
    assert_eq!(
        payload["metadata"]["quote_direction"].as_str(),
        Some("usd_to_msat")
    );
    assert!(payload["observations"]
        .as_array()
        .map(|items| !items.is_empty())
        .unwrap_or(false));
}

#[tokio::test]
async fn test_signet_funding_enforces_single_and_window_limits() {
    let url = create_product_test_server().await;
    let client = reqwest::Client::new();
    let pubkey = "abababababababababababababababababababababababababababababababab";

    let too_large_response = client
        .post(format!("{url}/v1/mint/quote/bolt11"))
        .json(&serde_json::json!({
            "pubkey": pubkey,
            "amount": 10001,
            "unit": "usd"
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(too_large_response.status(), 400);
    let too_large_payload: serde_json::Value = too_large_response.json().await.unwrap();
    assert_eq!(
        too_large_payload["error"].as_str(),
        Some("signet_funding_single_limit_exceeded:max_minor=10000")
    );

    for amount_minor in [10_000_u64, 10_000_u64, 5_000_u64] {
        let response = client
            .post(format!("{url}/v1/mint/quote/bolt11"))
            .json(&serde_json::json!({
                "pubkey": pubkey,
                "amount": amount_minor,
                "unit": "usd"
            }))
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), 200);
    }

    let capped_response = client
        .post(format!("{url}/v1/mint/quote/bolt11"))
        .json(&serde_json::json!({
            "pubkey": pubkey,
            "amount": 100,
            "unit": "usd"
        }))
        .send()
        .await
        .unwrap();
    assert_eq!(capped_response.status(), 429);
    let capped_payload: serde_json::Value = capped_response.json().await.unwrap();
    assert_eq!(
        capped_payload["error"].as_str(),
        Some("signet_funding_window_limit_exceeded:window_minor=25000:remaining_minor=0")
    );
}
