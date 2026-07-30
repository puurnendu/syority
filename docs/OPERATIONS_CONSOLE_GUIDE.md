# Operations Console Guide

## Overview

The Operations Console is a unified monitoring dashboard for platform administrators. It aggregates data from all existing services into a single view with 30-second auto-refresh.

## Sections

### Primary Stats
- Organizations count, Total users, DAU, MAU, Open feedback, Seed packs

### Infrastructure
- **Database** — Connection status, latency, migration version
- **Redis** — Connection, memory usage, key count
- **SMTP** — Configuration status, host
- **AI Provider** — Configuration, provider name, model
- **Build Info** — Version, commit hash, environment, release channel
- **Storage** — Backup count, total size, last backup date

### Licenses
- Distribution by type (trial, beta, starter, professional, enterprise)

### Recent Activity
- Last 5 backups with status and size
- Open feedback with severity

### Component Health
- Status of each system component (database, redis, smtp, ai, storage, queue)

## Navigation

**Platform → Operations**

The console is also linked from the Beta Management page.

## Data Sources

All data comes from existing M7.6G services:

| Section | Service |
|---------|---------|
| Health | DiagnosticsService |
| Analytics | AnalyticsService |
| Licenses | LicenseService |
| Backups | BackupService |
| Releases | ReleaseService |
| Feedback | FeedbackService |
| Seed Packs | SeedPackService |

## Auto-Refresh

- Infrastructure and analytics: 30 seconds
- Licenses and backups: 60 seconds
