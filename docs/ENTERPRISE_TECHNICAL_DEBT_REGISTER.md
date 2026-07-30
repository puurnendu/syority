# Enterprise Technical Debt Register — Pre-M8 Assessment

**Audit Date:** 2026-07-30  
**Scope:** Full codebase — Schema, Services, APIs, UI, Security, Performance, Build, Testing  
**Priority Levels:** P0 (blocker), P1 (pre-M8 must-fix), P2 (should-fix), P3 (future)

---

## Summary Dashboard

| Category | P0 | P1 | P2 | P3 | Total |
|----------|----|----|----|----|-------|
| Schema & Data | 0 | 3 | 4 | 2 | 9 |
| Code Quality | 0 | 2 | 5 | 3 | 10 |
| Architecture | 0 | 2 | 3 | 2 | 7 |
| API Standardization | 0 | 3 | 2 | 1 | 6 |
| Frontend / UI | 0 | 1 | 4 | 2 | 7 |
| Security | 0 | 2 | 2 | 1 | 5 |
| Performance | 0 | 1 | 3 | 1 | 5 |
| Testing | 0 | 3 | 1 | 0 | 4 |
| Build / DevOps | 0 | 1 | 2 | 1 | 4 |
| Documentation | 0 | 1 | 2 | 2 | 5 |
| **TOTAL** | **0** | **19** | **28** | **15** | **62** |

---

## 1. Schema & Data Debt

### TD-S001 — Dual Lessons Learned Models (P1)

**Location:** `prisma/schema.prisma` — `LessonLearned` (L2152) and `lessons_learnt` (L2178)  
**Issue:** Two overlapping models track the same domain concept. `LessonLearned` uses the M7.5+ pattern (with `is_in_central_register`, org relation). `lessons_learnt` is the legacy version (snake_case, different fields).  
**Risk:** Data fragmentation — queries must check both tables. New features risk targeting the wrong one.  
**Fix:** Migrate data from `lessons_learnt` → `LessonLearned`, then deprecate legacy table.

---

### TD-S002 — Dual Constraint Models (P1)

**Location:** `prisma/schema.prisma` — `ConstraintLog` (L1795) and `project_constraints` (L2284)  
**Issue:** `ConstraintLog` is the modern model (org-scoped, workpack-linked, AI-generated flag). `project_constraints` is legacy (string IDs, no org scope).  
**Risk:** Central Constraint Register may show incomplete data if both sources aren't queried.  
**Fix:** Verify `project_constraints` has no active usage, migrate any remaining data, remove.

---

### TD-S003 — Dual Punch Item Models (P1)

**Location:** `prisma/schema.prisma` — `PunchListItem` (L1125) and `punch_items` (L2313)  
**Issue:** Same pattern as constraints. `PunchListItem` is the modern model. `punch_items` is legacy.  
**Risk:** Punch register reports could miss data from the non-queried table.  
**Fix:** Consolidate into `PunchListItem`.

---

### TD-S004 — String ID Models (P2)

**Location:** `Permit` (L1031), `Project` (L1103), `punch_items` (L2313), `project_constraints` (L2284)  
**Issue:** These models use `String @id` without `@db.Uuid`. All modern models use UUID. This prevents foreign key references and breaks consistency.  
**Risk:** Cannot create proper relations. ORM typing inconsistencies.  
**Fix:** Migrate IDs to UUID format for any models that will persist.

---

### TD-S005 — Missing Soft Delete on Some Models (P2)

**Location:** Various — `Permit`, `ScheduleBaseline`, `ScheduleCalendar`, etc.  
**Issue:** Many models lack `deleted_at DateTime?` while all modern models have it.  
**Risk:** Accidental hard deletes; no audit trail for deletions.  
**Fix:** Add `deleted_at` to all models that represent business entities.

---

### TD-S006 — Inconsistent Naming Convention (P2)

**Location:** Schema-wide  
**Issue:** Mix of PascalCase (`SafetyLog`, `PunchListItem`) and snake_case (`cleaning_records`, `system_blinds`, `workpack_tools`) model names. Relations use both conventions.  
**Risk:** Developer confusion, inconsistent Prisma client usage.  
**Fix:** Standardize new models to PascalCase. Avoid renaming existing snake_case models (would break existing queries).

---

### TD-S007 — Schema Size (P2)

**Location:** `prisma/schema.prisma` — 4,593 lines  
**Issue:** Single monolithic schema file. Difficult to navigate, review, or split ownership.  
**Risk:** Merge conflicts during parallel development.  
**Fix:** Evaluate Prisma's `prismaSchemaFolder` preview feature to split by domain module. Low priority until Prisma stabilizes this.

---

### TD-S008 — Missing Indexes (P3)

**Location:** `SafetyIncident` (no org_id index), `SafetyPhoto` (no org_id index)  
**Issue:** Safety models lack organization_id indexes, which will affect multi-tenant query performance at scale.  
**Fix:** Add `@@index([organization_id])` to safety models.

---

### TD-S009 — Orphaned Enum Types (P3)

**Location:** `ResourceType2` (L2980), `BlindStatus`, `BlindTestType`, `BlindType`  
**Issue:** Some enums appear unused or are remnants of earlier designs. `ResourceType2` conflicts with the `ResourceType` model name.  
**Fix:** Audit enum usage, remove unused, rename `ResourceType2`.

---

## 2. Code Quality Debt

### TD-C001 — ta-dashboard.tsx Monolith (P1)

**Location:** `src/components/ta-dashboard.tsx` — 1,261 lines, 112KB  
**Issue:** Single-file demo component with hardcoded static data, inline styles, and a complete login/role system. Not production code.  
**Risk:** Often mistaken for production dashboard. Cannot be tested or maintained. Contains role system that conflicts with real RBAC.  
**Fix:** Mark as `demo/` or archive. Do NOT refactor — it was a design prototype only.

---

### TD-C002 — Safety Page Monolith (P1)

**Location:** `app/(dashboard)/safety/page.tsx` — 545 lines  
**Issue:** Single client component handling form state, API calls, photo upload, KPI computation, and rendering. No separation of concerns.  
**Risk:** Cannot extract widgets, cannot test KPI logic, difficult to maintain.  
**Fix:** Extract into: `SafetyLogForm`, `SafetyKPICards`, `SafetyIncidentList`, `SafetyPhotoGallery`.

---

### TD-C003 — Inline Prisma Queries in API Routes (P2)

**Location:** `app/api/events/[eventId]/safety/route.ts` and ~30 other API routes  
**Issue:** Prisma queries are written directly in API route handlers instead of calling service classes.  
**Risk:** Business logic duplication, cannot test without HTTP, violates the architecture pattern used by core modules.  
**Fix:** Progressively migrate to service-layer pattern (as done in `src/core/*`).

---

### TD-C004 — Type Safety — `any` Usage (P2)

**Location:** Throughout — `session.user as any`, `const user = session.user as any`  
**Issue:** Extensive use of `any` type for session user object. No typed session interface.  
**Risk:** Type errors at runtime, no IDE assistance, easy to misuse fields.  
**Fix:** Create `SessionUser` interface and type the session correctly.

---

### TD-C005 — Missing Error Boundaries (P2)

**Location:** `app/(dashboard)/` pages  
**Issue:** Only one ErrorBoundary component exists (`src/components/ui/ErrorBoundary.tsx`). Most pages don't use it.  
**Risk:** Unhandled errors crash the entire dashboard layout.  
**Fix:** Add error boundaries around each major page section.

---

### TD-C006 — Console Warnings in Providers (P2)

**Location:** `src/core/report-engine/providers/ProviderRegistry.ts` — `console.warn`  
**Issue:** `console.warn` used for duplicate provider registration. No structured logging.  
**Risk:** Warnings lost in production logs.  
**Fix:** Integrate with a structured logger (low priority).

---

### TD-C007 — Magic Strings (P2)

**Location:** API routes, permissions, status values  
**Issue:** Status values like `"pending"`, `"completed"`, `"Open"` are string literals throughout. Some are enums, some aren't.  
**Risk:** Typos cause silent failures. Inconsistent casing (`"Open"` vs `"open"`).  
**Fix:** Create const enums or string literal union types for all status fields.

---

### TD-C008 — Unused Imports (P3)

**Location:** Various files  
**Issue:** Some files import modules that are not used (common in iterative development).  
**Fix:** Run ESLint with `no-unused-imports` rule.

---

### TD-C009 — Duplicate Helper Functions (P3)

**Location:** Multiple API route files  
**Issue:** `ensureEventAccess()` is duplicated across safety API routes.  
**Fix:** Extract to shared utility: `src/lib/entityAccess.ts`.

---

### TD-C010 — Inconsistent Date Handling (P3)

**Location:** Safety API routes, report generation  
**Issue:** Mix of `new Date()`, `new Date(dateParam)`, and `logDate.setHours(0,0,0,0)`. No timezone-aware date library.  
**Risk:** Timezone bugs in multi-timezone deployments.  
**Fix:** Standardize on `dayjs` or `date-fns` with timezone support.

---

## 3. Architecture Debt

### TD-A001 — No Safety Service Layer (P1)

**Location:** `src/core/` — no `safety/` directory  
**Issue:** Safety module has NO service layer. All logic is in API routes. Every other domain (notifications, reports, planner, shutdown-scope, engineering-issues) has a dedicated `src/core/{module}/` service layer.  
**Risk:** Cannot reuse safety logic in report providers, cannot test, violates architecture pattern.  
**Fix:** Create `src/core/safety/SafetyService.ts` wrapping the API route logic.

---

### TD-A002 — No Safety Report Data Provider (P1)

**Location:** `src/core/report-engine/providers/` — no safety provider  
**Issue:** All other domains have report data providers. Safety does not. This means:
- Safety reports cannot be generated via the Enterprise Report Engine
- Safety KPIs cannot be widgetized in OIS
- Safety data cannot be included in scheduled reports  
**Risk:** Safety reporting must remain manual; blocks M7.6C safety dashboard.  
**Fix:** Create `SafetyProviders.ts` with providers: `safety.daily_log`, `safety.incident_register`, `safety.kpi_summary`, `safety.trend`.

---

### TD-A003 — API Guard Permission Mismatch (P2)

**Location:** `src/lib/permissions.ts` vs API routes  
**Issue:** Safety API routes use `guardApi('safety.view')` and `guardApi('safety.log')`, but `safety.view` and `safety.log` are NOT defined as `Permission` types in `permissions.ts`. They work via string passthrough but aren't in the type system.  
**Risk:** No compile-time verification of permission strings. Typos would silently fail open.  
**Fix:** Add `safety.view`, `safety.log`, `safety.edit` to the Permission union type.

---

### TD-A004 — Mixed CamelCase/snake_case API Responses (P2)

**Location:** Safety API returns camelCase (Prisma default), some legacy APIs return snake_case  
**Issue:** Frontend must handle both conventions.  
**Fix:** Standardize all API responses to camelCase (Prisma default behavior).

---

### TD-A005 — No Shared Widget Component Library (P2)

**Location:** `src/components/Dashboard/` — individual files, not a framework  
**Issue:** Chart components (`SCurveChart`, `ConstraintHeatmap`, etc.) exist but are not structured as a reusable widget library. They're tightly coupled to the PortfolioDashboard's state management.  
**Fix:** Create `src/components/widgets/` with standardized props interface: `{ data, config, loading, error }`.

---

### TD-A006 — Redis/BullMQ Lazy Init Not Implemented (P3)

**Location:** Referenced in M7.5.1 Production Hardening (NOT STARTED)  
**Issue:** Redis/BullMQ connections are initialized at import time, causing build-time errors in environments without Redis.  
**Fix:** Implement lazy initialization pattern.

---

### TD-A007 — No Event Bus / Pub-Sub Pattern (P3)

**Location:** System-wide  
**Issue:** Notification rules trigger on event types (e.g., `workpack.approved`) but there's no formal event bus. Events are dispatched ad-hoc from service methods.  
**Fix:** Implement a simple in-process event emitter pattern for decoupling.

---

## 4. API Standardization Debt

### TD-API001 — Inconsistent Response Envelope (P1)

**Location:** All API routes  
**Issue:** Some routes return `{ data: [...] }`, some return `{ logs: [...], stats: {...} }`, some return raw arrays. No standard envelope.  
**Fix:** Standardize: `{ data: T, meta?: { total, page, limit }, error?: string }`.

---

### TD-API002 — Missing Pagination (P1)

**Location:** Safety logs, constraints, punch items, engineering issues  
**Issue:** Most list APIs return all records without pagination. At scale (10,000+ safety logs), this causes performance issues.  
**Fix:** Add `?page=1&limit=50` support to all list endpoints.

---

### TD-API003 — No Rate Limiting (P1)

**Location:** All API routes  
**Issue:** No rate limiting on any API endpoint.  
**Risk:** Abuse, DoS, accidental infinite loops from frontend.  
**Fix:** Add rate limiting middleware (Next.js middleware or per-route).

---

### TD-API004 — Inconsistent Error Responses (P2)

**Location:** Various API routes  
**Issue:** Some return `{ error: 'message' }`, some return `{ message: 'text' }`, some return plain strings.  
**Fix:** Standardize error responses: `{ error: { code: string, message: string } }`.

---

### TD-API005 — Missing Input Validation (P2)

**Location:** Safety POST, report generation POST  
**Issue:** Minimal input validation. `body.lti ?? 0` accepts any type. No zod/yup schema validation.  
**Fix:** Add zod schema validation to all POST/PATCH endpoints.

---

### TD-API006 — No API Versioning (P3)

**Location:** `app/api/`  
**Issue:** No API versioning strategy. All routes are v1 implicitly.  
**Fix:** Not urgent — plan for `/api/v2/` when breaking changes are needed.

---

## 5. Frontend / UI Debt

### TD-UI001 — Large Bundle Size from ta-dashboard.tsx (P1)

**Location:** `src/components/ta-dashboard.tsx` — 112KB  
**Issue:** If imported anywhere, this file adds 112KB to the client bundle despite being a demo.  
**Risk:** Page load performance degradation.  
**Fix:** Move to `demo/` directory or dynamically import only when explicitly needed.

---

### TD-UI002 — Inline Styles in Components (P2)

**Location:** `ta-dashboard.tsx`, `safety/page.tsx`, various components  
**Issue:** Extensive use of inline `style={{...}}` objects instead of CSS classes or utility classes.  
**Risk:** No caching, no theming, difficult to maintain.  
**Fix:** Migrate to CSS modules or Tailwind classes (project appears to use both).

---

### TD-UI003 — No Loading States for Dashboard Widgets (P2)

**Location:** `PortfolioDashboard.tsx`, `safety/page.tsx`  
**Issue:** API-dependent sections show nothing while loading. No skeleton screens or loading indicators for individual sections.  
**Fix:** Add skeleton loading states per widget section.

---

### TD-UI004 — No Empty States (P2)

**Location:** Various dashboard pages  
**Issue:** When no data exists (new tenant, no events), pages show blank areas with no guidance.  
**Fix:** Add empty state illustrations with onboarding CTAs.

---

### TD-UI005 — Accessibility Gaps (P2)

**Location:** Chart components, interactive grids  
**Issue:** Recharts components lack `aria-label` attributes. Grid cells lack keyboard navigation.  
**Fix:** Add ARIA labels, keyboard handlers, and focus management.

---

### TD-UI006 — No Dark Mode Support (P3)

**Location:** All pages  
**Issue:** Application is light-mode only (except the demo ta-dashboard which is dark). No CSS custom property system for theming.  
**Fix:** Add CSS custom properties for theme tokens (future).

---

### TD-UI007 — No Responsive Breakpoint System (P3)

**Location:** Dashboard pages  
**Issue:** Pages use basic responsive classes but no systematic breakpoint system for widget grids.  
**Fix:** Design responsive grid system when implementing Dashboard Builder.

---

## 6. Security Debt

### TD-SEC001 — Unsafe Permission String Passthrough (P1)

**Location:** `src/lib/apiGuard.ts`, `src/lib/permissions.ts`  
**Issue:** `guardApi()` accepts any string as a permission, even if it's not defined in the `Permission` type. The function works because it uses a raw string comparison, not the type system.  
**Risk:** A misspelled permission like `guardApi('safty.view')` would silently deny access to all users without compile-time error.  
**Fix:** Make `guardApi()` accept only `Permission` typed values.

---

### TD-SEC002 — Encrypted Fields in Schema (P1)

**Location:** `notification_providers.smtp_password_enc`, `notification_providers.api_key_enc`  
**Issue:** Schema comments indicate these should be encrypted via `@/lib/encryption`, but no audit has verified the encryption is applied consistently.  
**Risk:** Plaintext credentials in database.  
**Fix:** Audit encryption implementation, add unit test to verify.

---

### TD-SEC003 — No CSRF Protection (P2)

**Location:** API routes  
**Issue:** No CSRF token validation on mutation endpoints.  
**Risk:** Cross-site request forgery attacks.  
**Fix:** Add CSRF middleware for non-GET routes.

---

### TD-SEC004 — Session User Type Not Validated (P2)

**Location:** `session.user as any` — all API routes  
**Issue:** Session user object is cast to `any` and individual fields are accessed without validation.  
**Risk:** If session shape changes, runtime errors instead of compile-time.  
**Fix:** Create and validate `SessionUser` interface.

---

### TD-SEC005 — No Audit Log for Security Events (P3)

**Location:** `SystemAuditLog` exists but is only for admin actions  
**Issue:** No audit logging for: failed login attempts, permission denied events, data export events.  
**Fix:** Extend audit logging to cover security-relevant events.

---

## 7. Performance Debt

### TD-PERF001 — Unpaginated Safety Logs (P1)

**Location:** `app/api/events/[eventId]/safety/route.ts` — GET handler  
**Issue:** Returns ALL safety logs for an event with includes. For long turnarounds (90+ days), this could return 90+ logs with all incidents and photos.  
**Fix:** Add pagination: `?page=1&limit=30`.

---

### TD-PERF002 — RollupEngine Full Table Scan (P2)

**Location:** `src/core/planner-workspace/RollupEngine.ts`  
**Issue:** `computeEventRollups()` loads ALL workpacks for an event with deeply nested includes. For events with 500+ workpacks, this is expensive.  
**Fix:** Add caching layer or pre-computed rollup table.

---

### TD-PERF003 — No Database Connection Pooling Config (P2)

**Location:** `src/lib/prisma.ts`  
**Issue:** No explicit connection pool size configuration for Prisma.  
**Fix:** Set `connection_limit` in DATABASE_URL or Prisma config.

---

### TD-PERF004 — No CDN/Static Asset Caching (P2)

**Location:** Build/deploy configuration  
**Issue:** Logo images, branding assets served from application server without CDN.  
**Fix:** Configure static asset caching headers and consider CDN for logos.

---

### TD-PERF005 — Large Component Files (P3)

**Location:** `UserPreferencesModal.tsx` (44.8KB), `ta-dashboard.tsx` (112KB)  
**Issue:** Very large component files increase bundle size and parsing time.  
**Fix:** Code-split large components. Dynamic import for modals.

---

## 8. Testing Debt

### TD-TEST001 — No Unit Tests (P1)

**Location:** No `__tests__/`, `*.test.ts`, or `*.spec.ts` files found  
**Issue:** Zero test files in the codebase. RollupEngine, ValidationEngine, ProviderRegistry, NotificationRuleEngine — all untested.  
**Risk:** Regressions from any change. Cannot verify behavior.  
**Fix:** Add unit tests for core services, starting with RollupEngine and ProviderRegistry.

---

### TD-TEST002 — No Integration Tests (P1)

**Location:** No test framework configured  
**Issue:** No API route tests. CRUD operations for safety, reports, notifications untested.  
**Fix:** Configure Jest + supertest (or Vitest). Add API route tests.

---

### TD-TEST003 — No E2E Tests (P1)

**Location:** No Playwright/Cypress configuration  
**Issue:** No end-to-end test coverage for critical flows (login, workpack creation, safety logging).  
**Fix:** Configure Playwright. Add smoke tests for critical paths.

---

### TD-TEST004 — No Schema Validation Tests (P2)

**Location:** No migration tests  
**Issue:** Schema changes are not tested against existing data. No migration rollback tests.  
**Fix:** Add migration validation in CI pipeline.

---

## 9. Build / DevOps Debt

### TD-BUILD001 — Redis Connection at Build Time (P1)

**Location:** Referenced in M7.5.1 Production Hardening  
**Issue:** Redis/BullMQ connections attempted during `next build`, causing failures in CI environments without Redis.  
**Risk:** Cannot build without Redis running.  
**Fix:** Lazy-initialize Redis connections (M7.5.1 scope).

---

### TD-BUILD002 — No CI/CD Pipeline Definition (P2)

**Location:** No `.github/workflows/`, no `Dockerfile`, no deploy scripts in repo  
**Issue:** No automated build/test/deploy pipeline.  
**Fix:** Add CI workflow with lint + type-check + build.

---

### TD-BUILD003 — No Environment Variable Validation (P2)

**Location:** No `.env.example` or env validation library  
**Issue:** Required environment variables not documented or validated at startup.  
**Fix:** Add zod env validation or `@t3-oss/env-nextjs`.

---

### TD-BUILD004 — No Database Migration CI Check (P3)

**Location:** Prisma migrations  
**Issue:** No CI step to verify pending migrations or schema drift.  
**Fix:** Add `prisma migrate status` to CI pipeline.

---

## 10. Documentation Debt

### TD-DOC001 — No API Documentation (P1)

**Location:** 52 API route groups with no documentation  
**Issue:** No OpenAPI/Swagger spec. No request/response examples. No postman collection.  
**Fix:** Generate OpenAPI spec from route definitions. Add to `docs/api/`.

---

### TD-DOC002 — Outdated Architecture Docs (P2)

**Location:** `docs/FEATURE_SPEC_v1.md` (58KB)  
**Issue:** Feature spec hasn't been updated since M6. Doesn't reflect M7.x changes.  
**Fix:** Create `docs/ARCHITECTURE.md` with current system overview.

---

### TD-DOC003 — No Data Dictionary (P2)

**Location:** Schema comments are sparse  
**Issue:** Many schema fields lack descriptions. New developers cannot understand field purposes.  
**Fix:** Add `/// @description` comments to all non-obvious fields.

---

### TD-DOC004 — No Onboarding Guide (P3)

**Location:** No `CONTRIBUTING.md` or `docs/DEVELOPMENT.md`  
**Issue:** No developer onboarding documentation.  
**Fix:** Create development setup guide.

---

### TD-DOC005 — ADR Directory Incomplete (P3)

**Location:** `docs/adr/` — only ADR-0012 observed  
**Issue:** Many architecture decisions (notification platform, report engine, provider registry) are not documented as ADRs.  
**Fix:** Backfill ADRs for key decisions.

---

## Priority Matrix — Pre-M8 Must-Fix Items

| ID | Title | Category | Effort |
|----|-------|----------|--------|
| TD-S001 | Dual Lessons Learned Models | Schema | 2 hrs |
| TD-S002 | Dual Constraint Models | Schema | 2 hrs |
| TD-S003 | Dual Punch Item Models | Schema | 2 hrs |
| TD-C001 | ta-dashboard.tsx Monolith | Code | 1 hr (move to demo/) |
| TD-C002 | Safety Page Decomposition | Code | 4 hrs |
| TD-A001 | No Safety Service Layer | Architecture | 4 hrs |
| TD-A002 | No Safety Report Provider | Architecture | 3 hrs |
| TD-API001 | Response Envelope Standard | API | 4 hrs |
| TD-API002 | Missing Pagination | API | 4 hrs |
| TD-API003 | No Rate Limiting | API | 2 hrs |
| TD-SEC001 | Permission String Safety | Security | 2 hrs |
| TD-SEC002 | Encryption Audit | Security | 2 hrs |
| TD-UI001 | Bundle Size from demo | Frontend | 1 hr |
| TD-PERF001 | Unpaginated Safety Logs | Performance | 2 hrs |
| TD-TEST001 | Unit Tests | Testing | 8 hrs |
| TD-TEST002 | Integration Tests | Testing | 8 hrs |
| TD-TEST003 | E2E Tests | Testing | 8 hrs |
| TD-BUILD001 | Redis Build-Time Init | Build | 3 hrs |
| TD-DOC001 | API Documentation | Documentation | 8 hrs |

**Total P1 effort: ~70 hours (≈9 engineering days)**

---

> [!WARNING]
> **TD-TEST001/002/003** (zero test coverage) is the highest-risk debt item. Without tests, every M8 feature risks introducing regressions in existing M7.x functionality. Testing infrastructure should be the FIRST pre-M8 investment.

> [!TIP]
> **Quick wins** that take <2 hours: TD-C001 (move demo file), TD-UI001 (same), TD-A003 (add permission types), TD-SEC001 (type safety fix).
