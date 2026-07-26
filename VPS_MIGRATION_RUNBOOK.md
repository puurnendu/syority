# Syority VPS Migration Runbook

**Date:** July 3, 2026
**Status:** All deployment blockers from the July 3 audits are fixed in this repo. Follow the steps below in order.

---

## What was fixed in this codebase (already done — no action needed)

| # | Issue (from audit) | Fix |
|---|---|---|
| 1 | No Redis container (BullMQ crash) | `redis` service added to `docker-compose.yml` with healthcheck + persistent volume; `REDIS_URL=redis://redis:6379` injected into `app` |
| 2 | Nginx `templates/` mount pointed at nothing; raw `${DOMAIN}` in `conf.d` broke nginx | Config moved to `nginx/templates/default.conf.template`; nginx's entrypoint now substitutes `${DOMAIN}` at boot. Staging compose updated to match |
| 3 | SSL chicken-and-egg (nginx won't start without certs, certbot needs nginx) | New `scripts/init-letsencrypt.sh` bootstraps with a temporary self-signed cert, then obtains the real one |
| 4 | `deploy.sh` used legacy `docker-compose`; health check hit an unpublished port | Rewritten: auto-detects Compose V2, uses `-f` flags consistently, health-checks inside the container |
| 5 | `ports: []` in prod override didn't actually unpublish port 3000 | Replaced with `ports: !reset []` (requires Compose v2.24+) |
| 6 | Postgres port 5432 exposed publicly | Bound to `127.0.0.1` only (Redis likewise) |
| 7 | **Security:** uploads stored in `public/` — served without auth | Uploads now go to `uploads/doc-library/` (private); files served only via authenticated, org-scoped `/api/documents/[id]/download` |
| 8 | **Security:** download route had no tenant check (IDOR) | Org-scope check added (404 for cross-tenant IDs); delete route too |
| 9 | Proxy Mode queried the admin's own org instead of the tenant | `guardApi`/`withTenantGuard` now honor the `syority_proxy` cookie (platform-admin roles only) — covers all 140 `orgScope` call sites |
| 10 | N+1 cascade: ~12 queries × N systems per dashboard load | New batch `computePlanningProgressForSystems()` (~9 bulk queries total); applied to portfolio-stats, system-progress, units, unit systems and unit schedule routes |
| 11 | Hardcoded WhatsApp webhook token | Reads `WHATSAPP_VERIFY_TOKEN` from env (returns 503 if unset) |
| 12 | Docker volume permission mismatch (EACCES as UID 1001) | Dockerfile now creates `/app/uploads` owned by `nextjs` so the named volume inherits correct ownership |
| 13 | BOM in `schema.prisma` | **Verified already fixed** — no BOM present |
| 14 | `documents/*` API routes used stale camelCase Prisma fields | Aligned to the current snake_case schema |

> **Still open (not deployment blockers, fix post-migration):** ~400 TypeScript errors masked by `ignoreBuildErrors: true`; 9 raw `.sql` files in `prisma/migrations/` outside Prisma tracking (migration-drift risk); WhatsApp inbound processing as a floating promise (acceptable on a long-running Docker container, not serverless).

---

## Step 0 — Prerequisites on the VPS

Ubuntu 22.04/24.04 LTS. Then:

```bash
curl -fsSL https://get.docker.com | sudo sh        # Docker Engine 24+ with Compose V2 plugin
docker compose version                              # must be v2.24+ (needed for !reset)
sudo ufw allow 22 && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable
sudo ss -tulpn | grep -E ':80|:443|:5432' || true   # nothing should be listening
# If apache2 / host nginx / host postgres occupy ports: sudo systemctl disable --now apache2 nginx postgresql
```

DNS: point an A record for your domain (e.g. `app.yourdomain.com`) at the VPS IP **before** Step 3.

## Step 1 — Clone and configure

```bash
sudo mkdir -p /var/www/syority && sudo chown $USER:$USER /var/www/syority
git clone -b main <your-repo-url> /var/www/syority && cd /var/www/syority
cp .env.example .env && nano .env
```

> The GitHub Actions workflow deploys to `/var/www/syority` — use that path, not `~/syority`.

`.env` values that MUST change from the example:

```env
DATABASE_URL="postgresql://user:pass@db:5432/syority?schema=public"   # host is `db`, not localhost
REDIS_URL="redis://redis:6379"
NEXTAUTH_URL="https://app.yourdomain.com"
NEXTAUTH_SECRET="$(openssl rand -base64 32)"
DOMAIN="app.yourdomain.com"
ENCRYPTION_KEY="<exactly 32 chars — see warning below>"
WHATSAPP_VERIFY_TOKEN="$(openssl rand -hex 16)"     # then update it in the Meta webhook config
STORAGE_PROVIDER="local"
# plus real SMTP_* and GEMINI_API_KEY / Vertex values
```

> ⚠️ **ENCRYPTION_KEY:** if tenants have already stored encrypted third-party API keys in your local DB, you MUST reuse the same key from your local `.env`. A new key makes existing encrypted data permanently unreadable. Only generate a fresh key for a fresh database.

## Step 2 — Bootstrap SSL (one time)

```bash
chmod +x scripts/*.sh
./scripts/init-letsencrypt.sh admin@yourdomain.com          # add --staging for a dry run
```

## Step 3 — Deploy the stack

```bash
./scripts/deploy.sh
```

Builds images, waits for Postgres, runs `prisma migrate deploy`, health-checks the app in-container, and validates nginx config.

## Step 4 — Migrate data from your local machine

**4a. Database** (local PowerShell / terminal):

```bash
pg_dump -U postgres -d syority -F c -b -v -f syority_local.dump
scp syority_local.dump user@VPS_IP:/tmp/
```

On the VPS:

```bash
cd /var/www/syority
docker compose -f docker-compose.yml -f docker-compose.prod.yml cp /tmp/syority_local.dump db:/tmp/
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec db pg_restore -U user -d syority --no-owner --role=user -v /tmp/syority_local.dump
```

**4b. Uploaded documents** — files previously lived in `public/doc-library/`; the new private location is the `uploads` volume:

```bash
rsync -avz ./public/doc-library/ user@VPS_IP:/tmp/doc-library/
```

On the VPS:

```bash
APP=$(docker compose -f docker-compose.yml -f docker-compose.prod.yml ps -q app)
docker cp /tmp/doc-library "$APP":/app/uploads/
docker exec -u root "$APP" chown -R 1001:1001 /app/uploads/doc-library
```

**4c. Repoint existing DB records** to the private path and authed download URL:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec db psql -U user -d syority -c "
UPDATE \"DocLibrary\"
SET storage_path = '/app/uploads' || public_url,
    public_url   = '/api/documents/' || id || '/download'
WHERE public_url LIKE '/doc-library/%';"
```

**4d. Delete the now-obsolete public copies** (they were the security hole):

```bash
docker exec "$APP" sh -c 'rm -rf /app/public/doc-library' 2>/dev/null || true
```

Also remove `public/doc-library/` from your local repo copy so future builds don't ship it.

## Step 5 — Wire up CI/CD

In GitHub → repo → Settings → Secrets and variables → Actions, set: `PROD_HOST` (VPS IP), `PROD_USER`, `PROD_SSH_KEY` (private key whose public half is in `~/.ssh/authorized_keys` on the VPS), `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `ENCRYPTION_KEY`, optionally `SLACK_WEBHOOK_URL`.

Note: the workflow runs `npm run lint` and `npx tsc --noEmit` before deploying — with ~400 pre-existing TS errors this gate will fail until they're fixed. Either fix the errors (recommended) or temporarily relax that step.

## Step 6 — Verify

```bash
curl -I https://app.yourdomain.com/api/health                      # 200
curl -I http://app.yourdomain.com                                  # 301 → https (if redirect configured)
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps # all services Up/healthy
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs app --tail 50
# Security check — must be 404/redirect, NOT the file:
curl -I "https://app.yourdomain.com/doc-library/<any-org-id>/<date>/<file>"
```

Then in the browser: log in, open the dashboard (validates Prisma client + batch queries), preview + download a migrated document, and test Proxy Mode as a platform admin (tenant data must now appear).

## Troubleshooting quick reference

| Symptom | Fix |
|---|---|
| `port is already allocated` on 80/443 | `sudo systemctl disable --now apache2 nginx` on the host |
| nginx: `cannot load certificate` | Rerun `./scripts/init-letsencrypt.sh` — cert missing for `$DOMAIN` |
| Prisma `Migration lock is already held` | `UPDATE _prisma_migrations SET rolled_back_at = NOW() WHERE finished_at IS NULL;` |
| `EACCES ... /app/uploads` | `docker exec -u root <app> chown -R 1001:1001 /app/uploads` (new builds handle this automatically) |
| BullMQ workers crash on boot | Check `REDIS_URL` is `redis://redis:6379` inside compose, and `docker compose exec redis redis-cli ping` returns PONG |
