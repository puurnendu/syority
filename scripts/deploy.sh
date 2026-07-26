#!/bin/bash
# =============================================================================
# Aurianoa OS / Syority — production deploy
#
# Run from the application root (compose files + .env present).
#
#   ./scripts/deploy.sh
#   SEED=1 ./scripts/deploy.sh          # optional platform seed after migrate
#   COMPOSE_FILES="-f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.http.yml" ./scripts/deploy.sh
#
# Migration policy:
#   - If the database already has application schema / migration history →
#     run `prisma migrate deploy`.
#   - If the database is empty (fresh volume) → ABORT with instructions.
#     Do NOT auto-migrate a greenfield DB until the migration strategy is fixed.
# =============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMPOSE_FILES="${COMPOSE_FILES:--f docker-compose.yml -f docker-compose.prod.yml}"
PG_USER="${PG_USER:-user}"
PG_DB="${PG_DB:-syority}"
MAX_DB_RETRIES="${MAX_DB_RETRIES:-30}"
MAX_HEALTH_RETRIES="${MAX_HEALTH_RETRIES:-12}"

LOG_TS() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
log()  { echo "[$(LOG_TS)] $*"; }
fail() { echo "[$(LOG_TS)] ERROR: $*" >&2; exit 1; }

log "Deploy starting (cwd=$ROOT_DIR)"

# -----------------------------------------------------------------------------
# Resolve Compose
# -----------------------------------------------------------------------------
if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  fail "Docker Compose not found. Run scripts/bootstrap.sh on the VPS first."
fi
log "Using: $COMPOSE $($COMPOSE version --short 2>/dev/null || true)"
log "Compose files: $COMPOSE_FILES"

# -----------------------------------------------------------------------------
# Environment validation
# -----------------------------------------------------------------------------
log "Validating environment..."
if [ ! -f .env ]; then
  fail ".env not found in $ROOT_DIR — copy .env.example and fill production values."
fi

REQUIRED_VARS=(DATABASE_URL NEXTAUTH_SECRET NEXTAUTH_URL ENCRYPTION_KEY DOMAIN REDIS_URL)
MISSING_VARS=()
for VAR in "${REQUIRED_VARS[@]}"; do
  if ! grep -qE "^${VAR}=" .env && [ -z "${!VAR:-}" ]; then
    MISSING_VARS+=("$VAR")
  fi
done
if [ "${#MISSING_VARS[@]}" -gt 0 ]; then
  fail "Missing required variables in .env: ${MISSING_VARS[*]}"
fi

# Soft checks / warnings
if grep -qE '^NEXTAUTH_SECRET=["'\'']?(generate-a-secure|change-me|your-)' .env 2>/dev/null; then
  log "WARNING: NEXTAUTH_SECRET looks like a placeholder"
fi
if grep -qE '^ENCRYPTION_KEY=["'\'']?(your-32-char|change-me)' .env 2>/dev/null; then
  log "WARNING: ENCRYPTION_KEY looks like a placeholder"
fi
log "Environment OK"

# -----------------------------------------------------------------------------
# Build & start
# -----------------------------------------------------------------------------
log "Building and starting containers..."
$COMPOSE $COMPOSE_FILES up -d --build --remove-orphans
log "Containers requested; waiting for database..."

# -----------------------------------------------------------------------------
# Wait for Postgres
# -----------------------------------------------------------------------------
RETRY=0
until $COMPOSE $COMPOSE_FILES exec -T db pg_isready -U "$PG_USER" -d "$PG_DB" >/dev/null 2>&1; do
  RETRY=$((RETRY + 1))
  if [ "$RETRY" -ge "$MAX_DB_RETRIES" ]; then
    log "--- db logs (tail) ---"
    $COMPOSE $COMPOSE_FILES logs db --tail 80 || true
    fail "Database did not become ready within ${MAX_DB_RETRIES} attempts"
  fi
  log "  db not ready ($RETRY/$MAX_DB_RETRIES)..."
  sleep 2
done
log "Database is ready"

# -----------------------------------------------------------------------------
# Migrations — automatic via migrator service (see scripts/docker-migrate.sh)
# -----------------------------------------------------------------------------
# Compose already runs `migrator` before `app` (service_completed_successfully).
# Re-run here so deploy.sh is safe even if only db/app were restarted.
log "Running prisma migrator (greenfield baseline or migrate deploy)..."
if ! $COMPOSE $COMPOSE_FILES run --rm migrator; then
  log "--- migrator / db logs ---"
  $COMPOSE $COMPOSE_FILES logs migrator --tail 80 || true
  $COMPOSE $COMPOSE_FILES logs db --tail 50 || true
  fail "Database migration failed — aborting deploy"
fi
log "Migrations applied"

# Optional seed (platform admin) — only when explicitly requested
if [ "${SEED:-0}" = "1" ]; then
  log "SEED=1 — running prisma/seed.ts via seeder service..."
  if ! $COMPOSE $COMPOSE_FILES --profile tools run --rm seeder; then
    # Fallback: builder-stage one-off if seeder service not in compose files
    $COMPOSE $COMPOSE_FILES run --rm --build \
      --entrypoint "npx tsx prisma/seed.ts" \
      migrator \
      || fail "Seed failed"
  fi
  log "Seed complete"
fi

# -----------------------------------------------------------------------------
# Health checks
# -----------------------------------------------------------------------------
log "Waiting for application health (/api/health inside app container)..."
HEALTH_RETRY=0
until $COMPOSE $COMPOSE_FILES exec -T app wget -q -O /dev/null http://localhost:3000/api/health 2>/dev/null; do
  HEALTH_RETRY=$((HEALTH_RETRY + 1))
  if [ "$HEALTH_RETRY" -ge "$MAX_HEALTH_RETRIES" ]; then
    log "--- app logs (tail) ---"
    $COMPOSE $COMPOSE_FILES logs app --tail 100 || true
    fail "Application health check failed after ${MAX_HEALTH_RETRIES} attempts"
  fi
  log "  app not healthy ($HEALTH_RETRY/$MAX_HEALTH_RETRIES)..."
  sleep 5
done
log "Application health OK"

if $COMPOSE $COMPOSE_FILES ps --services 2>/dev/null | grep -qx 'nginx'; then
  log "Validating nginx configuration..."
  $COMPOSE $COMPOSE_FILES exec -T nginx nginx -t \
    || fail "nginx -t failed"
  log "nginx configuration OK"
fi

# Redis ping (non-fatal warning)
if $COMPOSE $COMPOSE_FILES exec -T redis redis-cli ping 2>/dev/null | grep -q PONG; then
  log "Redis PONG OK"
else
  log "WARNING: Redis ping failed — background workers may not process jobs"
fi

# -----------------------------------------------------------------------------
# Cleanup
# -----------------------------------------------------------------------------
log "Pruning dangling images..."
docker image prune -f >/dev/null || true

log "Deploy successful"
$COMPOSE $COMPOSE_FILES ps || true
