use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MarketVisibility {
    Pending,
    Public,
}

impl std::fmt::Display for MarketVisibility {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MarketVisibility::Pending => write!(f, "pending"),
            MarketVisibility::Public => write!(f, "public"),
        }
    }
}

impl std::str::FromStr for MarketVisibility {
    type Err = String;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value.to_lowercase().as_str() {
            "pending" => Ok(Self::Pending),
            "public" => Ok(Self::Public),
            _ => Err(format!("Invalid market visibility: {value}")),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketLaunchState {
    pub event_id: String,
    pub raw_event_json: String,
    pub visibility: MarketVisibility,
    pub first_trade_at: Option<i64>,
    pub public_visible_at: Option<i64>,
    pub volume_minor: u64,
    pub trade_count: u64,
    pub last_price_yes_ppm: u64,
    pub last_price_no_ppm: u64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletFundingEvent {
    pub id: String,
    pub pubkey: String,
    pub rail: String,
    pub amount_minor: u64,
    pub status: String,
    pub risk_level: Option<String>,
    pub metadata_json: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WalletFundingStatus {
    InvoicePending,
    Paid,
    Complete,
    ReviewRequired,
    Expired,
    Cancelled,
}

impl std::fmt::Display for WalletFundingStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvoicePending => write!(f, "invoice_pending"),
            Self::Paid => write!(f, "paid"),
            Self::Complete => write!(f, "complete"),
            Self::ReviewRequired => write!(f, "review_required"),
            Self::Expired => write!(f, "expired"),
            Self::Cancelled => write!(f, "cancelled"),
        }
    }
}

impl std::str::FromStr for WalletFundingStatus {
    type Err = String;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value.to_lowercase().as_str() {
            "invoice_pending" => Ok(Self::InvoicePending),
            "paid" => Ok(Self::Paid),
            "complete" => Ok(Self::Complete),
            "review_required" => Ok(Self::ReviewRequired),
            "expired" => Ok(Self::Expired),
            "cancelled" => Ok(Self::Cancelled),
            _ => Err(format!("Invalid wallet funding status: {value}")),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FxQuoteObservation {
    pub source: String,
    pub btc_usd_price: f64,
    pub observed_at: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum FxQuoteDirection {
    #[default]
    UsdToMsat,
    MsatToMinor,
}

impl std::fmt::Display for FxQuoteDirection {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::UsdToMsat => write!(f, "usd_to_msat"),
            Self::MsatToMinor => write!(f, "msat_to_minor"),
        }
    }
}

impl std::str::FromStr for FxQuoteDirection {
    type Err = String;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value.to_ascii_lowercase().as_str() {
            "usd_to_msat" => Ok(Self::UsdToMsat),
            "msat_to_minor" => Ok(Self::MsatToMinor),
            _ => Err(format!("Invalid FX quote direction: {value}")),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct FxQuoteSourceMetadata {
    pub combination_policy: String,
    pub quote_direction: FxQuoteDirection,
    pub provider_count: u64,
    pub minimum_provider_count: u64,
    pub execution_spread_bps: u64,
    pub max_observation_age_seconds: i64,
    pub fallback_used: bool,
}

impl Default for FxQuoteSourceMetadata {
    fn default() -> Self {
        Self {
            combination_policy: "legacy_unknown".to_string(),
            quote_direction: FxQuoteDirection::UsdToMsat,
            provider_count: 0,
            minimum_provider_count: 0,
            execution_spread_bps: 0,
            max_observation_age_seconds: 0,
            fallback_used: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FxQuoteSnapshot {
    pub id: String,
    pub amount_minor: u64,
    pub amount_msat: u64,
    pub btc_usd_price: f64,
    pub reference_btc_usd_price: f64,
    pub source: String,
    pub spread_bps: u64,
    pub observations: Vec<FxQuoteObservation>,
    pub source_metadata: FxQuoteSourceMetadata,
    pub created_at: i64,
    pub expires_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletFundingQuote {
    pub id: String,
    pub pubkey: String,
    pub rail: String,
    pub amount_minor: u64,
    pub amount_msat: u64,
    pub status: WalletFundingStatus,
    pub invoice: Option<String>,
    pub payment_hash: Option<String>,
    pub fx_quote_id: String,
    pub funding_event_id: Option<String>,
    pub metadata_json: Option<String>,
    pub created_at: i64,
    pub expires_at: i64,
    pub settled_at: Option<i64>,
    pub completed_at: Option<i64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WalletFundingRequestStatus {
    Pending,
    Complete,
    Failed,
}

impl std::fmt::Display for WalletFundingRequestStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Pending => write!(f, "pending"),
            Self::Complete => write!(f, "complete"),
            Self::Failed => write!(f, "failed"),
        }
    }
}

impl std::str::FromStr for WalletFundingRequestStatus {
    type Err = String;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value.to_lowercase().as_str() {
            "pending" => Ok(Self::Pending),
            "complete" => Ok(Self::Complete),
            "failed" => Ok(Self::Failed),
            _ => Err(format!("Invalid wallet funding request status: {value}")),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletFundingRequest {
    pub request_id: String,
    pub pubkey: String,
    pub rail: String,
    pub amount_minor: u64,
    pub status: WalletFundingRequestStatus,
    pub error_message: Option<String>,
    pub funding_quote_id: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub completed_at: Option<i64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum UsdcDepositIntentStatus {
    Pending,
    Confirmed,
    Credited,
    Expired,
    Cancelled,
}

impl std::fmt::Display for UsdcDepositIntentStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Pending => write!(f, "pending"),
            Self::Confirmed => write!(f, "confirmed"),
            Self::Credited => write!(f, "credited"),
            Self::Expired => write!(f, "expired"),
            Self::Cancelled => write!(f, "cancelled"),
        }
    }
}

impl std::str::FromStr for UsdcDepositIntentStatus {
    type Err = String;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value.to_lowercase().as_str() {
            "pending" => Ok(Self::Pending),
            "confirmed" => Ok(Self::Confirmed),
            "credited" => Ok(Self::Credited),
            "expired" => Ok(Self::Expired),
            "cancelled" => Ok(Self::Cancelled),
            _ => Err(format!("Invalid USDC deposit intent status: {value}")),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsdcDepositIntent {
    pub id: String,
    pub pubkey: String,
    pub provider: Option<String>,
    pub provider_session_id: Option<String>,
    pub provider_redirect_url: Option<String>,
    pub network: String,
    pub asset: String,
    pub destination_address: String,
    pub requested_wallet_amount_minor: Option<u64>,
    pub received_asset_units: Option<u64>,
    pub onchain_tx_id: Option<String>,
    pub status: UsdcDepositIntentStatus,
    pub metadata_json: Option<String>,
    pub created_at: i64,
    pub expires_at: Option<i64>,
    pub confirmed_at: Option<i64>,
    pub credited_at: Option<i64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum UsdcWithdrawalStatus {
    Pending,
    Submitted,
    Completed,
    Failed,
    Cancelled,
}

impl std::fmt::Display for UsdcWithdrawalStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Pending => write!(f, "pending"),
            Self::Submitted => write!(f, "submitted"),
            Self::Completed => write!(f, "completed"),
            Self::Failed => write!(f, "failed"),
            Self::Cancelled => write!(f, "cancelled"),
        }
    }
}

impl std::str::FromStr for UsdcWithdrawalStatus {
    type Err = String;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value.to_lowercase().as_str() {
            "pending" => Ok(Self::Pending),
            "submitted" => Ok(Self::Submitted),
            "completed" => Ok(Self::Completed),
            "failed" => Ok(Self::Failed),
            "cancelled" => Ok(Self::Cancelled),
            _ => Err(format!("Invalid USDC withdrawal status: {value}")),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsdcWithdrawal {
    pub id: String,
    pub request_id: Option<String>,
    pub pubkey: String,
    pub provider: Option<String>,
    pub provider_payout_id: Option<String>,
    pub network: String,
    pub asset: String,
    pub destination_address: String,
    pub wallet_amount_minor: u64,
    pub asset_units: u64,
    pub onchain_tx_id: Option<String>,
    pub status: UsdcWithdrawalStatus,
    pub error_message: Option<String>,
    pub change_signatures_json: Option<String>,
    pub metadata_json: Option<String>,
    pub created_at: i64,
    pub submitted_at: Option<i64>,
    pub completed_at: Option<i64>,
    pub failed_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradeQuoteSnapshot {
    pub id: String,
    pub market_event_id: String,
    pub trade_type: String,
    pub side: String,
    pub fx_quote_id: String,
    pub spend_minor: u64,
    pub fee_minor: u64,
    pub net_minor: u64,
    pub settlement_minor: u64,
    pub settlement_msat: u64,
    pub settlement_fee_msat: u64,
    pub quantity: f64,
    pub average_price_ppm: u64,
    pub marginal_price_before_ppm: u64,
    pub marginal_price_after_ppm: u64,
    pub current_price_yes_ppm: u64,
    pub current_price_no_ppm: u64,
    pub snapshot_q_long: f64,
    pub snapshot_q_short: f64,
    pub snapshot_reserve_minor: u64,
    pub created_at: i64,
    pub expires_at: i64,
    pub executed_trade_id: Option<String>,
    pub executed_at: Option<i64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TradeExecutionRequestStatus {
    Pending,
    Complete,
    Failed,
}

impl std::fmt::Display for TradeExecutionRequestStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Pending => write!(f, "pending"),
            Self::Complete => write!(f, "complete"),
            Self::Failed => write!(f, "failed"),
        }
    }
}

impl std::str::FromStr for TradeExecutionRequestStatus {
    type Err = String;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value.to_lowercase().as_str() {
            "pending" => Ok(Self::Pending),
            "complete" => Ok(Self::Complete),
            "failed" => Ok(Self::Failed),
            _ => Err(format!("Invalid trade execution request status: {value}")),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradeExecutionRequest {
    pub request_id: String,
    pub pubkey: String,
    pub market_event_id: String,
    pub trade_type: String,
    pub side: String,
    pub spend_minor: Option<u64>,
    pub quantity: Option<f64>,
    pub status: TradeExecutionRequestStatus,
    pub error_message: Option<String>,
    pub trade_id: Option<String>,
    pub response_json: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub completed_at: Option<i64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TradeSettlementStatus {
    Complete,
}

impl std::fmt::Display for TradeSettlementStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Complete => write!(f, "complete"),
        }
    }
}

impl std::str::FromStr for TradeSettlementStatus {
    type Err = String;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value.to_lowercase().as_str() {
            "complete" => Ok(Self::Complete),
            _ => Err(format!("Invalid trade settlement status: {value}")),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradeSettlementRecord {
    pub id: String,
    pub trade_id: String,
    pub quote_id: Option<String>,
    pub pubkey: String,
    pub market_event_id: String,
    pub trade_type: String,
    pub side: String,
    pub rail: String,
    pub mode: String,
    pub settlement_minor: u64,
    pub settlement_msat: u64,
    pub settlement_fee_msat: u64,
    pub fx_quote_id: Option<String>,
    pub invoice: Option<String>,
    pub payment_hash: Option<String>,
    pub status: TradeSettlementStatus,
    pub metadata_json: Option<String>,
    pub created_at: i64,
    pub settled_at: Option<i64>,
    pub completed_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradeSettlementInsert {
    pub quote_id: Option<String>,
    pub pubkey: String,
    pub market_event_id: String,
    pub trade_type: String,
    pub side: String,
    pub rail: String,
    pub mode: String,
    pub settlement_minor: u64,
    pub settlement_msat: u64,
    pub settlement_fee_msat: u64,
    pub fx_quote_id: Option<String>,
    pub invoice: Option<String>,
    pub payment_hash: Option<String>,
    pub metadata_json: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketTradeRecord {
    pub id: String,
    pub market_event_id: String,
    pub market_slug: String,
    pub pubkey: String,
    pub direction: String,
    pub trade_type: String,
    pub amount_minor: u64,
    pub fee_minor: u64,
    pub quantity: f64,
    pub price_ppm: u64,
    pub created_at: i64,
    pub raw_event_json: String,
}
