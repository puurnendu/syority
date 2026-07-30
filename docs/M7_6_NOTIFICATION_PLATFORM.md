# M7.6 — Notification & Communication Platform

## Overview

M7.6 introduces a complete, enterprise-grade Notification Platform for AURIANOA OS. All email notifications flow through this centralized platform, which provides:

- **Multi-provider support** — SMTP, SES, SendGrid, Microsoft 365, Mailgun
- **Template engine** — `{{variable}}` substitution with `{{#if}}` conditionals
- **Rule engine** — Event-driven notification routing
- **Queue processor** — Reliable delivery with retry/backoff
- **Audit trail** — Full delivery logs for compliance
- **Distribution groups** — Reusable recipient collections

## Architecture

```
Business Event (workpack.submitted, password.reset, etc.)
        │
        ▼
   ┌─────────────────┐
   │  Rule Engine     │──── Match event_type → find rules
   │  (processEvent)  │──── Resolve recipients (user/role/group/email/actor)
   └────────┬────────┘
            │ For each recipient × matched rule:
            ▼
   ┌─────────────────┐
   │ Template Engine  │──── Render {{variables}} and {{#if}} conditionals
   │  (renderTemplate)│
   └────────┬────────┘
            │
            ▼
   ┌─────────────────┐
   │ Notification     │──── Insert into notification_queue table
   │ Queue            │──── Status: pending → sending → sent/failed
   └────────┬────────┘
            │ Queue Processor picks up pending items
            ▼
   ┌─────────────────┐
   │ Delivery Service │──── Resolve provider (DB or env fallback)
   │ (SMTP/SES/etc.) │──── Send via nodemailer
   └────────┬────────┘
            │
            ▼
   ┌─────────────────┐
   │ Delivery Log     │──── Full audit trail with message IDs
   └─────────────────┘
```

## Key Design Decisions

### 1. Database-First Queue (not BullMQ)
The notification queue uses the PostgreSQL `notification_queue` table instead of BullMQ. This ensures:
- No Redis dependency for email delivery
- Full audit trail in the database
- Easy retry management via SQL
- Queue processor can be triggered by API call, cron, or BullMQ job

### 2. Provider Credential Encryption
SMTP passwords are encrypted at rest using AES-256-GCM with the `ENCRYPTION_KEY` environment variable. Passwords are never returned in API responses.

### 3. Env Fallback for Providers
If no DB-configured provider exists, the delivery service falls back to environment variables (`SMTP_HOST`, `SMTP_PORT`, etc.). This ensures backward compatibility with pre-M7.6 deployments.

### 4. Template Slug System
Templates are identified by unique slugs (e.g., `password-reset`, `workpack-submitted`). This allows rules to reference templates without fragile ID dependencies.

### 5. Event → Rule → Template Pipeline
The notification flow is:
1. Business code calls `processEvent('event.type', { variables })`
2. Rule engine finds all enabled rules matching the event type
3. For each rule, recipients are resolved (users, roles, groups, emails, actors)
4. Template is rendered with provided variables
5. Notification is enqueued for delivery

## Services

| Service | File | Purpose |
|---------|------|---------|
| `NotificationProviderService` | `src/core/notifications/NotificationProviderService.ts` | CRUD for email providers |
| `NotificationTemplateService` | `src/core/notifications/NotificationTemplateService.ts` | CRUD + rendering for templates |
| `NotificationRuleEngine` | `src/core/notifications/NotificationRuleEngine.ts` | Event → rule matching + dispatch |
| `NotificationQueueProcessor` | `src/core/notifications/NotificationQueueProcessor.ts` | Queue processing + retry |
| `NotificationDeliveryService` | `src/core/notifications/NotificationDeliveryService.ts` | Actual SMTP delivery |
| `NotificationRecipientGroupService` | `src/core/notifications/NotificationRecipientGroupService.ts` | Distribution group CRUD |

## API Endpoints

All endpoints require platform admin authentication (`guardPlatformApi('nav.admin')`).

### Providers
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/platform/notifications/providers` | List all providers |
| POST | `/api/platform/notifications/providers` | Create provider |
| PUT | `/api/platform/notifications/providers/[id]` | Update provider |
| DELETE | `/api/platform/notifications/providers/[id]` | Delete provider |
| POST | `/api/platform/notifications/providers/[id]/test-connection` | Test SMTP connection |
| POST | `/api/platform/notifications/providers/[id]/test-email` | Send test email |
| POST | `/api/platform/notifications/providers/[id]/set-default` | Set as default |

### Templates
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/platform/notifications/templates` | List (with ?category filter) |
| POST | `/api/platform/notifications/templates` | Create template |
| PUT | `/api/platform/notifications/templates/[id]` | Update template |
| DELETE | `/api/platform/notifications/templates/[id]` | Delete template |
| POST | `/api/platform/notifications/templates/[id]/preview` | Preview with variables |

### Rules
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/platform/notifications/rules` | List all rules |
| POST | `/api/platform/notifications/rules` | Create rule |
| PUT | `/api/platform/notifications/rules/[id]` | Update rule |
| DELETE | `/api/platform/notifications/rules/[id]` | Delete rule |

### Groups
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/platform/notifications/groups` | List all groups |
| POST | `/api/platform/notifications/groups` | Create group |
| PUT | `/api/platform/notifications/groups/[id]` | Update group |
| DELETE | `/api/platform/notifications/groups/[id]` | Delete group |

### Queue & Dashboard
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/platform/notifications/queue` | List queue items (with ?status filter) |
| POST | `/api/platform/notifications/queue` | Process pending items now |
| POST | `/api/platform/notifications/queue/[id]/cancel` | Cancel a queued item |
| POST | `/api/platform/notifications/queue/[id]/retry` | Retry a failed item |
| GET | `/api/platform/notifications/delivery-logs` | Get delivery audit logs |
| GET | `/api/platform/notifications/dashboard` | Dashboard statistics |

## Platform Admin UI

Six pages under `/platform/notifications/`:

| Page | Path | Description |
|------|------|-------------|
| Dashboard | `/platform/notifications` | System health, stats, recent activity |
| Providers | `/platform/notifications/providers` | Provider CRUD with test connection/email |
| Templates | `/platform/notifications/templates` | Template editor with variable palette |
| Rules | `/platform/notifications/rules` | Event → template → channel → recipients |
| Groups | `/platform/notifications/groups` | Distribution group management |
| Queue | `/platform/notifications/queue` | Queue monitor with process/cancel/retry |

## Integration Points

### 1. Password Reset (`app/api/auth/forgot-password/route.ts`)
- **Before M7.6**: Direct `sendEmail()` with hardcoded HTML
- **After M7.6**: `processEvent('password.reset', { variables })` → rule engine → queue → delivery

### 2. Workflow Events (`src/lib/eventSubscribers.ts`)
- **Before M7.6**: `NotificationService.sendEmail()` with React Email templates
- **After M7.6**: In-app notifications preserved + `processEvent()` for email delivery

### 3. In-App Notifications (`src/lib/notifications.ts`)
- **Before M7.6**: `sendEmail()` → direct SMTP via `emailService.ts`
- **After M7.6**: `sendEmail()` → enqueue in `notification_queue` table

### 4. Report Delivery (`src/workers/reportDeliveryWorker.ts`)
- **Before M7.6**: Email channel was a stub
- **After M7.6**: Email channel enqueues via `notification_queue`

## Seed Data

22 default templates across 5 categories:
- **Authentication** (3): password-reset, welcome, user-invited
- **Planning** (4): workpack-submitted, workpack-approved, workpack-rejected, workpack-issued
- **Execution** (4): qa-assigned, qa-passed, hold-point-ready, punch-assigned
- **Reports** (4): daily-progress, shift-report, weekly-dashboard, executive-summary
- **Platform** (7): onboarding-submission, onboarding-approval, scope-approved, event-created, system-alert, backup-failed

4 default rules:
- Password Reset → Email User
- Workpack Submitted → Email Admins
- Workpack Approved → Email Creator
- Workpack Rejected → Email Creator

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ENCRYPTION_KEY` | Yes | — | 32-byte hex key for AES-256-GCM credential encryption |
| `SMTP_HOST` | No | — | Fallback SMTP host (if no DB provider) |
| `SMTP_PORT` | No | 587 | Fallback SMTP port |
| `SMTP_SECURE` | No | false | Fallback SMTP TLS |
| `SMTP_USER` | No | — | Fallback SMTP username |
| `SMTP_PASS` | No | — | Fallback SMTP password |
| `SMTP_FROM` | No | noreply@aurianoa.com | Fallback from address |
| `SMTP_FROM_NAME` | No | AURIANOA OS | Fallback from name |

## Future Extensibility

The platform is designed for future channels:
- **SMS**: Add provider type, delivery adapter
- **WhatsApp**: Wire existing MessageProcessor
- **Teams/Slack**: Webhook-based delivery
- **Push**: FCM/APNS integration
- **Webhook**: Generic HTTP POST delivery

Each channel requires:
1. A new `provider_type` enum value
2. A delivery adapter in `NotificationDeliveryService`
3. No database schema changes needed
