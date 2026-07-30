# Backup & Restore Guide

## Overview

Platform Backups create JSON-based archives of platform data with gzip compression and SHA-256 checksums. All backups are stored in the `./backups/` directory.

## Backup Types

| Type | Includes |
|------|----------|
| `full` | Everything: orgs, users, roles, hierarchy, events, workpacks, issues, reports, dashboards, notifications, feature flags, licenses, modules, branding, SMTP, AI, seed packs, BRE, feedback |
| `config_only` | Feature flags, licenses, modules, branding, SMTP, AI, seed packs |
| `data_only` | Orgs, users, roles, hierarchy, events, workpacks, issues, BRE, feedback |
| `documents_only` | Reports, dashboards, notifications |

## Creating a Backup

1. Navigate to **Platform → Backups**
2. Optionally enter a name (auto-generated if empty)
3. Select backup type
4. Click **💾 Create Backup**

## Verifying Integrity

1. Find the backup in the list
2. Click **Verify**
3. The system computes SHA-256 of the file and compares against the stored checksum

## Restoring

1. Click **Restore** on a completed backup
2. Confirm the operation
3. Currently restores: feature flags, seed packs (config items)
4. For full data restoration, use `pg_restore` with the exported JSON

## Retention Policy

- Set via `retentionDays` when creating backups (default: 90 days)
- Expired backups are cleaned up via the `enforce-retention` action

## API

```
GET  /api/admin/backups — List + stats
POST /api/admin/backups { action: 'create', type, name?, retentionDays? }
POST /api/admin/backups { action: 'verify', backupId }
POST /api/admin/backups { action: 'restore', backupId, scope? }
POST /api/admin/backups { action: 'preview', backupId }
POST /api/admin/backups { action: 'enforce-retention' }
GET  /api/admin/backups/[id] — Detail
DELETE /api/admin/backups/[id] — Delete
```

## Storage

- Location: `./backups/` (project root)
- Format: `.json.gz` (gzip compressed JSON)
- Each backup has a SHA-256 checksum stored in the database
