//! Error types for Cascade markets.

use thiserror::Error;

/// Cascade-specific errors.
#[derive(Debug, Error)]
pub enum CascadeError {
    #[error("Market not found: {slug}")]
    MarketNotFound { slug: String },

    #[error("Market not active: {slug} (status: {status:?})")]
    MarketNotActive { slug: String, status: MarketStatus },

    #[error("Invalid trade: {reason}")]
    InvalidTrade { reason: String },

    #[error("Invalid input: {reason}")]
    InvalidInput { reason: String },

    #[error("Insufficient funds: {reason}")]
    InsufficientFunds { reason: String },

    #[error("LMSR error: {0}")]
    LmsrError(String),

    #[error("Database error: {0}")]
    DatabaseError(String),

    #[error("Nostr error: {0}")]
    NostrError(String),

    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),

    #[error("Cascade error: {0}")]
    Generic(String),
}

impl From<cdk::error::Error> for CascadeError {
    fn from(e: cdk::error::Error) -> Self {
        CascadeError::Generic(e.to_string())
    }
}

impl From<serde_json::Error> for CascadeError {
    fn from(e: serde_json::Error) -> Self {
        CascadeError::SerializationError(e.to_string())
    }
}

impl From<sqlx::Error> for CascadeError {
    fn from(e: sqlx::Error) -> Self {
        CascadeError::DatabaseError(e.to_string())
    }
}

impl From<nostr_sdk::types::Url> for CascadeError {
    fn from(e: nostr_sdk::types::Url) -> Self {
        CascadeError::NostrError(format!("Invalid relay URL: {}", e))
    }
}

/// Market status for lifecycle tracking.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MarketStatus {
    /// Market is open for trading
    Open,
    /// Market has been resolved (outcome determined)
    Resolved,
    /// Market was cancelled (no resolution)
    Cancelled,
    /// Market is archived (deleted from Nostr but kept in local DB)
    Archived,
}

impl std::fmt::Display for MarketStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MarketStatus::Open => write!(f, "open"),
            MarketStatus::Resolved => write!(f, "resolved"),
            MarketStatus::Cancelled => write!(f, "cancelled"),
            MarketStatus::Archived => write!(f, "archived"),
        }
    }
}

impl std::str::FromStr for MarketStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "open" => Ok(MarketStatus::Open),
            "resolved" => Ok(MarketStatus::Resolved),
            "cancelled" => Ok(MarketStatus::Cancelled),
            "archived" => Ok(MarketStatus::Archived),
            _ => Err(format!("Unknown market status: {}", s)),
        }
    }
}

impl serde::Serialize for MarketStatus {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl<'de> serde::Deserialize<'de> for MarketStatus {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        s.parse().map_err(serde::de::Error::custom)
    }
}
