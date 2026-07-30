# Beta Deployment Guide

## Overview

This guide covers deploying Aurianoa OS v1.0.0-beta.1 for real beta users.

## Prerequisites

- Docker and Docker Compose installed
- PostgreSQL 15+ (or Docker-provided)
- Redis 7+ (or Docker-provided)
- SMTP server (optional, for email notifications)
- Domain/SSL configured

## Environment Variables

```env
# Application
NODE_ENV=production
NEXT_PUBLIC_ENVIRONMENT=beta
RELEASE_CHANNEL=beta
NEXTAUTH_SECRET=<generate-strong-secret>
NEXTAUTH_URL=https://your-domain.com

# Database
DATABASE_URL=postgresql://user:pass@host:5432/aurianoa

# Redis
REDIS_URL=redis://host:6379

# Build Info (set by CI/CD)
GIT_COMMIT=<commit-sha>
BUILD_NUMBER=<build-number>
BUILD_TIMESTAMP=<iso-timestamp>

# SMTP (optional)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...

# AI (optional)
AI_PROVIDER=openai
AI_API_KEY=...
```

## Deployment Steps

### 1. Database Setup
```bash
npx prisma migrate deploy
```

### 2. Seed Module Catalog
```bash
curl -X POST https://your-domain.com/api/admin/modules \
  -H "Content-Type: application/json" \
  -d '{"action":"seed"}'
```

### 3. Deploy Application
```bash
docker compose pull
docker compose up -d
```

### 4. Verify Health
```bash
curl https://your-domain.com/api/health
curl https://your-domain.com/api/health/ready
curl https://your-domain.com/api/health/live
```

### 5. Create Beta Licenses
For each beta organization, create a license via the Platform Admin UI or API.

### 6. Initialize Modules
For each organization, initialize module assignments.

## Monitoring

- **Diagnostics**: `/platform/monitoring`
- **Analytics**: `/platform/analytics`
- **Beta Console**: `/platform/beta`
- **Health API**: `/api/health`

## Rollback

See `docs/checklists/ROLLBACK_CHECKLIST.md`
