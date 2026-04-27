#!/usr/bin/env bash
# First-time TLS certificate bootstrap.
#
# Run this ONCE before starting the full stack:
#   chmod +x deploy/init-letsencrypt.sh
#   ./deploy/init-letsencrypt.sh your-domain.com admin@your-domain.com
#
# What it does:
#   1. Stops any running compose services
#   2. Uses certbot standalone (temporarily binds port 80) to issue the cert
#   3. Starts the full stack — nginx finds the real cert and starts cleanly
set -euo pipefail

DOMAIN="${1:?Usage: $0 <domain> <email>}"
EMAIL="${2:?Usage: $0 <domain> <email>}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Stopping any running services..."
cd "$ROOT_DIR"
docker compose down 2>/dev/null || true

echo "==> Creating data directories..."
mkdir -p "$ROOT_DIR/data/letsencrypt"
mkdir -p "$ROOT_DIR/data/certbot_webroot"

echo "==> Requesting certificate for $DOMAIN (certbot standalone)..."
docker run --rm \
  -v "$ROOT_DIR/data/letsencrypt:/etc/letsencrypt" \
  -v "$ROOT_DIR/data/certbot_webroot:/var/www/certbot" \
  -p 80:80 \
  certbot/certbot:latest certonly \
    --standalone \
    --preferred-challenges http \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN"

echo "==> Starting all services..."
docker compose up -d --build

echo ""
echo "✓ Certificate issued for $DOMAIN"
echo "  Stack is up. Certbot will auto-renew every 12 hours."
echo ""
echo "  Don't forget: replace 'your-domain.com' in deploy/nginx.conf with '$DOMAIN'"
