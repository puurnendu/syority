# Aurianoa OS — Milestone 4
# Identity, Authorization & Access Control

**Status:** Intermediate architecture implemented (safe, non-breaking)  
**SoT:** `UserRole` → `Role.slug` → `resolveAuthorization()` → Scope + Permissions

---

## 1. Architecture diagram

```
┌────────────────────────────────────────────────────────────┐
│                     IDENTITY (who)                         │
│  User.id · email · name · organization_id · status         │
└──────────────────────────┬─────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────┐
│              AUTHORIZATION (what / where)                  │
│  UserRole → Role.slug → resolveRoleSlug()                  │
│       │                                                    │
│       ├─► Scope: PLATFORM | TENANT                         │
│       │     (PROXY = session cookie, not a user property)  │
│       │                                                    │
│       └─► Permissions: hasPermission(role, perm)           │
│             Module.Feature.Operation                       │
└──────────────────────────┬─────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
   Middleware          API Guards         UI <Can>
   (auth+scope)     guardPlatformApi    permissions
                    guardTenantApi
```

**Eliminated as SoT:** `User.is_super_admin`, `User.is_tenant_admin`, CASL `ability.ts`, hardcoded role name checks.

**Retained as derived JWT fields** (compat): `is_super_admin`, `is_tenant_admin` — computed from roles at login, not from DB columns.

---

## 2. Database diagram (current → target)

### Current (intermediate — no breaking migration)

```
Organization (customer OR platform org)
    │
User ── organization_id (REQUIRED today)
    │
UserRole ── Role (slug, org-scoped)
```

### Target (future migration)

```
Organization (customers only)
User.organization_id  NULLABLE   ← platform users have NULL
Role.scope            PLATFORM | TENANT
Permission            catalog table
RolePermission        M:N
ProxySession          audited impersonation rows
```

**Flags `is_super_admin` / `is_tenant_admin`:**  
Kept in schema for backward-compatible columns; **ignored as SoT**. Justify retention: avoid destructive Prisma migration mid-flight; UI/scripts may still read columns. Auth no longer trusts them.

---

## 3. Authorization flow

```
Login
  → load User + user_roles.role
  → resolveAuthorization()
  → JWT { sub, organization_id, scope, roles[], role_ids[], derived flags }
Request
  → Middleware: authentication + scope/registry (no business perms)
  → API: guardPlatformApi | guardTenantApi | guardApi(legacy)
  → UI: hasPermission / <Can permission>
```

---

## 4. JWT flow

| Claim | Source | Mutable? |
|-------|--------|----------|
| `sub` / `id` | User.id | No |
| `organization_id` | User.organization_id | Proxy may override in API layer |
| `scope` | Derived from roles | No until re-login |
| `roles[]` | Role.slug normalized | No until re-login |
| `role_ids[]` | Role.id | No until re-login |
| `role` | primaryRole | Compat |
| `is_super_admin` / `is_tenant_admin` | **Derived** | Compat only |
| `must_change_password` | User column | Cleared on change + signOut |

After password change: `signOut` → fresh JWT (Milestone 3).

---

## 5. Permission matrix (summary)

| Role (canonical) | Scope | Key capabilities |
|------------------|-------|------------------|
| `platform_super_admin` | PLATFORM | Full platform + nav.admin/billing |
| `platform_admin` | PLATFORM | Platform ops |
| `tenant_administrator` | TENANT | Full tenant settings + ops (**replaces "super-admin"**) |
| `super_admin` | TENANT | **Alias** → same perms as tenant_administrator |
| `org_admin` | TENANT | Full tenant except AI provider settings |
| `planner` | TENANT | Planning / workpacks |
| `workpack_manager` | TENANT | Execution |
| `engineer` | TENANT | Edit workpacks |
| `viewer` | TENANT | Read |

Aliases: `super-admin` / `super_admin` → `tenant_administrator` via `resolveRoleSlug()`.

---

## 6. Route matrix

Unchanged from Milestone 3 registry (`src/security/routeRegistry.ts`):

- `/platform/*`, `/platform-data/*`, `/dashboard/ai-config`, `/settings/system` → PLATFORM  
- Tenant ops + settings → TENANT (+ PROXY for platform staff)

---

## 7. API matrix

| Guard | Use |
|-------|-----|
| `guardPlatformApi` | `/api/admin/tenants*`, onboarding, email test, backfill, password reset |
| `guardTenantApi` | **Preferred** for new tenant APIs (stricter) |
| `guardApi` | Legacy tenant APIs — permission map only; **no flag bypass** |

---

## 8. Migration report

| Phase | State |
|-------|-------|
| **Current → Intermediate** | ✅ Implemented |
| Role SoT | UserRole.slug |
| Scope in JWT | ✅ |
| Flag bypass removed from guardApi | ✅ |
| CASL deprecated | ✅ |
| First-org role slug | `tenant_administrator` |
| Platform bootstrap | `npm run seed:platform-admin` |
| **Intermediate → Final** | Pending |
| Nullable User.organization_id | Schema migration |
| Permission catalog tables | Schema + seed |
| Migrate all guardApi → guardTenantApi | Incremental |
| Drop is_* columns | After zero readers |
| Rename DB slugs `super-admin` → `tenant_administrator` | Data migration |

---

## 9. Files modified

| File | Change |
|------|--------|
| `src/security/identity.ts` | **New** — resolveAuthorization |
| `src/lib/permissions.ts` | Canonical roles + aliases + tenant_administrator |
| `src/lib/auth.ts` | JWT from resolver; scope + role_ids |
| `src/lib/apiGuard.ts` | Removed is_tenant_admin bypass |
| `src/lib/ability.ts` | Deprecated stub |
| `src/security/index.ts` | Export identity |
| `src/types/next-auth.d.ts` | scope, roles, role_ids |
| `src/components/auth/Can.tsx` | **New** component guard |
| `app/login/actions.ts` | Creates `tenant_administrator` |
| `prisma/seed-platform-admin.ts` | **New** bootstrap |
| `package.json` | `seed:platform-admin` |
| `docs/IDENTITY_AUTHORIZATION.md` | This document |

---

## 10. Technical debt removed

1. Competing SoT (flags vs roles) → roles win; flags derived  
2. CASL dead path marked deprecated  
3. Tenant flag bypass in `guardApi` removed  
4. Terminology: tenant “super-admin” → **Tenant Administrator**  
5. Platform bootstrap without promoting tenant admins  

**Remaining debt:** ~100 APIs still on `guardApi`; `Role.permissions` JSON unused; hyphen slugs in old seeds; documents uppercase role checks; `User.organization_id` required for platform users.

---

## Platform bootstrap

```bash
# From host (DB on localhost:5433)
$env:DATABASE_URL='postgresql://user:pass@127.0.0.1:5433/syority?schema=public'
npm run seed:platform-admin
```

Creates:
- Org `Syority Platform` (`tenant_type=platform`)
- Role `platform_super_admin`
- User `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD`

Login → `/platform/tenants`. Never shares customer tenant admin role.

---

## Verification matrix (expected)

| Actor | Scope | Pages | APIs |
|-------|-------|-------|------|
| Platform Admin | PLATFORM | `/platform/*` | `guardPlatformApi` |
| Tenant Administrator (`tenant_administrator` / aliased `super_admin`) | TENANT | settings + ops | tenant guards; **not** `/api/admin/tenants` |
| Planner | TENANT | planning | workpack perms |
| Viewer | TENANT | read-only | view perms |
| Proxy | PROXY session | tenant pages + “Viewing as …” | tenant org override + audit |
