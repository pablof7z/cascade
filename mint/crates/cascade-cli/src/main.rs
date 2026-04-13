mod cli;
mod config;
mod proof_store;

use anyhow::{anyhow, bail, Context, Result};
use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use cascade_api::types::{
    BlindedMessageInput, MintBolt11Request, MintBolt11Response, MintQuoteBolt11Request,
    MintQuoteBolt11Response, ProductCoordinatorBuyRequest, ProductCoordinatorSellRequest,
    ProductCoordinatorTradeQuoteRequest, ProductCreateMarketRequest, ProductFeedResponse,
    ProductMarketDetailResponse,
    ProductPortfolioFundingRequestStatusResponse, ProductTradeExecutionResponse,
    ProductTradeQuoteResponse, ProductTradeRequestStatusResponse, ProductTradeStatusResponse,
    TokenOutput,
};
use cdk::amount::{FeeAndAmounts, SplitTarget};
use cdk::dhke::construct_proofs;
use cdk::nuts::{BlindSignature, CurrencyUnit, KeySet, KeysResponse, PreMintSecrets};
use cdk::Amount;
use clap::Parser;
use cli::*;
use config::{
    build_config, default_proof_store_path, ensure_identity_summary, load_config, normalize_relays,
    resolve_config_path, resolve_requested_edition, write_config, Edition, LoadedConfig,
};
use nostr::prelude::*;
use nostr_sdk::prelude::{Client, Filter};
use proof_store::{decode_token, encode_token, normalize_unit, ProofStore, WalletMetadata};
use reqwest::Method;
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, HashMap, HashSet};
use std::fs;
use std::path::PathBuf;
use std::time::Duration;
use uuid::Uuid;

#[tokio::main]
async fn main() {
    if let Err(error) = async_main().await {
        eprintln!("{error:#}");
        std::process::exit(1);
    }
}

async fn async_main() -> Result<()> {
    let cli = Cli::parse();
    let edition = resolve_requested_edition(cli.signet, cli.mainnet)?;
    let ctx = AppContext::new(cli, edition)?;
    dispatch(ctx).await
}

async fn dispatch(ctx: AppContext) -> Result<()> {
    match &ctx.cli.command {
        Command::Identity(command) => handle_identity(&ctx, command).await,
        Command::Api(command) => handle_api(&ctx, command).await,
        Command::Proofs(command) => handle_proofs(&ctx, command).await,
        Command::Market(command) => handle_market(&ctx, command).await,
        Command::Trade(command) => handle_trade(&ctx, command).await,
        Command::Portfolio(command) => handle_portfolio(&ctx, command).await,
        Command::Position(command) => handle_position(&ctx, command).await,
        Command::Discussion(command) => handle_discussion(&ctx, command).await,
        Command::Profile(command) => handle_profile(&ctx, command).await,
        Command::Bookmarks(command) => handle_bookmarks(&ctx, command).await,
        Command::Feed(command) => handle_feed(&ctx, command).await,
        Command::Activity(command) => handle_activity(&ctx, command).await,
        Command::Analytics(command) => handle_analytics(&ctx, command).await,
        Command::Leaderboard(command) => handle_leaderboard(&ctx, command).await,
    }
}

#[derive(Debug)]
struct AppContext {
    cli: Cli,
    edition: Option<Edition>,
    http: reqwest::Client,
}

impl AppContext {
    fn new(cli: Cli, edition: Option<Edition>) -> Result<Self> {
        Ok(Self {
            cli,
            edition,
            http: reqwest::Client::builder().build()?,
        })
    }

    fn config_path(&self) -> Result<PathBuf> {
        resolve_config_path(self.cli.config.as_ref(), self.edition)
    }

    fn load_config(&self) -> Result<LoadedConfig> {
        load_config(&self.config_path()?)
    }

    fn require_config(&self) -> Result<LoadedConfig> {
        self.load_config()
    }

    fn api_base(&self, loaded: &LoadedConfig) -> String {
        self.cli
            .api_base
            .clone()
            .unwrap_or_else(|| loaded.config.api_base_url.clone())
            .trim_end_matches('/')
            .to_string()
    }

    fn relays(&self, loaded: Option<&LoadedConfig>) -> Vec<String> {
        if !self.cli.relay.is_empty() {
            return normalize_relays(&self.cli.relay);
        }
        if let Some(loaded) = loaded {
            return normalize_relays(&loaded.config.relays);
        }
        normalize_relays(&Vec::new())
    }

    fn keys(&self, loaded: &LoadedConfig) -> Result<Keys> {
        Keys::parse(&loaded.config.identity.nsec).context("failed to parse identity nsec")
    }

    fn pubkey_hex(&self, loaded: &LoadedConfig) -> Result<String> {
        Ok(self.keys(loaded)?.public_key().to_string())
    }

    fn proof_store_path(&self, loaded: &LoadedConfig) -> PathBuf {
        PathBuf::from(&loaded.config.proof_store)
    }

    fn emit<T: Serialize>(&self, value: &T) -> Result<()> {
        let output = serde_json::to_string_pretty(value)?;
        println!("{output}");
        Ok(())
    }

    fn resolve_url(&self, loaded: &LoadedConfig, target: &str) -> Result<String> {
        if target.starts_with("http://") || target.starts_with("https://") {
            return Ok(target.to_string());
        }

        let base = self.api_base(loaded);
        Ok(reqwest::Url::parse(&format!("{}/", base))?
            .join(target.trim_start_matches('/'))?
            .to_string())
    }

    async fn request_json<R: DeserializeOwned>(
        &self,
        loaded: &LoadedConfig,
        method: Method,
        target: &str,
        body: Option<Value>,
        auth_mode: AuthMode,
    ) -> Result<R> {
        let url = self.resolve_url(loaded, target)?;
        let body_text = body
            .as_ref()
            .map(serde_json::to_string)
            .transpose()
            .context("failed to serialize request body")?;

        let mut builder = self.http.request(method.clone(), &url);
        if let Some(body_text) = &body_text {
            builder = builder
                .header("content-type", "application/json")
                .body(body_text.clone());
        }

        if auth_mode.should_sign() {
            let header = self.build_nip98_header(loaded, &method, &url, body_text.as_deref())?;
            builder = builder.header("Authorization", header);
        }

        let response = builder.send().await?;
        let status = response.status();
        let text = response.text().await?;
        if !status.is_success() {
            bail!(
                "request failed with HTTP {}: {}",
                status.as_u16(),
                text.trim()
            );
        }

        serde_json::from_str(&text)
            .with_context(|| format!("failed to decode response body from {url}: {text}"))
    }

    fn build_nip98_header(
        &self,
        loaded: &LoadedConfig,
        method: &Method,
        url: &str,
        body_text: Option<&str>,
    ) -> Result<String> {
        let keys = self.keys(loaded)?;
        let mut tags = vec![
            Tag::parse(vec!["u".to_string(), url.to_string()])?,
            Tag::parse(vec!["method".to_string(), method.as_str().to_string()])?,
        ];

        if let Some(body_text) = body_text {
            let digest = hex::encode(Sha256::digest(body_text.as_bytes()));
            tags.push(Tag::parse(vec!["payload".to_string(), digest])?);
        }

        let event = EventBuilder::new(Kind::HttpAuth, "")
            .tags(tags)
            .sign_with_keys(&keys)?;
        let encoded = BASE64_STANDARD.encode(serde_json::to_vec(&event)?);
        Ok(format!("Nostr {encoded}"))
    }

    async fn publish_event(
        &self,
        loaded: &LoadedConfig,
        kind: Kind,
        content: String,
        tags: Vec<Tag>,
    ) -> Result<PublishedEvent> {
        let keys = self.keys(loaded)?;
        let event = EventBuilder::new(kind, content)
            .tags(tags)
            .sign_with_keys(&keys)?;

        let client = build_nostr_client(Some(keys), &self.relays(Some(loaded))).await?;
        let output = client.send_event(&event).await?;
        client.disconnect().await;

        Ok(PublishedEvent {
            raw_event: serde_json::to_value(&event)?,
            event_id: event.id.to_string(),
            success_relays: output
                .success
                .into_iter()
                .map(|relay| relay.to_string())
                .collect(),
            failed_relays: output
                .failed
                .into_iter()
                .map(|(relay, error)| (relay.to_string(), error))
                .collect(),
        })
    }

    async fn fetch_events(
        &self,
        loaded: Option<&LoadedConfig>,
        filter: Filter,
    ) -> Result<Vec<Event>> {
        let client = build_nostr_client(None, &self.relays(loaded)).await?;
        let events = client.fetch_events(filter, Duration::from_secs(5)).await?;
        client.disconnect().await;
        let mut collected: Vec<Event> = events.into_iter().collect();
        collected.sort_by_key(|event| event.created_at.as_secs());
        Ok(collected)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum AuthMode {
    Auto,
    Nip98,
    None,
}

impl AuthMode {
    fn from_str(value: &str) -> Result<Self> {
        match value.trim().to_lowercase().as_str() {
            "auto" => Ok(Self::Auto),
            "nip98" => Ok(Self::Nip98),
            "none" => Ok(Self::None),
            other => bail!("unsupported auth mode {other}"),
        }
    }

    fn should_sign(self) -> bool {
        !matches!(self, Self::None)
    }
}

#[derive(Debug, Serialize)]
struct PublishedEvent {
    event_id: String,
    raw_event: Value,
    success_relays: Vec<String>,
    failed_relays: BTreeMap<String, String>,
}

#[derive(Debug, Serialize)]
struct MarketRecord {
    event_id: String,
    slug: String,
    title: String,
    description: String,
    created_at: i64,
    raw_event: Value,
}

#[derive(Debug, Serialize)]
struct LocalPositionView {
    market_event_id: String,
    market_slug: String,
    market_title: String,
    direction: String,
    quantity: f64,
    current_price_ppm: u64,
    market_value_minor: u64,
}

#[derive(Debug, Serialize)]
struct PortfolioView {
    pubkey: String,
    local_usd_minor: u64,
    proof_wallets: Vec<proof_store::ProofWalletSummary>,
    local_positions: Vec<LocalPositionView>,
}

#[derive(Debug, Serialize)]
struct ActivityEntry {
    kind: String,
    id: String,
    created_at: i64,
    title: String,
    detail: String,
}

#[derive(Debug, Deserialize)]
struct MarketCreateSpecFile {
    title: Option<String>,
    description: Option<String>,
    slug: Option<String>,
    body: Option<String>,
    #[serde(default)]
    categories: Vec<String>,
    #[serde(default)]
    topics: Vec<String>,
}

#[derive(Debug)]
struct MarketCreateSpec {
    title: String,
    description: String,
    slug: String,
    body: String,
    categories: Vec<String>,
    topics: Vec<String>,
}

async fn handle_identity(ctx: &AppContext, command: &IdentityCommand) -> Result<()> {
    match &command.command {
        IdentitySubcommand::Init(args) => {
            let edition = ctx
                .edition
                .ok_or_else(|| anyhow!("identity init requires --signet or --mainnet"))?;
            let config_path = ctx.config_path()?;
            let proof_store_path = default_proof_store_path(&config_path);
            let api_base = ctx
                .cli
                .api_base
                .clone()
                .ok_or_else(|| anyhow!("identity init requires --api-base"))?;
            let nsec = if let Some(nsec) = &args.nsec {
                nsec.clone()
            } else {
                Keys::generate().secret_key().to_bech32()?
            };

            let summary = ensure_identity_summary(&nsec)?;
            let config = build_config(
                edition,
                api_base,
                ctx.cli.relay.clone(),
                nsec,
                proof_store_path.clone(),
            );
            write_config(&config_path, &config)?;

            let mut store = ProofStore::empty();
            store.save(&proof_store_path)?;

            let mut output = json!({
                "edition": edition.as_str(),
                "config_path": config_path,
                "proof_store": proof_store_path,
                "api_base_url": config.api_base_url,
                "relays": config.relays,
                "pubkey": summary.pubkey,
                "npub": summary.npub,
                "imported_existing_nsec": args.nsec.is_some(),
            });

            if args.nsec.is_none() {
                let loaded = load_config(&config_path)?;
                let metadata = build_profile_content(args)?;
                let published = ctx
                    .publish_event(&loaded, Kind::Metadata, metadata, Vec::new())
                    .await?;
                output["profile_event"] = serde_json::to_value(published)?;
            }

            ctx.emit(&output)
        }
        IdentitySubcommand::Show => {
            let loaded = ctx.require_config()?;
            let summary = ensure_identity_summary(&loaded.config.identity.nsec)?;
            ctx.emit(&json!({
                "edition": loaded.config.edition.as_str(),
                "config_path": loaded.path,
                "proof_store": loaded.config.proof_store,
                "pubkey": summary.pubkey,
                "npub": summary.npub,
                "api_base_url": ctx.api_base(&loaded),
                "relays": ctx.relays(Some(&loaded)),
            }))
        }
    }
}

async fn handle_api(ctx: &AppContext, command: &ApiCommand) -> Result<()> {
    match &command.command {
        ApiSubcommand::Request(args) => {
            let loaded = ctx.require_config()?;
            let method = Method::from_bytes(args.method.as_bytes())?;
            let body = read_optional_json_arg(args.body.as_ref())?;
            let auth = AuthMode::from_str(&args.auth)?;
            let result: Value = ctx
                .request_json(&loaded, method, &args.target, body, auth)
                .await?;
            ctx.emit(&result)
        }
    }
}

async fn handle_proofs(ctx: &AppContext, command: &ProofsCommand) -> Result<()> {
    let loaded = ctx.require_config()?;
    let path = ctx.proof_store_path(&loaded);
    let mut store = ProofStore::load(&path)?;

    match &command.command {
        ProofsSubcommand::List => ctx.emit(&json!({ "wallets": store.list() })),
        ProofsSubcommand::Balance => {
            let balances: Vec<Value> = store
                .list()
                .into_iter()
                .map(|wallet| {
                    json!({
                        "mint_url": wallet.mint_url,
                        "unit": wallet.unit,
                        "amount": wallet.amount,
                        "proof_count": wallet.proof_count,
                    })
                })
                .collect();
            ctx.emit(&json!({ "balances": balances }))
        }
        ProofsSubcommand::Show(args) => {
            let unit = normalize_unit(&args.unit);
            let wallet = store
                .wallet(&unit)
                .ok_or_else(|| anyhow!("no wallet for unit {unit}"))?;
            ctx.emit(wallet)
        }
        ProofsSubcommand::Import(args) => {
            let token = read_text_arg(&args.token)?;
            let (mint_url, unit, proofs) = decode_token(&token)?;
            let summary = store.add_proofs(&mint_url, &unit, &proofs, WalletMetadata::default());
            store.save(&path)?;
            ctx.emit(&json!({
                "imported": proofs.len(),
                "wallet": summary,
            }))
        }
        ProofsSubcommand::Export(args) => {
            let unit = normalize_unit(&args.unit);
            let wallet = store
                .wallet(&unit)
                .ok_or_else(|| anyhow!("no wallet for unit {unit}"))?;
            if wallet.mint_url.is_empty() {
                bail!("wallet {unit} is missing a mint_url and cannot be exported");
            }
            let token = encode_token(&wallet.mint_url, &wallet.unit, &wallet.proofs)?;
            ctx.emit(&json!({
                "mint_url": wallet.mint_url,
                "unit": wallet.unit,
                "amount": wallet.proofs.iter().map(|proof| proof.amount).sum::<u64>(),
                "proof_count": wallet.proofs.len(),
                "token": token,
            }))
        }
        ProofsSubcommand::Remove(args) => {
            let secrets: HashSet<String> = args.secrets.iter().cloned().collect();
            let summary = store
                .remove_proofs_by_secret(&args.unit, &secrets)
                .ok_or_else(|| anyhow!("no wallet for unit {}", normalize_unit(&args.unit)))?;
            store.save(&path)?;
            ctx.emit(&json!({
                "removed": secrets.len(),
                "wallet": summary,
            }))
        }
    }
}

async fn handle_market(ctx: &AppContext, command: &MarketCommand) -> Result<()> {
    match &command.command {
        MarketSubcommand::List(args) => {
            let loaded = ctx.require_config()?;
            if let Some(creator) = &args.creator {
                if args.visibility != "public" {
                    bail!(
                        "creator market listing only supports --visibility public; use `cascade market pending <event_id>` for creator-only pending markets"
                    );
                }

                let public_market_ids = public_market_event_ids(ctx, &loaded).await?;
                let fetch_limit = args.limit.map(|limit| limit.max(100)).unwrap_or(200);
                let markets = fetch_creator_market_records(ctx, Some(&loaded), creator, fetch_limit)
                    .await?
                    .into_iter()
                    .filter(|market| public_market_ids.contains(&market.event_id))
                    .collect::<Vec<_>>();
                ctx.emit(&json!({ "markets": limit_vec(markets, args.limit) }))
            } else {
                let payload: ProductFeedResponse = ctx
                    .request_json(
                        &loaded,
                        Method::GET,
                        "/api/product/feed",
                        None,
                        AuthMode::None,
                    )
                    .await?;
                let markets: Vec<MarketRecord> = payload
                    .markets
                    .into_iter()
                    .filter_map(parse_market_record)
                    .collect();
                ctx.emit(&json!({ "markets": limit_vec(markets, args.limit) }))
            }
        }
        MarketSubcommand::Show(args) => {
            let loaded = ctx.require_config()?;
            let selector = resolve_market_selector(ctx, &loaded, &args.market).await?;
            let detail: ProductMarketDetailResponse = ctx
                .request_json(
                    &loaded,
                    Method::GET,
                    &format!("/api/product/markets/slug/{}", selector.slug),
                    None,
                    AuthMode::None,
                )
                .await?;
            ctx.emit(&detail)
        }
        MarketSubcommand::Pending(args) => {
            let loaded = ctx.require_config()?;
            let creator = match &args.creator {
                Some(creator) => creator.clone(),
                None => ctx.pubkey_hex(&loaded)?,
            };
            let detail: Value = ctx
                .request_json(
                    &loaded,
                    Method::GET,
                    &format!("/api/product/markets/{}/pending/{}", args.event_id, creator),
                    None,
                    AuthMode::Nip98,
                )
                .await?;
            ctx.emit(&detail)
        }
        MarketSubcommand::PriceHistory(args) => {
            let loaded = ctx.require_config()?;
            let selector = resolve_market_selector(ctx, &loaded, &args.market).await?;
            let history: Value = ctx
                .request_json(
                    &loaded,
                    Method::GET,
                    &format!("/api/market/{}/price-history", selector.event_id),
                    None,
                    AuthMode::None,
                )
                .await?;
            ctx.emit(&history)
        }
        MarketSubcommand::Activity(args) => {
            let loaded = ctx.require_config()?;
            let selector = resolve_market_selector(ctx, &loaded, &args.market).await?;
            let detail: ProductMarketDetailResponse = ctx
                .request_json(
                    &loaded,
                    Method::GET,
                    &format!("/api/product/markets/slug/{}", selector.slug),
                    None,
                    AuthMode::None,
                )
                .await?;
            let discussions =
                fetch_market_discussions(ctx, Some(&loaded), &selector.event_id).await?;
            let payload = json!({
                "market": detail.market,
                "trades": limit_json(detail.trades, args.limit),
                "discussion": limit_vec(discussions, args.limit),
            });
            ctx.emit(&payload)
        }
        MarketSubcommand::Create(args) => {
            let loaded = ctx.require_config()?;
            let keys = ctx.keys(&loaded)?;
            let selector = build_market_create_spec(args)?;

            let mut tags = vec![
                Tag::parse(vec!["title".to_string(), selector.title.clone()])?,
                Tag::parse(vec!["d".to_string(), selector.slug.clone()])?,
                Tag::parse(vec![
                    "description".to_string(),
                    selector.description.clone(),
                ])?,
                Tag::parse(vec!["status".to_string(), "open".to_string()])?,
            ];
            for category in &selector.categories {
                tags.push(Tag::parse(vec!["c".to_string(), category.clone()])?);
            }
            for topic in &selector.topics {
                tags.push(Tag::parse(vec!["t".to_string(), topic.clone()])?);
            }

            let event = EventBuilder::new(Kind::Custom(982), selector.body.clone())
                .tags(tags)
                .sign_with_keys(&keys)?;
            let raw_event = serde_json::to_value(&event)?;

            let client = build_nostr_client(Some(keys.clone()), &ctx.relays(Some(&loaded))).await?;
            let publish_output = client.send_event(&event).await?;
            client.disconnect().await;

            let create_request = ProductCreateMarketRequest {
                event_id: event.id.to_string(),
                title: selector.title.clone(),
                description: selector.description.clone(),
                slug: selector.slug.clone(),
                body: selector.body.clone(),
                creator_pubkey: keys.public_key().to_string(),
                raw_event: raw_event.clone(),
                b: 10.0,
            };

            let market_registration: Value = ctx
                .request_json(
                    &loaded,
                    Method::POST,
                    "/api/product/markets",
                    Some(serde_json::to_value(&create_request)?),
                    AuthMode::Nip98,
                )
                .await
                .or_else(|error| {
                    if error.to_string().contains("HTTP 409") {
                        Ok(json!({ "status": "existing_market" }))
                    } else {
                        Err(error)
                    }
                })?;

            let seed_result = execute_buy(
                ctx,
                &loaded,
                &event.id.to_string(),
                &selector.slug,
                &selector.title,
                &args.seed_side,
                args.seed_spend_minor,
                args.request_id.clone(),
            )
            .await?;

            ctx.emit(&json!({
                "market_event": raw_event,
                "published": {
                    "event_id": event.id.to_string(),
                    "success_relays": publish_output.success.into_iter().map(|relay| relay.to_string()).collect::<Vec<_>>(),
                    "failed_relays": publish_output.failed.into_iter().map(|(relay, error)| (relay.to_string(), error)).collect::<BTreeMap<_, _>>(),
                },
                "market_registration": market_registration,
                "seed_trade": seed_result,
            }))
        }
    }
}

async fn handle_trade(ctx: &AppContext, command: &TradeCommand) -> Result<()> {
    let loaded = ctx.require_config()?;
    match &command.command {
        TradeSubcommand::Quote(quote) => match &quote.command {
            TradeQuoteSubcommand::Buy(args) => {
                let selector = resolve_market_selector(ctx, &loaded, &args.market).await?;
                let payload: ProductTradeQuoteResponse = ctx
                    .request_json(
                        &loaded,
                        Method::POST,
                        "/api/trades/quote",
                        Some(serde_json::to_value(ProductCoordinatorTradeQuoteRequest {
                            event_id: selector.event_id,
                            side: args.side.clone(),
                            spend_minor: Some(args.spend_minor),
                            quantity: None,
                        })?),
                        AuthMode::None,
                    )
                    .await?;
                ctx.emit(&payload)
            }
            TradeQuoteSubcommand::Sell(args) => {
                let selector = resolve_market_selector(ctx, &loaded, &args.market).await?;
                let payload: ProductTradeQuoteResponse = ctx
                    .request_json(
                        &loaded,
                        Method::POST,
                        "/api/trades/sell/quote",
                        Some(serde_json::to_value(ProductCoordinatorTradeQuoteRequest {
                            event_id: selector.event_id,
                            side: args.side.clone(),
                            spend_minor: None,
                            quantity: Some(args.quantity),
                        })?),
                        AuthMode::None,
                    )
                    .await?;
                ctx.emit(&payload)
            }
        },
        TradeSubcommand::Buy(args) => {
            let selector = resolve_market_selector(ctx, &loaded, &args.market).await?;
            let result = execute_buy(
                ctx,
                &loaded,
                &selector.event_id,
                &selector.slug,
                &selector.title,
                &args.side,
                args.spend_minor,
                args.request_id.clone(),
            )
            .await?;
            ctx.emit(&result)
        }
        TradeSubcommand::Sell(args) => {
            let selector = resolve_market_selector(ctx, &loaded, &args.market).await?;
            let result = execute_sell(
                ctx,
                &loaded,
                &selector.event_id,
                &selector.slug,
                &selector.title,
                &args.side,
                args.quantity,
                args.request_id.clone(),
            )
            .await?;
            ctx.emit(&result)
        }
        TradeSubcommand::Status(args) => {
            let payload: ProductTradeStatusResponse = ctx
                .request_json(
                    &loaded,
                    Method::GET,
                    &format!("/api/trades/{}", args.id),
                    None,
                    AuthMode::None,
                )
                .await?;
            ctx.emit(&payload)
        }
        TradeSubcommand::RequestStatus(args) => {
            let payload: ProductTradeRequestStatusResponse = ctx
                .request_json(
                    &loaded,
                    Method::GET,
                    &format!("/api/trades/requests/{}", args.id),
                    None,
                    AuthMode::None,
                )
                .await?;
            ctx.emit(&payload)
        }
        TradeSubcommand::QuoteStatus(args) => {
            let payload: ProductTradeQuoteResponse = ctx
                .request_json(
                    &loaded,
                    Method::GET,
                    &format!("/api/trades/quotes/{}", args.id),
                    None,
                    AuthMode::None,
                )
                .await?;
            ctx.emit(&payload)
        }
    }
}

async fn handle_portfolio(ctx: &AppContext, command: &PortfolioCommand) -> Result<()> {
    let loaded = ctx.require_config()?;
    match &command.command {
        PortfolioSubcommand::Show => {
            let view = build_portfolio_view(ctx, &loaded).await?;
            ctx.emit(&view)
        }
        PortfolioSubcommand::Faucet(args) => {
            if loaded.config.edition != Edition::Signet {
                bail!("portfolio faucet is signet-only");
            }

            let quote: MintQuoteBolt11Response = ctx
                .request_json(
                    &loaded,
                    Method::POST,
                    "/v1/mint/quote/bolt11",
                    Some(serde_json::to_value(MintQuoteBolt11Request {
                        amount: args.amount_minor,
                        unit: "usd".to_string(),
                        description: Some(format!(
                            "Cascade portfolio funding for {}",
                            ctx.pubkey_hex(&loaded)?
                        )),
                        pubkey: Some(ctx.pubkey_hex(&loaded)?),
                        request_id: None,
                    })?),
                    AuthMode::None,
                )
                .await?;
            let paid_quote =
                wait_for_mint_quote_state(ctx, &loaded, &quote.quote, &["PAID"]).await?;
            let proofs =
                claim_lightning_quote_to_store(ctx, &loaded, &paid_quote.quote, paid_quote.amount)
                    .await?;
            ctx.emit(&json!({
                "quote": paid_quote,
                "imported_proofs": {
                    "count": proofs.len(),
                    "amount_minor": proofs.iter().map(|proof| proof.amount).sum::<u64>(),
                }
            }))
        }
        PortfolioSubcommand::Funding(funding) => match &funding.command {
            PortfolioFundingSubcommand::Lightning(lightning) => match &lightning.command {
                PortfolioLightningFundingSubcommand::Quote(args) => {
                    let payload: MintQuoteBolt11Response = ctx
                        .request_json(
                            &loaded,
                            Method::POST,
                            "/v1/mint/quote/bolt11",
                            Some(serde_json::to_value(MintQuoteBolt11Request {
                                amount: args.amount_minor,
                                unit: "usd".to_string(),
                                description: Some(format!(
                                    "Cascade portfolio funding for {}",
                                    ctx.pubkey_hex(&loaded)?
                                )),
                                pubkey: Some(ctx.pubkey_hex(&loaded)?),
                                request_id: args.request_id.clone(),
                            })?),
                            AuthMode::None,
                        )
                        .await?;
                    ctx.emit(&payload)
                }
            },
            PortfolioFundingSubcommand::Status(args) => {
                let payload: MintQuoteBolt11Response = ctx
                    .request_json(
                        &loaded,
                        Method::GET,
                        &format!("/v1/mint/quote/bolt11/{}", args.id),
                        None,
                        AuthMode::None,
                    )
                    .await?;
                ctx.emit(&payload)
            }
            PortfolioFundingSubcommand::RequestStatus(args) => {
                let payload: ProductPortfolioFundingRequestStatusResponse = ctx
                    .request_json(
                        &loaded,
                        Method::GET,
                        &format!("/api/portfolio/funding/requests/{}", args.id),
                        None,
                        AuthMode::None,
                    )
                    .await?;
                ctx.emit(&payload)
            }
            PortfolioFundingSubcommand::Settle(args) => {
                let quote: MintQuoteBolt11Response = ctx
                    .request_json(
                        &loaded,
                        Method::GET,
                        &format!("/v1/mint/quote/bolt11/{}", args.id),
                        None,
                        AuthMode::None,
                    )
                    .await?;

                if !quote.state.eq_ignore_ascii_case("PAID") {
                    ctx.emit(&json!({
                        "quote": quote,
                        "message": "quote is not paid yet; nothing to claim"
                    }))
                } else {
                    let proofs =
                        claim_lightning_quote_to_store(ctx, &loaded, &quote.quote, quote.amount)
                            .await?;
                    ctx.emit(&json!({
                        "quote": quote,
                        "imported_proofs": {
                            "count": proofs.len(),
                            "amount_minor": proofs.iter().map(|proof| proof.amount).sum::<u64>(),
                        }
                    }))
                }
            }
        },
    }
}

async fn handle_position(ctx: &AppContext, command: &PositionCommand) -> Result<()> {
    match &command.command {
        PositionSubcommand::Sync => {
            let loaded = ctx.require_config()?;
            let mut store = ProofStore::load(&ctx.proof_store_path(&loaded))?;
            let existing = fetch_existing_position_events(ctx, &loaded).await?;
            let mut published = Vec::new();
            let mut seen_keys = HashSet::new();

            for wallet in store.wallets.clone() {
                if wallet.unit == "usd" || wallet.proofs.is_empty() {
                    continue;
                }

                let (slug, direction) = parse_market_unit(&wallet.unit)
                    .ok_or_else(|| anyhow!("unsupported market proof unit {}", wallet.unit))?;
                let selector = resolve_market_selector(ctx, &loaded, &slug).await?;
                let quantity_minor: u64 = wallet.proofs.iter().map(|proof| proof.amount).sum();
                let quantity = share_minor_to_quantity(quantity_minor);
                let key = format!("{}:{}", selector.event_id, direction);
                seen_keys.insert(key.clone());

                let content = json!({
                    "marketId": selector.event_id,
                    "marketTitle": selector.title,
                    "direction": direction,
                    "quantity": quantity
                })
                .to_string();
                let tags = vec![
                    Tag::parse(vec![
                        "d".to_string(),
                        format!("cascade:position:{}:{}", selector.event_id, direction),
                    ])?,
                    Tag::parse(vec!["c".to_string(), "cascade".to_string()])?,
                    Tag::parse(vec!["v".to_string(), "1".to_string()])?,
                ];
                let event = ctx
                    .publish_event(&loaded, Kind::Custom(30078), content, tags)
                    .await?;
                published.push(event);

                let _ = store.add_proofs(
                    &wallet.mint_url,
                    &wallet.unit,
                    &[],
                    WalletMetadata {
                        market_event_id: Some(&selector.event_id),
                        market_slug: Some(&selector.slug),
                        market_title: Some(&selector.title),
                        side: Some(direction),
                    },
                );
            }

            for stale in existing {
                let key = stale.key.clone();
                if seen_keys.contains(&key) {
                    continue;
                }
                let content = json!({
                    "marketId": stale.market_event_id,
                    "marketTitle": stale.market_title,
                    "direction": stale.direction,
                    "quantity": 0
                })
                .to_string();
                let tags = vec![
                    Tag::parse(vec![
                        "d".to_string(),
                        format!(
                            "cascade:position:{}:{}",
                            stale.market_event_id, stale.direction
                        ),
                    ])?,
                    Tag::parse(vec!["c".to_string(), "cascade".to_string()])?,
                    Tag::parse(vec!["v".to_string(), "1".to_string()])?,
                ];
                published.push(
                    ctx.publish_event(&loaded, Kind::Custom(30078), content, tags)
                        .await?,
                );
            }

            store.save(&ctx.proof_store_path(&loaded))?;
            ctx.emit(&json!({ "published": published }))
        }
    }
}

async fn handle_profile(ctx: &AppContext, command: &ProfileCommand) -> Result<()> {
    match &command.command {
        ProfileSubcommand::Show(args) => {
            let loaded = ctx.require_config()?;
            let pubkey = parse_public_key(&args.identifier)?;
            let event = fetch_latest_event(
                ctx,
                Some(&loaded),
                Filter::new().author(pubkey).kind(Kind::Metadata).limit(1),
            )
            .await?;
            ctx.emit(&json!({
                "identifier": args.identifier,
                "pubkey": pubkey.to_string(),
                "profile": event.map(|event| serde_json::to_value(event)).transpose()?,
            }))
        }
        ProfileSubcommand::Update(args) => {
            let loaded = ctx.require_config()?;
            let content = build_profile_content(args)?;
            let published = ctx
                .publish_event(&loaded, Kind::Metadata, content, Vec::new())
                .await?;
            ctx.emit(&published)
        }
        ProfileSubcommand::Follow(args) => {
            let loaded = ctx.require_config()?;
            let target = parse_public_key(&args.identifier)?;
            let published = update_contact_list(ctx, &loaded, target, true).await?;
            ctx.emit(&published)
        }
        ProfileSubcommand::Unfollow(args) => {
            let loaded = ctx.require_config()?;
            let target = parse_public_key(&args.identifier)?;
            let published = update_contact_list(ctx, &loaded, target, false).await?;
            ctx.emit(&published)
        }
        ProfileSubcommand::Follows(args) => {
            let loaded = ctx.require_config()?;
            let pubkey = parse_public_key(&args.identifier)?;
            let event = fetch_latest_event(
                ctx,
                Some(&loaded),
                Filter::new()
                    .author(pubkey)
                    .kind(Kind::ContactList)
                    .limit(1),
            )
            .await?;
            let follows = event
                .map(|event| {
                    event
                        .tags
                        .into_iter()
                        .filter_map(|tag| {
                            let tag = tag.as_slice();
                            match tag.first().map(|value| value.as_str()) {
                                Some("p") => tag.get(1).map(ToString::to_string),
                                _ => None,
                            }
                        })
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();
            ctx.emit(&json!({
                "identifier": args.identifier,
                "pubkey": pubkey.to_string(),
                "follows": follows,
            }))
        }
    }
}

async fn handle_bookmarks(ctx: &AppContext, command: &BookmarksCommand) -> Result<()> {
    let loaded = ctx.require_config()?;
    match &command.command {
        BookmarksSubcommand::List => {
            let event = fetch_latest_event(
                ctx,
                Some(&loaded),
                Filter::new()
                    .author(ctx.keys(&loaded)?.public_key())
                    .kind(Kind::Bookmarks)
                    .limit(1),
            )
            .await?;
            let event_ids = event
                .as_ref()
                .map(|event| {
                    event
                        .tags
                        .iter()
                        .filter_map(|tag| {
                            let tag = tag.as_slice();
                            match tag.first().map(|value| value.as_str()) {
                                Some("e") => tag.get(1).map(ToString::to_string),
                                _ => None,
                            }
                        })
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();
            ctx.emit(&json!({ "event_ids": event_ids, "raw_event": event.map(serde_json::to_value).transpose()? }))
        }
        BookmarksSubcommand::Add(args) => {
            let selector = resolve_market_selector(ctx, &loaded, &args.market).await?;
            let published = update_bookmarks(ctx, &loaded, &selector.event_id, true).await?;
            ctx.emit(&published)
        }
        BookmarksSubcommand::Remove(args) => {
            let selector = resolve_market_selector(ctx, &loaded, &args.market).await?;
            let published = update_bookmarks(ctx, &loaded, &selector.event_id, false).await?;
            ctx.emit(&published)
        }
    }
}

async fn handle_discussion(ctx: &AppContext, command: &DiscussionCommand) -> Result<()> {
    let loaded = ctx.require_config()?;
    let selector = resolve_market_selector(ctx, &loaded, &command.market).await?;

    let is_write = command.title.is_some() || command.reply.is_some() || command.content.is_some();
    if !is_write {
        if let Some(thread_id) = &command.thread {
            let discussions =
                fetch_market_discussions(ctx, Some(&loaded), &selector.event_id).await?;
            let thread = build_discussion_threads(&discussions, &selector.event_id)
                .into_iter()
                .find(|thread| thread.post.id == *thread_id)
                .ok_or_else(|| anyhow!("thread {} not found", thread_id))?;
            return ctx.emit(&thread);
        }

        let discussions = fetch_market_discussions(ctx, Some(&loaded), &selector.event_id).await?;
        let threads = build_discussion_threads(&discussions, &selector.event_id);
        return ctx.emit(&json!({
            "market": selector,
            "threads": threads,
        }));
    }

    if command.title.is_some() == command.reply.is_some() {
        bail!("discussion write requires exactly one of --title or --reply");
    }

    let content = read_required_text_arg(command.content.as_ref(), "--content")?;
    let mut tags = vec![
        Tag::parse(vec![
            "e".to_string(),
            selector.event_id.clone(),
            "".to_string(),
            "root".to_string(),
        ])?,
        Tag::parse(vec!["k".to_string(), "982".to_string()])?,
    ];

    if let Some(title) = &command.title {
        tags.push(Tag::parse(vec!["subject".to_string(), title.clone()])?);
    }

    if let Some(reply) = &command.reply {
        tags.push(Tag::parse(vec![
            "e".to_string(),
            reply.clone(),
            "".to_string(),
            "reply".to_string(),
        ])?);
    }

    let published = ctx
        .publish_event(&loaded, Kind::Custom(1111), content, tags)
        .await?;
    ctx.emit(&published)
}

async fn handle_feed(ctx: &AppContext, command: &FeedCommand) -> Result<()> {
    let loaded = ctx.require_config()?;
    match &command.command {
        FeedSubcommand::Home => {
            let payload: ProductFeedResponse = ctx
                .request_json(
                    &loaded,
                    Method::GET,
                    "/api/product/feed",
                    None,
                    AuthMode::None,
                )
                .await?;
            ctx.emit(&payload)
        }
    }
}

async fn handle_activity(ctx: &AppContext, command: &ActivityCommand) -> Result<()> {
    let loaded = ctx.require_config()?;
    match &command.command {
        ActivitySubcommand::List(args) => {
            let feed: ProductFeedResponse = ctx
                .request_json(
                    &loaded,
                    Method::GET,
                    "/api/product/feed",
                    None,
                    AuthMode::None,
                )
                .await?;
            let discussions =
                fetch_recent_discussions(ctx, Some(&loaded), args.limit.unwrap_or(80)).await?;
            let mut entries = Vec::new();

            for market in feed.markets.into_iter().filter_map(parse_market_record) {
                entries.push(ActivityEntry {
                    kind: "market".to_string(),
                    id: market.event_id,
                    created_at: market.created_at,
                    title: market.title,
                    detail: market.description,
                });
            }
            for trade in feed.trades {
                if let Some(entry) = parse_trade_activity(&trade) {
                    entries.push(entry);
                }
            }
            for discussion in discussions {
                entries.push(ActivityEntry {
                    kind: "discussion".to_string(),
                    id: discussion.id.clone(),
                    created_at: discussion.created_at,
                    title: discussion
                        .subject
                        .unwrap_or_else(|| "Discussion update".to_string()),
                    detail: discussion.content,
                });
            }

            entries.sort_by(|left, right| right.created_at.cmp(&left.created_at));
            ctx.emit(&json!({ "entries": limit_vec(entries, args.limit) }))
        }
    }
}

async fn handle_analytics(ctx: &AppContext, command: &AnalyticsCommand) -> Result<()> {
    let loaded = ctx.require_config()?;
    match &command.command {
        AnalyticsSubcommand::Summary => {
            let feed: ProductFeedResponse = ctx
                .request_json(
                    &loaded,
                    Method::GET,
                    "/api/product/feed",
                    None,
                    AuthMode::None,
                )
                .await?;
            let discussions = fetch_recent_discussions(ctx, Some(&loaded), 160).await?;
            let market_count = feed.markets.len();
            let trade_count = feed.trades.len();
            let discussion_count = discussions.len();
            let unique_creators = feed
                .markets
                .iter()
                .filter_map(|market| market.get("pubkey").and_then(Value::as_str))
                .collect::<HashSet<_>>()
                .len();
            let unique_discussion_authors = discussions
                .iter()
                .map(|discussion| discussion.pubkey.as_str())
                .collect::<HashSet<_>>()
                .len();
            ctx.emit(&json!({
                "market_count": market_count,
                "trade_count": trade_count,
                "discussion_count": discussion_count,
                "unique_creators": unique_creators,
                "unique_discussion_authors": unique_discussion_authors,
            }))
        }
    }
}

async fn handle_leaderboard(ctx: &AppContext, command: &LeaderboardCommand) -> Result<()> {
    let loaded = ctx.require_config()?;
    match &command.command {
        LeaderboardSubcommand::Show => {
            let feed: ProductFeedResponse = ctx
                .request_json(
                    &loaded,
                    Method::GET,
                    "/api/product/feed",
                    None,
                    AuthMode::None,
                )
                .await?;
            let markets: Vec<MarketRecord> = feed
                .markets
                .into_iter()
                .filter_map(parse_market_record)
                .collect();
            let discussions = fetch_recent_discussions(ctx, Some(&loaded), 240).await?;
            let bookmark_events = ctx
                .fetch_events(
                    Some(&loaded),
                    Filter::new().kind(Kind::Bookmarks).limit(200),
                )
                .await?;

            let mut bookmark_counts: HashMap<String, u64> = HashMap::new();
            for event in bookmark_events {
                for tag in event.tags {
                    let values = tag.as_slice();
                    if values.first().map(|value| value.as_str()) != Some("e") {
                        continue;
                    }
                    if let Some(event_id) = values.get(1) {
                        *bookmark_counts.entry(event_id.to_string()).or_default() += 1;
                    }
                }
            }

            let mut creator_counts: HashMap<String, u64> = HashMap::new();
            for market in &markets {
                if let Some(pubkey) = market
                    .raw_event
                    .get("pubkey")
                    .and_then(Value::as_str)
                    .map(ToString::to_string)
                {
                    *creator_counts.entry(pubkey).or_default() += 1;
                }
            }

            let mut market_rows: Vec<Value> = markets
                .iter()
                .map(|market| {
                    let discussion_count = discussions
                        .iter()
                        .filter(|discussion| discussion.market_id == market.event_id)
                        .count();
                    json!({
                        "event_id": market.event_id,
                        "slug": market.slug,
                        "title": market.title,
                        "bookmark_count": bookmark_counts.get(&market.event_id).copied().unwrap_or(0),
                        "discussion_count": discussion_count,
                    })
                })
                .collect();
            market_rows.sort_by(|left, right| {
                right["bookmark_count"]
                    .as_u64()
                    .cmp(&left["bookmark_count"].as_u64())
                    .then(
                        right["discussion_count"]
                            .as_u64()
                            .cmp(&left["discussion_count"].as_u64()),
                    )
            });

            let mut creator_rows: Vec<Value> = creator_counts
                .into_iter()
                .map(|(pubkey, markets_created)| json!({ "pubkey": pubkey, "markets_created": markets_created }))
                .collect();
            creator_rows.sort_by(|left, right| {
                right["markets_created"]
                    .as_u64()
                    .cmp(&left["markets_created"].as_u64())
            });

            ctx.emit(&json!({
                "markets": market_rows,
                "creators": creator_rows,
            }))
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct DiscussionRecord {
    id: String,
    pubkey: String,
    market_id: String,
    root_id: String,
    reply_to: Option<String>,
    subject: Option<String>,
    content: String,
    created_at: i64,
    raw_event: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct DiscussionThread {
    post: DiscussionRecord,
    replies: Vec<DiscussionThread>,
    reply_count: usize,
}

#[derive(Debug, Clone, Serialize)]
struct ResolvedMarketSelector {
    event_id: String,
    slug: String,
    title: String,
}

fn keyset_denominations(keyset: &KeySet) -> Vec<u64> {
    let mut denominations: Vec<u64> = keyset
        .keys
        .keys()
        .iter()
        .map(|(amount, _)| amount.to_u64())
        .collect();
    denominations.sort_unstable();
    denominations
}

async fn fetch_active_usd_keyset(ctx: &AppContext, loaded: &LoadedConfig) -> Result<KeySet> {
    let payload: KeysResponse = ctx
        .request_json(loaded, Method::GET, "/v1/keys", None, AuthMode::None)
        .await?;

    payload
        .keysets
        .into_iter()
        .find(|keyset| keyset.unit == CurrencyUnit::Usd && keyset.active.unwrap_or(false))
        .ok_or_else(|| anyhow!("active USD keyset not found"))
}

async fn fetch_market_keyset(
    ctx: &AppContext,
    loaded: &LoadedConfig,
    event_id: &str,
    side: &str,
) -> Result<KeySet> {
    let payload: Value = ctx
        .request_json(
            loaded,
            Method::GET,
            &format!("/{event_id}/v1/keys"),
            None,
            AuthMode::None,
        )
        .await?;
    let payload = payload.get("Ok").cloned().unwrap_or(payload);
    let keyset = if side.eq_ignore_ascii_case("yes") || side.eq_ignore_ascii_case("long") {
        payload["long_keyset"].clone()
    } else {
        payload["short_keyset"].clone()
    };

    let id = keyset["id"]
        .as_str()
        .ok_or_else(|| anyhow!("market keyset id missing"))?;
    let unit = keyset["unit"]
        .as_str()
        .ok_or_else(|| anyhow!("market keyset unit missing"))?;
    let keys = keyset["keys"]
        .as_object()
        .ok_or_else(|| anyhow!("market keyset keys missing"))?
        .iter()
        .map(|(amount, public_key)| {
            Ok((
                amount.clone(),
                Value::String(
                    public_key["pubkey"]
                        .as_str()
                        .ok_or_else(|| anyhow!("market keyset pubkey missing"))?
                        .to_string(),
                ),
            ))
        })
        .collect::<Result<serde_json::Map<String, Value>>>()?;

    serde_json::from_value(json!({
        "id": id,
        "unit": unit,
        "active": true,
        "keys": keys
    }))
    .context("failed to decode market keyset")
}

fn prepare_outputs(
    keyset: &KeySet,
    amount: u64,
) -> Result<(Vec<BlindedMessageInput>, Option<PreMintSecrets>)> {
    if amount == 0 {
        return Ok((Vec::new(), None));
    }

    let pre_mint = PreMintSecrets::random(
        keyset.id,
        Amount::from(amount),
        &SplitTarget::default(),
        &FeeAndAmounts::from((0, keyset_denominations(keyset))),
    )?;

    let outputs = serde_json::from_value(serde_json::to_value(pre_mint.blinded_messages())?)?;
    Ok((outputs, Some(pre_mint)))
}

fn proofs_from_signatures(
    signatures: &[TokenOutput],
    pre_mint: &PreMintSecrets,
    keyset: &KeySet,
) -> Result<Vec<cascade_api::types::ProofInput>> {
    if signatures.is_empty() {
        return Ok(Vec::new());
    }

    let blind_signatures: Vec<BlindSignature> =
        serde_json::from_value(serde_json::to_value(signatures)?)?;
    let proofs = construct_proofs(
        blind_signatures,
        pre_mint.rs(),
        pre_mint.secrets(),
        &keyset.keys,
    )?;
    serde_json::from_value(serde_json::to_value(proofs)?)
        .context("failed to decode proofs from blind signatures")
}

async fn wait_for_mint_quote_state(
    ctx: &AppContext,
    loaded: &LoadedConfig,
    quote_id: &str,
    expected_states: &[&str],
) -> Result<MintQuoteBolt11Response> {
    let mut last_state = String::new();
    for _ in 0..50 {
        let payload: MintQuoteBolt11Response = ctx
            .request_json(
                loaded,
                Method::GET,
                &format!("/v1/mint/quote/bolt11/{quote_id}"),
                None,
                AuthMode::None,
            )
            .await?;
        last_state = payload.state.clone();
        if expected_states
            .iter()
            .any(|state| payload.state.eq_ignore_ascii_case(state))
        {
            return Ok(payload);
        }
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    }

    bail!("mint quote {quote_id} did not reach expected state; last state {last_state}");
}

async fn claim_lightning_quote_to_store(
    ctx: &AppContext,
    loaded: &LoadedConfig,
    quote_id: &str,
    amount_minor: u64,
) -> Result<Vec<cascade_api::types::ProofInput>> {
    let usd_keyset = fetch_active_usd_keyset(ctx, loaded).await?;
    let (outputs, pre_mint) = prepare_outputs(&usd_keyset, amount_minor)?;
    let pre_mint = pre_mint.ok_or_else(|| anyhow!("cannot claim a zero-amount mint quote"))?;
    let payload: MintBolt11Response = ctx
        .request_json(
            loaded,
            Method::POST,
            "/v1/mint/bolt11",
            Some(serde_json::to_value(MintBolt11Request {
                quote: quote_id.to_string(),
                outputs,
            })?),
            AuthMode::None,
        )
        .await?;
    let proofs = proofs_from_signatures(&payload.signatures, &pre_mint, &usd_keyset)?;

    let path = ctx.proof_store_path(loaded);
    let mut store = ProofStore::load(&path)?;
    store.add_proofs(
        &loaded.config.api_base_url,
        "usd",
        &proofs,
        WalletMetadata::default(),
    );
    store.save(&path)?;

    Ok(proofs)
}

async fn execute_buy(
    ctx: &AppContext,
    loaded: &LoadedConfig,
    event_id: &str,
    slug: &str,
    title: &str,
    side: &str,
    spend_minor: u64,
    request_id: Option<String>,
) -> Result<Value> {
    let path = ctx.proof_store_path(loaded);
    let mut store = ProofStore::load(&path)?;
    let spend_proofs = store.select_for_amount("usd", spend_minor)?;
    let input_total_minor: u64 = spend_proofs.iter().map(|proof| proof.amount).sum();
    let request_id = request_id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let quote: ProductTradeQuoteResponse = ctx
        .request_json(
            loaded,
            Method::POST,
            "/api/trades/quote",
            Some(serde_json::to_value(ProductCoordinatorTradeQuoteRequest {
                event_id: event_id.to_string(),
                side: side.to_string(),
                spend_minor: Some(spend_minor),
                quantity: None,
            })?),
            AuthMode::None,
        )
        .await?;
    let market_keyset = fetch_market_keyset(ctx, loaded, event_id, side).await?;
    let usd_keyset = fetch_active_usd_keyset(ctx, loaded).await?;
    let (issued_outputs, issued_pre_mint) = prepare_outputs(&market_keyset, quote.quantity_minor)?;
    let (change_outputs, change_pre_mint) = prepare_outputs(
        &usd_keyset,
        input_total_minor.saturating_sub(quote.spend_minor),
    )?;
    let issued_pre_mint =
        issued_pre_mint.ok_or_else(|| anyhow!("buy quote returned zero issued amount"))?;
    let payload: ProductTradeExecutionResponse = ctx
        .request_json(
            loaded,
            Method::POST,
            "/api/trades/buy",
            Some(serde_json::to_value(ProductCoordinatorBuyRequest {
                event_id: event_id.to_string(),
                pubkey: ctx.pubkey_hex(loaded)?,
                side: side.to_string(),
                spend_minor,
                proofs: spend_proofs.clone(),
                issued_outputs,
                change_outputs,
                quote_id: quote.quote_id.clone(),
                request_id: Some(request_id.clone()),
            })?),
            AuthMode::Nip98,
        )
        .await?;

    let spent_commitments: HashSet<String> =
        spend_proofs.iter().map(|proof| proof.C.clone()).collect();
    let _ = store.remove_proofs_by_commitment("usd", &spent_commitments);
    if let Some(change) = &payload.change {
        let change_pre_mint = change_pre_mint
            .as_ref()
            .ok_or_else(|| anyhow!("buy change signatures returned without prepared outputs"))?;
        let change_proofs =
            proofs_from_signatures(&change.signatures, change_pre_mint, &usd_keyset)?;
        store.add_proofs(
            &loaded.config.api_base_url,
            &change.unit,
            &change_proofs,
            WalletMetadata::default(),
        );
    }
    if let Some(issued) = &payload.issued {
        let issued_proofs =
            proofs_from_signatures(&issued.signatures, &issued_pre_mint, &market_keyset)?;
        store.add_proofs(
            &loaded.config.api_base_url,
            &issued.unit,
            &issued_proofs,
            WalletMetadata {
                market_event_id: Some(event_id),
                market_slug: Some(slug),
                market_title: Some(title),
                side: Some(side),
            },
        );
    }
    store.save(&path)?;
    sync_positions_after_trade(ctx, loaded).await?;

    Ok(json!({
        "request_id": request_id,
        "trade": payload,
    }))
}

async fn execute_sell(
    ctx: &AppContext,
    loaded: &LoadedConfig,
    event_id: &str,
    slug: &str,
    title: &str,
    side: &str,
    quantity: f64,
    request_id: Option<String>,
) -> Result<Value> {
    let path = ctx.proof_store_path(loaded);
    let mut store = ProofStore::load(&path)?;
    let unit = market_unit_for_side(slug, side)?;
    let target_minor = quantity_to_share_minor(quantity)?;
    let spend_proofs = store.select_for_amount(&unit, target_minor)?;
    let input_total_minor: u64 = spend_proofs.iter().map(|proof| proof.amount).sum();
    let request_id = request_id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let quote: ProductTradeQuoteResponse = ctx
        .request_json(
            loaded,
            Method::POST,
            "/api/trades/sell/quote",
            Some(serde_json::to_value(ProductCoordinatorTradeQuoteRequest {
                event_id: event_id.to_string(),
                side: side.to_string(),
                spend_minor: None,
                quantity: Some(quantity),
            })?),
            AuthMode::None,
        )
        .await?;
    let market_keyset = fetch_market_keyset(ctx, loaded, event_id, side).await?;
    let usd_keyset = fetch_active_usd_keyset(ctx, loaded).await?;
    let (issued_outputs, issued_pre_mint) = prepare_outputs(&usd_keyset, quote.net_minor)?;
    let (change_outputs, change_pre_mint) = prepare_outputs(
        &market_keyset,
        input_total_minor.saturating_sub(quote.quantity_minor),
    )?;
    let issued_pre_mint =
        issued_pre_mint.ok_or_else(|| anyhow!("sell quote returned zero issued amount"))?;

    let payload: ProductTradeExecutionResponse = ctx
        .request_json(
            loaded,
            Method::POST,
            "/api/trades/sell",
            Some(serde_json::to_value(ProductCoordinatorSellRequest {
                event_id: event_id.to_string(),
                pubkey: ctx.pubkey_hex(loaded)?,
                side: side.to_string(),
                quantity,
                proofs: spend_proofs.clone(),
                issued_outputs,
                change_outputs,
                quote_id: quote.quote_id.clone(),
                request_id: Some(request_id.clone()),
            })?),
            AuthMode::Nip98,
        )
        .await?;

    let spent_commitments: HashSet<String> =
        spend_proofs.iter().map(|proof| proof.C.clone()).collect();
    let _ = store.remove_proofs_by_commitment(&unit, &spent_commitments);
    if let Some(change) = &payload.change {
        let change_pre_mint = change_pre_mint
            .as_ref()
            .ok_or_else(|| anyhow!("sell change signatures returned without prepared outputs"))?;
        let change_proofs =
            proofs_from_signatures(&change.signatures, change_pre_mint, &market_keyset)?;
        store.add_proofs(
            &loaded.config.api_base_url,
            &change.unit,
            &change_proofs,
            WalletMetadata {
                market_event_id: Some(event_id),
                market_slug: Some(slug),
                market_title: Some(title),
                side: Some(side),
            },
        );
    }
    if let Some(issued) = &payload.issued {
        let issued_proofs =
            proofs_from_signatures(&issued.signatures, &issued_pre_mint, &usd_keyset)?;
        store.add_proofs(
            &loaded.config.api_base_url,
            &issued.unit,
            &issued_proofs,
            WalletMetadata::default(),
        );
    }
    store.save(&path)?;
    sync_positions_after_trade(ctx, loaded).await?;

    Ok(json!({
        "request_id": request_id,
        "trade": payload,
    }))
}

async fn sync_positions_after_trade(ctx: &AppContext, _loaded: &LoadedConfig) -> Result<()> {
    let position_command = PositionCommand {
        command: PositionSubcommand::Sync,
    };
    let _ = handle_position(ctx, &position_command).await;
    Ok(())
}

async fn build_portfolio_view(ctx: &AppContext, loaded: &LoadedConfig) -> Result<PortfolioView> {
    let store = ProofStore::load(&ctx.proof_store_path(loaded))?;
    let pubkey = ctx.pubkey_hex(loaded)?;

    let local_usd_minor = store
        .wallet("usd")
        .map(|wallet| wallet.proofs.iter().map(|proof| proof.amount).sum())
        .unwrap_or(0);

    let mut positions = Vec::new();
    for wallet in store.wallets.iter().filter(|wallet| wallet.unit != "usd") {
        let (slug, side) = match parse_market_unit(&wallet.unit) {
            Some(value) => value,
            None => continue,
        };
        let selector = resolve_market_selector(ctx, loaded, &slug).await?;
        let detail: ProductMarketDetailResponse = ctx
            .request_json(
                loaded,
                Method::GET,
                &format!("/api/product/markets/slug/{}", selector.slug),
                None,
                AuthMode::None,
            )
            .await?;
        let quantity_minor: u64 = wallet.proofs.iter().map(|proof| proof.amount).sum();
        let quantity = share_minor_to_quantity(quantity_minor);
        let current_price_ppm = if side == "long" {
            detail.market.price_long_ppm
        } else {
            detail.market.price_short_ppm
        };
        let market_value_minor =
            ((quantity * current_price_ppm as f64) / 1_000_000.0).round() as u64;
        positions.push(LocalPositionView {
            market_event_id: selector.event_id.clone(),
            market_slug: selector.slug.clone(),
            market_title: selector.title.clone(),
            direction: side.to_string(),
            quantity,
            current_price_ppm,
            market_value_minor,
        });
    }

    Ok(PortfolioView {
        pubkey,
        local_usd_minor,
        proof_wallets: store.list(),
        local_positions: positions,
    })
}

async fn resolve_market_selector(
    ctx: &AppContext,
    loaded: &LoadedConfig,
    selector: &str,
) -> Result<ResolvedMarketSelector> {
    if is_hex_event_id(selector) {
        let feed: ProductFeedResponse = ctx
            .request_json(
                loaded,
                Method::GET,
                "/api/product/feed",
                None,
                AuthMode::None,
            )
            .await?;
        if let Some(record) = feed
            .markets
            .into_iter()
            .filter_map(parse_market_record)
            .find(|record| record.event_id == selector)
        {
            return Ok(ResolvedMarketSelector {
                event_id: record.event_id,
                slug: record.slug,
                title: record.title,
            });
        }

        let authored_markets =
            fetch_creator_market_records(ctx, Some(loaded), &ctx.pubkey_hex(loaded)?, 200).await?;
        if let Some(market) = authored_markets
            .into_iter()
            .find(|market| market.event_id == selector)
        {
            return Ok(ResolvedMarketSelector {
                event_id: market.event_id,
                slug: market.slug,
                title: market.title,
            });
        }
    }

    let detail: ProductMarketDetailResponse = ctx
        .request_json(
            loaded,
            Method::GET,
            &format!("/api/product/markets/slug/{selector}"),
            None,
            AuthMode::None,
        )
        .await?;
    Ok(ResolvedMarketSelector {
        event_id: detail.market.event_id,
        slug: detail.market.slug,
        title: detail.market.title,
    })
}

fn build_market_create_spec(args: &MarketCreateArgs) -> Result<MarketCreateSpec> {
    let mut spec = if let Some(input) = &args.spec {
        if !input.starts_with('@') {
            bail!("market create spec must be @path/to/file.json");
        }
        let raw = fs::read_to_string(input.trim_start_matches('@'))
            .with_context(|| format!("failed to read {}", input.trim_start_matches('@')))?;
        serde_json::from_str::<MarketCreateSpecFile>(&raw).context("failed to parse market spec")?
    } else {
        MarketCreateSpecFile {
            title: None,
            description: None,
            slug: None,
            body: None,
            categories: Vec::new(),
            topics: Vec::new(),
        }
    };

    if spec.title.is_none() {
        spec.title = args.title.clone();
    }
    if spec.description.is_none() {
        spec.description = args.description.clone();
    }
    if spec.slug.is_none() {
        spec.slug = args.slug.clone();
    }
    if spec.body.is_none() {
        spec.body = match args.body.as_ref() {
            Some(value) => Some(read_text_arg(value)?),
            None => None,
        };
    }
    if spec.categories.is_empty() {
        spec.categories = args.categories.clone();
    }
    if spec.topics.is_empty() {
        spec.topics = args.topics.clone();
    }

    let title = spec
        .title
        .ok_or_else(|| anyhow!("market create requires --title or a title in the spec file"))?;
    let description = spec.description.unwrap_or_default();
    let slug = spec
        .slug
        .ok_or_else(|| anyhow!("market create requires --slug or a slug in the spec file"))?;
    let body = spec.body.unwrap_or_default();

    Ok(MarketCreateSpec {
        title,
        description,
        slug,
        body,
        categories: spec.categories,
        topics: spec.topics,
    })
}

fn parse_market_record(value: Value) -> Option<MarketRecord> {
    let event_id = value.get("id")?.as_str()?.to_string();
    let created_at = value
        .get("created_at")
        .and_then(Value::as_i64)
        .unwrap_or_default();
    let tags = value.get("tags")?.as_array()?;
    let slug = first_tag_value(tags, "d")?;
    let title = first_tag_value(tags, "title").unwrap_or_else(|| slug.clone());
    let description = first_tag_value(tags, "description").unwrap_or_default();
    Some(MarketRecord {
        event_id,
        slug,
        title,
        description,
        created_at,
        raw_event: value,
    })
}

async fn public_market_event_ids(ctx: &AppContext, loaded: &LoadedConfig) -> Result<HashSet<String>> {
    let payload: ProductFeedResponse = ctx
        .request_json(loaded, Method::GET, "/api/product/feed", None, AuthMode::None)
        .await?;
    Ok(payload
        .markets
        .into_iter()
        .filter_map(|value| value.get("id").and_then(Value::as_str).map(ToString::to_string))
        .collect())
}

async fn fetch_creator_market_records(
    ctx: &AppContext,
    loaded: Option<&LoadedConfig>,
    creator: &str,
    limit: usize,
) -> Result<Vec<MarketRecord>> {
    let events = ctx
        .fetch_events(
            loaded,
            Filter::new()
                .author(parse_public_key(creator)?)
                .kind(Kind::Custom(982))
                .limit(limit),
        )
        .await?;
    let mut markets = events
        .into_iter()
        .filter_map(|event| serde_json::to_value(event).ok().and_then(parse_market_record))
        .collect::<Vec<_>>();
    markets.sort_by(|left, right| right.created_at.cmp(&left.created_at));
    Ok(markets)
}

fn parse_trade_activity(value: &Value) -> Option<ActivityEntry> {
    let id = value.get("id")?.as_str()?.to_string();
    let created_at = value
        .get("created_at")
        .and_then(Value::as_i64)
        .unwrap_or_default();
    let tags = value.get("tags")?.as_array()?;
    let direction = first_tag_value(tags, "direction").unwrap_or_else(|| "unknown".to_string());
    let trade_type = first_tag_value(tags, "type").unwrap_or_else(|| "trade".to_string());
    let amount = first_tag_value(tags, "amount").unwrap_or_else(|| "0".to_string());
    let market = first_tag_value(tags, "e").unwrap_or_default();
    Some(ActivityEntry {
        kind: "trade".to_string(),
        id,
        created_at,
        title: format!("{direction} {trade_type}"),
        detail: format!("{amount} on {market}"),
    })
}

fn first_tag_value(tags: &[Value], tag_name: &str) -> Option<String> {
    for tag in tags {
        let tag = tag.as_array()?;
        if tag.first()?.as_str()? != tag_name {
            continue;
        }
        return tag.get(1).and_then(Value::as_str).map(ToString::to_string);
    }
    None
}

async fn fetch_market_discussions(
    ctx: &AppContext,
    loaded: Option<&LoadedConfig>,
    market_id: &str,
) -> Result<Vec<DiscussionRecord>> {
    let event_id = EventId::from_hex(market_id)?;
    let events = ctx
        .fetch_events(
            loaded,
            Filter::new()
                .kind(Kind::Custom(1111))
                .event(event_id)
                .limit(240),
        )
        .await?;
    Ok(events
        .into_iter()
        .filter_map(parse_discussion_event)
        .collect())
}

async fn fetch_recent_discussions(
    ctx: &AppContext,
    loaded: Option<&LoadedConfig>,
    limit: usize,
) -> Result<Vec<DiscussionRecord>> {
    let events = ctx
        .fetch_events(loaded, Filter::new().kind(Kind::Custom(1111)).limit(limit))
        .await?;
    let mut discussions: Vec<DiscussionRecord> = events
        .into_iter()
        .filter_map(parse_discussion_event)
        .collect();
    discussions.sort_by(|left, right| right.created_at.cmp(&left.created_at));
    Ok(limit_vec(discussions, Some(limit)))
}

fn parse_discussion_event(event: Event) -> Option<DiscussionRecord> {
    let raw_event = serde_json::to_value(&event).ok()?;
    let mut root_id: Option<String> = None;
    let mut reply_to: Option<String> = None;
    let mut subject: Option<String> = None;
    let mut kind_reference: Option<String> = None;

    for tag in event.tags.iter() {
        let values = tag.as_slice();
        match values.first().map(|value| value.as_str()) {
            Some("e") => {
                let event_ref = values.get(1).map(ToString::to_string)?;
                let marker = values.get(3).map(|value| value.as_str());
                if marker == Some("root") {
                    root_id = Some(event_ref);
                } else if marker == Some("reply") {
                    reply_to = Some(event_ref);
                } else if reply_to.is_none() {
                    reply_to = Some(event_ref);
                }
            }
            Some("subject") => {
                subject = values.get(1).map(ToString::to_string);
            }
            Some("k") => {
                kind_reference = values.get(1).map(ToString::to_string);
            }
            _ => {}
        }
    }

    let root_id = root_id?;
    let market_id = if kind_reference.as_deref() == Some("982") {
        root_id.clone()
    } else if root_id != event.id.to_string() {
        root_id.clone()
    } else {
        return None;
    };

    Some(DiscussionRecord {
        id: event.id.to_string(),
        pubkey: event.pubkey.to_string(),
        market_id,
        root_id,
        reply_to,
        subject,
        content: event.content,
        created_at: event.created_at.as_secs() as i64,
        raw_event,
    })
}

fn build_discussion_threads(
    records: &[DiscussionRecord],
    market_id: &str,
) -> Vec<DiscussionThread> {
    let mut relevant: Vec<DiscussionRecord> = records
        .iter()
        .filter(|record| record.market_id == market_id)
        .cloned()
        .collect();
    relevant.sort_by(|left, right| left.created_at.cmp(&right.created_at));

    let mut node_map: HashMap<String, DiscussionThread> = relevant
        .iter()
        .map(|record| {
            (
                record.id.clone(),
                DiscussionThread {
                    post: record.clone(),
                    replies: Vec::new(),
                    reply_count: 0,
                },
            )
        })
        .collect();

    let mut roots = Vec::new();
    for record in relevant {
        let node = match node_map.get(&record.id).cloned() {
            Some(node) => node,
            None => continue,
        };
        let is_root = record.reply_to.is_none()
            || record.reply_to.as_deref() == Some(record.market_id.as_str())
            || record.reply_to.as_deref() == Some(record.root_id.as_str());
        if is_root {
            roots.push(node);
            continue;
        }
        if let Some(parent_id) = &record.reply_to {
            if let Some(parent) = node_map.get_mut(parent_id) {
                parent.replies.push(node.clone());
                continue;
            }
        }
        roots.push(node);
    }

    for root in &mut roots {
        annotate_reply_count(root);
    }
    roots.sort_by(|left, right| right.post.created_at.cmp(&left.post.created_at));
    roots
}

fn annotate_reply_count(node: &mut DiscussionThread) -> usize {
    let mut count = 0;
    for reply in &mut node.replies {
        count += 1 + annotate_reply_count(reply);
    }
    node.reply_count = count;
    node.replies
        .sort_by(|left, right| left.post.created_at.cmp(&right.post.created_at));
    count
}

async fn fetch_latest_event(
    ctx: &AppContext,
    loaded: Option<&LoadedConfig>,
    filter: Filter,
) -> Result<Option<Event>> {
    let mut events = ctx.fetch_events(loaded, filter).await?;
    events.sort_by(|left, right| right.created_at.cmp(&left.created_at));
    Ok(events.into_iter().next())
}

async fn update_contact_list(
    ctx: &AppContext,
    loaded: &LoadedConfig,
    target: PublicKey,
    follow: bool,
) -> Result<PublishedEvent> {
    let current = fetch_latest_event(
        ctx,
        Some(loaded),
        Filter::new()
            .author(ctx.keys(loaded)?.public_key())
            .kind(Kind::ContactList)
            .limit(1),
    )
    .await?;

    let mut contacts: BTreeMap<String, PublicKey> = BTreeMap::new();
    if let Some(event) = current {
        for tag in event.tags {
            let values = tag.as_slice();
            if values.first().map(|value| value.as_str()) != Some("p") {
                continue;
            }
            if let Some(value) = values.get(1) {
                if let Ok(pubkey) = PublicKey::parse(value) {
                    contacts.insert(pubkey.to_string(), pubkey);
                }
            }
        }
    }

    if follow {
        contacts.insert(target.to_string(), target);
    } else {
        contacts.remove(&target.to_string());
    }

    let contacts = contacts.into_values().map(Contact::new).collect::<Vec<_>>();
    let builder = EventBuilder::contact_list(contacts);
    let keys = ctx.keys(loaded)?;
    let event = builder.sign_with_keys(&keys)?;
    let client = build_nostr_client(Some(keys), &ctx.relays(Some(loaded))).await?;
    let output = client.send_event(&event).await?;
    client.disconnect().await;
    Ok(PublishedEvent {
        event_id: event.id.to_string(),
        raw_event: serde_json::to_value(event)?,
        success_relays: output
            .success
            .into_iter()
            .map(|relay| relay.to_string())
            .collect(),
        failed_relays: output
            .failed
            .into_iter()
            .map(|(relay, error)| (relay.to_string(), error))
            .collect(),
    })
}

async fn update_bookmarks(
    ctx: &AppContext,
    loaded: &LoadedConfig,
    market_event_id: &str,
    add: bool,
) -> Result<PublishedEvent> {
    let current = fetch_latest_event(
        ctx,
        Some(loaded),
        Filter::new()
            .author(ctx.keys(loaded)?.public_key())
            .kind(Kind::Bookmarks)
            .limit(1),
    )
    .await?;

    let mut event_ids: BTreeMap<String, String> = BTreeMap::new();
    if let Some(event) = current {
        for tag in event.tags {
            let values = tag.as_slice();
            if values.first().map(|value| value.as_str()) != Some("e") {
                continue;
            }
            if let Some(value) = values.get(1) {
                event_ids.insert(value.to_string(), value.to_string());
            }
        }
    }

    if add {
        event_ids.insert(market_event_id.to_string(), market_event_id.to_string());
    } else {
        event_ids.remove(market_event_id);
    }

    let tags = event_ids
        .into_values()
        .map(|event_id| Tag::parse(vec!["e".to_string(), event_id]))
        .collect::<Result<Vec<_>, _>>()?;

    ctx.publish_event(loaded, Kind::Bookmarks, String::new(), tags)
        .await
}

async fn fetch_existing_position_events(
    ctx: &AppContext,
    loaded: &LoadedConfig,
) -> Result<Vec<ExistingPositionEvent>> {
    let events = ctx
        .fetch_events(
            Some(loaded),
            Filter::new()
                .author(ctx.keys(loaded)?.public_key())
                .kind(Kind::Custom(30078))
                .limit(240),
        )
        .await?;

    Ok(events
        .into_iter()
        .filter_map(|event| {
            let raw = serde_json::to_value(&event).ok()?;
            let d_tag = event.tags.iter().find_map(|tag| {
                let values = tag.as_slice();
                if values.first().map(|value| value.as_str()) == Some("d") {
                    values.get(1).map(ToString::to_string)
                } else {
                    None
                }
            })?;
            let parts: Vec<&str> = d_tag.split(':').collect();
            if parts.len() < 4 {
                return None;
            }
            let market_event_id = parts[2..parts.len() - 1].join(":");
            let direction = parts.last()?.to_string();
            let market_title = raw
                .get("content")
                .and_then(Value::as_str)
                .and_then(|content| serde_json::from_str::<Value>(content).ok())
                .and_then(|content| {
                    content
                        .get("marketTitle")
                        .and_then(Value::as_str)
                        .map(ToString::to_string)
                })
                .unwrap_or_default();
            Some(ExistingPositionEvent {
                key: format!("{market_event_id}:{direction}"),
                market_event_id,
                market_title,
                direction,
            })
        })
        .collect())
}

#[derive(Debug)]
struct ExistingPositionEvent {
    key: String,
    market_event_id: String,
    market_title: String,
    direction: String,
}

fn parse_public_key(identifier: &str) -> Result<PublicKey> {
    PublicKey::parse(identifier)
        .with_context(|| format!("unsupported profile identifier {identifier}"))
}

fn build_profile_content(args: &impl ProfileLikeArgs) -> Result<String> {
    let mut payload = serde_json::Map::new();
    if let Some(name) = args.name() {
        payload.insert("name".to_string(), json!(name));
    }
    if let Some(about) = args.about() {
        payload.insert("about".to_string(), json!(about));
    }
    if let Some(avatar_url) = args.avatar_url() {
        payload.insert("picture".to_string(), json!(avatar_url));
    }
    if let Some(banner_url) = args.banner_url() {
        payload.insert("banner".to_string(), json!(banner_url));
    }
    if let Some(website) = args.website() {
        payload.insert("website".to_string(), json!(website));
    }
    if let Some(nip05) = args.nip05() {
        payload.insert("nip05".to_string(), json!(nip05));
    }
    Ok(Value::Object(payload).to_string())
}

trait ProfileLikeArgs {
    fn name(&self) -> Option<&str>;
    fn about(&self) -> Option<&str>;
    fn avatar_url(&self) -> Option<&str>;
    fn banner_url(&self) -> Option<&str>;
    fn website(&self) -> Option<&str>;
    fn nip05(&self) -> Option<&str>;
}

impl ProfileLikeArgs for IdentityInitArgs {
    fn name(&self) -> Option<&str> {
        self.name.as_deref()
    }
    fn about(&self) -> Option<&str> {
        self.about.as_deref()
    }
    fn avatar_url(&self) -> Option<&str> {
        self.avatar_url.as_deref()
    }
    fn banner_url(&self) -> Option<&str> {
        self.banner_url.as_deref()
    }
    fn website(&self) -> Option<&str> {
        self.website.as_deref()
    }
    fn nip05(&self) -> Option<&str> {
        self.nip05.as_deref()
    }
}

impl ProfileLikeArgs for ProfileUpdateArgs {
    fn name(&self) -> Option<&str> {
        self.name.as_deref()
    }
    fn about(&self) -> Option<&str> {
        self.about.as_deref()
    }
    fn avatar_url(&self) -> Option<&str> {
        self.avatar_url.as_deref()
    }
    fn banner_url(&self) -> Option<&str> {
        self.banner_url.as_deref()
    }
    fn website(&self) -> Option<&str> {
        self.website.as_deref()
    }
    fn nip05(&self) -> Option<&str> {
        self.nip05.as_deref()
    }
}

fn read_text_arg(value: &str) -> Result<String> {
    if let Some(path) = value.strip_prefix('@') {
        return fs::read_to_string(path).with_context(|| format!("failed to read {path}"));
    }
    Ok(value.to_string())
}

fn read_required_text_arg(value: Option<&String>, flag: &str) -> Result<String> {
    let value = value.ok_or_else(|| anyhow!("{flag} is required"))?;
    read_text_arg(value)
}

fn read_optional_json_arg(value: Option<&String>) -> Result<Option<Value>> {
    let Some(value) = value else {
        return Ok(None);
    };
    let raw = read_text_arg(value)?;
    Ok(Some(
        serde_json::from_str(&raw).context("failed to parse JSON input")?,
    ))
}

fn limit_vec<T>(mut values: Vec<T>, limit: Option<usize>) -> Vec<T> {
    if let Some(limit) = limit {
        values.truncate(limit);
    }
    values
}

fn limit_json(mut values: Vec<Value>, limit: Option<usize>) -> Vec<Value> {
    if let Some(limit) = limit {
        values.truncate(limit);
    }
    values
}

fn is_hex_event_id(value: &str) -> bool {
    value.len() == 64 && value.chars().all(|char| char.is_ascii_hexdigit())
}

fn market_unit_for_side(slug: &str, side: &str) -> Result<String> {
    match side.to_ascii_lowercase().as_str() {
        "yes" | "long" => Ok(format!("long_{slug}")),
        "no" | "short" => Ok(format!("short_{slug}")),
        other => bail!("unsupported side {other}; expected long or short"),
    }
}

fn parse_market_unit(unit: &str) -> Option<(String, &'static str)> {
    let unit = normalize_unit(unit);
    if let Some(slug) = unit.strip_prefix("long_") {
        return Some((slug.to_string(), "long"));
    }
    if let Some(slug) = unit.strip_prefix("short_") {
        return Some((slug.to_string(), "short"));
    }
    None
}

fn quantity_to_share_minor(quantity: f64) -> Result<u64> {
    if !quantity.is_finite() || quantity <= 0.0 {
        bail!("quantity must be positive");
    }
    let amount = (quantity * 10_000.0).floor();
    if amount <= 0.0 {
        bail!("quantity is below one share-minor unit");
    }
    Ok(amount as u64)
}

fn share_minor_to_quantity(quantity_minor: u64) -> f64 {
    quantity_minor as f64 / 10_000.0
}

async fn build_nostr_client(keys: Option<Keys>, relays: &[String]) -> Result<Client> {
    let client = match keys {
        Some(keys) => Client::new(keys),
        None => Client::default(),
    };
    for relay in relays {
        client.add_relay(relay).await?;
    }
    client.connect().await;
    Ok(client)
}
