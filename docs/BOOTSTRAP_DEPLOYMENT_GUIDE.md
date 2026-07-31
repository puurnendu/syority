# Aurianoa OS — Bootstrap & Deployment Guide

> **Version:** 1.0.0-beta.1
> **Last updated:** 2026-07-31

---

## Overview

This guide covers database migration, seeding, and deployment for Aurianoa OS.

All seed and migration scripts use a **shared Prisma client** (`prisma/seed-client.ts`) that provides:

- Adapter-compatible `PrismaClient` (Prisma v7 + `@prisma/adapter-pg`)
- `DATABASE_URL` validation
- Database connectivity verification
- Core table verification (Organization, User)
- Clean disconnect

---

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 20+ |
| PostgreSQL | 15+ |
| npm | 9+ |

Environment variables (`.env`):

```env
DATABASE_URL=postgresql://user:pass@localhost:5433/syority
PLATFORM_ADMIN_EMAIL=info@syority.com
PLATFORM_ADMIN_PASSWORD=Admin@123
NEXTAUTH_SECRET=<your-secret>
NEXTAUTH_URL=http://localhost:3000
ENCRYPTION_KEY=<your-encryption-key>
```

---

## Fresh Installation

### Option A: Single Command (Recommended)

```bash
npm run bootstrap
```

This performs all steps automatically:
1. Applies all database migrations
2. Generates Prisma client
3. Seeds platform organization and admin
4. Seeds superadmin account
5. Seeds platform admin
6. Seeds SYORITY Corporation
7. Verifies Organization and User tables
8. Prints login credentials

### Option B: Step-by-Step

```bash
# 1. Apply migrations
npx prisma migrate deploy

# 2. Generate Prisma client
npx prisma generate

# 3. Main seed (platform org + admin + notifications + report builder)
npm run seed

# 4. Superadmin account
npm run seed:superadmin

# 5. Platform admin
npm run seed:platform-admin

# 6. SYORITY Corporation
npm run seed:syority
```

### Optional Seeds

```bash
# Role catalog with test users
npm run seed:role-catalog

# Enterprise demo environment (multi-tenant demo data)
npm run seed:enterprise-demo

# Certificate templates
npm run seed:cert-templates

# Gasket-bolt lookup table
npm run seed:gasket-lookup
```

---

## Docker Deployment

### Standard Deployment

```bash
docker compose up -d
```

The `migrator` service runs automatically before the `app` starts (default: `migrate`).

### Migrator Subcommands

```bash
# Run migrations only (default)
docker compose run --rm migrator migrate

# Run all seeds
docker compose run --rm migrator seed

# Full bootstrap (migrate + seed + verify)
docker compose run --rm migrator bootstrap
```

### First-Time Docker Setup

```bash
# Build images
docker compose build

# Run full bootstrap
docker compose run --rm migrator bootstrap

# Start the application
docker compose up -d app
```

---

## Upgrade Procedure

### Local

```bash
# Pull latest code
git pull origin main

# Install dependencies
npm ci --legacy-peer-deps

# Apply new migrations
npx prisma migrate deploy

# Regenerate Prisma client
npx prisma generate

# Rebuild
npm run build

# Start
npm start
```

### Docker

```bash
# Pull latest code
git pull origin main

# Rebuild images
docker compose build

# Apply migrations (automatic with default entrypoint)
docker compose up -d
```

---

## Migration

### Apply Pending Migrations

```bash
npx prisma migrate deploy
```

### Check Migration Status

```bash
npx prisma migrate status
```

### Create New Migration (Development Only)

```bash
npx prisma migrate dev --name <migration_name>
```

---

## Verification

### Verify Schema

```bash
npx prisma validate
```

### Verify Build

```bash
npm run build
```

### Verify Database State

The bootstrap script automatically verifies:
- ✅ Database connectivity
- ✅ Organization table exists and has rows
- ✅ User table exists and has active users

### Manual Verification

```bash
# Check organization count
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"Organization\" WHERE deleted_at IS NULL;"

# Check user count
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"User\" WHERE is_active = true;"

# Check migration history
psql $DATABASE_URL -c "SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at DESC LIMIT 10;"
```

---

## Rollback

### Roll Back a Migration

Prisma does not support automatic rollback. To revert:

1. Create a new migration that undoes the change:
   ```bash
   npx prisma migrate dev --name revert_<original_name>
   ```

2. Or manually apply SQL:
   ```bash
   psql $DATABASE_URL -f rollback.sql
   npx prisma migrate resolve --rolled-back <migration_name>
   ```

### Database Backup Before Migration

```bash
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore From Backup

```bash
psql $DATABASE_URL < backup_20260731_120000.sql
```

---

## Troubleshooting

### "PrismaClient was instantiated without any options"

**Cause:** A script is using the legacy `new PrismaClient()` without a driver adapter.

**Fix:** Replace with:
```typescript
import { prisma, disconnect } from './seed-client';
// or for scripts/ directory:
import { prisma, disconnect } from '../prisma/seed-client';
```

### "DATABASE_URL is not set"

**Fix:** Ensure `.env` file exists with a valid `DATABASE_URL`, or pass it via environment:
```bash
DATABASE_URL=postgresql://user:pass@localhost:5433/syority npm run bootstrap
```

### "Organization/User table not found"

**Cause:** Migrations haven't been applied.

**Fix:**
```bash
npx prisma migrate deploy
```

### Docker: lightningcss binary error

**Cause:** `node_modules` installed on a different platform (e.g., Windows vs Linux).

**Fix:**
```bash
# Inside the container or on the correct platform:
npm rebuild lightningcss
# or
rm -rf node_modules && npm ci --legacy-peer-deps
```

---

## Seed Architecture

All seed scripts import from a single shared client:

```
prisma/seed-client.ts          ← Shared PrismaClient with adapter
├── prisma/seed.ts             ← Main seed (org, admin, notifications, reports)
├── prisma/seed-superadmin.ts  ← Superadmin account
├── prisma/seed-platform-admin.ts ← Platform admin
├── prisma/seed-syority.ts     ← SYORITY Corporation
├── prisma/seed-role-catalog.ts ← Role catalog + test users
├── prisma/seed-enterprise-demo.ts ← Multi-tenant demo data
├── prisma/seed-certificate-templates.ts ← Certificate templates
├── prisma/seed-gasket-lookup.ts ← Gasket-bolt lookup
├── prisma/seed-ois-templates.ts ← OIS widget/dashboard templates
├── prisma/seeds/notification-seed.ts ← Notification templates & rules
└── prisma/seeds/report-builder-seed.ts ← Report builder definitions
```

### Adding a New Seed

1. Create your seed file under `prisma/`
2. Import the shared client:
   ```typescript
   import { prisma, verifyDatabase, disconnect } from './seed-client';
   ```
3. Use `verifyDatabase()` at the top of your main function
4. Call `disconnect()` in your finally block
5. Add an npm script to `package.json`

---

## Default Credentials

| Account | Email | Password | Notes |
|---|---|---|---|
| Platform Admin | `info@syority.com` | `Admin@123` | Must change on first login |
| Superadmin | `superadmin@aurianoa.com` | `Admin@123` | Must change on first login |

> ⚠️ **Change all default passwords immediately after deployment.**
