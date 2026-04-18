use async_trait::async_trait;
use cascade_core::product::{
    FxQuoteDirection, FxQuoteObservation, FxQuoteSnapshot, FxQuoteSourceMetadata,
};
use chrono::{DateTime, Utc};
use futures::future::join_all;
use reqwest::header::DATE;
use serde::Deserialize;
use std::sync::Arc;
use std::time::Duration;
use tracing::warn;
use uuid::Uuid;

const COMBINATION_POLICY: &str = "median_non_stale_major_providers_v1";

#[derive(Debug, Clone)]
pub struct FxQuoteEnvelope {
    pub snapshot: FxQuoteSnapshot,
}

#[derive(Debug, Clone)]
pub struct FxQuotePolicy {
    pub quote_ttl_seconds: i64,
    pub max_provider_spread_bps: u64,
    pub max_observation_age_seconds: i64,
    pub min_provider_count: usize,
    pub usd_to_msat_spread_bps: u64,
    pub msat_to_usd_spread_bps: u64,
}

impl FxQuotePolicy {
    pub fn for_network(_network_type: &str) -> Self {
        Self {
            quote_ttl_seconds: 900,
            max_provider_spread_bps: 500,
            max_observation_age_seconds: 60,
            min_provider_count: 2,
            usd_to_msat_spread_bps: 100,
            msat_to_usd_spread_bps: 100,
        }
    }

    fn execution_spread_bps(&self, direction: FxQuoteDirection) -> u64 {
        match direction {
            FxQuoteDirection::UsdToMsat => self.usd_to_msat_spread_bps,
            FxQuoteDirection::MsatToMinor => self.msat_to_usd_spread_bps,
        }
    }
}

#[async_trait]
pub trait QuoteSource: Send + Sync {
    fn id(&self) -> &'static str;

    async fn fetch_observation(
        &self,
        client: &reqwest::Client,
    ) -> Result<FxQuoteObservation, String>;
}

#[derive(Debug, Default)]
struct CoinbaseQuoteSource;

#[derive(Debug, Default)]
struct KrakenQuoteSource;

#[derive(Debug, Default)]
struct BitstampQuoteSource;

#[derive(Clone)]
pub struct FxQuoteService {
    client: reqwest::Client,
    sources: Vec<Arc<dyn QuoteSource>>,
    policy: FxQuotePolicy,
}

impl FxQuoteService {
    pub fn for_network(network_type: &str) -> Result<Self, reqwest::Error> {
        Self::with_policy(FxQuotePolicy::for_network(network_type))
    }

    pub fn with_policy(policy: FxQuotePolicy) -> Result<Self, reqwest::Error> {
        Self::new(
            vec![
                Arc::new(CoinbaseQuoteSource),
                Arc::new(KrakenQuoteSource),
                Arc::new(BitstampQuoteSource),
            ],
            policy,
        )
    }

    pub fn with_sources(
        sources: Vec<Arc<dyn QuoteSource>>,
        policy: FxQuotePolicy,
    ) -> Result<Self, reqwest::Error> {
        Self::new(sources, policy)
    }

    fn new(
        sources: Vec<Arc<dyn QuoteSource>>,
        policy: FxQuotePolicy,
    ) -> Result<Self, reqwest::Error> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_millis(1500))
            .user_agent("cascade-mint/0.1")
            .build()?;

        Ok(Self {
            client,
            sources,
            policy,
        })
    }

    async fn reference_price_snapshot(
        &self,
    ) -> Result<(Vec<FxQuoteObservation>, f64, u64), String> {
        let now = Utc::now().timestamp();
        let mut observations = self.fetch_provider_observations().await;
        observations.retain(|observation| self.is_observation_fresh(observation, now));
        observations.sort_by(|left, right| left.btc_usd_price.total_cmp(&right.btc_usd_price));

        if observations.len() < self.policy.min_provider_count {
            return Err(format!(
                "insufficient_fresh_fx_observations:required={}:got={}",
                self.policy.min_provider_count,
                observations.len()
            ));
        }

        let reference_btc_usd_price =
            median_price(&observations).ok_or_else(|| "no_fresh_fx_observations".to_string())?;
        let provider_spread_bps = provider_spread_bps(&observations, reference_btc_usd_price);

        if observations.len() > 1 && provider_spread_bps > self.policy.max_provider_spread_bps {
            return Err(format!(
                "fx_provider_disagreement_too_large:{provider_spread_bps}bps"
            ));
        }

        Ok((observations, reference_btc_usd_price, provider_spread_bps))
    }

    pub async fn quote_minor_to_msat(&self, amount_minor: u64) -> Result<FxQuoteEnvelope, String> {
        if amount_minor == 0 {
            return Err("amount_minor_must_be_positive".to_string());
        }

        let amount_usd = amount_minor as f64 / 100.0;
        let direction = FxQuoteDirection::UsdToMsat;
        let snapshot = self
            .lock_quote(
                direction,
                |_reference_btc_usd_price, executable_btc_usd_price| {
                    let amount_btc = amount_usd / executable_btc_usd_price;
                    let amount_msat = (amount_btc * 100_000_000_000.0).round().max(0.0) as u64;
                    (amount_minor, amount_msat)
                },
            )
            .await?;

        Ok(snapshot)
    }

    pub async fn quote_wallet_funding(&self, amount_minor: u64) -> Result<FxQuoteEnvelope, String> {
        if amount_minor == 0 {
            // Zero-value sell: the position has no market value after LMSR pricing and fees.
            // Return a synthetic quote so the trade can complete without a Lightning payment.
            let now = Utc::now().timestamp();
            return Ok(FxQuoteEnvelope {
                snapshot: FxQuoteSnapshot {
                    id: Uuid::new_v4().to_string(),
                    amount_minor: 0,
                    amount_msat: 0,
                    btc_usd_price: 0.0,
                    reference_btc_usd_price: 0.0,
                    source: "zero_value_exit".to_string(),
                    spread_bps: 0,
                    observations: vec![],
                    source_metadata: FxQuoteSourceMetadata::default(),
                    created_at: now,
                    expires_at: now + 3600,
                },
            });
        }
        self.quote_minor_to_msat(amount_minor).await
    }

    pub async fn quote_msat_to_minor(&self, amount_msat: u64) -> Result<FxQuoteEnvelope, String> {
        if amount_msat == 0 {
            return Err("amount_msat_must_be_positive".to_string());
        }

        let amount_btc = amount_msat as f64 / 100_000_000_000.0;
        self.lock_quote(
            FxQuoteDirection::MsatToMinor,
            |_reference_btc_usd_price, executable_btc_usd_price| {
                let amount_usd = amount_btc * executable_btc_usd_price;
                let amount_minor = (amount_usd * 100.0).ceil().max(0.0) as u64;
                (amount_minor, amount_msat)
            },
        )
        .await
    }

    async fn lock_quote<F>(
        &self,
        direction: FxQuoteDirection,
        amount_builder: F,
    ) -> Result<FxQuoteEnvelope, String>
    where
        F: FnOnce(f64, f64) -> (u64, u64),
    {
        let (observations, reference_btc_usd_price, provider_spread_bps) =
            self.reference_price_snapshot().await?;
        let execution_spread_bps = self.policy.execution_spread_bps(direction);
        let executable_btc_usd_price =
            apply_execution_spread(reference_btc_usd_price, direction, execution_spread_bps)?;
        let provider_count = observations.len() as u64;
        let (amount_minor, amount_msat) =
            amount_builder(reference_btc_usd_price, executable_btc_usd_price);
        let now = Utc::now().timestamp();
        let source = observations
            .iter()
            .map(|item| item.source.as_str())
            .collect::<Vec<_>>()
            .join(",");

        Ok(FxQuoteEnvelope {
            snapshot: FxQuoteSnapshot {
                id: Uuid::new_v4().to_string(),
                amount_minor,
                amount_msat,
                btc_usd_price: executable_btc_usd_price,
                reference_btc_usd_price,
                source,
                spread_bps: provider_spread_bps,
                observations,
                source_metadata: FxQuoteSourceMetadata {
                    combination_policy: COMBINATION_POLICY.to_string(),
                    quote_direction: direction,
                    provider_count,
                    minimum_provider_count: self.policy.min_provider_count as u64,
                    execution_spread_bps,
                    max_observation_age_seconds: self.policy.max_observation_age_seconds,
                },
                created_at: now,
                expires_at: now + self.policy.quote_ttl_seconds,
            },
        })
    }

    async fn fetch_provider_observations(&self) -> Vec<FxQuoteObservation> {
        let results = join_all(
            self.sources
                .iter()
                .map(|source| source.fetch_observation(&self.client)),
        )
        .await;

        results
            .into_iter()
            .filter_map(|result| match result {
                Ok(observation) => Some(observation),
                Err(error) => {
                    warn!("FX provider observation rejected: {error}");
                    None
                }
            })
            .collect()
    }

    fn is_observation_fresh(&self, observation: &FxQuoteObservation, now: i64) -> bool {
        if !observation.btc_usd_price.is_finite() || observation.btc_usd_price <= 0.0 {
            return false;
        }

        let age_seconds = now.saturating_sub(observation.observed_at);
        age_seconds <= self.policy.max_observation_age_seconds
    }
}

#[async_trait]
impl QuoteSource for CoinbaseQuoteSource {
    fn id(&self) -> &'static str {
        "coinbase"
    }

    async fn fetch_observation(
        &self,
        client: &reqwest::Client,
    ) -> Result<FxQuoteObservation, String> {
        #[derive(Deserialize)]
        struct CoinbasePayload {
            data: CoinbasePrice,
        }

        #[derive(Deserialize)]
        struct CoinbasePrice {
            amount: String,
        }

        let response = client
            .get("https://api.coinbase.com/v2/prices/BTC-USD/spot")
            .send()
            .await
            .map_err(|error| format!("{}:request_failed:{error}", self.id()))?;
        let observed_at = response_observed_at(&response);
        let payload = response
            .json::<CoinbasePayload>()
            .await
            .map_err(|error| format!("{}:invalid_payload:{error}", self.id()))?;
        let btc_usd_price = payload
            .data
            .amount
            .parse::<f64>()
            .map_err(|error| format!("{}:invalid_price:{error}", self.id()))?;

        Ok(FxQuoteObservation {
            source: self.id().to_string(),
            btc_usd_price,
            observed_at,
        })
    }
}

#[async_trait]
impl QuoteSource for KrakenQuoteSource {
    fn id(&self) -> &'static str {
        "kraken"
    }

    async fn fetch_observation(
        &self,
        client: &reqwest::Client,
    ) -> Result<FxQuoteObservation, String> {
        #[derive(Deserialize)]
        struct KrakenPayload {
            result: std::collections::HashMap<String, KrakenTicker>,
        }

        #[derive(Deserialize)]
        struct KrakenTicker {
            c: Vec<String>,
        }

        let response = client
            .get("https://api.kraken.com/0/public/Ticker?pair=XBTUSD")
            .send()
            .await
            .map_err(|error| format!("{}:request_failed:{error}", self.id()))?;
        let observed_at = response_observed_at(&response);
        let payload = response
            .json::<KrakenPayload>()
            .await
            .map_err(|error| format!("{}:invalid_payload:{error}", self.id()))?;
        let ticker = payload
            .result
            .into_values()
            .next()
            .ok_or_else(|| format!("{}:missing_ticker", self.id()))?;
        let btc_usd_price = ticker
            .c
            .first()
            .ok_or_else(|| format!("{}:missing_last_trade", self.id()))?
            .parse::<f64>()
            .map_err(|error| format!("{}:invalid_price:{error}", self.id()))?;

        Ok(FxQuoteObservation {
            source: self.id().to_string(),
            btc_usd_price,
            observed_at,
        })
    }
}

#[async_trait]
impl QuoteSource for BitstampQuoteSource {
    fn id(&self) -> &'static str {
        "bitstamp"
    }

    async fn fetch_observation(
        &self,
        client: &reqwest::Client,
    ) -> Result<FxQuoteObservation, String> {
        #[derive(Deserialize)]
        struct BitstampPayload {
            last: String,
            timestamp: String,
        }

        let response = client
            .get("https://www.bitstamp.net/api/v2/ticker/btcusd/")
            .send()
            .await
            .map_err(|error| format!("{}:request_failed:{error}", self.id()))?;
        let header_observed_at = response_observed_at(&response);
        let payload = response
            .json::<BitstampPayload>()
            .await
            .map_err(|error| format!("{}:invalid_payload:{error}", self.id()))?;
        let btc_usd_price = payload
            .last
            .parse::<f64>()
            .map_err(|error| format!("{}:invalid_price:{error}", self.id()))?;
        let observed_at = payload
            .timestamp
            .parse::<i64>()
            .unwrap_or(header_observed_at);

        Ok(FxQuoteObservation {
            source: self.id().to_string(),
            btc_usd_price,
            observed_at,
        })
    }
}

fn response_observed_at(response: &reqwest::Response) -> i64 {
    response
        .headers()
        .get(DATE)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| DateTime::parse_from_rfc2822(value).ok())
        .map(|timestamp| timestamp.timestamp())
        .unwrap_or_else(|| Utc::now().timestamp())
}

fn apply_execution_spread(
    reference_btc_usd_price: f64,
    direction: FxQuoteDirection,
    spread_bps: u64,
) -> Result<f64, String> {
    if !reference_btc_usd_price.is_finite() || reference_btc_usd_price <= 0.0 {
        return Err("invalid_reference_btc_usd_price".to_string());
    }

    let spread_fraction = spread_bps as f64 / 10_000.0;
    let adjusted = match direction {
        FxQuoteDirection::UsdToMsat => reference_btc_usd_price * (1.0 - spread_fraction),
        FxQuoteDirection::MsatToMinor => reference_btc_usd_price * (1.0 + spread_fraction),
    };

    if !adjusted.is_finite() || adjusted <= 0.0 {
        return Err("invalid_executable_btc_usd_price".to_string());
    }

    Ok(adjusted)
}

fn median_price(observations: &[FxQuoteObservation]) -> Option<f64> {
    if observations.is_empty() {
        return None;
    }

    let middle = observations.len() / 2;
    if observations.len() % 2 == 1 {
        Some(observations[middle].btc_usd_price)
    } else {
        Some((observations[middle - 1].btc_usd_price + observations[middle].btc_usd_price) / 2.0)
    }
}

fn provider_spread_bps(observations: &[FxQuoteObservation], reference_btc_usd_price: f64) -> u64 {
    if observations.len() <= 1 || reference_btc_usd_price <= 0.0 {
        return 0;
    }

    let min_price = observations
        .first()
        .map(|item| item.btc_usd_price)
        .unwrap_or(reference_btc_usd_price);
    let max_price = observations
        .last()
        .map(|item| item.btc_usd_price)
        .unwrap_or(reference_btc_usd_price);

    (((max_price - min_price) / reference_btc_usd_price) * 10_000.0)
        .round()
        .max(0.0) as u64
}

#[cfg(test)]
mod tests {
    use super::{median_price, provider_spread_bps, FxQuotePolicy, FxQuoteService, QuoteSource};
    use async_trait::async_trait;
    use cascade_core::product::FxQuoteDirection;
    use std::sync::Arc;

    #[derive(Debug)]
    struct FixedQuoteSource {
        id: &'static str,
        price: f64,
        observed_at: i64,
    }

    #[async_trait]
    impl QuoteSource for FixedQuoteSource {
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

    fn test_policy(_now: i64) -> FxQuotePolicy {
        FxQuotePolicy {
            quote_ttl_seconds: 30,
            max_provider_spread_bps: 500,
            max_observation_age_seconds: 60,
            min_provider_count: 2,
            usd_to_msat_spread_bps: 100,
            msat_to_usd_spread_bps: 100,
        }
    }

    fn test_service(sources: Vec<Arc<dyn QuoteSource>>, policy: FxQuotePolicy) -> FxQuoteService {
        FxQuoteService::new(sources, policy).unwrap()
    }

    #[tokio::test]
    async fn quote_service_rejects_missing_providers() {
        let service = test_service(Vec::new(), test_policy(chrono::Utc::now().timestamp()));
        let error = service.quote_wallet_funding(2_500).await.unwrap_err();
        assert_eq!(error, "insufficient_fresh_fx_observations:required=2:got=0");
    }

    #[tokio::test]
    async fn quote_service_uses_median_reference_rate_and_directional_spread() {
        let now = chrono::Utc::now().timestamp();
        let policy = test_policy(now);
        let service = test_service(
            vec![
                Arc::new(FixedQuoteSource {
                    id: "a",
                    price: 49_000.0,
                    observed_at: now,
                }),
                Arc::new(FixedQuoteSource {
                    id: "b",
                    price: 50_000.0,
                    observed_at: now,
                }),
                Arc::new(FixedQuoteSource {
                    id: "c",
                    price: 51_000.0,
                    observed_at: now,
                }),
            ],
            policy,
        );

        let quote = service.quote_wallet_funding(2_500).await.unwrap();
        assert_eq!(quote.snapshot.reference_btc_usd_price, 50_000.0);
        assert_eq!(quote.snapshot.btc_usd_price, 49_500.0);
        assert_eq!(quote.snapshot.spread_bps, 400);
        assert_eq!(quote.snapshot.source_metadata.execution_spread_bps, 100);
        assert_eq!(quote.snapshot.source_metadata.provider_count, 3);
    }

    #[tokio::test]
    async fn quote_service_rejects_stale_observations() {
        let now = chrono::Utc::now().timestamp();
        let service = test_service(
            vec![
                Arc::new(FixedQuoteSource {
                    id: "a",
                    price: 50_000.0,
                    observed_at: now - 120,
                }),
                Arc::new(FixedQuoteSource {
                    id: "b",
                    price: 50_100.0,
                    observed_at: now - 121,
                }),
            ],
            test_policy(now),
        );

        let error = service.quote_wallet_funding(2_500).await.unwrap_err();
        assert_eq!(error, "insufficient_fresh_fx_observations:required=2:got=0");
    }

    #[tokio::test]
    async fn quote_service_rejects_large_provider_disagreement() {
        let now = chrono::Utc::now().timestamp();
        let service = test_service(
            vec![
                Arc::new(FixedQuoteSource {
                    id: "a",
                    price: 40_000.0,
                    observed_at: now,
                }),
                Arc::new(FixedQuoteSource {
                    id: "b",
                    price: 60_000.0,
                    observed_at: now,
                }),
            ],
            test_policy(now),
        );

        let error = service.quote_wallet_funding(2_500).await.unwrap_err();
        assert_eq!(error, "fx_provider_disagreement_too_large:4000bps");
    }

    #[tokio::test]
    async fn quote_msat_to_minor_applies_execution_spread() {
        let now = chrono::Utc::now().timestamp();
        let service = test_service(
            vec![Arc::new(FixedQuoteSource {
                id: "a",
                price: 50_000.0,
                observed_at: now,
            })],
            FxQuotePolicy {
                min_provider_count: 1,
                ..test_policy(now)
            },
        );

        let quote = service.quote_msat_to_minor(50_000_000).await.unwrap();
        assert_eq!(quote.snapshot.reference_btc_usd_price, 50_000.0);
        assert_eq!(quote.snapshot.btc_usd_price, 50_500.0);
        assert_eq!(quote.snapshot.amount_minor, 2_525);
        assert_eq!(
            quote.snapshot.source_metadata.quote_direction,
            FxQuoteDirection::MsatToMinor
        );
    }

    #[test]
    fn median_price_handles_even_and_odd_counts() {
        let odd = vec![
            cascade_core::product::FxQuoteObservation {
                source: "a".to_string(),
                btc_usd_price: 49_000.0,
                observed_at: 0,
            },
            cascade_core::product::FxQuoteObservation {
                source: "b".to_string(),
                btc_usd_price: 50_000.0,
                observed_at: 0,
            },
            cascade_core::product::FxQuoteObservation {
                source: "c".to_string(),
                btc_usd_price: 51_000.0,
                observed_at: 0,
            },
        ];
        let even = vec![
            cascade_core::product::FxQuoteObservation {
                source: "a".to_string(),
                btc_usd_price: 49_000.0,
                observed_at: 0,
            },
            cascade_core::product::FxQuoteObservation {
                source: "b".to_string(),
                btc_usd_price: 51_000.0,
                observed_at: 0,
            },
        ];

        assert_eq!(median_price(&odd), Some(50_000.0));
        assert_eq!(median_price(&even), Some(50_000.0));
        assert_eq!(provider_spread_bps(&odd, 50_000.0), 400);
        assert_eq!(provider_spread_bps(&even, 50_000.0), 400);
    }
}
