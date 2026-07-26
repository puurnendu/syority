#!/bin/bash
# =============================================================================
# Aurianoa OS / Syority — restore from a backup directory produced by backup.sh
#
#   ./scripts/restore.sh /var/backups/syority/20260716T120000Z
#
# Behaviour:
#   - Creates a pre-restore safety snapshot (DB + uploads) for rollback
#   - Restores PostgreSQL (prefers custom .dump; falls back to .sql.gz)
#   - Restores uploads into the app container volume
#   - Verifies checksums when SHA256SUMS is present
#   - On failure, attempts rollback from the safety snapshot
#
# Idempotent-ish: safe to re-run with the same backup dir after fixing errors.
# =============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BACKUP_SRC="${1:-}"
COMPOSE_FILES="${COMPOSE_FILES:--f docker-compose.yml -f docker-compose.prod.yml}"
PG_USER="${PG_USER:-user}"
PG_DB="${PG_DB:-syority}"
SAFETY_ROOT="${SAFETY_ROOT:-${ROOT_DIR}/backups/_pre_restore}"

LOG_TS() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
log()  { echo "[$(LOG_TS)] $*"; }
fail() { echo "[$(LOG_TS)] ERROR: $*" >&2; exit 1; }

if [ -z "$BACKUP_SRC" ]; then
  fail "Usage: $0 <backup-directory-from-backup.sh>"
fi
if [ ! -d "$BACKUP_SRC" ]; then
  fail "Backup directory not found: $BACKUP_SRC"
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  fail "Docker Compose not found."
fi

SQL_GZ="$(ls -1 "$BACKUP_SRC"/postgres_*.sql.gz 2>/dev/null | head -1 || true)"
CUSTOM_DUMP="$(ls -1 "$BACKUP_SRC"/postgres_*.dump 2>/dev/null | head -1 || true)"
UPLOADS_TAR="$(ls -1 "$BACKUP_SRC"/uploads.tar.gz 2>/dev/null | head -1 || true)"

[ -n "$UPLOADS_TAR" ] || fail "uploads.tar.gz missing in $BACKUP_SRC"
if [ -z "$CUSTOM_DUMP" ] && [ -z "$SQL_GZ" ]; then
  fail "No postgres_*.dump or postgres_*.sql.gz in $BACKUP_SRC"
fi

# -----------------------------------------------------------------------------
# Verify checksums (if present)
# -----------------------------------------------------------------------------
verify_checksums() {
  if [ -f "$BACKUP_SRC/SHA256SUMS" ]; then
    log "Verifying SHA256SUMS..."
    (
      cd "$BACKUP_SRC"
      if command -v sha256sum >/dev/null 2>&1; then
        sha256sum -c SHA256SUMS
      else
        shasum -a 256 -c SHA256SUMS
      fi
    )
    log "Checksums OK"
  else
    log "WARNING: SHA256SUMS not found — skipping integrity check"
  fi
}

# -----------------------------------------------------------------------------
# Pre-restore safety snapshot (for rollback)
# -----------------------------------------------------------------------------
SAFETY_DIR=""
create_safety_snapshot() {
  local ts
  ts="$(date -u +"%Y%m%dT%H%M%SZ")"
  SAFETY_DIR="${SAFETY_ROOT}/${ts}"
  mkdir -p "$SAFETY_DIR"
  log "Creating pre-restore safety snapshot → $SAFETY_DIR"

  if $COMPOSE $COMPOSE_FILES exec -T db pg_isready -U "$PG_USER" -d "$PG_DB" >/dev/null 2>&1; then
    $COMPOSE $COMPOSE_FILES exec -T db \
      pg_dump -U "$PG_USER" -d "$PG_DB" -Fc --no-owner --no-acl \
      > "${SAFETY_DIR}/postgres_pre.dump" || log "WARNING: pre-restore DB dump failed"
  else
    log "WARNING: db not ready — skipping pre-restore DB dump"
  fi

  local app_cid
  app_cid="$($COMPOSE $COMPOSE_FILES ps -q app 2>/dev/null || true)"
  if [ -n "$app_cid" ]; then
    docker exec "$app_cid" sh -c 'if [ -d /app/uploads ]; then tar -C /app -czf - uploads; else tar -czf - --files-from /dev/null; fi' \
      > "${SAFETY_DIR}/uploads_pre.tar.gz" || log "WARNING: pre-restore uploads archive failed"
  fi
}

rollback_from_safety() {
  if [ -z "${SAFETY_DIR:-}" ] || [ ! -d "$SAFETY_DIR" ]; then
    log "No safety snapshot available for rollback"
    return 1
  fi
  log "ROLLBACK: restoring pre-restore safety snapshot from $SAFETY_DIR"
  if [ -f "${SAFETY_DIR}/postgres_pre.dump" ]; then
    restore_db_dump "${SAFETY_DIR}/postgres_pre.dump" || true
  fi
  if [ -f "${SAFETY_DIR}/uploads_pre.tar.gz" ]; then
    restore_uploads_tar "${SAFETY_DIR}/uploads_pre.tar.gz" || true
  fi
  log "ROLLBACK attempt finished — verify data manually"
}

# -----------------------------------------------------------------------------
# Restore helpers
# -----------------------------------------------------------------------------
restore_db_dump() {
  local dump_file="$1"
  log "Restoring PostgreSQL from $(basename "$dump_file")..."

  # Terminate other sessions, then recreate public schema content via pg_restore
  $COMPOSE $COMPOSE_FILES exec -T db \
    psql -U "$PG_USER" -d postgres -v ON_ERROR_STOP=1 <<SQL
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '${PG_DB}' AND pid <> pg_backend_pid();
SQL

  # Drop & recreate database for a clean restore (contained to this DB name only)
  $COMPOSE $COMPOSE_FILES exec -T db \
    psql -U "$PG_USER" -d postgres -v ON_ERROR_STOP=1 <<SQL
DROP DATABASE IF EXISTS ${PG_DB};
CREATE DATABASE ${PG_DB} OWNER ${PG_USER};
SQL

  if [[ "$dump_file" == *.dump ]]; then
    cat "$dump_file" | $COMPOSE $COMPOSE_FILES exec -T db \
      pg_restore -U "$PG_USER" -d "$PG_DB" --no-owner --role="$PG_USER" -v
  else
    # sql.gz
    gzip -dc "$dump_file" | $COMPOSE $COMPOSE_FILES exec -T db \
      psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1
  fi
  log "PostgreSQL restore finished"
}

restore_uploads_tar() {
  local tar_file="$1"
  log "Restoring uploads from $(basename "$tar_file")..."
  local app_cid
  app_cid="$($COMPOSE $COMPOSE_FILES ps -q app 2>/dev/null || true)"
  if [ -z "$app_cid" ]; then
    fail "app container not running — start stack before restoring uploads"
  fi

  # Replace /app/uploads contents
  docker exec -u root "$app_cid" sh -c 'rm -rf /app/uploads/* /app/uploads/.[!.]* 2>/dev/null || true; mkdir -p /app/uploads'
  cat "$tar_file" | docker exec -i -u root "$app_cid" tar -C /app -xzf -
  docker exec -u root "$app_cid" chown -R 1001:1001 /app/uploads || true
  log "Uploads restore finished"
}

validate_restore() {
  log "Validating restore..."
  $COMPOSE $COMPOSE_FILES exec -T db \
    pg_isready -U "$PG_USER" -d "$PG_DB" >/dev/null

  local table_count
  table_count="$($COMPOSE $COMPOSE_FILES exec -T db \
    psql -U "$PG_USER" -d "$PG_DB" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" \
    | tr -d '[:space:]')"
  log "    public tables: ${table_count:-0}"
  if [ "${table_count:-0}" -lt 1 ]; then
    fail "Validation failed: no tables in public schema after restore"
  fi

  local app_cid
  app_cid="$($COMPOSE $COMPOSE_FILES ps -q app 2>/dev/null || true)"
  if [ -n "$app_cid" ]; then
    docker exec "$app_cid" sh -c 'test -d /app/uploads' || fail "uploads directory missing after restore"
  fi
  log "Validation OK"
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
verify_checksums
create_safety_snapshot

trap 'log "Restore failed — attempting rollback..."; rollback_from_safety; exit 1' ERR

if [ -n "$CUSTOM_DUMP" ]; then
  restore_db_dump "$CUSTOM_DUMP"
else
  restore_db_dump "$SQL_GZ"
fi

restore_uploads_tar "$UPLOADS_TAR"
validate_restore

trap - ERR
log "Restore complete from $BACKUP_SRC"
log "Pre-restore safety snapshot kept at: $SAFETY_DIR"
