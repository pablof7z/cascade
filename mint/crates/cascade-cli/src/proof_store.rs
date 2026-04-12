use anyhow::{bail, Context, Result};
use cascade_api::types::ProofInput;
use cdk::mint_url::MintUrl;
use cdk::nuts::{CurrencyUnit, Id, Proof, TokenV3};
use cdk::secret::Secret;
use cdk::Amount;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashSet};
use std::fs;
use std::path::Path;
use std::str::FromStr;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProofStore {
    pub version: u64,
    pub updated_at: String,
    #[serde(default)]
    pub wallets: Vec<ProofWallet>,
    #[serde(default)]
    pub proofs: Vec<ProofInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProofWallet {
    pub mint_url: String,
    pub unit: String,
    #[serde(default)]
    pub proofs: Vec<ProofInput>,
    #[serde(default)]
    pub market_event_id: Option<String>,
    #[serde(default)]
    pub market_slug: Option<String>,
    #[serde(default)]
    pub market_title: Option<String>,
    #[serde(default)]
    pub side: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProofWalletSummary {
    pub mint_url: String,
    pub unit: String,
    pub proof_count: usize,
    pub amount: u64,
    pub market_event_id: Option<String>,
    pub market_slug: Option<String>,
    pub market_title: Option<String>,
    pub side: Option<String>,
}

impl ProofStore {
    pub fn empty() -> Self {
        Self {
            version: 2,
            updated_at: chrono::Utc::now().to_rfc3339(),
            wallets: Vec::new(),
            proofs: Vec::new(),
        }
    }

    pub fn load(path: &Path) -> Result<Self> {
        if !path.exists() {
            return Ok(Self::empty());
        }

        let raw = fs::read_to_string(path)
            .with_context(|| format!("failed to read proof store {}", path.display()))?;
        let mut store: Self =
            serde_json::from_str(&raw).with_context(|| "failed to parse proof store")?;

        if store.wallets.is_empty() && !store.proofs.is_empty() {
            let proofs = std::mem::take(&mut store.proofs);
            store.wallets.push(ProofWallet {
                mint_url: String::new(),
                unit: "usd".to_string(),
                proofs,
                market_event_id: None,
                market_slug: None,
                market_title: None,
                side: None,
            });
        }

        store.version = 2;
        store.normalize();
        Ok(store)
    }

    pub fn save(&mut self, path: &Path) -> Result<()> {
        self.updated_at = chrono::Utc::now().to_rfc3339();
        self.normalize();

        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .with_context(|| format!("failed to create {}", parent.display()))?;
        }

        let json = serde_json::to_string_pretty(self)?;
        fs::write(path, format!("{json}\n"))
            .with_context(|| format!("failed to write proof store {}", path.display()))?;
        Ok(())
    }

    pub fn list(&self) -> Vec<ProofWalletSummary> {
        self.wallets
            .iter()
            .map(|wallet| ProofWalletSummary {
                mint_url: wallet.mint_url.clone(),
                unit: wallet.unit.clone(),
                proof_count: wallet.proofs.len(),
                amount: wallet.proofs.iter().map(|proof| proof.amount).sum(),
                market_event_id: wallet.market_event_id.clone(),
                market_slug: wallet.market_slug.clone(),
                market_title: wallet.market_title.clone(),
                side: wallet.side.clone(),
            })
            .collect()
    }

    pub fn wallet(&self, unit: &str) -> Option<&ProofWallet> {
        self.wallets
            .iter()
            .find(|wallet| wallet.unit == normalize_unit(unit))
    }

    pub fn wallet_mut(&mut self, mint_url: &str, unit: &str) -> &mut ProofWallet {
        let normalized_unit = normalize_unit(unit);
        let normalized_mint = normalize_mint_url(mint_url);
        if let Some(index) = self
            .wallets
            .iter()
            .position(|wallet| wallet.unit == normalized_unit && wallet.mint_url == normalized_mint)
        {
            return &mut self.wallets[index];
        }

        self.wallets.push(ProofWallet {
            mint_url: normalized_mint,
            unit: normalized_unit,
            proofs: Vec::new(),
            market_event_id: None,
            market_slug: None,
            market_title: None,
            side: None,
        });
        self.wallets.last_mut().expect("wallet inserted")
    }

    pub fn add_proofs(
        &mut self,
        mint_url: &str,
        unit: &str,
        proofs: &[ProofInput],
        metadata: WalletMetadata<'_>,
    ) -> ProofWalletSummary {
        let wallet = self.wallet_mut(mint_url, unit);
        let mut by_commitment: BTreeMap<String, ProofInput> = wallet
            .proofs
            .drain(..)
            .map(|proof| (proof.C.clone(), proof))
            .collect();

        for proof in proofs {
            by_commitment.insert(proof.C.clone(), proof.clone());
        }

        wallet.proofs = by_commitment.into_values().collect();
        if let Some(event_id) = metadata.market_event_id {
            wallet.market_event_id = Some(event_id.to_string());
        }
        if let Some(slug) = metadata.market_slug {
            wallet.market_slug = Some(slug.to_string());
        }
        if let Some(title) = metadata.market_title {
            wallet.market_title = Some(title.to_string());
        }
        if let Some(side) = metadata.side {
            wallet.side = Some(side.to_string());
        }

        ProofWalletSummary {
            mint_url: wallet.mint_url.clone(),
            unit: wallet.unit.clone(),
            proof_count: wallet.proofs.len(),
            amount: wallet.proofs.iter().map(|proof| proof.amount).sum(),
            market_event_id: wallet.market_event_id.clone(),
            market_slug: wallet.market_slug.clone(),
            market_title: wallet.market_title.clone(),
            side: wallet.side.clone(),
        }
    }

    pub fn remove_proofs_by_commitment(
        &mut self,
        unit: &str,
        commitments: &HashSet<String>,
    ) -> Option<ProofWalletSummary> {
        let normalized_unit = normalize_unit(unit);
        let wallet = self
            .wallets
            .iter_mut()
            .find(|wallet| wallet.unit == normalized_unit)?;
        wallet
            .proofs
            .retain(|proof| !commitments.contains(&proof.C));
        Some(ProofWalletSummary {
            mint_url: wallet.mint_url.clone(),
            unit: wallet.unit.clone(),
            proof_count: wallet.proofs.len(),
            amount: wallet.proofs.iter().map(|proof| proof.amount).sum(),
            market_event_id: wallet.market_event_id.clone(),
            market_slug: wallet.market_slug.clone(),
            market_title: wallet.market_title.clone(),
            side: wallet.side.clone(),
        })
    }

    pub fn remove_proofs_by_secret(
        &mut self,
        unit: &str,
        secrets: &HashSet<String>,
    ) -> Option<ProofWalletSummary> {
        let normalized_unit = normalize_unit(unit);
        let wallet = self
            .wallets
            .iter_mut()
            .find(|wallet| wallet.unit == normalized_unit)?;
        wallet
            .proofs
            .retain(|proof| !secrets.contains(&proof.secret));
        Some(ProofWalletSummary {
            mint_url: wallet.mint_url.clone(),
            unit: wallet.unit.clone(),
            proof_count: wallet.proofs.len(),
            amount: wallet.proofs.iter().map(|proof| proof.amount).sum(),
            market_event_id: wallet.market_event_id.clone(),
            market_slug: wallet.market_slug.clone(),
            market_title: wallet.market_title.clone(),
            side: wallet.side.clone(),
        })
    }

    pub fn select_for_amount(&self, unit: &str, target: u64) -> Result<Vec<ProofInput>> {
        let wallet = self
            .wallet(unit)
            .ok_or_else(|| anyhow::anyhow!("no local proof wallet for unit {unit}"))?;
        let mut proofs = wallet.proofs.clone();
        proofs.sort_by(|left, right| right.amount.cmp(&left.amount));

        let mut selected = Vec::new();
        let mut total = 0_u64;
        for proof in proofs {
            total = total.saturating_add(proof.amount);
            selected.push(proof);
            if total >= target {
                return Ok(selected);
            }
        }

        bail!("insufficient local proofs in unit {unit}");
    }

    fn normalize(&mut self) {
        for wallet in &mut self.wallets {
            wallet.mint_url = normalize_mint_url(&wallet.mint_url);
            wallet.unit = normalize_unit(&wallet.unit);
            let mut seen = HashSet::new();
            wallet.proofs.retain(|proof| seen.insert(proof.C.clone()));
        }

        self.wallets
            .retain(|wallet| !wallet.proofs.is_empty() || wallet.unit == "usd");
        self.wallets.sort_by(|left, right| {
            left.unit
                .cmp(&right.unit)
                .then(left.mint_url.cmp(&right.mint_url))
        });
    }
}

#[derive(Debug, Clone, Copy, Default)]
pub struct WalletMetadata<'a> {
    pub market_event_id: Option<&'a str>,
    pub market_slug: Option<&'a str>,
    pub market_title: Option<&'a str>,
    pub side: Option<&'a str>,
}

pub fn normalize_unit(unit: &str) -> String {
    let trimmed = unit.trim();
    if trimmed.eq_ignore_ascii_case("usd") {
        return "usd".to_string();
    }
    if let Some(rest) = trimmed.strip_prefix("LONG_") {
        return format!("long_{}", rest);
    }
    if let Some(rest) = trimmed.strip_prefix("SHORT_") {
        return format!("short_{}", rest);
    }
    trimmed.to_lowercase()
}

pub fn normalize_mint_url(mint_url: &str) -> String {
    mint_url.trim().trim_end_matches('/').to_string()
}

pub fn encode_token(mint_url: &str, unit: &str, proofs: &[ProofInput]) -> Result<String> {
    let mint = MintUrl::from_str(mint_url)?;
    let unit = parse_currency_unit(unit);
    let cashu_proofs = proofs
        .iter()
        .map(proof_input_to_cashu)
        .collect::<Result<Vec<_>>>()?;
    let token = TokenV3::new(mint, cashu_proofs, None, Some(unit))?;
    Ok(token.to_string())
}

pub fn decode_token(token: &str) -> Result<(String, String, Vec<ProofInput>)> {
    let token = TokenV3::from_str(token.trim()).context("failed to decode Cashu token")?;
    let entry = token
        .token
        .first()
        .ok_or_else(|| anyhow::anyhow!("token is missing proofs"))?;
    let unit = token
        .unit
        .as_ref()
        .map(currency_unit_to_string)
        .unwrap_or_else(|| "sat".to_string());
    let proofs = entry
        .proofs
        .iter()
        .map(|proof| ProofInput {
            secret: proof.secret.to_string(),
            amount: proof.amount.to_u64(),
            C: proof.c.to_hex(),
            id: proof.keyset_id.to_string(),
            witness: proof.witness.as_ref().map(ToString::to_string),
            dleq: None,
        })
        .collect::<Vec<_>>();
    Ok((entry.mint.to_string(), normalize_unit(&unit), proofs))
}

fn parse_currency_unit(unit: &str) -> CurrencyUnit {
    match normalize_unit(unit).as_str() {
        "usd" => CurrencyUnit::Usd,
        "sat" => CurrencyUnit::Sat,
        other => CurrencyUnit::Custom(other.to_string()),
    }
}

fn currency_unit_to_string(unit: &CurrencyUnit) -> String {
    match unit {
        CurrencyUnit::Sat => "sat".to_string(),
        CurrencyUnit::Msat => "msat".to_string(),
        CurrencyUnit::Usd => "usd".to_string(),
        CurrencyUnit::Eur => "eur".to_string(),
        CurrencyUnit::Custom(value) => value.to_string(),
        _ => unit.to_string(),
    }
}

fn proof_input_to_cashu(proof: &ProofInput) -> Result<Proof> {
    let keyset_id = Id::from_str(&proof.id)?;
    let secret = Secret::from_str(&proof.secret)?;
    let public_key = cdk::nuts::PublicKey::from_hex(&proof.C)?;
    Ok(Proof::new(
        Amount::from(proof.amount),
        keyset_id,
        secret,
        public_key,
    ))
}
