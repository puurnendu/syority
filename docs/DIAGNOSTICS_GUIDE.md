# Diagnostics Guide

## Overview

Platform diagnostics (`/platform/monitoring`) provides real-time health monitoring for all Aurianoa OS components.

## Components Monitored

| Component | Checks | Threshold |
|-----------|--------|-----------|
| **Database** | Connection, latency, migration status | < 500ms = healthy |
| **Redis** | Connection, memory usage | < 200ms = healthy |
| **BullMQ Queues** | Waiting, active, completed, failed | < 100 failed = healthy |
| **SMTP** | Configuration status | Configured = healthy |
| **AI Provider** | Provider, model configured | Configured = healthy |
| **Memory** | Heap used, RSS, external | < 85% = healthy |
| **Storage** | Document count, attachment count | Informational |

## Health Status

| Status | Meaning |
|--------|---------|
| 🟢 Healthy | All within thresholds |
| 🟡 Degraded | Some components slow or unknown |
| 🔴 Down | Critical component failure |
| ⚪ Unknown | Cannot determine status |

## API

```
GET /api/admin/diagnostics — Full diagnostic report
GET /api/health            — Basic health check
GET /api/health/ready      — Kubernetes readiness
GET /api/health/live       — Kubernetes liveness
```

## Application Info

- Version (from `package.json`)
- Environment (`NEXT_PUBLIC_ENVIRONMENT`)
- Git Commit (`GIT_COMMIT` or `VERCEL_GIT_COMMIT_SHA`)
- Build Number (`BUILD_NUMBER`)
- Uptime

## Auto-Refresh

The diagnostics dashboard auto-refreshes every 30 seconds.
