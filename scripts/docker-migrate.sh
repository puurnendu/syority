#!/bin/sh
set -eu

# Aurianoa OS — Docker Migrator Entrypoint
#
# Usage:
#   docker compose run --rm migrator              # default: migrate
#   docker compose run --rm migrator migrate      # run migrations only
#   docker compose run --rm migrator seed         # run all seeds
#   docker compose run --rm migrator bootstrap    # full bootstrap (migrate + seed + verify)

COMMAND="${1:-migrate}"

case "$COMMAND" in
  migrate)
    echo "[migrator] Running migrations..."
    exec node ./scripts/docker-migrate.mjs
    ;;
  seed)
    echo "[migrator] Running seeds..."
    npx tsx prisma/seed.ts
    npx tsx prisma/seed-superadmin.ts
    npx tsx prisma/seed-platform-admin.ts
    npx tsx prisma/seed-syority.ts
    echo "[migrator] Seed complete."
    ;;
  bootstrap)
    echo "[migrator] Running full bootstrap..."
    # Step 1: Migrate
    node ./scripts/docker-migrate.mjs
    # Step 2: Seed
    npx tsx prisma/seed.ts
    npx tsx prisma/seed-superadmin.ts
    npx tsx prisma/seed-platform-admin.ts
    npx tsx prisma/seed-syority.ts
    echo "[migrator] Bootstrap complete."
    ;;
  *)
    echo "[migrator] Unknown command: $COMMAND"
    echo "  Usage: migrate | seed | bootstrap"
    exit 1
    ;;
esac
