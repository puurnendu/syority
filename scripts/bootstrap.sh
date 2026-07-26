#!/bin/bash
# =============================================================================
# Aurianoa OS / Syority — VPS bootstrap (server prerequisites only)
#
# Run ON THE VPS as root (or via sudo). Does NOT deploy the application.
#
#   sudo bash scripts/bootstrap.sh
#   sudo APP_DIR=/var/www/aurianoa bash scripts/bootstrap.sh
#
# Idempotent: safe to re-run.
# =============================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/syority}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/syority}"
DEPLOY_USER="${SUDO_USER:-${DEPLOY_USER:-$(whoami)}}"
LOG_TS() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
log()  { echo "[$(LOG_TS)] $*"; }
fail() { echo "[$(LOG_TS)] ERROR: $*" >&2; exit 1; }

if [ "$(id -u)" -ne 0 ]; then
  fail "Run as root (sudo bash scripts/bootstrap.sh)."
fi

log "==> Bootstrap starting (APP_DIR=$APP_DIR, user=$DEPLOY_USER)"

# -----------------------------------------------------------------------------
# 1. Base packages
# -----------------------------------------------------------------------------
log "==> 1/7 Installing base packages (curl, ca-certificates, git, ufw, openssl)..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  git \
  ufw \
  openssl \
  gzip \
  tar \
  coreutils \
  >/dev/null

command -v git >/dev/null || fail "git install failed"
log "    git: $(git --version)"

# -----------------------------------------------------------------------------
# 2. Docker Engine
# -----------------------------------------------------------------------------
log "==> 2/7 Installing Docker Engine (if missing)..."
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
else
  log "    Docker already installed: $(docker --version)"
fi
command -v docker >/dev/null || fail "docker not available after install"
systemctl enable --now docker >/dev/null 2>&1 || true

# -----------------------------------------------------------------------------
# 3. Docker Compose plugin (v2)
# -----------------------------------------------------------------------------
log "==> 3/7 Ensuring Docker Compose V2 plugin..."
if ! docker compose version >/dev/null 2>&1; then
  apt-get install -y -qq docker-compose-plugin >/dev/null
fi
docker compose version >/dev/null || fail "docker compose plugin missing"
COMPOSE_VER="$(docker compose version --short 2>/dev/null || docker compose version | head -1)"
log "    compose: $COMPOSE_VER"
# Warn if older than 2.24 (needed for ports: !reset in docker-compose.prod.yml)
MAJOR_MINOR="$(echo "$COMPOSE_VER" | grep -oE '[0-9]+\.[0-9]+' | head -1 || true)"
if [ -n "$MAJOR_MINOR" ]; then
  MAJOR="${MAJOR_MINOR%%.*}"
  MINOR="${MAJOR_MINOR##*.}"
  if [ "$MAJOR" -lt 2 ] || { [ "$MAJOR" -eq 2 ] && [ "$MINOR" -lt 24 ]; }; then
    log "    WARNING: Compose $COMPOSE_VER detected; v2.24+ recommended for ports: !reset"
  fi
fi

# Allow deploy user to run docker without sudo (requires re-login)
if id "$DEPLOY_USER" >/dev/null 2>&1; then
  usermod -aG docker "$DEPLOY_USER" || true
  log "    Added $DEPLOY_USER to docker group (re-login required for non-sudo docker)"
fi

# -----------------------------------------------------------------------------
# 4. Firewall
# -----------------------------------------------------------------------------
log "==> 4/7 Configuring UFW (22/80/443)..."
ufw allow OpenSSH >/dev/null || ufw allow 22/tcp >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
# Do NOT open 3000/5432/6379 publicly — app/db/redis stay on Docker network / loopback
ufw --force enable >/dev/null
log "    ufw status:"
ufw status numbered | head -20 || true

# -----------------------------------------------------------------------------
# 5. Directories
# -----------------------------------------------------------------------------
log "==> 5/7 Creating application and backup directories..."
mkdir -p "$APP_DIR"
mkdir -p "$BACKUP_DIR"
mkdir -p "$APP_DIR/certbot/conf" "$APP_DIR/certbot/www"
mkdir -p "$APP_DIR/uploads"
chown -R "$DEPLOY_USER":"$DEPLOY_USER" "$APP_DIR" "$BACKUP_DIR" 2>/dev/null || true
chmod 750 "$BACKUP_DIR" || true
log "    APP_DIR=$APP_DIR"
log "    BACKUP_DIR=$BACKUP_DIR"

# -----------------------------------------------------------------------------
# 6. Prerequisite verification
# -----------------------------------------------------------------------------
log "==> 6/7 Verifying prerequisites..."
MISSING=0
for CMD in docker git curl openssl gzip tar; do
  if command -v "$CMD" >/dev/null 2>&1; then
    log "    OK  $CMD"
  else
    log "    MISSING  $CMD"
    MISSING=1
  fi
done
if docker compose version >/dev/null 2>&1; then
  log "    OK  docker compose"
else
  log "    MISSING  docker compose"
  MISSING=1
fi
if [ "$MISSING" -ne 0 ]; then
  fail "One or more prerequisites are missing."
fi

# Port check (informational)
log "    Checking host ports 80/443..."
if command -v ss >/dev/null 2>&1; then
  ss -tulpn | grep -E ':80 |:443 ' || log "    (nothing listening on 80/443 — good for first deploy)"
fi

# -----------------------------------------------------------------------------
# 7. Next steps (no deploy)
# -----------------------------------------------------------------------------
log "==> 7/7 Bootstrap complete — application NOT deployed."
cat <<EOF

Next steps (manual):
  1. Place application code in:  $APP_DIR
  2. Create .env from .env.example (never commit .env)
  3. Point DNS A record at this VPS before TLS
  4. Run SSL bootstrap:  ./scripts/init-letsencrypt.sh <email>
  5. Run deploy:         ./scripts/deploy.sh
  6. Configure backups:  BACKUP_DIR=$BACKUP_DIR ./scripts/backup.sh

EOF
