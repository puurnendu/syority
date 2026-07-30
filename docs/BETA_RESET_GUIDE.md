# Organization Data Reset Guide

## Overview

The Data Reset tool allows platform administrators to clean beta organization data without deleting the organization itself. A rollback backup is automatically created before each reset.

## What Can Be Reset

| Category | What's Deleted |
|----------|----------------|
| Shutdown Events | All shutdown/turnaround events |
| Engineering Issues | All engineering issues |
| Workpacks & Activities | All workpacks and their activities |
| Notifications | All notification records |
| Feedback | All feedback entries |
| Usage Statistics | All usage tracking records |

## What's Always Preserved

- ✅ Organization (never deleted via reset)
- ✅ Hierarchy (Sites, Plants, Areas, Units, Systems, Assets)
- ✅ Users (toggle: `keepUsers`)
- ✅ Roles (toggle: `keepRoles`)
- ✅ Branding (toggle: `keepBranding`)
- ✅ License (toggle: `keepLicense`)
- ✅ Feature Flags (toggle: `keepFeatureFlags`)
- ✅ Modules (toggle: `keepModules`)

## Usage

1. Navigate to **Platform → Data Reset**
2. Select the target organization
3. Check categories to reset
4. Configure preservation toggles
5. Click **🔍 Preview Affected Records**
6. Review the preview panel
7. Type the organization name to confirm
8. Click **🗑️ Reset**

## Safety Measures

- **Rollback backup** — A `data_only` backup is automatically created before reset
- **Preview** — Always preview before executing
- **Typed confirmation** — Must type organization name
- **Audit trail** — Full logging via SystemAuditLog

## API

```
POST /api/admin/reset { action: 'preview', organizationId, options }
POST /api/admin/reset { action: 'execute', organizationId, options }
```
