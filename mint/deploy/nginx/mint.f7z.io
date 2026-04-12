# Nginx configuration for mint.f7z.io
# Place in /etc/nginx/sites-available/mint.f7z.io
# Enable with: sudo ln -s /etc/nginx/sites-available/mint.f7z.io /etc/nginx/sites-enabled/

server {
    listen 443 ssl http2;
    server_name mint.f7z.io;

    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/mint.f7z.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mint.f7z.io/privkey.pem;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;

    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # HSTS (uncomment if ready for production)
    # add_header Strict-Transport-Security "max-age=63072000" always;

    # Security headers
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer" always;

    # Logging
    access_log /var/log/nginx/mint.f7z.io_access.log;
    error_log /var/log/nginx/mint.f7z.io_error.log;

    location / {
        # Proxy to Cascade Mint
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;

        # Standard headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;

        # WebSocket support (for NUT-17 if enabled)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Timeouts for long-polling mint quotes
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        proxy_connect_timeout 15s;

        # Buffering
        proxy_buffering off;
        proxy_request_buffering off;
    }

    # Health check endpoint (no rate limiting)
    location /health {
        proxy_pass http://127.0.0.1:8080/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;

        # Shorter timeouts for health checks
        proxy_read_timeout 10s;
        proxy_connect_timeout 5s;
    }

    # Rate limiting zone
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=30r/s;

    location ~ ^/(v1/.+) {
        limit_req zone=api_limit burst=50 nodelay;

        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Longer timeouts for mint operations
        proxy_read_timeout 300s;
        proxy_connect_timeout 15s;
    }
}

# HTTP → HTTPS redirect
server {
    listen 80;
    server_name mint.f7z.io;
    return 301 https://$host$request_uri;
}
