# M7.5.1 — Deployment Guide

> **Platform**: Syority STO  
> **Date**: 2026-07-29  
> **Infrastructure**: Docker Compose on VPS (Nginx reverse proxy)

---

## 1. Prerequisites

### Required Software
- Docker Engine 24+ with Compose v2.24+
- Node.js 20 LTS (for local development/build)
- PostgreSQL 15+ (via Docker or managed)
- Redis 7+ (via Docker or managed)

### Required Environment Variables
Copy `.env.example` → `.env` and set:

```bash
# Mandatory — app will NOT start without these
DATABASE_URL="postgresql://user:password@db:5432/syority?schema=public"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
ENCRYPTION_KEY="your-32-char-encryption-key-here"

# Recommended — features degraded without these
REDIS_URL="redis://redis:6379"
NEXTAUTH_URL="https://app.yourdomain.com"
GOOGLE_CLOUD_PROJECT="your-gcp-project"
GOOGLE_CLOUD_LOCATION="us-central1"
```

---

## 2. Build

```bash
# Local build (verifies no runtime connections during compilation)
npm run build

# Docker build
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
```

### Build Safety Guarantee

After M7.5.1, `npm run build` will:
- ✅ Compile TypeScript
- ✅ Generate static pages
- ✅ Bundle assets
- ❌ Never connect to Redis
- ❌ Never start BullMQ queues/workers
- ❌ Never call Vertex AI
- ❌ Never derive encryption keys

---

## 3. Deploy

```bash
# Start all services
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Startup order (handled by depends_on):
# 1. db          → PostgreSQL
# 2. redis       → Redis
# 3. migrator    → Prisma migrations (exits after completion)
# 4. app         → Next.js application server
# 5. worker      → BullMQ background workers
# 6. nginx       → Reverse proxy + TLS
```

---

## 4. Health Verification

Run these checks after every deployment:

### Step 1: Liveness (is the process alive?)
```bash
curl -f http://localhost:3000/api/system/live
# Expected: 200 {"status":"alive","uptime_seconds":...,"pid":...}
```

### Step 2: Readiness (is infrastructure ready?)
```bash
curl -f http://localhost:3000/api/system/readiness
# Expected: 200 {"ready":true,"checks":{"database":true,"redis":true,...}}
```

### Step 3: Health (comprehensive status)
```bash
curl -s http://localhost:3000/api/system/health | python3 -m json.tool
# Expected: 200 with all checks "healthy"
```

### Step 4: Worker Verification
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs worker --tail=20
# Expected: 
#   [Workers] Schedule recalculate worker started
#   [Workers] Report delivery worker started
#   [Workers] Knowledge Engine worker started
```

---

## 5. Monitoring

### Docker HEALTHCHECK (add to docker-compose.prod.yml)
```yaml
app:
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:3000/api/system/live"]
    interval: 30s
    timeout: 5s
    retries: 3
    start_period: 30s

worker:
  healthcheck:
    test: ["CMD", "node", "-e", "process.exit(0)"]
    interval: 60s
    timeout: 5s
    retries: 3
```

### Log Levels
Set via `LOG_LEVEL` environment variable:
- `DEBUG` — All logs (development)
- `INFO` — Normal operations (production default)
- `WARN` — Warnings and above
- `ERROR` — Errors only

Production logs are JSON-structured for aggregation tools (Loki, CloudWatch, etc.).

---

## 6. Rollback Procedure

```bash
# 1. Roll back to previous image
docker compose -f docker-compose.yml -f docker-compose.prod.yml down app worker
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-build app worker

# 2. Verify health
curl -f http://localhost:3000/api/system/readiness

# 3. If database migrations need rollback
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm migrator npx prisma migrate resolve --rolled-back <migration_name>
```

---

## 7. Troubleshooting

### Build fails with ECONNREFUSED
This should no longer happen after M7.5.1. If it does:
1. Check that no new code eagerly imports Redis/BullMQ at module scope
2. Verify `ioredis` and `bullmq` are in `serverExternalPackages` in `next.config.ts`
3. Search for `new Redis(`, `new Queue(`, `new Worker(` at module scope

### Health endpoint returns "unhealthy"
1. Check which component failed: `curl -s /api/system/health | jq '.checks'`
2. If `database: unhealthy` → verify `DATABASE_URL` and PostgreSQL connectivity
3. If `redis: unhealthy` → verify `REDIS_URL` and Redis connectivity
4. If `vertex_ai: degraded` → set `GOOGLE_CLOUD_PROJECT` and `GOOGLE_CLOUD_LOCATION`

### Workers not processing jobs
1. Verify worker container is running: `docker compose ps worker`
2. Check worker logs: `docker compose logs worker --tail=50`
3. Verify Redis is accessible from worker: check `REDIS_URL` in worker env
4. Check queue status via health endpoint: `curl -s /api/system/health | jq '.checks.bullmq'`

### Missing environment variables at startup
The app will fail fast with a clear error listing all missing required variables:
```
╔══════════════════════════════════════════════════════════════╗
║           MISSING REQUIRED CONFIGURATION                   ║
╠══════════════════════════════════════════════════════════════╣
║  ✗ DATABASE_URL — PostgreSQL connection string             ║
║  ✗ NEXTAUTH_SECRET — NextAuth session signing secret       ║
╚══════════════════════════════════════════════════════════════╝
```

---

## 8. Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Proxy pattern for backward-compat | Avoids changing 8+ consumer files; matches existing `prisma.ts` pattern |
| Workers in separate process | Next.js must not bundle worker code; keeps app server lightweight |
| ADC for Vertex AI | No API keys to manage; inherits service account from GCP runtime |
| Config validation in `instrumentation.ts` | Runs once on cold start, before any request handling |
| In-memory rate limiter kept eager | No I/O; `RateLimiterMemory` is pure computation |
