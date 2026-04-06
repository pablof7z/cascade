//! Cascade API - HTTP API layer for Cascade prediction markets.
//!
//! Provides both standard Cashu NUT endpoints (via cdk-axum) and custom
//! Cascade endpoints for market management, trading, pricing, and resolution.

pub mod handlers;
pub mod routes;
pub mod types;

use axum::Router;
use cascade_core::{MarketManager, NostrPublisher};
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

/// Build the complete HTTP server combining CDK standard routes and Cascade custom routes.
///
/// # Arguments
/// * `market_manager` - The market manager for Cascade operations
/// * `nostr_publisher` - The Nostr publisher for market and trade events
/// * `config` - Optional mint configuration
///
/// # Returns
/// An Axum Router with all routes configured.
///
/// ## Route Structure
/// - `/v1/*` - Standard Cashu NUT endpoints (from cdk-axum)
/// - `/v1/cascade/*` - Custom Cascade endpoints
///
/// ## CORS Configuration
/// - Permissive CORS for development
/// - Configure allowed origins for production
pub async fn build_server(
    market_manager: MarketManager,
    nostr_publisher: NostrPublisher,
    _config: Option<&MintConfig>,
) -> anyhow::Result<Router> {
    // Create Cascade custom router
    let cascade_router = routes::cascade_routes(market_manager, nostr_publisher);

    // Build the complete app with CORS and tracing
    let app = Router::new()
        // Mount Cascade routes under /v1/cascade/
        .nest("/v1/cascade", cascade_router)
        .layer(CorsLayer::permissive()) // CORS for frontend
        .layer(TraceLayer::new_for_http()); // Request logging

    Ok(app)
}

/// Mint configuration.
#[derive(Debug, Clone)]
pub struct MintConfig {
    /// Mint name for /v1/info endpoint
    pub name: String,
    /// Mint description
    pub description: String,
    /// CORS allowed origins (empty for permissive)
    pub cors_origins: Vec<String>,
    /// Server port
    pub port: u16,
}

impl Default for MintConfig {
    fn default() -> Self {
        Self {
            name: "Cascade Mint".to_string(),
            description: "Cascade prediction market mint".to_string(),
            cors_origins: vec![],
            port: 3338,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mint_config_default() {
        let config = MintConfig::default();
        assert_eq!(config.name, "Cascade Mint");
        assert_eq!(config.port, 3338);
    }
}
