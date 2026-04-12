use hmac::{Hmac, Mac};
use reqwest::StatusCode;
use serde::Deserialize;
use serde_json::Value;
use sha2::Sha256;
use std::collections::HashMap;

type HmacSha256 = Hmac<Sha256>;

const STRIPE_WEBHOOK_TOLERANCE_SECONDS: i64 = 300;

#[derive(Debug, Clone)]
pub struct StripeConfig {
    pub secret_key: String,
    pub webhook_secret: String,
    pub success_url: String,
    pub cancel_url: String,
    pub base_url: String,
    pub checkout_expiry_seconds: u64,
    pub product_name: String,
    pub max_topup_minor: u64,
    pub window_limit_minor: u64,
    pub window_seconds: i64,
    pub allowed_risk_levels: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct StripeGateway {
    client: reqwest::Client,
    config: StripeConfig,
}

#[derive(Debug, Clone)]
pub struct StripeCheckoutSession {
    pub id: String,
    pub url: String,
    pub expires_at: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct StripeWebhookEvent {
    pub id: String,
    #[serde(rename = "type")]
    pub event_type: String,
    pub data: StripeWebhookEventData,
}

#[derive(Debug, Clone, Deserialize)]
pub struct StripeWebhookEventData {
    pub object: Value,
}

#[derive(Debug, Clone, Deserialize)]
struct StripeCreateSessionResponse {
    id: String,
    url: Option<String>,
    expires_at: Option<i64>,
}

impl StripeGateway {
    pub fn new(config: StripeConfig) -> Result<Self, String> {
        if config.secret_key.trim().is_empty()
            || config.webhook_secret.trim().is_empty()
            || config.success_url.trim().is_empty()
            || config.cancel_url.trim().is_empty()
        {
            return Err("stripe_gateway_not_fully_configured".to_string());
        }
        if config.max_topup_minor == 0
            || config.window_limit_minor == 0
            || config.window_seconds <= 0
        {
            return Err("invalid_stripe_risk_limits".to_string());
        }
        if config.allowed_risk_levels.is_empty() {
            return Err("invalid_stripe_allowed_risk_levels".to_string());
        }

        let client = reqwest::Client::builder()
            .build()
            .map_err(|error| error.to_string())?;

        Ok(Self { client, config })
    }

    pub fn max_topup_minor(&self) -> u64 {
        self.config.max_topup_minor
    }

    pub fn window_limit_minor(&self) -> u64 {
        self.config.window_limit_minor
    }

    pub fn window_seconds(&self) -> i64 {
        self.config.window_seconds
    }

    pub fn normalized_risk_level(&self, risk_level: Option<&str>) -> String {
        risk_level
            .map(|value| value.trim().to_ascii_lowercase())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| "not_assessed".to_string())
    }

    pub fn is_risk_level_allowed(&self, risk_level: Option<&str>) -> bool {
        let normalized = self.normalized_risk_level(risk_level);
        self.config
            .allowed_risk_levels
            .iter()
            .any(|allowed| allowed == &normalized)
    }

    pub async fn create_topup_checkout_session(
        &self,
        topup_id: &str,
        pubkey: &str,
        amount_minor: u64,
        request_id: Option<&str>,
        edition: &str,
    ) -> Result<StripeCheckoutSession, String> {
        let now = chrono::Utc::now().timestamp();
        let expires_at = now + self.config.checkout_expiry_seconds.max(300) as i64;

        let mut form = vec![
            ("mode".to_string(), "payment".to_string()),
            ("client_reference_id".to_string(), topup_id.to_string()),
            (
                "success_url".to_string(),
                self.render_return_url(&self.config.success_url, topup_id),
            ),
            (
                "cancel_url".to_string(),
                self.render_return_url(&self.config.cancel_url, topup_id),
            ),
            (
                "line_items[0][price_data][currency]".to_string(),
                "usd".to_string(),
            ),
            (
                "line_items[0][price_data][product_data][name]".to_string(),
                self.config.product_name.clone(),
            ),
            (
                "line_items[0][price_data][product_data][description]".to_string(),
                format!("Cascade portfolio top-up for {edition}"),
            ),
            (
                "line_items[0][price_data][unit_amount]".to_string(),
                amount_minor.to_string(),
            ),
            ("line_items[0][quantity]".to_string(), "1".to_string()),
            ("metadata[topup_id]".to_string(), topup_id.to_string()),
            ("metadata[pubkey]".to_string(), pubkey.to_string()),
            (
                "metadata[amount_minor]".to_string(),
                amount_minor.to_string(),
            ),
            ("metadata[edition]".to_string(), edition.to_string()),
            (
                "payment_intent_data[metadata][topup_id]".to_string(),
                topup_id.to_string(),
            ),
            (
                "payment_intent_data[metadata][pubkey]".to_string(),
                pubkey.to_string(),
            ),
            (
                "payment_intent_data[metadata][amount_minor]".to_string(),
                amount_minor.to_string(),
            ),
            (
                "payment_intent_data[metadata][edition]".to_string(),
                edition.to_string(),
            ),
            ("expires_at".to_string(), expires_at.to_string()),
        ];

        if let Some(request_id) = request_id.filter(|value| !value.trim().is_empty()) {
            form.push(("metadata[request_id]".to_string(), request_id.to_string()));
            form.push((
                "payment_intent_data[metadata][request_id]".to_string(),
                request_id.to_string(),
            ));
        }

        let response = self
            .client
            .post(format!(
                "{}/v1/checkout/sessions",
                self.config.base_url.trim_end_matches('/')
            ))
            .bearer_auth(&self.config.secret_key)
            .form(&form)
            .send()
            .await
            .map_err(|error| format!("stripe_checkout_request_failed: {error}"))?;

        let status = response.status();
        let body = response
            .text()
            .await
            .map_err(|error| format!("stripe_checkout_response_failed: {error}"))?;

        if status != StatusCode::OK {
            return Err(format!(
                "stripe_checkout_session_failed:{}",
                stripe_error_message(status, &body)
            ));
        }

        let payload: StripeCreateSessionResponse = serde_json::from_str(&body)
            .map_err(|error| format!("invalid_stripe_checkout_response: {error}"))?;
        let url = payload
            .url
            .ok_or_else(|| "stripe_checkout_session_missing_url".to_string())?;

        Ok(StripeCheckoutSession {
            id: payload.id,
            url,
            expires_at: payload.expires_at,
        })
    }

    pub async fn retrieve_payment_intent_risk_level(
        &self,
        payment_intent_id: &str,
    ) -> Result<Option<String>, String> {
        let response = self
            .client
            .get(format!(
                "{}/v1/payment_intents/{}",
                self.config.base_url.trim_end_matches('/'),
                payment_intent_id
            ))
            .bearer_auth(&self.config.secret_key)
            .query(&[("expand[]", "latest_charge")])
            .send()
            .await
            .map_err(|error| format!("stripe_payment_intent_request_failed: {error}"))?;

        let status = response.status();
        let body = response
            .text()
            .await
            .map_err(|error| format!("stripe_payment_intent_response_failed: {error}"))?;

        if status != StatusCode::OK {
            return Err(format!(
                "stripe_payment_intent_failed:{}",
                stripe_error_message(status, &body)
            ));
        }

        let value: Value = serde_json::from_str(&body)
            .map_err(|error| format!("invalid_stripe_payment_intent_response: {error}"))?;

        Ok(
            stripe_value_at(&value, &["latest_charge", "outcome", "risk_level"])
                .and_then(Value::as_str)
                .map(str::to_string)
                .or_else(|| {
                    stripe_value_at(&value, &["charges", "data"])
                        .and_then(Value::as_array)
                        .and_then(|charges| charges.first())
                        .and_then(|charge| stripe_value_at(charge, &["outcome", "risk_level"]))
                        .and_then(Value::as_str)
                        .map(str::to_string)
                }),
        )
    }

    pub fn verify_webhook(
        &self,
        body: &[u8],
        signature_header: &str,
    ) -> Result<StripeWebhookEvent, String> {
        let (timestamp, signatures) = parse_signature_header(signature_header)?;
        let now = chrono::Utc::now().timestamp();
        if (now - timestamp).abs() > STRIPE_WEBHOOK_TOLERANCE_SECONDS {
            return Err("stripe_webhook_signature_too_old".to_string());
        }

        let mut signed_payload = timestamp.to_string().into_bytes();
        signed_payload.push(b'.');
        signed_payload.extend_from_slice(body);

        let mut any_match = false;
        for signature in signatures {
            let signature_bytes = hex::decode(signature)
                .map_err(|_| "invalid_stripe_webhook_signature".to_string())?;
            let mut mac = HmacSha256::new_from_slice(self.config.webhook_secret.as_bytes())
                .map_err(|_| "invalid_stripe_webhook_secret".to_string())?;
            mac.update(&signed_payload);
            if mac.verify_slice(&signature_bytes).is_ok() {
                any_match = true;
                break;
            }
        }

        if !any_match {
            return Err("stripe_webhook_signature_mismatch".to_string());
        }

        serde_json::from_slice(body).map_err(|error| format!("invalid_stripe_webhook: {error}"))
    }

    fn render_return_url(&self, template: &str, topup_id: &str) -> String {
        template.replace("{TOPUP_ID}", topup_id)
    }
}

fn parse_signature_header(header: &str) -> Result<(i64, Vec<String>), String> {
    let mut timestamp = None;
    let mut signatures = Vec::new();

    for part in header.split(',') {
        let Some((key, value)) = part.split_once('=') else {
            continue;
        };

        match key.trim() {
            "t" => {
                let parsed = value
                    .trim()
                    .parse::<i64>()
                    .map_err(|_| "invalid_stripe_webhook_timestamp".to_string())?;
                timestamp = Some(parsed);
            }
            "v1" => signatures.push(value.trim().to_string()),
            _ => {}
        }
    }

    let timestamp = timestamp.ok_or_else(|| "missing_stripe_webhook_timestamp".to_string())?;
    if signatures.is_empty() {
        return Err("missing_stripe_webhook_signature".to_string());
    }

    Ok((timestamp, signatures))
}

fn stripe_error_message(status: StatusCode, body: &str) -> String {
    if let Ok(value) = serde_json::from_str::<Value>(body) {
        if let Some(message) =
            stripe_value_at(&value, &["error", "message"]).and_then(Value::as_str)
        {
            return format!("{status}:{message}");
        }
    }

    format!("{status}:{body}")
}

fn stripe_value_at<'a>(value: &'a Value, path: &[&str]) -> Option<&'a Value> {
    let mut current = value;
    for segment in path {
        current = current.get(*segment)?;
    }
    Some(current)
}

pub fn topup_metadata_checkout_fields(
    metadata_json: Option<&str>,
) -> (Option<String>, Option<String>, Option<i64>, Option<String>) {
    let Some(json) = metadata_json else {
        return (None, None, None, None);
    };
    let Ok(value) = serde_json::from_str::<Value>(json) else {
        return (None, None, None, None);
    };

    let checkout_url = stripe_value_at(&value, &["checkout_url"])
        .and_then(Value::as_str)
        .map(str::to_string);
    let checkout_session_id = stripe_value_at(&value, &["checkout_session_id"])
        .and_then(Value::as_str)
        .map(str::to_string);
    let checkout_expires_at =
        stripe_value_at(&value, &["checkout_expires_at"]).and_then(Value::as_i64);
    let risk_level = stripe_value_at(&value, &["risk_level"])
        .and_then(Value::as_str)
        .map(str::to_string);

    (
        checkout_url,
        checkout_session_id,
        checkout_expires_at,
        risk_level,
    )
}

pub fn topup_metadata_merge(extra: &[(&str, Value)]) -> Value {
    let mut map = serde_json::Map::new();
    for (key, value) in extra {
        map.insert((*key).to_string(), value.clone());
    }
    Value::Object(map)
}

pub fn stripe_event_metadata(object: &Value) -> HashMap<String, String> {
    object
        .get("metadata")
        .and_then(Value::as_object)
        .map(|entries| {
            entries
                .iter()
                .filter_map(|(key, value)| {
                    value.as_str().map(|text| (key.clone(), text.to_string()))
                })
                .collect()
        })
        .unwrap_or_default()
}
