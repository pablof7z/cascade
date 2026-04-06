use thiserror::Error;

#[derive(Debug, Error)]
pub enum CascadeError {
    #[error("Cascade error: {0}")]
    Generic(String),
}

impl From<cdk::error::Error> for CascadeError {
    fn from(e: cdk::error::Error) -> Self {
        CascadeError::Generic(e.to_string())
    }
}
