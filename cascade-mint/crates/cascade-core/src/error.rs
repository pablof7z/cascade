use thiserror::Error;

/// Result type for Cascade operations
pub type Result<T> = std::result::Result<T, CascadeError>;

/// Cascade-specific error types
#[derive(Error, Debug)]
pub enum CascadeError {
    #[error("LMSR error: {0}")]
    LmsrError(String),

    #[error("Invalid trade: {reason}")]
    InvalidTrade { reason: String },

    #[error("Cost calculation failed: {0}")]
    CostCalculationFailed(String),

    #[error("Market not found: {0}")]
    MarketNotFound(String),

    #[error("Market not active: {0}")]
    MarketNotActive(String),

    #[error("Insufficient funds: need {need} sats, have {have}")]
    InsufficientFunds { need: u64, have: u64 },

    #[error("Invalid proofs: {0}")]
    InvalidProofs(String),

    #[error("Database error: {0}")]
    DatabaseError(String),

    #[error("Keyset error: {0}")]
    KeysetError(String),

    #[error("Token error: {0}")]
    TokenError(String),

    #[error("Trade error: {0}")]
    TradeError(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),

    #[error("Configuration error: {0}")]
    ConfigError(String),

    #[error("Payment error: {0}")]
    PaymentError(String),

    #[error("Internal error: {0}")]
    InternalError(String),
}

// Convenience methods for construction
impl CascadeError {
    pub fn lmsr(msg: impl Into<String>) -> Self {
        CascadeError::LmsrError(msg.into())
    }

    pub fn invalid_trade(msg: impl Into<String>) -> Self {
        CascadeError::InvalidTrade {
            reason: msg.into(),
        }
    }
}

impl From<sqlx::Error> for CascadeError {
    fn from(err: sqlx::Error) -> Self {
        CascadeError::DatabaseError(err.to_string())
    }
}

impl From<serde_json::Error> for CascadeError {
    fn from(err: serde_json::Error) -> Self {
        CascadeError::SerializationError(err.to_string())
    }
}