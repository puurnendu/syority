#!/bin/bash
# ============================================================================
# One-time Let's Encrypt bootstrap for a fresh VPS.
#
# Solves the chicken-and-egg problem: nginx won't start without certificates,
# and certbot (webroot mode) can't issue certificates unless nginx is serving
# /.well-known/acme-challenge/ on port 80.
#
# Strategy: create a temporary self-signed certificate so nginx starts,
# then request the real certificate via certbot and reload nginx.
#
# Usage (from the repo root on the VPS, after .env is populated with DOMAIN):
#   chmod +x scripts/init-letsencrypt.sh
#   ./scripts/init-letsencrypt.sh admin@yourdomain.com
# ============================================================================
set -e

EMAIL="${1:?Usage: ./scripts/init-letsencrypt.sh <email> [--staging]}"
STAGING_ARG=""
[ "$2" = "--staging" ] && STAGING_ARG="--staging"

# Load DOMAIN from .env
if [ -f .env ]; then
  DOMAIN=$(grep -E '^DOMAIN=' .env | cut -d= -f2- | tr -d '"' | tr -d "'")
fi
if [ -z "$DOMAIN" ]; then
  echo "❌ DOMAIN not set in .env"
  exit 1
fi

if docker compose version > /dev/null 2>&1; then
  COMPOSE="docker compose"
else
  COMPOSE="docker-compose"
fi
COMPOSE="$COMPOSE -f docker-compose.yml -f docker-compose.prod.yml"

CERT_PATH="./certbot/conf/live/$DOMAIN"

echo "### Domain: $DOMAIN"

if [ -d "$CERT_PATH" ] && [ -f "$CERT_PATH/fullchain.pem" ]; then
  echo "### Certificate already exists at $CERT_PATH — nothing to bootstrap."
  exit 0
fi

echo "### 1/4 Creating temporary self-signed certificate so nginx can start..."
mkdir -p "$CERT_PATH" ./certbot/www
docker run --rm -v "$(pwd)/certbot/conf:/etc/letsencrypt" alpine/openssl req \
  -x509 -nodes -newkey rsa:2048 -days 1 \
  -keyout "/etc/letsencrypt/live/$DOMAIN/privkey.pem" \
  -out "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" \
  -subj "/CN=$DOMAIN"

echo "### 2/4 Starting nginx..."
$COMPOSE up -d nginx
sleep 5

echo "### 3/4 Removing dummy certificate and requesting the real one..."
rm -rf "$CERT_PATH"
$COMPOSE run --rm --entrypoint "certbot certonly --webroot -w /var/www/certbot \
  --email $EMAIL -d $DOMAIN --agree-tos --no-eff-email --non-interactive $STAGING_ARG" certbot

echo "### 4/4 Reloading nginx with the real certificate..."
$COMPOSE exec nginx nginx -s reload

echo "✅ SSL bootstrap complete for $DOMAIN. The certbot sidecar renews automatically."
