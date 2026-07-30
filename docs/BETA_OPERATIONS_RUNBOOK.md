# Beta Operations Runbook

## Pre-Deployment Checklist

- [ ] Run `npx prisma migrate deploy` to apply all migrations
- [ ] Verify `DATABASE_URL` is set and accessible
- [ ] Verify environment variables: `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
- [ ] Optional: Configure `REDIS_URL`, `SMTP_HOST`, `OPENAI_API_KEY`
- [ ] Run `npm run build` and verify no build errors
- [ ] Navigate to `/install` to run the Installation Wizard
- [ ] Verify platform admin can log in at `/auth/login`
- [ ] Initialize built-in seed packs at `/platform/seed-packs`
- [ ] Create a full backup at `/platform/backups`

## Daily Operations

### Morning Check
1. Open **Operations Console** (`/platform/operations`)
2. Verify overall health is 🟢 Healthy
3. Check database latency < 100ms
4. Review open feedback count
5. Check for expiring licenses

### Weekly Tasks
- [ ] Create a backup (`full` type)
- [ ] Run retention policy enforcement
- [ ] Review inactive organizations in Beta Management
- [ ] Check feedback summary for recurring issues

## Onboarding a New Beta Organization

1. Navigate to **Seed Packs** (`/platform/seed-packs`)
2. Select appropriate pack (e.g., `refinery_demo`)
3. Enter customer-specific slug and name in overrides
4. Click **▶ Execute**
5. Share credentials: email from pack, password: `Admin@123`
6. User will be forced to change password on first login

## Resetting a Beta Organization

1. Navigate to **Data Reset** (`/platform/reset`)
2. Select the organization
3. Select categories to reset (events, workpacks, issues, etc.)
4. Keep: users, roles, license, modules, branding
5. Preview → Confirm → Execute
6. Rollback backup is auto-created

## Emergency Procedures

### Database Connection Lost
1. Check `DATABASE_URL` environment variable
2. Verify PostgreSQL is running
3. Check Operations Console for error details
4. Restart the application

### Full Platform Reset (Last Resort)
1. Create a backup first
2. Drop all tables: `npx prisma migrate reset`
3. Re-apply migrations: `npx prisma migrate deploy`
4. Run seed: `npx prisma db seed`
5. Navigate to `/install` to re-initialize

### Restore from Backup
1. Navigate to **Backups** (`/platform/backups`)
2. Verify backup integrity (click **Verify**)
3. Click **Restore** on the target backup
4. For full database restore, use `pg_restore`

## Monitoring Alerts

| Metric | Threshold | Action |
|--------|-----------|--------|
| Health | 🔴 unhealthy | Check component health panel |
| DB Latency | > 500ms | Investigate connection pool |
| Open Feedback | > 20 | Triage and assign |
| Inactive Orgs | > 30 days | Contact or archive |
| Backup Age | > 7 days | Create new backup |
| License Expiry | < 7 days | Notify and renew |

## Useful API Endpoints

```
GET  /api/admin/diagnostics  — Full system diagnostics
GET  /api/admin/analytics    — Usage analytics
GET  /api/admin/backups      — Backup list + stats
GET  /api/admin/seed-packs   — Seed pack catalog
GET  /api/install            — Installation status
POST /api/admin/beta         — Organization actions (health, clone, suspend, reset)
POST /api/admin/reset        — Organization data reset
```
