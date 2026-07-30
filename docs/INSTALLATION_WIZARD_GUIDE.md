# Installation Wizard Guide

## Overview

The Installation Wizard provides a guided first-run setup for new Aurianoa OS environments. It is accessible at `/install` without authentication.

## Steps

1. **Welcome** — Introduction screen
2. **System Check** — Verifies database, Redis, SMTP, AI provider, storage
3. **Admin User** — Creates the platform super admin account
4. **Organization** — Configures the platform organization
5. **Seed Pack** — Optionally provisions a demo organization
6. **Review & Install** — Review configuration and execute
7. **Complete** — Installation summary and login link

## Prerequisites

- PostgreSQL database running and accessible via `DATABASE_URL`
- Node.js 18+ runtime
- Prisma migrations applied (`npx prisma migrate deploy`)

## Optional Infrastructure

- **Redis** — For queue management (optional, gracefully degraded if missing)
- **SMTP** — For email notifications (optional)
- **AI Provider** — For AI features (optional)

## Security

- The wizard is only accessible when the platform has NOT been installed yet
- Once a super admin user exists, the `/install` endpoint returns a 400 error
- After installation, users are redirected to `/auth/login`

## API

```
GET  /api/install — Check installation status
POST /api/install { adminName, adminEmail, adminPassword, orgName?, orgSlug?, seedPackSlug? }
POST /api/install { action: 'report' } — Generate installation report
```

## Seed Pack Options

During installation, you can select:

| Option | Description |
|--------|-------------|
| None | Clean platform, no demo data |
| Refinery Demo | Full turnaround with 850+ records |
| Petrochemical Demo | Ethylene cracker complex |
| Contractor Company | Engineering contractor |
| Training Environment | Sample exercises |
