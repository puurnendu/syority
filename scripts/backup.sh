#!/bin/bash
# =============================================================================
# Aurianoa OS / Syority — backup (PostgreSQL + uploads)
#
# Run from the application root (where docker-compose*.yml and .env live).
#
#   ./scripts/backup.sh
#   BACKUP_DIR=/var/backups/syority ./scripts/backup.sh
#
# Does NOT upload to cloud. Local filesystem only.
# =============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BACKUP_DIR="${BACKUP_DIR:-${ROOT_DIR}/backups}"
COMPOSE_FILES="${COMPOSE_FILES:--f docker-compose.yml -f docker-compose.prod.yml}"
PG_USER="${PG_USER:-user}"
PG_DB="${PG_DB:-syority}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

TIMESTAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
RUN_DIR="${BACKUP_DIR}/${TIMESTAMP}"
LOG_TS() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
log()  { echo "[$(LOG_TS)] $*"; }
fail() { echo "[$(LOG_TS)] ERROR: $*" >&2; exit 1; }

if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  fail "Docker Compose not found."
fi

mkdir -p "$RUN_DIR"
log "Backup starting → $RUN_DIR"

# -----------------------------------------------------------------------------
# 1. PostgreSQL dump (custom format for pg_restore, plus gzip sql for portability)
# -----------------------------------------------------------------------------
log "Dumping PostgreSQL (${PG_DB})..."
if ! $COMPOSE $COMPOSE_FILES ps --status running --services 2>/dev/null | grep -qx 'db'; then
  # Older compose may not support --status; fall back to pg_isready probe
  if ! $COMPOSE $COMPOSE_FILES exec -T db pg_isready -U "$PG_USER" -d "$PG_DB" >/dev/null 2>&1; then
    fail "Database container is not ready. Start the stack first."
  fi
fi

SQL_GZ="${RUN_DIR}/postgres_${PG_DB}.sql.gz"
CUSTOM_DUMP="${RUN_DIR}/postgres_${PG_DB}.dump"

$COMPOSE $COMPOSE_FILES exec -T db \
  pg_dump -U "$PG_USER" -d "$PG_DB" --no-owner --no-acl \
  | gzip -c > "$SQL_GZ"

$COMPOSE $COMPOSE_FILES exec -T db \
  pg_dump -U "$PG_USER" -d "$PG_DB" -Fc --no-owner --no-acl \
  > "$CUSTOM_DUMP"

log "    wrote $(basename "$SQL_GZ") ($(wc -c < "$SQL_GZ" | tr -d ' ') bytes)"
log "    wrote $(basename "$CUSTOM_DUMP") ($(wc -c < "$CUSTOM_DUMP" | tr -d ' ') bytes)"

# -----------------------------------------------------------------------------
# 2. Uploads archive (from app container volume /app/uploads)
# -----------------------------------------------------------------------------
log "Archiving uploads..."
UPLOADS_TAR="${RUN_DIR}/uploads.tar.gz"
APP_CID="$($COMPOSE $COMPOSE_FILES ps -q app 2>/dev/null || true)"
if [ -n "$APP_CID" ]; then
  # Stream tar from inside the app container (owns /app/uploads volume)
  docker exec "$APP_CID" sh -c 'if [ -d /app/uploads ]; then tar -C /app -czf - uploads; else tar -czf - --files-from /dev/null; fi' \
    > "$UPLOADS_TAR"
else
  log "    WARNING: app container not running — trying host ./uploads if present"
  if [ -d "$ROOT_DIR/uploads" ]; then
    tar -C "$ROOT_DIR" -czf "$UPLOADS_TAR" uploads
  else
    # Empty archive so restore always has a file
    tar -czf "$UPLOADS_TAR" --files-from /dev/null
    log "    WARNING: no uploads found; wrote empty archive"
  fi
fi
log "    wrote $(basename "$UPLOADS_TAR") ($(wc -c < "$UPLOADS_TAR" | tr -d ' ') bytes)"

# -----------------------------------------------------------------------------
# 3. Checksums + manifest
# -----------------------------------------------------------------------------
log "Writing checksums..."
MANIFEST="${RUN_DIR}/MANIFEST.txt"
{
  echo "timestamp=${TIMESTAMP}"
  echo "host=$(hostname 2>/dev/null || echo unknown)"
  echo "pg_user=${PG_USER}"
  echo "pg_db=${PG_DB}"
  echo "compose_files=${COMPOSE_FILES}"
} > "$MANIFEST"

(
  cd "$RUN_DIR"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum postgres_*.sql.gz postgres_*.dump uploads.tar.gz > SHA256SUMS
  else
    shasum -a 256 postgres_*.sql.gz postgres_*.dump uploads.tar.gz > SHA256SUMS
  fi
)
log "    SHA256SUMS written"

# -----------------------------------------------------------------------------
# 4. Retention
# -----------------------------------------------------------------------------
if [ "${RETENTION_DAYS}" -gt 0 ] 2>/dev/null; then
  log "Applying retention (${RETENTION_DAYS} days) under ${BACKUP_DIR}..."
  find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -mtime "+${RETENTION_DAYS}" -exec rm -rf {} + 2>/dev/null || true
fi

log "Backup complete: $RUN_DIR"
ls -la "$RUN_DIR"
