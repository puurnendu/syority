# Seed Pack Guide

## Overview

Seed Packs are reusable packages that provision organizations with realistic demo data. They enable platform administrators to quickly set up beta environments, training environments, and customer pilot setups.

## Built-in Packs

| Pack | Category | Description | ~Records |
|------|----------|-------------|----------|
| `empty` | Pilot | Minimal org + admin + core modules | 5 |
| `refinery_demo` | Demo | Full refinery turnaround with CDU/VDU/NHT/DHDS/FCC | 850 |
| `petrochemical_demo` | Demo | Ethylene cracker + polymer units | 500 |
| `contractor_demo` | Demo | Engineering contractor setup | 100 |
| `training` | Training | Pre-configured training environment | 300 |

## Usage

### Initialize Built-in Packs

Navigate to **Platform → Seed Packs** and click **Initialize Built-in Packs**.

This seeds the `seed_packs` table with all built-in definitions. Idempotent — safe to run multiple times.

### Execute a Seed Pack

1. Select a pack from the catalog
2. (Optional) Override the organization slug and name
3. Click **▶ Execute**
4. Monitor the execution log

### What Gets Provisioned

A seed pack execution creates:

- ✅ Organization
- ✅ Site
- ✅ Roles (with proper permissions from `roleCatalog`)
- ✅ Users (default password: `Admin@123`, `must_change_password = true`)
- ✅ Hierarchy: Plants → Areas → Units → Systems → Assets
- ✅ Shutdown Event
- ✅ Engineering Issues
- ✅ Workpacks with Activities
- ✅ License (via LicenseService)
- ✅ Modules (via ModuleService)

### Override Organization Details

When executing, you can override:
- **Slug** — creates org with custom slug (e.g., `customer-pilot-acme`)
- **Name** — custom organization name

### Clone a Pack

Click **Clone** to create a copy for customization. The clone is set to `draft` status.

### Export / Import

- **Export** — downloads pack as JSON
- **Import** — uploads JSON to create a new pack

## Idempotency

All seed pack operations use `upsert` patterns:
- Re-executing a pack updates existing records rather than creating duplicates
- Safe to re-run after partial failures

## API

```
GET  /api/admin/seed-packs — List all packs
POST /api/admin/seed-packs { action: 'seed' } — Initialize built-ins
POST /api/admin/seed-packs { action: 'execute', packId, slug?, name? }
POST /api/admin/seed-packs { action: 'clone', packId, newSlug }
POST /api/admin/seed-packs { action: 'preview', packId }
POST /api/admin/seed-packs { action: 'import', data }
GET  /api/admin/seed-packs/[id] — Pack detail
PATCH /api/admin/seed-packs/[id] — Update pack
DELETE /api/admin/seed-packs/[id] — Delete (non-builtin only)
```

## Custom Packs

Create custom packs by providing a `SeedPackConfig` JSON:

```typescript
interface SeedPackConfig {
  organization: { name, slug, industry?, tenant_type?, country? }
  site: { name, code }
  hierarchy: [ { plant, areas: [ { name, code, units: [...] } ] } ]
  users: [ { name, email, role } ]
  roles: [ { slug, name } ]
  shutdownEvent?: { name, code, type, start, end }
  engineeringIssues?: [ { title, category, priority } ]
  workpacks?: [ { code, name, discipline, priority, activities? } ]
  license?: { type, maxUsers? }
}
```
