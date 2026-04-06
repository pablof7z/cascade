//! Cascade API — HTTP endpoints for the Cashu mint

pub mod handlers;
pub mod routes;
pub mod types;

use axum::Router;
use std::sync::Arc;
use cascade_core::MarketManager;

/// Build the complete HTTP server combining CDK routes + Cascade custom routes
pub fn build_server(market_manager: Arc<MarketManager>) -> Router {
    // Combine CDK NUT routes (from cdk-axum) with custom Cascade routes
    // In production, this integrates: create_mint_router() from CDK
    // For now, we build our custom routes only
    
    routes::build_cascade_routes(market_manager)
}
