# Beta Deployment Checklist

## Pre-Deployment

- [ ] All M7.6G migrations applied (`npx prisma migrate deploy`)
- [ ] Module catalog seeded (`POST /api/admin/modules` with `action: 'seed'`)
- [ ] Environment variables configured:
  - `NEXT_PUBLIC_ENVIRONMENT=beta`
  - `RELEASE_CHANNEL=beta`
  - `GIT_COMMIT` set by CI/CD
  - `BUILD_NUMBER` set by CI/CD
  - `BUILD_TIMESTAMP` set by CI/CD
- [ ] Redis connection verified
- [ ] SMTP configuration verified
- [ ] AI provider configured (if applicable)
- [ ] Docker health checks passing

## Deployment

- [ ] Database backup completed
- [ ] `docker compose pull` for latest images
- [ ] `docker compose up -d` deployed
- [ ] Health check: `GET /api/health` returns 200
- [ ] Readiness: `GET /api/health/ready` returns 200
- [ ] Liveness: `GET /api/health/live` returns 200

## Post-Deployment

- [ ] Platform diagnostics: `GET /api/admin/diagnostics` — all green
- [ ] License system operational: `GET /api/admin/licenses`
- [ ] Feature flags loaded: `GET /api/admin/features`
- [ ] Feedback button visible on all pages
- [ ] Create beta licenses for initial organizations
- [ ] Initialize modules for each organization
- [ ] Verify BullMQ workers running

## Smoke Test

- [ ] Login as platform admin
- [ ] Access Platform Dashboard (`/platform/dashboard`)
- [ ] Access License Management (`/platform/licenses`)
- [ ] Access Module Management (`/platform/modules`)
- [ ] Access Feature Flags (`/platform/features`)
- [ ] Access Diagnostics (`/platform/monitoring`)
- [ ] Access Analytics (`/platform/analytics`)
- [ ] Access Beta Management (`/platform/beta`)
- [ ] Access Release Info (`/platform/release`)
- [ ] Submit feedback via floating button
- [ ] Login as tenant user
- [ ] Verify module access matches license
