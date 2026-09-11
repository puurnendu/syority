# M16-R6 — Production Readiness

**Date:** 8 September 2026

## Deployment assumptions (binding)

Immediate production topology is **`docker-compose.yml`**:

- One `app` replica (no `deploy.replicas`)
- One Postgres
- Redis for BullMQ (not used as ConfirmationGate store)
- `migrator` service runs `prisma migrate deploy` before app start
- `output: 'standalone'`

**Do not** run multiple M16 Node instances behind a load balancer until confirmation, rate-limit, and mobile idempotency are shared.

## Startup

1. Root `instrumentation.ts` re-exports `src/instrumentation.ts` so webpack `next build` (scans files next to `./app`) and turbopack (`src/instrumentation`) both load `register()`.
2. Node runtime only: `validateRequiredConfig`, `registerR2ReadTools`, `registerR3WriteTools` (idempotent), event subscribers.
3. Empty tool registry would fail-closed (no EWS from conversational path). Empty registry is a **functional** outage, not an authorization bypass. R6 registers tools at boot.

## Migrations

| Item | Status |
|---|---|
| `20260908_m16_r6_interaction_logs` | Present; creates `m16_interaction_logs` (TEXT conversation_id); adds WhatsApp `event_id` |
| Localhost `prisma migrate status` | **4 pending** including R6 and three 20260906 M12 migrations |
| Fresh/upgrade apply this session | **Not run** (would mutate operator DB) |
| Docker | `migrator` applies pending SQL before app |

**Operator action before WhatsApp/Voice audit logs work:** `prisma migrate deploy` (or Docker migrator). Until then `logAndReturn` swallows create failures.

## Configuration

Must be set for full M16 channels:

- `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
- WhatsApp: `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` (missing secret → ACK 200, no process)
- Voice: Whisper key (`WHATSAPP_OPENAI_API_KEY` used by live Voice route)
- LLM provider credentials via existing ProviderLoader (org-scoped)

`configValidator` does not currently warn on missing `WHATSAPP_APP_SECRET` (P2).

## Observability

- EWS: AuditLog + EventBus after success
- M16: `m16_interaction_logs` (governance trail, not business history)
- WhatsApp: `whatsapp_updates` transport rows
- Health: `/api/health/live` (compose healthcheck)

## Performance (qualitative)

No R6 premature optimization. Known shapes:

- Readiness bulk is per-id loop (N+1) — existing M12
- Entity resolution bounded `take: 10`
- LLM/transcription timeouts/retries remain provider-layer
- Rate limits: AI 20/min, webhook 60/min, Voice 30/min, Mobile 60/min (after R6 custom-options fix)

## Browser / HTTP acceptance

**UNVERIFIED.** Next.js not started (`.next` artifact). No claim of HTTP GREEN.

## Release checklist (operators)

- [ ] Apply pending Prisma migrations
- [ ] Single app instance (or accept confirmation loss across nodes)
- [ ] Set WhatsApp secret before enabling Meta webhook
- [ ] Do not ship `test-exec.ts` as a reachable route
- [ ] Keep `src/app/api/reports` unserved or explicitly migrate those routes to `app/api` later (not live bypass)
