use bitcoin::secp256k1::{Keypair, Message, Secp256k1, SecretKey, XOnlyPublicKey};
use futures::{future::join_all, SinkExt, StreamExt};
use serde_json::{json, Value};
use sha2::Digest;
use std::time::Duration;
use tokio::time::timeout;
use tokio_tungstenite::{connect_async, tungstenite::Message as WsMessage};

#[derive(Clone)]
pub struct TradePublisher {
    relays: Vec<String>,
    keypair: Keypair,
    public_key: XOnlyPublicKey,
    publish_timeout: Duration,
}

impl TradePublisher {
    pub fn new(
        relays: Vec<String>,
        secret_key: SecretKey,
        publish_timeout_ms: u64,
    ) -> Result<Self, String> {
        if relays.is_empty() {
            return Err("nostr_relays_are_required".to_string());
        }

        let secp = Secp256k1::new();
        let keypair = Keypair::from_secret_key(&secp, &secret_key);
        let (public_key, _) = XOnlyPublicKey::from_keypair(&keypair);

        Ok(Self {
            relays,
            keypair,
            public_key,
            publish_timeout: Duration::from_millis(publish_timeout_ms.max(1)),
        })
    }

    pub fn public_key_hex(&self) -> String {
        self.public_key.to_string()
    }

    pub async fn publish_trade_event(&self, raw_event: &Value) -> Result<(), String> {
        let signed_event = self.sign_trade_event(raw_event)?;
        let event_id = signed_event
            .get("id")
            .and_then(Value::as_str)
            .ok_or_else(|| "signed_trade_event_id_missing".to_string())?
            .to_string();
        let event_json = serde_json::to_string(&signed_event)
            .map_err(|error| format!("failed_to_serialize_signed_trade_event: {error}"))?;

        let attempts = join_all(self.relays.iter().cloned().map(|relay| {
            publish_event_to_relay(
                relay,
                event_json.clone(),
                event_id.clone(),
                self.publish_timeout,
            )
        }))
        .await;

        if attempts.iter().any(Result::is_ok) {
            return Ok(());
        }

        Err(attempts
            .into_iter()
            .filter_map(Result::err)
            .collect::<Vec<_>>()
            .join(" | "))
    }

    fn sign_trade_event(&self, raw_event: &Value) -> Result<Value, String> {
        let created_at = raw_event
            .get("created_at")
            .and_then(Value::as_i64)
            .ok_or_else(|| "trade_event_created_at_missing".to_string())?;
        let kind = raw_event
            .get("kind")
            .and_then(Value::as_i64)
            .ok_or_else(|| "trade_event_kind_missing".to_string())?;
        let content = raw_event
            .get("content")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        let tags = raw_event
            .get("tags")
            .and_then(Value::as_array)
            .ok_or_else(|| "trade_event_tags_missing".to_string())?
            .iter()
            .map(|tag| {
                tag.as_array()
                    .ok_or_else(|| "trade_event_tag_must_be_an_array".to_string())?
                    .iter()
                    .map(|item| {
                        item.as_str()
                            .map(str::to_string)
                            .ok_or_else(|| "trade_event_tag_values_must_be_strings".to_string())
                    })
                    .collect::<Result<Vec<_>, _>>()
            })
            .collect::<Result<Vec<Vec<String>>, _>>()?;
        let pubkey = self.public_key_hex();
        let event_payload = json!([0, pubkey, created_at, kind, tags, content]);
        let event_payload_json = serde_json::to_string(&event_payload)
            .map_err(|error| format!("failed_to_serialize_trade_event_payload: {error}"))?;
        let digest = sha2::Sha256::digest(event_payload_json.as_bytes());
        let event_id = hex::encode(digest);
        let message = Message::from_digest_slice(&digest)
            .map_err(|error| format!("failed_to_build_trade_event_message: {error}"))?;
        let secp = Secp256k1::new();
        let signature = secp.sign_schnorr_no_aux_rand(&message, &self.keypair);

        Ok(json!({
            "id": event_id,
            "pubkey": self.public_key_hex(),
            "created_at": created_at,
            "kind": kind,
            "content": content,
            "sig": signature.to_string(),
            "tags": tags,
        }))
    }
}

async fn publish_event_to_relay(
    relay: String,
    event_json: String,
    event_id: String,
    publish_timeout: Duration,
) -> Result<(), String> {
    let connect = timeout(publish_timeout, connect_async(relay.as_str()))
        .await
        .map_err(|_| format!("relay_connect_timeout:{relay}"))?
        .map_err(|error| format!("relay_connect_failed:{relay}:{error}"))?;
    let (mut socket, _) = connect;

    let payload = format!(r#"["EVENT",{}]"#, event_json);
    timeout(
        publish_timeout,
        socket.send(WsMessage::Text(payload.into())),
    )
    .await
    .map_err(|_| format!("relay_send_timeout:{relay}"))?
    .map_err(|error| format!("relay_send_failed:{relay}:{error}"))?;

    loop {
        let next = timeout(publish_timeout, socket.next())
            .await
            .map_err(|_| format!("relay_ack_timeout:{relay}"))?;
        let Some(message) = next else {
            return Err(format!("relay_closed_without_ack:{relay}"));
        };
        let message = message.map_err(|error| format!("relay_read_failed:{relay}:{error}"))?;
        match message {
            WsMessage::Text(text) => match relay_ack(&text, &event_id) {
                Ok(Some(())) => {
                    let _ = socket.close(None).await;
                    return Ok(());
                }
                Ok(None) => continue,
                Err(error) => return Err(format!("relay_rejected_event:{relay}:{error}")),
            },
            WsMessage::Ping(payload) => {
                let _ = socket.send(WsMessage::Pong(payload)).await;
            }
            WsMessage::Close(_) => {
                return Err(format!("relay_closed_without_ack:{relay}"));
            }
            _ => continue,
        }
    }
}

fn relay_ack(message: &str, event_id: &str) -> Result<Option<()>, String> {
    let Ok(value) = serde_json::from_str::<Value>(message) else {
        return Ok(None);
    };
    let Some(items) = value.as_array() else {
        return Ok(None);
    };
    let Some(kind) = items.first().and_then(Value::as_str) else {
        return Ok(None);
    };

    match kind {
        "OK" => {
            let acked_event_id = items.get(1).and_then(Value::as_str).unwrap_or_default();
            if acked_event_id != event_id {
                return Ok(None);
            }

            if items.get(2).and_then(Value::as_bool).unwrap_or(false) {
                Ok(Some(()))
            } else {
                Err(items
                    .get(3)
                    .and_then(Value::as_str)
                    .unwrap_or("relay_rejected_event")
                    .to_string())
            }
        }
        "NOTICE" => Err(items
            .get(1)
            .and_then(Value::as_str)
            .unwrap_or("relay_notice")
            .to_string()),
        _ => Ok(None),
    }
}
