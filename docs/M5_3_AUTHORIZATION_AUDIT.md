# M5.3 Authorization Audit — Platform & Tenant Roles

**Status:** Frozen before M6  
**Canvas:** `m5-3-authorization-audit.canvas.tsx`  
**Catalog:** `src/security/roleCatalog.ts`  
**Permissions SoT:** `src/lib/permissions.ts`

## Rules

1. Platform roles exist **only** on the platform organization (`tenant_type=platform`).
2. Tenant roles exist **only** on tenant organizations.
3. Tenant roles **never** receive `nav.admin`, `nav.billing`, or `knowledge.*`.
4. Platform access to tenant data requires **Proxy Mode** (session), not a tenant role on the platform user.
5. System roles are not customizable / not deletable.

## Seed

```bash
npm run seed:role-catalog
```

Password for all test users: `Admin@123` (override with `ROLE_CATALOG_TEST_PASSWORD`).

### Platform test users

| Email | Role |
|-------|------|
| info@syority.com | platform_super_admin |
| platform-pm@syority.test | platform_product_manager |
| platform-scheduler@syority.test | platform_master_scheduler |
| platform-support@syority.test | platform_support |
| platform-finance@syority.test | platform_finance |

### Tenant test users (demo tenant)

| Email | Role |
|-------|------|
| tenant-admin@syority.test | tenant_administrator |
| lead-planner@syority.test | lead_planner |
| planner@syority.test | planner |
| scheduler@syority.test | scheduler |
| pm@syority.test | project_manager |
| safety@syority.test | safety_officer |
| qaqc@syority.test | qa_qc_inspector |
| materials@syority.test | material_coordinator |
| viewer@syority.test | viewer |

## Knowledge Engine

| Permission | Who |
|------------|-----|
| knowledge.view | Super Admin, Product Manager, Master Scheduler, Support |
| knowledge.review | Super Admin, Product Manager, Master Scheduler |
| knowledge.admin | Super Admin, Product Manager |

Finance and all tenant roles: **denied**.

## API

- `GET /api/platform/role-catalog` — frozen catalog + permission lists (platform admin)

## Verification

See canvas checklist. Automated isolation tests:

```bash
npx vitest run src/security/__tests__/roleCatalog.isolation.test.ts
```
