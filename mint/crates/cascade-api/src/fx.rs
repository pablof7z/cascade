use cascade_core::product::{FxQuoteObservation, FxQuoteSnapshot};
use chrono::Utc;
use serde::Deserialize;
use std::time::Duration;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct FxQuoteEnvelope {
    pub snapshot: FxQuoteSnapshot,
    pub fallback_used: bool,
}

#[derive(Clone)]
pub struct FxQuoteService {
    client: reqwest::Client,
    providers: Vec<FxProvider>,
    max_provider_spread_bps: u64,
    fallback_btc_usd_price: Option<f64>,
    quote_ttl_seconds: i64,
}

#[derive(Debug, Clone, Copy)]
enum FxProvider {
    Coinbase,
    Kraken,
    Bitstamp,
}

impl FxQuoteService {
    pub fn for_network(network_type: &str) -> Result<Self, reqwest::Error> {
        let fallback_btc_usd_price = if network_type == "signet" {
            Some(50_000.0)
        } else {
            None
        };

        Self::new(
            vec![
                FxProvider::Coinbase,
                FxProvider::Kraken,
                FxProvider::Bitstamp,
            ],
            500,
            fallback_btc_usd_price,
            900,
        )
    }

    pub fn static_only(btc_usd_price: f64) -> Result<Self, reqwest::Error> {
        Self::new(Vec::new(), 500, Some(btc_usd_price), 900)
    }

    fn new(
        providers: Vec<FxProvider>,
        max_provider_spread_bps: u64,
        fallback_btc_usd_price: Option<f64>,
        quote_ttl_seconds: i64,
    ) -> Result<Self, reqwest::Error> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_millis(1500))
            .user_agent("cascade-mint/0.1")
            .build()?;

        Ok(Self {
            client,
            providers,
            max_provider_spread_bps,
            fallback_btc_usd_price,
            quote_ttl_seconds,
        })
    }

    pub async fn quote_wallet_funding(
        &self,
        amount_minor: u64,
    ) -> Result<FxQuoteEnvelope, String> {
        if amount_minor == 0 {
            return Err("amount_minor_must_be_positive".to_string());
        }

        let mut observations = self.fetch_provider_observations().await;
        observations.sort_by(|left, right| left.btc_usd_price.total_cmp(&right.btc_usd_price));

        let (btc_usd_price, spread_bps, fallback_used) = if observations.is_empty() {
            match self.fallback_btc_usd_price {
                Some(price) => {
                    observations.push(FxQuoteObservation {
                        source: "signet-static".to_string(),
                        btc_usd_price: price,
                        observed_at: Utc::now().timestamp(),
                    });
                    (price, 0, true)
                }
                None => return Err("no_fx_providers_available".to_string()),
            }
        } else {
            let min = observations
                .first()
                .map(|item| item.btc_usd_price)
                .unwrap_or(0.0);
            let max = observations
                .last()
                .map(|item| item.btc_usd_price)
                .unwrap_or(0.0);
            let median = observations[observations.len() / 2].btc_usd_price;
            let spread_bps = if observations.len() > 1 && median > 0.0 {
                (((max - min) / median) * 10_000.0).round().max(0.0) as u64
            } else {
                0
            };

            if observations.len() > 1 && spread_bps > self.max_provider_spread_bps {
                return Err(format!(
                    "fx_provider_disagreement_too_large:{spread_bps}bps"
                ));
            }

            (median, spread_bps, false)
        };

        let amount_usd = amount_minor as f64 / 100.0;
        let amount_btc = amount_usd / btc_usd_price;
        let amount_msat = (amount_btc * 100_000_000_000.0).round().max(0.0) as u64;
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
                btc_usd_price,
                source,
                spread_bps,
                observations,
                created_at: now,
                expires_at: now + self.quote_ttl_seconds,
            },
            fallback_used,
        })
    }

    async fn fetch_provider_observations(&self) -> Vec<FxQuoteObservation> {
        let mut observations = Vec::new();

        for provider in &self.providers {
            if let Some(observation) = self.fetch_provider(*provider).await {
                observations.push(observation);
            }
        }

        observations
    }

    async fn fetch_provider(&self, provider: FxProvider) -> Option<FxQuoteObservation> {
        match provider {
            FxProvider::Coinbase => self.fetch_coinbase().await,
            FxProvider::Kraken => self.fetch_kraken().await,
            FxProvider::Bitstamp => self.fetch_bitstamp().await,
        }
    }

    async fn fetch_coinbase(&self) -> Option<FxQuoteObservation> {
        #[derive(Deserialize)]
        struct CoinbasePayload {
            data: CoinbasePrice,
        }

        #[derive(Deserialize)]
        struct CoinbasePrice {
            amount: String,
        }

        let response = self
            .client
            .get("https://api.coinbase.com/v2/prices/BTC-USD/spot")
            .send()
            .await
            .ok()?;
        let payload = response.json::<CoinbasePayload>().await.ok()?;
        let btc_usd_price = payload.data.amount.parse::<f64>().ok()?;
        if !btc_usd_price.is_finite() || btc_usd_price <= 0.0 {
            return None;
        }

        Some(FxQuoteObservation {
            source: "coinbase".to_string(),
            btc_usd_price,
            observed_at: Utc::now().timestamp(),
        })
    }

    async fn fetch_kraken(&self) -> Option<FxQuoteObservation> {
        #[derive(Deserialize)]
        struct KrakenPayload {
            result: std::collections::HashMap<String, KrakenTicker>,
        }

        #[derive(Deserialize)]
        struct KrakenTicker {
            c: Vec<String>,
        }

        let response = self
            .client
            .get("https://api.kraken.com/0/public/Ticker?pair=XBTUSD")
            .send()
            .await
            .ok()?;
        let payload = response.json::<KrakenPayload>().await.ok()?;
        let ticker = payload.result.into_values().next()?;
        let btc_usd_price = ticker.c.first()?.parse::<f64>().ok()?;
        if !btc_usd_price.is_finite() || btc_usd_price <= 0.0 {
            return None;
        }

        Some(FxQuoteObservation {
            source: "kraken".to_string(),
            btc_usd_price,
            observed_at: Utc::now().timestamp(),
        })
    }

    async fn fetch_bitstamp(&self) -> Option<FxQuoteObservation> {
        #[derive(Deserialize)]
        struct BitstampPayload {
            last: String,
        }

        let response = self
            .client
            .get("https://www.bitstamp.net/api/v2/ticker/btcusd/")
            .send()
            .await
            .ok()?;
        let payload = response.json::<BitstampPayload>().await.ok()?;
        let btc_usd_price = payload.last.parse::<f64>().ok()?;
        if !btc_usd_price.is_finite() || btc_usd_price <= 0.0 {
            return None;
        }

        Some(FxQuoteObservation {
            source: "bitstamp".to_string(),
            btc_usd_price,
            observed_at: Utc::now().timestamp(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::FxQuoteService;
    use cascade_core::product::FxQuoteObservation;

    #[tokio::test]
    async fn static_fallback_quotes_msat() {
        let service = FxQuoteService::static_only(50_000.0).unwrap();
        let quote = service.quote_wallet_funding(2_500).await.unwrap();
        assert_eq!(quote.snapshot.amount_minor, 2_500);
        assert_eq!(quote.snapshot.amount_msat, 50_000_000);
        assert_eq!(quote.snapshot.btc_usd_price, 50_000.0);
        assert!(quote.fallback_used);
        assert_eq!(quote.snapshot.observations.len(), 1);
    }

    #[test]
    fn observations_sort_by_price() {
        let mut observations = [
            FxQuoteObservation {
                source: "b".to_string(),
                btc_usd_price: 84_000.0,
                observed_at: 0,
            },
            FxQuoteObservation {
                source: "a".to_string(),
                btc_usd_price: 82_000.0,
                observed_at: 0,
            },
        ];
        observations.sort_by(|left, right| left.btc_usd_price.total_cmp(&right.btc_usd_price));
        assert_eq!(observations[0].source, "a");
        assert_eq!(observations[1].source, "b");
    }
}
