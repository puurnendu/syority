# Aurianoa OS — Platform vs Tenant Segregation

**Milestone 3 architecture foundation**  
Comparable targets: Primavera Unifier, Maximo, Hexagon SDx, Microsoft 365 Admin Center.

---

## 1. Architecture diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         AURIANOA OS                             │
│                     (single codebase)                           │
├──────────────────────┬──────────────────────┬───────────────────┤
│      PLATFORM        │       TENANT         │       PROXY       │
│   Scope.PLATFORM     │    Scope.TENANT      │   Scope.PROXY     │
│                      │                      │                   │
│  Syority employees   │  Customer org        │  Platform support │
│  /platform/*         │  /(dashboard)/*      │  cookie + audit   │
│  /platform-data/*    │  /settings/*         │  "Viewing as X"   │
│  AI providers        │  Planning/Execution  │                   │
│  SMTP / billing      │  Workpacks / Safety  │                   │
│  Feature flags       │  Tenant license      │                   │
└──────────────────────┴──────────────────────┴───────────────────┘
           │                      │                    │
           ▼                      ▼                    ▼
   src/security/*          src/security/*        syority_proxy
   guardPlatformApi        guardTenantApi        ENTER/EXIT audited
```

Central modules:

| Module | Path |
|--------|------|
| Scopes | `src/security/scopes.ts` |
| Route registry | `src/security/routeRegistry.ts` |
| Navigation metadata | `src/security/navigation.ts` |
| Access evaluation | `src/security/access.ts` |
| API guards | `src/security/apiGuards.ts` |
| Barrel | `src/security/index.ts` |

---

## 2. Navigation map

### Platform (`PLATFORM_NAV`)
Dashboard equivalents → Tenants · Onboarding · Licensing/Billing · Platform Users · AI Providers · SMTP/System · Feature Flags · Setup · Global Master Data hub

### Tenant shell
Dashboard · Planning · Execution · Intelligence · Documents · Safety · Import/Export · Organization · Settings

### Tenant settings (`TENANT_SETTINGS_NAV`)
My Profile · Notifications · Organization Profile · Users · Roles · Sites · Plants · Responsibility Matrix · License · Integrations · SSO · Audit Logs · AI Usage (prompts/logs only) · WhatsApp · Calendars · Certificate Templates · Clearance Parties · Item Catalog

**Removed from tenant menus:** AI Configuration (providers), System Settings (SMTP), Platform Features, Platform Billing, Platform-data master data.

---

## 3. Permission matrix (high level)

| Permission | Platform roles | Tenant org_admin / super_admin | Notes |
|------------|----------------|--------------------------------|-------|
| `nav.admin` | ✓ | ✗ (removed from `super_admin`) | Platform console only |
| `nav.billing` | ✓ | ✗ | Platform billing |
| `settings.*` | ✓ (for proxy) | ✓ tenant-scoped | |
| `settings.ai.*` | ✓ platform providers | Tenant: usage pages only | Providers UI is platform |
| Workpack / events / safety | Via proxy | ✓ | |

---

## 4. Route matrix (selected)

| Path | Scope | Expected |
|------|-------|----------|
| `/platform/*` | PLATFORM | Platform only |
| `/platform-data/*` | PLATFORM | Platform only |
| `/dashboard/ai-config` | PLATFORM | Blocked for tenants → `/settings` |
| `/settings/system` | PLATFORM | Blocked for tenants → `/settings` |
| `/settings/*` (other) | TENANT | Tenant + proxy |
| `/workpacks`, `/events`, … | TENANT | Tenant + proxy |

Full list: `src/security/routeRegistry.ts`

---

## 5. API matrix (critical)

| API | Guard | Before | After |
|-----|-------|--------|-------|
| `/api/admin/tenants*` | `guardPlatformApi` | Tenant `super_admin` could pass | Platform only |
| `/api/admin/onboarding` | `guardPlatformApi` | Same | Platform only |
| `/api/admin/users/*/reset-password` | `guardPlatformApi` | Same | Platform only |
| `/api/admin/email/test` | `guardPlatformApi` | Same | Platform only |
| `/api/admin/backfill-activity-codes` | `guardPlatformApi` | Same | Platform only |
| `/api/admin/role-check` | `guardPlatformApi` + 410 | **Unauthenticated** | Disabled |
| `/api/admin/features*`, billing stats | Explicit platform roles | OK | Unchanged |
| `/api/settings/*` | `guardApi` / tenant | Tenant org scoped | Unchanged pattern |
| `/api/proxy/enter` | Platform + tenant validate + audit | No UI | Audited + UI |
| `/api/proxy/exit` | Platform + audit | Unauthenticated clear | Auth + audit |

---

## 6. Pages requiring changes (status)

| Page | Action | Status |
|------|--------|--------|
| Settings nav | Metadata-driven tenant-only | **Done** |
| Dashboard layout | Remove platform-data from tenant | **Done** |
| Platform layout | Driven by `PLATFORM_NAV` | **Done** |
| Tenant detail | Enter Proxy Mode button | **Done** |
| `/dashboard/ai-config` | Registry PLATFORM — middleware blocks tenants | **Done** |
| `/settings/system` | Registry PLATFORM — middleware blocks tenants | **Done** |
| Approval Matrix page | Not built yet | Future |
| Platform Branding / Storage / Backups pages | Missing product pages | Future (nav placeholders via system) |

---

## 7. Components requiring changes

| Component | Change | Status |
|-----------|--------|--------|
| `SettingsNavItems.tsx` | `TENANT_SETTINGS_NAV` only | Done |
| `GlobalBreadcrumb` | “Viewing as {tenant}” | Done |
| `NavBar` | Exit proxy (existing) | Kept |
| `TenantDetailClient` | Enter proxy | Done |
| Future: `<Can scope permission>` HOC | Component-level | Phase 2 |

---

## 8. Dead / stale pages

| Item | Notes |
|------|-------|
| `/admin/*` UI | No `app/admin` tree — links updated to `/platform/*` |
| `SettingsSidebar.tsx` | Legacy unused sidebar |
| `/platform-data/.../item-catalog` | Missing; use `/settings/items` for tenant catalog |
| `/api/admin/role-check` | Disabled (410) |

---

## 9. Duplicate pages

| Capability | Platform | Tenant | Resolution |
|------------|----------|--------|------------|
| AI providers | `/platform/ai-config` | `/dashboard/ai-config` | Tenant blocked; platform owns providers |
| System/SMTP | `/platform/system` | `/settings/system` | Tenant blocked |
| Certificate templates | `/platform-data/...` | `/settings/certificate-templates` | Global vs tenant override — keep both with scopes |
| Billing | `/platform/billing` | `/settings/subscription` | Global vs license view — correct split |

---

## 10. Security issues found & fixed

1. **CRITICAL:** `guardApi` treated tenant `super_admin` / `is_super_admin` as full bypass → could call platform tenant APIs. **Fixed.**
2. **CRITICAL:** `/api/admin/role-check` unauthenticated privilege escalation. **Disabled.**
3. **HIGH:** Tenant menus linked AI Configuration & System Settings. **Removed + middleware blocked.**
4. **HIGH:** Tenant shell exposed `/platform-data/*`. **Removed.**
5. **HIGH:** No UI for proxy enter. **Added + audited.**
6. **MEDIUM:** `nav.admin` on tenant `super_admin` role map. **Removed.**

---

## 11. Implementation plan (phased)

### Phase 1 — Foundation (this milestone) ✅
- Security domains + route/nav metadata
- Middleware registry enforcement
- Platform API hardening
- Tenant menu cleanup
- Proxy enter/exit audit

### Phase 2 — Full metadata migration
- Migrate all tenant APIs to `guardTenantApi`
- Add `<Can>` / `useCan()` for buttons/widgets
- Declare `requiredScope` on every route page export
- Delete dead SettingsSidebar / stale links

### Phase 3 — Product completeness
- Platform pages: Branding, Storage, Backups, Monitoring, Support tickets, Platform Audit UI
- Tenant Approval Matrix
- Redis-backed rate limits; MFA

---

## 12. Migration strategy

1. Deploy Phase 1 with Docker rebuild (middleware + security modules are build-time).
2. Communicate: tenant admins lose AI provider & System Settings menus (by design).
3. Platform support uses **Enter Proxy Mode** on tenant detail; banner shows **Viewing as {Tenant}**.
4. After deploy, verify:
   - Tenant org_admin: `/platform/tenants` → `/dashboard`; `/dashboard/ai-config` → `/settings`
   - Tenant cannot `GET /api/admin/tenants` (403)
   - Platform can enter proxy and open `/workpacks`
5. Do not re-introduce hardcoded menus — extend `src/security/navigation.ts` and `routeRegistry.ts` only.

---

## Success criteria checklist

| Criterion | Status |
|-----------|--------|
| Platform Admin sees only platform features in platform shell | ✅ |
| Tenant Admin sees only tenant features | ✅ (nav + MW) |
| Proxy mode explicit + audited | ✅ |
| URL access without auth rejected | ✅ (MW + API) |
| No menu without permission metadata | ✅ settings; shell still hybrid → Phase 2 |
| Future modules inherit architecture | ✅ via `src/security/*` |
