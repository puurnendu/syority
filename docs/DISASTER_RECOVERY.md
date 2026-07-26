# Disaster Recovery Runbook — Aurianoa OS / Syority

**Purpose:** Recover from VPS loss, disk failure, or bad deploy with known RTO/RPO and repeatable steps.  
**Companion scripts:** `scripts/bootstrap.sh`, `scripts/backup.sh`, `scripts/restore.sh`, `scripts/deploy.sh`, `scripts/init-letsencrypt.sh`.  
**Last updated:** 16 July 2026

---

## 1. Objectives

| Metric | Target | Notes |
|---|---|---|
| **RPO** (max data loss) | **≤ 24 hours** | Daily backups; tighten with more frequent `backup.sh` cron if needed |
| **RTO** (time to restore service) | **2–6 hours** | Assumes DNS TTL ≤ 1h, backups reachable, images build successfully |
| Critical data | PostgreSQL + `/app/uploads` | Redis is disposable (job queues rebuild) |
| TLS | Re-issue via Let's Encrypt if needed | Or restore `certbot/conf` from backup if you archived it |

---

## 2. What to back up (and what not to)

| Asset | Backup? | How |
|---|---|---|
| PostgreSQL (`syority`) | **Yes — P0** | `./scripts/backup.sh` → `postgres_*.dump` / `.sql.gz` |
| Uploads volume (`/app/uploads`) | **Yes — P0** | Same script → `uploads.tar.gz` |
| `.env` | **Yes — P0 (offline/secrets store)** | Copy to encrypted vault / password manager — **never** commit to git |
| `certbot/conf` (TLS keys) | Optional P1 | Tar `certbot/conf` into backup host; else re-run Let's Encrypt |
| Redis | No | AOF is convenience only; workers re-queue |
| Docker images | No | Rebuild from git + `deploy.sh` |
| Application code | Via git remote | Clone fresh on new VPS |

Default backup location: `BACKUP_DIR` (default `./backups` or `/var/backups/syority` from bootstrap).

**Daily (recommended cron):**

```bash
0 2 * * * cd /var/www/syority && BACKUP_DIR=/var/backups/syority ./scripts/backup.sh >> /var/log/syority-backup.log 2>&1
```

**Weekly:** copy latest `BACKUP_DIR` snapshot off-box (USB / second VPS / object storage) — configure later.  
**Monthly:** retain one verified restore test (run `restore.sh` against a staging stack).

**Retention (script default):** 14 days on the backup disk (`RETENTION_DAYS`).

---

## 3. Replace a failed VPS (cold standby)

Estimated time: **2–4 hours** if backups and DNS are ready.

### 3.1 Provision

1. Create a new Ubuntu 22.04/24.04 VPS.  
2. Point a temporary hostname or prepare to flip the A record (see §6).  
3. SSH in as a sudo-capable user.

### 3.2 Bootstrap host

```bash
# After placing application code in /var/www/syority (git clone or rsync)
cd /var/www/syority
sudo bash scripts/bootstrap.sh
# Re-login (or new SSH session) so docker group applies
```

### 3.3 Configure secrets

```bash
cd /var/www/syority
cp .env.example .env
nano .env   # restore REAL values from vault — especially ENCRYPTION_KEY, DATABASE_URL, NEXTAUTH_*
```

Critical: **reuse the same `ENCRYPTION_KEY`** if any tenant encrypted API keys exist in the DB.

Ensure compose DB URL uses Docker hostnames:

```env
DATABASE_URL="postgresql://user:pass@db:5432/syority?schema=public"
REDIS_URL="redis://redis:6379"
NEXTAUTH_URL="https://your.domain"
DOMAIN="your.domain"
```

### 3.4 Copy backups onto the new VPS

```bash
# Example: from your laptop / backup host
scp -r /path/to/20260716T020000Z user@NEW_VPS:/var/backups/syority/
```

### 3.5 Start infrastructure volumes (DB) before restore

```bash
cd /var/www/syority
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d db redis
# Wait until healthy
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec db pg_isready -U user -d syority
```

Build/start `app` so the uploads volume exists (or restore will create via running app):

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build app worker
```

### 3.6 Restore data

```bash
./scripts/restore.sh /var/backups/syority/20260716T020000Z
```

### 3.7 TLS

**Option A — restore certs** (if you backed up `certbot/conf`):

```bash
# extract into ./certbot/conf then:
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d nginx certbot
```

**Option B — re-issue:**

```bash
./scripts/init-letsencrypt.sh admin@your.domain
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 3.8 Deploy / migrate (existing DB only)

Because restore already loaded schema + data, `_prisma_migrations` / `Organization` should exist:

```bash
./scripts/deploy.sh
```

`deploy.sh` will run `prisma migrate deploy` only when it detects an existing app schema. Fresh empty DBs are refused by design.

### 3.9 Validate

See §7 checklist.

---

## 4. Restore PostgreSQL only

```bash
cd /var/www/syority
# Prefer custom format:
# ./scripts/restore.sh already does DROP/CREATE + pg_restore

# Manual alternative:
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T db \
  pg_restore -U user -d syority --clean --if-exists --no-owner -v < backups/.../postgres_syority.dump
```

Prefer **`./scripts/restore.sh`** so uploads stay consistent and a pre-restore safety snapshot is kept.

---

## 5. Restore uploads only

```bash
APP=$(docker compose -f docker-compose.yml -f docker-compose.prod.yml ps -q app)
docker exec -u root "$APP" sh -c 'rm -rf /app/uploads/*; mkdir -p /app/uploads'
cat /var/backups/syority/<TIMESTAMP>/uploads.tar.gz \
  | docker exec -i -u root "$APP" tar -C /app -xzf -
docker exec -u root "$APP" chown -R 1001:1001 /app/uploads
```

Or use `./scripts/restore.sh` (restores DB + uploads together).

---

## 6. DNS cutover

1. Lower TTL to 300s **before** the maintenance window (if possible).  
2. After new VPS responds on HTTP/HTTPS with correct cert:  
   - Update A/AAAA record for `DOMAIN` to the new VPS IP.  
3. Verify:

```bash
dig +short your.domain
curl -I https://your.domain/api/health
```

4. Keep old VPS powered on (read-only / stopped compose) until DNS propagates and health checks pass.  
5. Raise TTL again after stability.

**Propagation wait:** typically 5–60 minutes with low TTL; up to 24–48h if TTL was high — plan RTO accordingly.

---

## 7. Validation checklist (post-restore)

- [ ] `curl -fsS https://$DOMAIN/api/health` returns 200  
- [ ] Login works with a known user  
- [ ] Open a workpack / document download (uploads path)  
- [ ] Dashboard loads (Prisma + Redis path)  
- [ ] `docker compose … ps` — app, worker, db, redis, nginx healthy/up  
- [ ] `docker compose … exec redis redis-cli ping` → PONG  
- [ ] Nginx: `docker compose … exec nginx nginx -t`  
- [ ] Confirm `ENCRYPTION_KEY` matches pre-incident value if integrations used encryption  
- [ ] Take a **fresh** backup immediately after successful restore  

---

## 8. Estimated recovery timeline

| Step | Duration |
|---|---|
| Provision VPS + bootstrap | 20–40 min |
| Clone/copy code + `.env` | 15–30 min |
| Transfer backup artifacts | 10–60 min (size-dependent) |
| Restore DB + uploads | 15–45 min |
| TLS + deploy + smoke tests | 30–60 min |
| DNS cutover + verify | 15–60 min |
| **Total** | **~2–6 hours** |

---

## 9. Failure modes & notes

| Issue | Action |
|---|---|
| `deploy.sh` aborts on empty DB | Expected — restore a backup first, or complete migration baseline strategy offline |
| `restore.sh` fails mid-way | Script attempts rollback from `backups/_pre_restore/<timestamp>` |
| Uploads permission errors | `chown -R 1001:1001 /app/uploads` inside app container as root |
| Certbot / nginx cert missing | Re-run `init-letsencrypt.sh`; ensure DNS already points here for HTTP-01 |
| Wrong `ENCRYPTION_KEY` | Encrypted tenant secrets unreadable — restore key from vault |

---

## 10. Contacts / ownership (fill in)

| Role | Name | Contact |
|---|---|---|
| Primary operator | | |
| DNS / registrar | | |
| Backup storage location | | |
| Secrets vault | | |

---

## Stop

This document is operational guidance only. It does not deploy infrastructure by itself. Execute scripts only during an approved recovery or drill.
