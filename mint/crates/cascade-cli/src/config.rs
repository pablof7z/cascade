use anyhow::{anyhow, bail, Context, Result};
use chrono::Utc;
use nostr::prelude::{Keys, ToBech32};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

pub const DEFAULT_RELAYS: [&str; 1] = ["wss://purplepag.es"];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Edition {
    Signet,
    Mainnet,
}

impl Edition {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Signet => "signet",
            Self::Mainnet => "mainnet",
        }
    }

    pub fn market_event_kind(self) -> u16 {
        match self {
            Self::Signet => 980,
            Self::Mainnet => 982,
        }
    }

    pub fn trade_event_kind(self) -> u16 {
        match self {
            Self::Signet => 981,
            Self::Mainnet => 983,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdentityConfig {
    pub nsec: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeConfig {
    pub version: u64,
    pub edition: Edition,
    pub api_base_url: String,
    pub relays: Vec<String>,
    pub identity: IdentityConfig,
    pub proof_store: String,
    pub created_at: String,
}

#[derive(Debug, Clone)]
pub struct LoadedConfig {
    pub path: PathBuf,
    pub config: RuntimeConfig,
}

#[derive(Debug, Clone)]
pub struct IdentitySummary {
    pub pubkey: String,
    pub npub: String,
}

pub fn resolve_requested_edition(signet: bool, mainnet: bool) -> Result<Option<Edition>> {
    if signet && mainnet {
        bail!("--signet and --mainnet are mutually exclusive");
    }
    if signet {
        return Ok(Some(Edition::Signet));
    }
    if mainnet {
        return Ok(Some(Edition::Mainnet));
    }
    Ok(None)
}

pub fn default_config_path(edition: Edition) -> PathBuf {
    PathBuf::from(".cascade")
        .join(edition.as_str())
        .join("agent.json")
}

pub fn normalize_relays(relays: &[String]) -> Vec<String> {
    let mut out: Vec<String> = relays
        .iter()
        .map(|relay| relay.trim())
        .filter(|relay| !relay.is_empty())
        .map(str::to_string)
        .collect();

    if out.is_empty() {
        out = DEFAULT_RELAYS
            .iter()
            .map(|relay| relay.to_string())
            .collect();
    }

    out.sort();
    out.dedup();
    out
}

pub fn ensure_identity_summary(nsec: &str) -> Result<IdentitySummary> {
    let keys = Keys::parse(nsec).context("failed to parse nsec")?;
    Ok(IdentitySummary {
        pubkey: keys.public_key().to_string(),
        npub: keys.public_key().to_bech32()?,
    })
}

pub fn resolve_config_path(config: Option<&String>, edition: Option<Edition>) -> Result<PathBuf> {
    if let Some(path) = config {
        return Ok(PathBuf::from(path));
    }

    if let Some(edition) = edition {
        return Ok(default_config_path(edition));
    }

    let signet = default_config_path(Edition::Signet);
    if signet.exists() {
        return Ok(signet);
    }

    let mainnet = default_config_path(Edition::Mainnet);
    if mainnet.exists() {
        return Ok(mainnet);
    }

    Err(anyhow!(
        "no config found; pass --config or use --signet/--mainnet so the default path can be inferred"
    ))
}

pub fn load_config(path: &Path) -> Result<LoadedConfig> {
    let raw = fs::read_to_string(path)
        .with_context(|| format!("failed to read config file {}", path.display()))?;
    let config: RuntimeConfig = serde_json::from_str(&raw)
        .with_context(|| format!("failed to parse config file {}", path.display()))?;
    Ok(LoadedConfig {
        path: path.to_path_buf(),
        config,
    })
}

pub fn write_config(path: &Path, config: &RuntimeConfig) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("failed to create {}", parent.display()))?;
    }

    let json = serde_json::to_string_pretty(config)?;
    fs::write(path, format!("{json}\n"))
        .with_context(|| format!("failed to write {}", path.display()))?;
    Ok(())
}

pub fn build_config(
    edition: Edition,
    api_base_url: String,
    relays: Vec<String>,
    nsec: String,
    proof_store: PathBuf,
) -> RuntimeConfig {
    RuntimeConfig {
        version: 1,
        edition,
        api_base_url: api_base_url.trim_end_matches('/').to_string(),
        relays: normalize_relays(&relays),
        identity: IdentityConfig { nsec },
        proof_store: proof_store.to_string_lossy().to_string(),
        created_at: Utc::now().to_rfc3339(),
    }
}

pub fn default_proof_store_path(config_path: &Path) -> PathBuf {
    config_path
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join("proofs.json")
}
