# Milestone 5 — Enterprise Organization Hierarchy

## Hierarchy

```
Platform
  └── Tenant (Organization)          ← one customer company / one refinery site tenant
        └── Site
              └── Plant
                    └── Area (optional)
                          └── Unit
                                └── System
                                      └── Asset / Equipment
```

Workpacks (future) attach to **Asset**, **System**, or **Unit** via existing optional FKs on `Workpack` (`asset_id`, `system_id`, `unit_id`, plus denormalized `plant_id` / `site_id`). No Workpack implementation in this milestone.

## ER Diagram

```mermaid
erDiagram
  Organization ||--o{ Site : owns
  Site ||--o{ Plant : contains
  Plant ||--o{ Area : optional
  Plant ||--o{ Unit : contains
  Area ||--o{ Unit : optional
  Unit ||--o{ System : contains
  System ||--o{ Asset : contains
  Unit ||--o{ Asset : denorm
  Plant ||--o{ Asset : denorm
  Workpack }o--|| Site : required
  Workpack }o--o| Plant : optional
  Workpack }o--o| Unit : optional
  Workpack }o--o| System : optional
  Workpack }o--o| Asset : optional

  Organization {
    uuid id PK
    string name
  }
  Site {
    uuid id PK
    uuid organization_id FK
    string code UK_org
    string name
    datetime deleted_at
  }
  Plant {
    uuid id PK
    uuid organization_id FK
    uuid site_id FK
    string code UK_site
    string name
  }
  Area {
    uuid id PK
    uuid organization_id FK
    uuid plant_id FK
    string code UK_plant
    string name
  }
  Unit {
    uuid id PK
    uuid organization_id FK
    uuid plant_id FK
    uuid area_id FK_nullable
    string code UK_plant
  }
  System {
    uuid id PK
    uuid organization_id FK
    uuid unit_id FK
    string code UK_unit
  }
  Asset {
    uuid id PK
    uuid organization_id FK
    uuid site_id FK
    uuid plant_id FK_nullable
    uuid unit_id FK_nullable
    uuid system_id FK_nullable
    string tag_number UK_org
  }
```

## Rules

| Rule | Enforcement |
|------|-------------|
| One company = one Tenant | Platform tenants; hierarchy rows always carry `organization_id` |
| Platform users do not own hierarchy | `guardTenantApi` + proxy mode for platform actors |
| Codes unique within parent | Site: `(organization_id, code)`; Plant: `(site_id, code)`; Area/Unit: `(plant_id, code)`; System: `(unit_id, code)`; Asset: `(organization_id, tag_number)` |
| Soft delete | `deleted_at` + `is_active`; restore endpoints |
| Tenant isolation | Every query filters `organization_id` from session |

## Prisma / Migration

- Migration: `prisma/migrations/20260724120000_enterprise_org_hierarchy/migration.sql`
- New model: `Area`
- `Unit.area_id` (optional)
- `Asset.plant_id`, `Asset.unit_id` (denormalized for Workpack/reporting)
- UUID `@default(uuid())` on Site/Plant/Unit/System/Asset/Area
- Parent-scoped unique indexes; duplicate codes renamed `*-DUP-<id>` during migrate

```bash
npx prisma migrate deploy
# or in Docker:
docker compose exec app npx prisma migrate deploy
npx prisma generate
```

## REST API (all `guardTenantApi`)

| Method | Path | Permission |
|--------|------|------------|
| GET/POST | `/api/hierarchy/sites` | `site.view` / `site.manage` |
| PATCH/DELETE | `/api/hierarchy/sites/:id` | `site.manage` |
| POST | `/api/hierarchy/sites/:id/restore` | `site.manage` |
| GET/POST | `/api/hierarchy/plants` | `plant.view` / `plant.manage` |
| PATCH/DELETE | `/api/hierarchy/plants/:id` | `plant.manage` |
| POST | `/api/hierarchy/plants/:id/restore` | `plant.manage` |
| GET/POST | `/api/hierarchy/areas` | `area.view` / `area.manage` |
| PATCH/DELETE | `/api/hierarchy/areas/:id` | `area.manage` |
| POST | `/api/hierarchy/areas/:id/restore` | `area.manage` |
| GET/POST | `/api/hierarchy/units` | `unit.view` / `unit.manage` |
| PATCH/DELETE | `/api/hierarchy/units/:id` | `unit.manage` |
| POST | `/api/hierarchy/units/:id/restore` | `unit.manage` |
| GET/POST | `/api/hierarchy/systems` | `system.view` / `system.manage` |
| PATCH/DELETE | `/api/hierarchy/systems/:id` | `system.manage` |
| POST | `/api/hierarchy/systems/:id/restore` | `system.manage` |
| GET/POST | `/api/hierarchy/assets` | `asset.view` / `asset.manage` |
| PATCH/DELETE | `/api/hierarchy/assets/:id` | `asset.manage` |
| POST | `/api/hierarchy/assets/:id/restore` | `asset.manage` |
| POST | `/api/hierarchy/import` | manage perm for `entity` |

### List query params

`page`, `pageSize`, `search`, `status` (`active`\|`inactive`\|`archived`\|`all`), `siteId`, `plantId`, `areaId`, `unitId`, `systemId`, `parentId`

### Import

Multipart: `file` (xlsx/csv), `entity` (`site`\|`plant`\|`area`\|`unit`\|`system`\|`asset`), `dryRun` (`true` default).

Columns: **Code**, **Name**, **Description**, **Parent**, **Status**.

Dry-run returns a validation report before commit (`dryRun=false`).

## Permission matrix

| Role | site | plant | area | unit | system | asset |
|------|------|-------|------|------|--------|-------|
| tenant_administrator / org_admin | view+manage | view+manage | view+manage | view+manage | view+manage | view+manage |
| planner | view+manage | view+manage | view+manage | view+manage | view+manage | view+manage |
| workpack_manager / engineer / reviewer / viewer | view | view | view | view | view | view |
| contractor | view | view | — | view | view | view |
| tenant_admin (ops) | view | view | view | view | view | view |

Legacy colon permissions (`unit:view`, `system:view`, …) remain for existing Planning screens.

## UI

| Path | Level |
|------|-------|
| `/settings/hierarchy/sites` | Sites |
| `/settings/hierarchy/plants` | Plants |
| `/settings/hierarchy/areas` | Areas |
| `/settings/hierarchy/units` | Units |
| `/settings/hierarchy/systems` | Systems |
| `/settings/hierarchy/assets` | Assets |

Legacy `/settings/sites` and `/settings/plants` render the same CRUD component. Nav uses hierarchy permissions.

Features: search, pagination, status filter, create/edit, archive/restore, Excel/CSV import with validation report.

## Sample hierarchy (refinery)

```
Tenant: Gulf Coast Refining Co.
└── Site: GCR-MAIN — Gulf Coast Main Complex
    └── Plant: CDU — Crude Distillation
        ├── Area: CDU-PROC — Process
        │   └── Unit: 100 — Atmospheric Tower
        │       ├── System: 100-OVHD — Overhead
        │       │   └── Asset: E-100A — Overhead Condenser A
        │       └── System: 100-BTMS — Bottoms
        │           └── Asset: P-100A — Bottoms Pump A
        └── Area: CDU-OFF — Offsites
            └── Unit: 110 — Feed Prep
                └── System: 110-FEED — Crude Feed
                    └── Asset: TK-110 — Crude Charge Tank
    └── Plant: FCC — Fluid Catalytic Cracking
        └── Unit: 200 — Reactor/Regen          ← Area omitted (allowed)
            └── System: 200-RX — Reactor Circuit
                └── Asset: R-200 — FCC Reactor
```

Same unit code `100` may exist under Plant FCC later; duplicate `100` under CDU is rejected.

## Workpack preparation

`Workpack` already has:

- `site_id` (required)
- `plant_id`, `unit_id`, `system_id`, `asset_id` (optional)

Attach policy (config later): prefer Asset → else System → else Unit. No schema change required for Workpacks module.

## Code map

| Concern | Path |
|---------|------|
| Service | `src/core/hierarchy/HierarchyService.ts` |
| Import | `src/core/hierarchy/HierarchyImport.ts` |
| API helpers | `src/core/hierarchy/apiHelpers.ts` |
| REST | `app/api/hierarchy/**` |
| UI | `src/components/hierarchy/HierarchyCrudPage.tsx` |
| Permissions | `src/lib/permissions.ts` |
| Nav | `src/security/navigation.ts` |
