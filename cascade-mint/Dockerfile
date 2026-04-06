# =============================================================================
# Stage 1: Build
# =============================================================================
FROM rust:1.75-bookworm AS builder

# Install build dependencies for SQLite and OpenSSL
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Copy workspace files
COPY Cargo.toml Cargo.lock ./
COPY crates ./crates

# Build dependencies first (cached layer)
RUN mkdir -p crates/cascade-mint && \
    echo 'fn main() {}' > crates/cascade-mint/src/main.rs && \
    cargo build --release && \
    rm -rf crates/cascade-mint/src

# Copy actual source and build
COPY . .

# Build the binary with optimizations
RUN cargo build --release --bin cascade-mint

# =============================================================================
# Stage 2: Runtime
# =============================================================================
FROM debian:bookworm-slim AS runtime

# Install runtime dependencies for SQLite
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsqlite3-0 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create non-root user for security
RUN groupadd --gid 1000 mint && \
    useradd --uid 1000 --gid mint --shell /bin/false --create-home mint

WORKDIR /app

# Copy binary from builder
COPY --from=builder /build/target/release/cascade-mint /app/

# Create data directory
RUN mkdir -p /data && chown -R mint:mint /app /data

USER mint

# Expose port (Axum server default)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

ENTRYPOINT ["/app/cascade-mint"]
