# AURIANOA-STO — SYSTEM-WIDE FORENSIC USABILITY AUDIT

**Audit type:** Forensic, evidence-only, read-only
**Scope:** Whole application as a usable enterprise product
**Repository:** `c:\DEV\STO`
**Branch:** `develop`
**Git HEAD at audit time:** `6e45b54` (2026-08-01) — *see D-003, the working tree diverges heavily from HEAD*
**Last production build artefact:** `.next/BUILD_ID = MwKeNX53a4mhH0O0s1gnb`, dated 2026-09-01
**Audit date:** 2026-09-08

**Nothing in this audit was fixed, modified, or refactored.** No product code, route, schema, API, or UI file was changed. The only file this audit added to the repository is this document. Temporary evidence files used during collection were removed; every measurement below is reproducible with the commands cited.

---

## 0. VERIFICATION BASIS AND ITS LIMITS (read this first)

This section exists because the audit brief demands that uncertainty not be hidden.

| Verification method | Status | Notes |
|---|---|---|
| Static route enumeration | **DONE** | Filesystem walk of `app/**/page.tsx` |
| Static navigation-target resolution | **DONE** | Nav configs + `Link`/`router.push` extraction |
| TypeScript compilation | **DONE** | `npx tsc --noEmit` executed, exit code 2 |
| Dependency resolution check | **DONE** | `package.json` + `node_modules` probes |
| Git reproducibility check | **DONE** | `git status --porcelain -uall`, `git ls-files` |
| Design-token / theme inventory | **DONE** | Config + CSS + occurrence counting over 490 UI files |
| Accessibility signal inventory | **DONE** | Occurrence counting over 490 UI files |
| **Runtime page load of any route** | **NOT DONE — BLOCKED** | No browser-automation tool available in this environment |
| **Screenshot / visual review** | **NOT DONE — BLOCKED** | Same reason |
| **Interactive click-through of controls** | **NOT DONE — BLOCKED** | Same reason |
| **Contrast / rendered-layout measurement** | **NOT DONE — BLOCKED** | Requires a rendering engine |

**Evidence that runtime verification was impossible, not merely skipped:** no browser/navigate/screenshot tool exists in the available toolset, and no server was listening on `localhost:3000` at audit time (TCP probe returned `False`). No dev server was started, because starting one and mutating state was outside the read-only mandate.

**Consequence you must accept when reading this report:** every finding below is derived from source-code evidence with file and line citations. Defect classes that are *only* observable at runtime — React hydration mismatches, actual visual overflow, real colour contrast, chart rendering failures, genuinely rendered 404 pages, focus behaviour — are **UNVERIFIED**. Where a finding depends on runtime behaviour I have said so explicitly and named the exact command or action that would confirm it. I have not converted any inference into a claim of fact.

---

## 1. EXECUTIVE SUMMARY

**Verdict: the application is NOT currently usable as a complete enterprise product, and it is NOT currently deployable in a reproducible way.**

The codebase is large and, in its core planning and execution engines, substantially real — 193 routes, 631 API route handlers, genuine CPM scheduling, genuine Prisma-backed data. This is not a mock-up. The failure is not one of missing engineering volume. It is a failure of **assembly**: modules that were built to completion were never wired into the product a user actually touches, and the repository no longer contains the application that exists on this developer's disk.

Five findings block release outright:

1. **The first screen a new user reaches is a 404.** `app/page.tsx:19` and `app/login/LoginForm.tsx:79` both send the user to `/admin/setup`. That route does not exist anywhere in the application. The real page is `/platform/setup`. On any installation where system readiness is false — that is, every fresh install — login terminates on the global not-found page. `/workpacks` does the same via `app/(dashboard)/workpacks/layout.tsx:14`.

2. **The Dashboard's "Admin Panel" button is a 404.** `app/(dashboard)/dashboard/page.tsx:86` links to `/admin/tenants`; the real route is `/platform/tenants`. An `/admin/*` → `/platform/*` namespace migration was performed and these call sites were left behind.

3. **The repository cannot rebuild this application.** HEAD is dated 2026-08-01. The working tree carries 1,164 uncommitted changes including 895 untracked files, 324 of them `.ts`/`.tsx` under `app/` or `src/`. Fourteen route pages exist only on this disk — including the **entire M12 execution surface** (`/execution`, `/execution/mobile`, `/execution/lookahead`, `/execution/plan-vs-actual`), the **M14 Report Center** (`/reports`), and **M15 Management Intelligence**. A Docker build from the git remote would produce a product missing execution, reporting, and management intelligence.

4. **Three completed modules are unreachable by any user.** `/reports`, `/report-builder/*` (M14), `/ois/*` (M13 Operational Intelligence Studio, six routes), `/execution/mobile` (M12 field mobile), and `/events/[eventId]/management-intelligence` (M15) have **no navigation entry anywhere**. They are functional and API-backed, and they can only be opened by typing a URL. The cause is traceable: `src/security/navigation.ts:147` declares the Reports shell section, but the object that declares it (`TENANT_SHELL_SECTIONS`) is consumed by nothing, because the tenant shell hardcodes its own menus — the exact practice `docs/PLATFORM_TENANT_SEGREGATION.md:194` forbids.

5. **The "Test connection" button on the Integrations page manufactures a false success.** `app/api/settings/integrations/test/route.ts` inserts a deliberate 1.5-second delay — the code comment reads *"Simulate network delay to make the test feel real"* — and then returns hard-coded successes such as `"Successfully verified P6 EPPM API connection."` and `"Successfully authenticated with SAP REST Bridge."` **without making any network call whatsoever.** Four of the six providers return success unconditionally, ignoring the configuration entirely. The `PATCH` that would save the configuration returns `501`. A customer can therefore be shown written confirmation that their Primavera P6 or SAP integration is live when nothing was contacted and nothing was saved. This is the one finding in this audit that is not merely incomplete work — it asserts a false fact to the user, and it is a commercial misrepresentation risk rather than a bug.

Close behind: **six enterprise features ship a complete, polished UI over a backend that returns HTTP 501.** SSO (SAML/OIDC), Integrations, and the AI Prompt Library all present finished configuration screens whose save path is explicitly disabled. Most seriously, **self-service password recovery does not work at all** — `forgot-password`, `reset-password`, and `verify-token` all return `501 "Password reset is not available in this release."` And the flagship **Execution Cockpit and Mobile Execution screens hang on an infinite "Loading…" spinner** for any tenant that has no shutdown selected, which includes every newly provisioned tenant.

Beyond the blockers, three systemic conditions make the product feel unfinished rather than merely buggy. There is **no design system at all** — `tailwind.config.ts` is not even loaded by Tailwind v4 and defines no tokens, so the interface is held together by 2,062 raw hex literals and 1,547 inline `style={{}}` objects across 132 files, producing at least three competing palettes. There are **zero React error boundaries** in the entire `app/` tree, so any client-side throw on any of 193 routes drops the user onto Next.js's default error screen with no recovery path. And **accessibility is effectively absent**: 1,059 form controls share 41 label associations, 1,379 buttons share 14 `aria-label`s, and 85 modal overlays share one `role="dialog"`.

Finally, the global "Active Shutdown" selector in the navigation bar — the control that visually promises a system-wide context filter — governs **six screens**. Its server-side counterpart, `getActiveShutdownServer()`, is documented in three milestone gate reviews and called by nothing.

**Estimated product completeness: 53%** (breakdown and method in §24). Engineering depth is high; product assembly, reachability, and finish are not.

---

## 2. DEFECT COUNT BY SEVERITY

| Severity | Definition applied | Count |
|---|---|---|
| **P0** | Blocks release. User cannot complete a core journey, the product cannot be deployed, or the UI asserts something false. | **4** |
| **P1** | Major. A module is unreachable, unbuildable, dead, hangs, or a whole quality dimension is absent. | **14** |
| **P2** | Visible quality/consistency defect that a customer would notice and comment on. | **14** |
| **P3** | Hygiene. Invisible to users; costs maintainer time. | **5** |

Full register with evidence in §30.

---

## 3. ROUTE INVENTORY (SUMMARY)

**Total page routes served: 193**, all under `app/` (App Router).

| Namespace | Route count | Shell / layout | Access control |
|---|---|---|---|
| `app/(dashboard)/**` | 132 | `app/(dashboard)/layout.tsx` → `NavBar` | Session + `hasPermission`; `(dashboard)` is a route group and absent from URLs |
| `app/platform/**` | 38 | `app/platform/layout.tsx` → `NavBar` (metadata-driven) | Platform roles only, enforced in `src/middleware.ts:79-89` |
| `app/platform-data/**` | 16 | `app/platform-data/layout.tsx` | Platform roles only, `src/middleware.ts:91-96` |
| `app/auth/**`, `app/login`, `app/onboarding`, `app/install` | 6 | own layouts | Public per `src/middleware.ts:8-18` (except `/auth/change-password`) |
| `app/page.tsx` | 1 | none | Session-gated redirect dispatcher |

**Special files present:** 8 `layout.tsx`, 4 `loading.tsx`, 3 `not-found.tsx`, **0 `error.tsx`**, **0 `global-error.tsx`**.

**`src/app/` is a decoy.** It contains no pages and only three API handlers — `src/app/api/reports/{artifacts,definitions,generate}/route.ts`. Because Next.js serves the root `app/` directory, these three are **not routed**. There is no `app/api/reports/` directory. Any UI call to `/api/reports/*` therefore 404s.

**Middleware is confirmed live, not a defect.** `src/middleware.ts` is compiled and registered: `.next/server/middleware-manifest.json` contains the matcher `/((?!api|_next/static|_next/image|favicon.ico).*)`. I checked this specifically because `middleware.ts` sitting in `src/` while `app/` sits at the root is a common misconfiguration. It is fine here.

---

## 4. 404 REGISTER — ROUTES REFERENCED BY THE UI THAT DO NOT EXIST

Zero tolerance was applied. Every entry below was confirmed by (a) locating the referencing line and (b) confirming no matching `page.tsx` exists.

| # | Broken target | Referenced from | Control the user sees | Real route | Severity |
|---|---|---|---|---|---|
| 1 | `/admin/setup` | `app/page.tsx:19` | *(none — automatic redirect from `/`)* | `/platform/setup` | **P0** |
| 2 | `/admin/setup` | `app/login/LoginForm.tsx:79` | *(none — post-login redirect)* | `/platform/setup` | **P0** |
| 3 | `/admin/setup` | `app/(dashboard)/workpacks/layout.tsx:14` | *(none — layout redirect)* | `/platform/setup` | **P0** |
| 4 | `/admin/setup` | `app/(dashboard)/dashboard/page.tsx:90` | "⚙️ Admin Setup" button | `/platform/setup` | **P0** |
| 5 | `/admin/tenants` | `app/(dashboard)/dashboard/page.tsx:86` | "⚡ Admin Panel" button | `/platform/tenants` | **P0** |
| 6 | `/admin/tenants/{orgId}` | `app/platform/users/_components/AdminUsersClient.tsx:127` | Organisation name link in the platform Users table | `/platform/tenants/{id}` | **P0** |

**Proof the `/admin/*` namespace has no pages:** the only `admin` directory under `app/` is `app/api/admin` — API handlers, not pages. No `app/admin/**/page.tsx` exists. `git grep` for `/admin/setup` returns exactly the four call sites above.

**Behavioural nuance, stated honestly.** For a **tenant** user these six references reach `app/not-found.tsx`. For an **unproxied platform admin**, `src/middleware.ts:127-131` intercepts unknown non-platform paths and redirects to `/platform/dashboard`, so entries 1–5 would silently misroute rather than 404 for that role. Entry 6 lives inside the platform shell and 404s for platform admins. Either way the user does not arrive where the label promised. **This distinction is inferred from reading the middleware, not observed at runtime.**

### Further 404 targets in live, reachable UI

Eight more broken targets were found and individually confirmed against the route tree.

| # | Broken target | Referenced from | Control the user sees | Real route | Severity |
|---|---|---|---|---|---|
| 7 | `/auth/login` | `app/install/page.tsx:311` | **"Go to Login →"** — the final CTA of the installation wizard | `/login` | **P1** |
| 8 | `/engineering-issues/manual` | `app/(dashboard)/engineering-issues/page.tsx:82` | **"Manual Entry"** button | *none — never built* | **P1** |
| 9 | `/workpacks/{id}/audit` | `src/components/Workpack/WorkpackLayout.tsx:659` | **"View full audit log →"** | *none — never built* | **P1** |
| 10 | `/settings/ai-config` | `app/platform/setup/page.tsx:154` | "AI (optional custom provider)" setup step | `/platform/ai-config` | **P2** |
| 11 | `/settings/templates` | `src/components/Workpack/ApplyTemplateModal.tsx:91` | "Settings → Templates" help link | `/planning/templates` | **P2** |
| 12 | `/auth/signin` | `app/(dashboard)/lessons/page.tsx:8`, `app/(dashboard)/constraints/page.tsx:8` | *(server redirect for anonymous users)* | `/login` | **P2** |
| 13–16 | `/settings/templates`, `/settings/udf-definitions`, `/settings/print-settings`, `/settings/master-data/activity-codes` | `app/(dashboard)/settings/not-found.tsx:14,15,17,18` | "Related sections" recovery links | `/planning/templates`, `/platform-data/udf-definitions`, `/platform-data/print-settings`, `/platform-data/master-data/activity-codes` | **P1** |

Entry 7 is the most damaging of this group after the `/admin/*` set: it is the **last click of the installation wizard**. A newly installed system tells the administrator to click "Go to Login" and delivers a 404.

Entries 13–16 are a particular kind of failure. `app/(dashboard)/settings/not-found.tsx` is the Settings 404 handler — the page shown when a user reaches a settings URL that does not exist. Its "related sections" list marks these four links **`available: true`**, and all four are themselves 404s. The recovery page cannot recover. Every one of the four points at a page that was moved to `/platform-data/*` or `/planning/*` during the same namespace migration that produced D-001.

**Total distinct 404 targets in live UI: 14.**

### Cleared as dead code — reported for completeness, not user-facing

`src/components/Navigation/SettingsSidebar.tsx` contains **eight** broken hrefs (`/settings/master-data/activity-codes`, `/disciplines`, `/resources`, `/settings/udf-definitions`, `/settings/templates`, `/settings/print-settings`, `/settings/ai-config`, `/settings/billing`). I verified this component is **imported by nothing** — the only occurrence of the string `SettingsSidebar` anywhere in `app/` or `src/` is inside its own file. The live settings sidebar is `SettingsNavItems.tsx`, driven by `TENANT_SETTINGS_NAV`, whose 24 hrefs all resolve correctly. These eight are therefore **P3 dead code, not user-facing 404s**, and must not be counted in the register above.

**Additional dead reference (not a user-facing 404):** `src/components/NavBar.tsx:454` marks the Execution dropdown active for `/operations`, and `:462` for `/portfolio`. Neither route exists. Effect is a missing active-state highlight, not a broken link. **P3.**

---

## 4A. BACKEND STUBS BEHIND FINISHED UI — HTTP 501

Six API routes return `501 Not Implemented`. In every case the corresponding UI is complete and gives no advance warning.

| Endpoint | Stub evidence | UI that depends on it | Consequence | Severity |
|---|---|---|---|---|
| `app/api/auth/forgot-password/route.ts` | `"TEMPORARILY DISABLED"`; returns `501 "Password reset is not available in this release."` | `/auth/forgot-password` — full public-facing form | **No self-service password recovery exists** | **P1** |
| `app/api/auth/reset-password/route.ts` | `501` | `/auth/reset-password` | Reset links would fail even if an email were sent | **P1** |
| `app/api/auth/verify-token/route.ts` | `501` | `/auth/reset-password` token check | Same flow, blocked at the first step | **P1** |
| `app/api/settings/sso/route.ts` | `"Stub: SsoConfig model does not exist"`; `PATCH` → `501 "SSO configuration is not available in this release."` | `/settings/sso` — complete SAML/OIDC configuration UI | Admin completes an enterprise SSO form; **save always fails** | **P1** |
| `app/api/settings/integrations/route.ts` | `GET` → `{ integrations: [] }`; `PATCH` → `501` | `/settings/integrations` — provider catalogue is a hardcoded `PROVIDERS` array | Nothing persists; see §4B | **P0** (with §4B) |
| `app/api/ai-prompts/route.ts` | `"Stub: AiPrompt model does not exist"`; `GET` → `{ data: [] }`; `PUT` → `501` | `/settings/ai-prompts` — "Prompt Library" editor | Library renders permanently empty; saves rejected | **P1** |

The password-recovery group is the most consequential. For an enterprise platform with tenant user management, "forgot password" is not an optional convenience — its absence means every forgotten password becomes an administrator support ticket, and `/auth/forgot-password` is linked from the public login page.

## 4B. FABRICATED SUCCESS — `app/api/settings/integrations/test/route.ts`

This is the single most serious finding in the audit that is not a crash or a build failure, quoted verbatim:

```
    // Simulate network delay to make the test feel real
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Scaffolded simulated responses based on the provider
    switch (provider) {
      case 'sap':
        if (!config.apiUrl || !config.apiKey) {
          return NextResponse.json({ success: false, message: 'Missing API URL or Key.' });
        }
        return NextResponse.json({ success: true, message: 'Successfully authenticated with SAP REST Bridge.' });

      case 'p6':
        return NextResponse.json({ success: true, message: 'Successfully verified P6 EPPM API connection.' });
      ...
      case 'docusign':
        return NextResponse.json({ success: true, message: 'OAuth credentials validated.' });

      case 'msproject':
        return NextResponse.json({ success: true, message: 'MS Project Server connected.' });

      default:
        return NextResponse.json({ success: true, message: 'Connection tested successfully.' });
```

Three facts compound here:

1. **No network request is ever made** to SAP, Primavera P6, Slack, DocuSign, or MS Project.
2. **Four of six providers return success unconditionally** — `p6`, `docusign`, `msproject`, and the `default` branch never inspect `config` at all. Only `sap` and `slack` perform even a presence check on their fields.
3. **The 1.5-second delay is deliberate**, and the comment states its purpose is to make the fake test *"feel real."*

Because `PATCH /api/settings/integrations` also returns `501`, the complete user experience is: configure Primavera P6 → click "Test connection" → wait → read *"Successfully verified P6 EPPM API connection."* → nothing was contacted, and nothing was saved.

**Classified P0.** Every other incomplete feature in this audit is honest about being incomplete, or is silent. This one produces affirmative written evidence of a working integration that does not exist. In a procurement or pilot context that is a misrepresentation exposure, not a defect backlog item. It should be disabled before any external demonstration. **(D-023.)**

---

## 5. BROKEN / UNBUILDABLE CODE REGISTER

These do not fail because of logic errors; they fail to resolve their own imports.

| # | File | Failure | Reachable by a user? | Severity |
|---|---|---|---|---|
| 1 | `app/(dashboard)/schedule/page.tsx:4` | Imports `@/components/schedule/ScheduleGantt`; the directory on disk is `src/components/**Schedule**/`. `tsc` reports `TS1149: File name … differs from already included file name … only in casing`. | Yes — `/schedule`, in the Planning menu | **P0** |
| 2 | `src/components/m13/ControlTowerDashboard.tsx:6,7` | Imports `@/components/ui/card` and `@/components/ui/alert`. Neither exists; `src/components/ui/` contains only `AutocompleteItemInput`, `ComingSoonPage`, `ConfirmDeleteDialog`, `ErrorBoundary`, `NotificationBell`. `tsc` reports two `TS2307`. | **No** — the component is imported by nothing | **P1** |
| 3 | `src/components/Schedule/ScheduleRibbon.tsx:15`, `TaskListTable.tsx:4`, `taskTransformer.ts:1` | All three import `gantt-task-react`, which is absent from `package.json` and absent from `node_modules` (`Test-Path` → `False`). Three `TS2307`. | **No** — imported by no component | **P1** |

### Why defect 1 is a P0 and not a Windows curiosity

`Dockerfile` stage 2 is `FROM node:20-bookworm-slim AS builder` and runs `npm run build` on a case-sensitive Linux filesystem. On Windows/NTFS the lowercase import resolves; on Linux it does not. `next.config.ts:25-27` sets `typescript: { ignoreBuildErrors: true }`, which does **not** rescue this, because unresolved module specifiers are a bundler error, not a TypeScript error.

**Stated uncertainty:** I did not execute a Linux build. What is proven is the casing mismatch (via `tsc`) and the Linux build stage (via `Dockerfile`). The build failure is the expected consequence, not an observed one. One command settles it:

```
docker build --target builder -t sto-buildcheck .
```

There is a second, independent reason that build would fail: `src/components/Schedule/ScheduleGantt.tsx` is **untracked by git** (see D-003), so a build from the remote lacks the file under either casing.

### Why defect 3 matters more than dead code usually does

`tests/m11-v1-schedule-view.test.ts:405` and `tests/m11-import-deprecation.test.ts:96` assert against these files by **reading them as raw source text** and pattern-matching strings. They pass while the modules cannot compile and are wired to nothing. The M11 schedule-view test suite therefore provides assurance about the Gantt that the Gantt does not have. The Gantt the user actually sees is `src/components/Schedule/ScheduleGantt.tsx`, a bespoke implementation with no third-party Gantt dependency at all.

---

## 6. INCOMPLETE / PLACEHOLDER PAGE REGISTER

Nine routes render an explicit placeholder via `src/components/ui/ComingSoonPage.tsx`.

| Route | Placeholder wrapper | Advertised in navigation? |
|---|---|---|
| `/settings/audit-logs` | `ComingSoonPage` directly | **Yes** — `src/security/navigation.ts:98` |
| `/settings/notifications` | `ComingSoonPage` directly | **Yes** — `src/security/navigation.ts:81` |
| `/platform-data/print-settings` | `PlatformDataComingSoon` | **Yes** — `src/security/navigation.ts:68` |
| `/platform-data/master-data/item-catalog` | `PlatformDataComingSoon` | **Yes** — `src/security/navigation.ts:64` |
| `/platform-data/master-data/blinds` | `PlatformDataComingSoon` | No |
| `/platform-data/master-data/bolts` | `PlatformDataComingSoon` | No |
| `/platform-data/master-data/consumables` | `PlatformDataComingSoon` | No |
| `/platform-data/master-data/gaskets` | `PlatformDataComingSoon` | No |
| `app/(dashboard)/settings/not-found.tsx` | `ComingSoonPage` | n/a (404 handler) |

The four marked **Yes** are the damaging ones: the menu advertises a capability, the user clicks, and receives a 🚧 panel. "Audit Logs" and "Notifications" are both compliance-adjacent features that enterprise buyers ask about in the first demo. **P2** (D-016).

`app/platform/_components/PlatformComingSoon.tsx` is defined and imported by no page — dead code. **P3.**

Encouragingly, `TODO`/`FIXME` appears in only **1** of 490 UI files, and `Math.random` appears in 5 files but is used exclusively for temporary row IDs, widget IDs, and generated passwords (`app/platform/tenants/new/page.tsx:131`) — **not** for fabricated display data. I checked this specifically to test the hypothesis that dashboards were showing invented numbers; that hypothesis is **not supported**.

---

## 7. ORPHAN PAGE REGISTER — BUILT, WORKING, UNREACHABLE

These routes have **no inbound link from any navigation menu, dashboard card, or CTA**. They are reachable only by typing a URL.

| Orphaned surface | Routes | Module | Real or placeholder? |
|---|---|---|---|
| **M14 Report Center** | `/reports` | M14 | Real — server component → `ReportCenter` client, API-backed |
| **M14 Report Builder** | `/report-builder`, `/report-builder/dashboard`, `/report-builder/history`, `/report-builder/schedules`, `/report-builder/[definitionId]` | M14 | Real |
| **M13 Operational Intelligence Studio** | `/ois`, `/ois/cockpits`, `/ois/builder/[dashboardId]`, `/ois/view/[dashboardId]`, `/ois/meeting/[dashboardId]`, `/ois/tv/[sessionCode]` | M13 | Real — `/ois` fetches `/api/ois/dashboards`, supports create and clone |
| **M12 field mobile** | `/execution/mobile` | M12 | Real — `MobileExecutionView` |
| **M15 Management Intelligence** | `/events/[eventId]/management-intelligence` | M15 | Real |
| Execution readiness | `/events/[eventId]/execution-readiness` | M12/M10 | Real |
| Alerting & rules | `/alerts`, `/rules` | — | Real, API-backed |
| Event materials & WBS | `/events/[eventId]/materials`, `/events/[eventId]/wbs` | — | Real — no inbound link found |
| Platform sub-consoles | `/platform/analytics`, `/platform/beta`, `/platform/licenses`, `/platform/modules`, `/platform/release`, `/platform/system` | — | Real — absent from `PLATFORM_NAV`; reachable only from Operations/Beta KPI cards |
| Imported schedule | `/imported-schedule` | M11 | Real |
| Scope compare / create | `/shutdown-scope/compare`, `/shutdown-scope/create` | — | Real |
| Asset intake | `/asset-register/new`, `/asset-register/import`, `/asset-register/extract-pid` | — | Real |
| Issue intake | `/engineering-issues/import` | — | Real |
| Schedule import notice | `/integrations/import` | M11 | Real (deprecation notice) |
| Planning detail | `/planning/blinds`, `/planning/joints` | — | Real |
| Workpack strategies | `/workpack-intelligence/strategies` | — | Real |
| AI config | `/dashboard/ai-config` | M16 | Real |

**At least 33 working routes have no way in.** For M13, M14, and M15 this means three complete milestones are invisible to the customer who paid for them.

**One correction:** `/shutdowns` was initially recorded here as an orphaned page. It is not a page — `app/(dashboard)/shutdowns/page.tsx` is a four-line `redirect('/events')` shim. It is removed from the orphan count. Likewise `/platform-data/templates` and `/settings/assets` are redirect aliases, and `/settings/plants` and `/settings/sites` are legacy path aliases carrying an explicit *"Legacy path"* comment — all four are legacy surface, not lost functionality.

### Root cause, traced

The tenant shell builds its menus from **hardcoded arrays** at `app/(dashboard)/layout.tsx:46-125` — `planningItems`, `executionItems`, `intelligenceItems`, `importExportItems`, `adminItems`. It also explicitly passes `platformItems={[]}`, `tenantsItems={[]}`, `platformDataItems={[]}` into `NavBar` (lines 143-148).

Meanwhile `src/security/navigation.ts:140-151` defines `TENANT_SHELL_SECTIONS`, which **does** include the missing Reports entry:

```
{ id: 'report-builder', label: 'Reports', href: '/report-builder', scope: Scope.TENANT, permission: 'reporting:view' }
```

`TENANT_SHELL_SECTIONS` is re-exported at `src/security/index.ts:4` and **consumed by nothing**. The metadata knows Reports belongs in the shell. The shell does not read the metadata.

The platform shell, by contrast, is correctly metadata-driven: `app/platform/layout.tsx:20-22` builds its menus through `src/config/platform-navigation.ts`, which reads `PLATFORM_NAV`. So the two halves of the same application use two different navigation architectures — and the hardcoded half is the one that lost three modules. `docs/PLATFORM_TENANT_SEGREGATION.md:194` states the rule that was broken: *"Do not re-introduce hardcoded menus — extend `src/security/navigation.ts` and `routeRegistry.ts` only."* **P1** (D-005, D-006).

---

## 8. CONTEXT AUDIT — THE ACTIVE SHUTDOWN SELECTOR IS MOSTLY DECORATIVE

`ActiveShutdownSelector` sits in the navigation bar on every tenant page (`src/components/NavBar.tsx:437` via `ContextPill`). It presents as the application's global context control: site name, shutdown code, live status badge, pulsing indicator.

**It governs six components.** The complete set of consumers of `useActiveShutdown()`:

| Consumer | File |
|---|---|
| Activity planning grid | `src/components/planning/ActivityPlanningGrid.tsx:32` |
| Schedule Gantt | `src/components/Schedule/ScheduleGantt.tsx:15` |
| Execution cockpit | `src/components/execution/ExecutionCockpit.tsx:29` |
| Lookahead | `src/components/execution/LookaheadView.tsx:18` |
| Plan vs actual | `src/components/execution/PlanVsActualView.tsx:18` |
| Mobile execution | `src/components/execution/MobileExecutionView.tsx:9` |
| *(selector + list UI only)* | `ActiveShutdownSelector.tsx:22`, `EventActionsClient.tsx:9`, `ShutdownListClient.tsx:24` |

Every other page — Dashboard, Workpacks, Digital Plant, Asset Register, Shutdown Scope, all of `/planning/*` except the activity grid, Reports, OIS, Punch, Permits, Constraints — **ignores the selected shutdown entirely**.

**The server-side half of the mechanism is dead code.** `src/lib/shutdownContext.ts:8` defines `getActiveShutdownServer(organizationId)`, which reads the `syority_active_event` cookie and falls back to the most recent event. It has **zero call sites**. It is nonetheless documented as the server-side context authority in `docs/M8.1_FINAL_REPORT.md:14` and `docs/M16_R0_1_FINAL_GATE_REVIEW.md:67,120`, and `docs/M16_R0_1_FINAL_GATE_REVIEW.md:852` instructs future work to reuse it.

**Secondary defect.** `setActiveShutdown` (`src/context/ActiveShutdownContext.tsx:105-116`) updates React state, a cookie, and `localStorage`, but never calls `router.refresh()`. Today this causes no visible bug precisely *because* no server component reads the cookie. The moment one does, changing the shutdown will leave stale server-rendered data on screen. This is a latent trap, not a current break — recorded as **P2** on that basis (D-018).

**User-facing consequence:** a planner selects "TA-2026 North Train" and most of the application shows unfiltered organisation-wide data anyway, with no indication that the filter did not apply. This is worse than having no selector, because the selector asserts a filter is active. **P1** (D-007).

**Not verified at runtime:** whether the six consuming screens visibly re-fetch on selection change.

---

## 9. FAKE AND HARD-CODED DATA IN USER-FACING OUTPUT

`ExecutionCockpit.tsx:29`, `LookaheadView.tsx:18`, and `PlanVsActualView.tsx:18` all destructure `activeSite` from `useActiveShutdown()`. **`activeSite` is not a member of `ActiveShutdownContextType`** (`src/context/ActiveShutdownContext.tsx:26-34`). Confirmed by three `tsc` errors:

```
src/components/execution/ExecutionCockpit.tsx(29,27): error TS2339: Property 'activeSite' does not exist on type 'ActiveShutdownContextType'.
src/components/execution/LookaheadView.tsx(18,27):    error TS2339: Property 'activeSite' does not exist on type 'ActiveShutdownContextType'.
src/components/execution/PlanVsActualView.tsx(18,27): error TS2339: Property 'activeSite' does not exist on type 'ActiveShutdownContextType'.
```

`activeSite` is therefore permanently `undefined`, and every read is written with a hard-coded fallback that renders instead:

| Location | Rendered text | Context |
|---|---|---|
| `ExecutionCockpit.tsx:352` | `Site Complex` | Cockpit header badge |
| `ExecutionCockpit.tsx:1037` | `Refinery Complex` | **Header of the "Daily Execution Shift Report"** |
| `LookaheadView.tsx:76` | `Site` | 24h/72h lookahead subtitle |
| `PlanVsActualView.tsx:69` | `Site` | Variance view subtitle |

The second row is the serious one: a document titled *Daily Execution Shift Report* carries a fabricated site name. This ships only because `next.config.ts:26` sets `ignoreBuildErrors: true`. **P2** (D-012) — no crash, but incorrect information on an operational report.

Separately, `src/components/Schedule/ScheduleGantt.tsx:18`: when the component receives an `eventId` prop, it substitutes a literal shutdown object rather than looking one up —

```
const activeShutdown = externalEventId
  ? { code: 'WKS', name: 'Workspace Schedule', site: { name: 'Site' } }
  : contextShutdown;
```

So the embedded Gantt in the planner workspace always titles itself "WKS / Workspace Schedule / Site". **P2** (D-013).

---

## 10. ERROR, EMPTY, AND LOADING STATE AUDIT

### The finding that dominates this section

**There is not one `error.tsx` or `global-error.tsx` in the entire repository.** A recursive search of `app/` and `src/` for both filenames returns nothing.

Next.js uses `error.tsx` to install a React error boundary per route segment. With none present, any client-side exception on any of 193 routes escapes to the framework's default handler: in production, a bare *"Application error: a client-side exception has occurred"* screen, with no branding, no recovery action, and no route context.

One error boundary exists in the codebase — `src/components/ui/ErrorBoundary.tsx` — and it is used in exactly one place, `src/components/Workpack/WorkpackTabs.tsx:1599`, wrapping workpack tab content. That single usage is good practice; it is also the whole of the application's error containment. **P1** (D-008).

### Loading states

Four route-level `loading.tsx` files exist: `app/(dashboard)/loading.tsx`, `app/(dashboard)/workpacks/loading.tsx`, `app/(dashboard)/workpacks/[id]/loading.tsx`, `app/login/loading.tsx`. The `(dashboard)` group file provides a baseline for its 132 routes. Component-level loading is handled ad hoc (`isLoading` flags), e.g. `app/(dashboard)/ois/page.tsx:158`.

### Empty states

Present and well-executed where sampled. `app/(dashboard)/ois/page.tsx:159-164` renders a 📭 icon, a heading, and guidance. `ActiveShutdownSelector.tsx:91-100` renders "No shutdowns configured for this site." **with a "+ Create First Shutdown" action** — the correct pattern.

### Silently swallowed errors

The prevailing failure idiom is to discard the error and render an empty result, which is indistinguishable to the user from "there is no data":

| Location | Code | User sees |
|---|---|---|
| `app/(dashboard)/ois/page.tsx:48` | `.catch(() => setDashboards([]))` | "No dashboards yet" — identical to a real empty library |
| `src/components/NavBar.tsx:334` | `.catch(() => {})` with comment *"silently fail — fallback to default"* | Default branding; tenant logo silently absent |
| `src/components/Schedule/ScheduleGantt.tsx:50-51` | `console.error(...)` only | Empty Gantt, no message |
| `src/context/ActiveShutdownContext.tsx:64-67` | `if (!res.ok) { setAllShutdowns([]); return; }` | "No shutdowns configured" — even when the API errored |

That last one is the most misleading: an API outage presents as an empty, correctly-functioning system. **P2** (D-017).

### The Execution screens hang forever when no shutdown is selected

Both M12 execution surfaces initialise `loading` to `true` and then return from their fetch function **before clearing it**:

```16:17:src/components/execution/MobileExecutionView.tsx
  const fetchData = async () => {
    if (!activeShutdown?.id) return;
```

```67:69:src/components/execution/ExecutionCockpit.tsx
  const fetchData = async () => {
    if (!activeShutdown?.id) return;
    setLoading(true);
```

`setLoading(false)` lives only in the `finally` block *after* that guard, so it never runs on the early-return path. `MobileExecutionView.tsx:73` then renders unconditionally:

```73:73:src/components/execution/MobileExecutionView.tsx
  if (loading) return <div className="p-4 text-center">Loading execution board...</div>;
```

The `useEffect` depends on `[activeShutdown?.id]`, so in the normal case — a tenant with events — the effect re-runs once the context resolves and the screen recovers. The failure case is precisely **a tenant with zero events, or an `/api/events` failure**: `activeShutdown` stays `null` permanently, and the user sits on "Loading execution board…" indefinitely with no empty state, no error, and no way forward.

Every newly provisioned tenant is in exactly that state. The flagship execution module therefore appears broken on first use rather than empty. **P1** (D-025).

`ExecutionCockpit` compounds this: it destructures `isLoading: contextLoading` at line 29 and **never uses it** — the variable appears exactly once in the file. The guard that would have distinguished "context still loading" from "no shutdown exists" was retrieved and then forgotten.

### Feedback on user actions

**`alert()` is the application's primary feedback mechanism** — 29 files use it, including the core workspaces: `ExecutionCockpit` (3), `ReportDesigner` (4), `ScheduleContainer` (4), `planner-workspace/ActivityGrid` (5), `ScenarioControlDashboard` (5), `workpack-factory/page.tsx` (5), `MaintainBaselinesModal` (5).

There is no global toast or notification system. Three files implement their own local toast (`Schedule/WbsView.tsx`, `Schedule/LevelingPreviewModal.tsx`, `Workpack/WorkpackLayout.tsx`), which is why feedback style differs between adjacent screens. Blocking, unstyled, unbranded browser dialogs are not acceptable in an enterprise control application — a modal `alert()` freezes an execution cockpit that is otherwise polling live data. **P2** (D-011).

---

## 10A. DEAD CONTROL REGISTER

Controls that are present, enabled, and do nothing or do less than they claim.

| Control | File:Line | Expected | Actual | Persists? | Severity |
|---|---|---|---|---|---|
| **"Commit to Register"** (P&ID extraction) | `app/(dashboard)/asset-register/extract-pid/page.tsx:41-45` | POST reviewed AI extraction into the asset register | Code comment *"In a full implementation…"*; fires `alert()` then redirects | **No** | **P1** |
| **"Request Full Data Archive"** (GDPR) | `app/(dashboard)/settings/system/tabs/TabDataStorage.tsx:87-91` | Queue a data-export job | `alert('Export request queued…')` — no API call exists | **No** | **P1** |
| **Edit (✎) on an active catalogue item** | `app/(dashboard)/settings/items/page.tsx:454` | Open edit form / PATCH | `onClick={() => {}}` | No | **P2** |
| **"Compare" (previous shift/day)** | `app/(dashboard)/ois/meeting/[dashboardId]/page.tsx:80-81` | Load comparison dataset | `console.log('Compare:', type)` | No | **P2** |
| **"+ Add Nozzle"** | `app/(dashboard)/asset-register/[assetId]/AssetDetailClient.tsx:55` | Add a nozzle | `<button>` with **no `onClick`** | No | **P2** |
| **Edit (nozzle row)** | `app/(dashboard)/asset-register/[assetId]/AssetDetailClient.tsx:78` | Edit a nozzle | `<button>` with **no `onClick`** | No | **P2** |
| **"Help"** | `src/components/UserPreferencesModal.tsx:657` | Open help | `onClick={() => {}}` | n/a | **P3** |
| **Password tab action** | `src/components/UserPreferencesModal.tsx:641-644` | Change password | Button has **no handler** | No | **P2** |
| **OAuth credentials block** | `app/(dashboard)/settings/system/tabs/TabApiAccess.tsx:200` | Manage OAuth clients | Renders a `COMING SOON` badge | n/a | **P2** |
| **"Deploy cockpit"** | `app/(dashboard)/ois/cockpits/page.tsx:41-61` | Create dashboard + redirect | On failure: `catch { /* ignore */ }`, button silently re-enables | No | **P2** |
| **"+ New Workpack"** dropdown trigger | `src/components/Workpack/WorkpackDashboard.tsx:75-80` | Open menu | No `onClick`; relies on CSS `:hover` — **unusable on touch devices** | n/a | **P2** |

Additional partially-wired surfaces: `src/components/planner-workspace/InspectorPanel.tsx:89-101` renders a `PlaceholderTab` for **six** inspector tabs (Resources, Materials, Documents, QA/QC, Certificates, History); `src/components/UserPreferencesModal.tsx:9-18` disables **four** preference tabs; `app/(dashboard)/workpack-factory/page.tsx:126-133` hardcodes `PRODUCTION_TARGET = { workpacks_per_week: 10 }` under the comment `"V1 Configuration Placeholder"` and presents it as a throughput KPI.

**Project-scoped module stubs.** Four routes linked from project navigation alongside fully working siblings are one-line placeholders: `/projects/[id]/equipment` (*"Phase 1 shell — coming soon"*), and `/projects/[id]/safety`, `/punch`, `/permits` (all *"Phase 6 feature — coming soon"*). The safety case is actively misleading — `/safety` and `/events/[eventId]/safety` are complete implementations, so the same capability is real at org and event scope but a stub at project scope. Separately, the top-level `/punch` and `/permits` routes are navigation shells that render static text and a link to `/projects`, and `/imported-schedule` renders only a *"Please Select a Project"* card. **P2** (D-024, D-026).

## 10B. UI CALLS TO ENDPOINTS THAT DO NOT EXIST

I confirmed each of the following has no `route.ts` anywhere under `app/api/`.

| UI call | Called from | Nearest real endpoint | Severity |
|---|---|---|---|
| `GET /api/sites` | `app/(dashboard)/workpack-factory/page.tsx:235`; `workpack-intelligence/instantiate/[scopeItemId]/page.tsx:44`; `src/components/ois/DashboardVariableBar.tsx:144` | `/api/hierarchy/sites`, `/api/settings/sites` | **P1** |
| `GET /api/planner-workspace/readiness` | `src/components/planner-workspace/WorkspaceDetailPane.tsx:410` | `/api/workpack-intelligence/workpacks/[id]/readiness` | **P1** |
| `GET /api/planner-workspace/constraints` | `src/components/planner-workspace/WorkspaceDetailPane.tsx:471` | `/api/workpacks/[id]/constraints` | **P1** |
| `GET /api/templates` | `workpack-intelligence/instantiate/[scopeItemId]/page.tsx:27` | `/api/admin/templates`, `/api/settings/templates` | **P1** |
| `GET /api/platform-data/master-data/disciplines` | `src/components/planning/ActivityPlanningGrid.tsx:61` | `/api/master-data/disciplines` | **P1** |
| `GET /api/contractors`, `/api/organizations/contractors`, `/api/organizations/resource-types` | `DashboardVariableBar.tsx:153`; `ResourcePlanningDashboard.tsx:68-69` | `/api/settings/master-data/contractors`, `/api/settings/master-data/resource-types` | **P1** |
| `POST /api/ois/meetings/{id}/export` | `app/(dashboard)/ois/meeting/[dashboardId]/page.tsx:62,72` | `/api/ois/dashboards/[id]/export` | **P2** |

Every one of these is on a **reachable, live screen** — the Workpack Factory, the Planner Workspace inspector, the Activity Planning Grid, the OIS variable bar. Because these calls sit behind swallowed-error handlers (§10), the visible symptom is an empty dropdown or an empty inspector panel with no error message. A planner sees "no disciplines" and "no sites" and reasonably concludes the master data was never loaded. **P1** (D-027).

**Not a defect — verified and cleared.** `app/(dashboard)/projects/[id]/ta-dashboard/page.tsx` also calls five nonexistent `/api/events/{id}/…` endpoints (`s-curve`, `constraints`, `punch`, `lookahead`, `activities/unit-progress`). I initially treated these as broken, then read the call sites: each is a **fallback** reached only if the primary `/api/projects/{id}/…` call fails, and I confirmed all six primary endpoints exist. The TA dashboard works when given a project id. The residual defect is narrower — 11 `.catch(() => {})` handlers on that page (lines 187–288) mean an event-scoped id produces a fully-rendered dashboard of empty panels with no error at all. **P3, not P1.**

## 11. UI DESIGN SYSTEM, THEME, AND COLOUR AUDIT

### There is no design system. This is a configuration fact, not an opinion.

| Evidence | Finding |
|---|---|
| `tailwindcss` version | `^4.1.8` |
| `app/globals.css` line 1 | `@import "tailwindcss"` — Tailwind v4 CSS-first mode |
| `@config` directive in `globals.css` | **absent** |
| ⇒ consequence | **`tailwind.config.ts` is never loaded.** Tailwind v4 ignores the JS config unless `@config` points at it. |
| `tailwind.config.ts` contents | `theme: { extend: {} }` — empty regardless |
| `:root` custom properties in `globals.css` | **none** |
| `darkMode` configuration | **none** |

So there are **zero design tokens** in the application: no brand colour, no spacing scale, no type scale, no radius scale, no shadow scale. Every visual decision is made locally, per file.

### What filled the vacuum

Measured across 490 UI files in `app/` and `src/components/`:

| Signal | Count | Files affected |
|---|---|---|
| Hex colour literals | **2,062** | 143 |
| Inline `style={{…}}` objects | **1,547** | 132 / 490 |
| Tailwind arbitrary colours `bg-[#…]` / `text-[#…]` / `border-[#…]` | **384** | — |
| `rgba()` literals | 89 | — |
| `dark:` variants | 61 | — |
| Theme provider / toggle (`ThemeProvider`, `useTheme`, `toggleTheme`, `data-theme`) | **0** | — |

### Token inventory (de facto, reverse-engineered from usage)

| Concept | Value in use | Occurrences | Defined as a token? |
|---|---|---|---|
| Brand navy | `#0D2137` | **193** | No — literal, 193 times |
| Brand navy hover | `#1A3A5C` | 65 | No |
| Body text grey | `#6B7280` | **208** | No |
| Muted grey | `#9CA3AF` | 74 | No |
| Border grey | `#E5E7EB` | 57 | No |
| Primary blue | `#3B82F6` | 124 | No |
| Warning amber | `#F59E0B` | 115 | No |
| Success green | `#10B981` | 94 | No |
| Danger red | `#EF4444` | 77 | No |
| **Dark surface** | `#30363D` | 57 | No |
| **Dark muted text** | `#8B949E` | 51 | No |

The last two are GitHub's dark-theme greys — but see the correction below before drawing conclusions from them.

A documented brand pair does exist outside the UI: `primaryColor: '#0D2137'` and `accentColor: '#E8701A'` in `src/core/report-builder/ReportLayoutService.ts` and `app/api/settings/print-settings/route.ts`. So the product has a defined brand — it is applied to **generated PDFs and print output only**. The accent orange `#E8701A` is essentially absent from the interactive interface.

### Palettes actually visible to a user

Establishing this required separating live code from dead code, which changed the conclusion materially:

| Palette | Where | Live? |
|---|---|---|
| Brand navy `#0D2137` / hover `#1A3A5C` | `NavBar` active states, `WorkpackLayout` sidebar, platform CTAs | **Yes** — the strongest brand adoption |
| Tailwind blue `blue-600` | Dashboard primary CTAs, `ReportDesigner` save | **Yes** |
| Schedule-grid navy `#1E3A5F` | `ScheduleContainer.tsx:1678` sticky grid header | **Yes** — a *third* navy, adjacent to the other two |
| Slate cockpit `slate-900`/`950` + `cyan-400` | `ExecutionCockpit` | **Yes** |
| Toolbar `gray-900` | `planner-workspace/WorkspaceToolbar.tsx:99` | **Yes** — a fourth dark chrome |
| Indigo `#6366F1` + inline styles | `workpack-factory/page.tsx:420` | **Yes** |
| Inline dark slate `#0F172A`/`#1E293B` | `planner-workspace/evm/CostControlDashboard.tsx` — dark panel inside a light page | **Yes** |
| MS Project green `#2B7344` | `LevelingPreviewModal.tsx:92,103,229` only | **Yes, but narrow** |
| GitHub-dark `#0D1117`/`#30363D`/`#8B949E` | `src/components/ta-dashboard.tsx` | **No — dead code** |

**Two corrections to earlier working hypotheses, recorded because the audit brief requires that reversals be visible rather than quietly dropped:**

1. **`#2B7344` is not "the schedule ribbon green."** `ScheduleRibbon.tsx` uses it six times, but that component is never rendered — the only occurrences of the string `ScheduleRibbon` in `app/` or `src/` are inside its own file, and it is one of the three unbuildable `gantt-task-react` files from §5. The green survives in live UI only through `LevelingPreviewModal`, which *is* rendered (`ScheduleContainer.tsx:1962`, `ResourcePlanningDashboard.tsx:331`). So this is a modal-scoped inconsistency, not a module-defining one.

2. **`src/components/ta-dashboard.tsx` is dead code.** It is the worst file in the repository by two independent measures — **619 hex literals** and **199 TypeScript errors** — and it is imported by nothing. The route `/projects/[id]/ta-dashboard` renders a *different* file, `app/(dashboard)/projects/[id]/ta-dashboard/page.tsx`. The only match for `ta-dashboard'` anywhere is a breadcrumb label string in `GlobalBreadcrumb.tsx:74`. There is therefore **no GitHub-dark skin in the shipping product**, and the 199 errors are not a user-facing risk. It is, however, 619 hex literals and 199 errors of pure liability sitting in the tree. **P3.**

Net: **seven live competing palettes**, including three different navies. **P2** (D-009, D-010).

### Two competing styling systems

The application is written in Tailwind *and* in CSS-in-JS, chosen per file by whoever wrote it:

| File | Inline `style={{}}` count |
|---|---|
| `app/(dashboard)/workpack-factory/page.tsx` | **68** |
| `src/components/planner-workspace/evm/CostControlDashboard.tsx` | **37** |
| `app/(dashboard)/projects/[id]/ta-dashboard/page.tsx` | 17 |
| `src/components/planner-workspace/WorkspaceGantt.tsx` | 11 |
| `src/components/Schedule/ScheduleContainer.tsx` | 10 |

`app/(dashboard)/ois/page.tsx` is the clearest example: **393 lines styled entirely with inline objects and no Tailwind class at all** — `padding: '32px'`, `borderRadius: '14px'`, and a purple-to-blue gradient button (`linear-gradient(135deg, #3B82F6, #8B5CF6)`) that appears nowhere else in the product. A user moving from Workpacks to OIS crosses a visible design boundary.

`app/globals.css` adds a third layer: hand-written `.settings-card`, `.settings-table`, `.settings-card-header` classes with their own hard-coded hex values and their own density (`padding: 10px 14px`, `font-size: 13px`), used only by Settings. Settings therefore has a table style that no other module shares.

### Dark / light theme

**Dark mode is not implemented.** There is no toggle, no provider, no `darkMode` config, and the config file is not loaded. The 61 `dark:` variants in the codebase are **inert** — they can never match. Simultaneously, several screens are *hard-coded* dark: `ExecutionCockpit` and the execution family use `slate-800`/`slate-900` surfaces with `slate-300`/`slate-400` text, while Planning, Workpacks, and Settings are hard-coded light.

The result is not a dark theme; it is a light product with permanently dark rooms inside it. A user in `/execution` and a user in `/planning/activities` are looking at what appear to be two different applications. **P2** (D-010).

*Contrast ratios were not measured — that requires rendering. Unverified.*

### Typography, spacing, density

No type scale exists, so page titles were set independently per page. Sampled: `text-2xl font-bold` (`dashboard/page.tsx:43`), `text-xl font-bold` (`reports/page.tsx:13`), `fontSize: '28px', fontWeight: 800` (`ois/page.tsx:107`). Three page-title treatments in three pages. Page padding likewise varies — `p-6` (dashboard), `px-6 py-4` (reports), `padding: '32px'` (OIS). Settings tables run at 13px via `globals.css`; other tables set their own sizes. **P2** (D-014).

---

## 12. GANTT AUDIT

Two independent Gantt implementations exist, plus an abandoned third:

| Implementation | File | Size | State |
|---|---|---|---|
| Schedule Gantt (live) | `src/components/Schedule/ScheduleGantt.tsx` | 17.1 KB | **Real.** Bespoke SVG/DOM Gantt. `POST /api/schedule/calculate` with `event_id`; renders `is_critical`, day/week/month zoom, critical-path filter, synchronised left-table/right-chart scrolling (`handleLeftScroll`/`handleRightScroll`, lines 84-94). |
| Workspace Gantt | `src/components/planner-workspace/WorkspaceGantt.tsx` | — | Separate implementation, 11 inline style blocks |
| `gantt-task-react` wrappers | `ScheduleRibbon.tsx`, `TaskListTable.tsx`, `taskTransformer.ts` | 12.9 KB | **Dead and unbuildable** — dependency not installed (see §5) |

The live Gantt is genuine CPM visualisation, not a mock-up — this is one of the stronger parts of the product. Two caveats: it displays a fabricated title when embedded (§9), and it reports failure only to `console.error` (line 50), leaving the user with an empty chart.

`ScheduleContainer.tsx` is **101.7 KB in a single file** — the largest UI file in the repository and a maintainability risk on its own. **P3** (D-020).

*Rendering fidelity, dependency-line drawing, and drag behaviour were not verified — no runtime access.*

---

## 13. RESPONSIVE AUDIT

| Signal | Value |
|---|---|
| UI files containing **no** breakpoint (`sm:`/`md:`/`lg:`/`xl:`) | **375 of 490 (76.5%)** |
| `sm:` / `md:` / `lg:` / `xl:` occurrences | 136 / 160 / 109 / 13 |
| `overflow-x-auto` (horizontal-scroll escape hatch) | 59 |
| Fixed pixel widths `w-[…]` | 94 |
| Fixed minimum widths `min-w-[…]` | 50 |

The application shell is responsive: `NavBar` collapses to a hamburger below `lg` (`src/components/NavBar.tsx:397`) and `MobileDrawer` is a complete mobile menu. Both layouts respect `env(safe-area-inset-top)`.

Below the shell, three-quarters of the interface has no responsive intent, and `xl:` — the breakpoint that matters for the wide control-room monitors this product targets — is used 13 times in 490 files. The 144 fixed width declarations are the concrete risk: a `min-w-[1200px]` grid inside a tablet viewport overflows.

`/execution/mobile` deserves specific note: it is the designated mobile field surface, it is built, and it has **no navigation entry** (§7). A field technician cannot find the mobile view from the mobile UI. **P2** (D-015).

*No viewport was rendered at any width. All layout-breakage claims are unverified inferences from fixed dimensions.*

---

## 14. ACCESSIBILITY AUDIT

Measured across the same 490 UI files.

| Signal | Count | Assessment |
|---|---|---|
| `<input>` + `<select>` + `<textarea>` | 705 + 281 + 73 = **1,059** | — |
| `htmlFor` label associations | **41** | **~96% of form controls have no programmatic label** |
| `<button>` elements | **1,379** | — |
| `aria-label` | **14** | Icon-only buttons are unnamed to assistive tech |
| `aria-live` | **0** | No async state change is ever announced |
| `aria-describedby` | **0** | No validation message is associated with its field |
| `aria-modal` | **0** | — |
| `fixed inset-0` overlays (modals) | **85** | — |
| `role="dialog"` | **1** | 84 modals are invisible to screen readers |
| `aria-expanded` / `aria-haspopup` | **1 / 1** | Both in `ActiveShutdownSelector.tsx:46-47`; `NavDropdown` has neither |
| `onClick` on `<div>`/`<span>` | **47** | Not keyboard reachable |
| `tabIndex` | 8 | Insufficient to remediate the above |
| `sr-only` | **1** | — |
| `role="…"` (all roles) | 15 | — |
| Escape-key handling | 20 | vs 85 modals |
| `<img>` / `alt=` | 14 / 14 | **Compliant** |

**Verdict: the application does not meet WCAG 2.1 Level A**, and would fail an enterprise accessibility procurement review. This is not a matter of polish — 1,059 form controls with 41 labels means screen-reader users cannot complete data entry, and 47 keyboard-unreachable click targets means keyboard-only users cannot complete some journeys at all.

There is positive evidence of intent: `focus:ring` appears **539** times, so visible focus styling was applied consistently. The gap is semantics and ARIA, not focus indication. `ActiveShutdownSelector` is correctly built (`aria-label`, `aria-haspopup`, `aria-expanded`, `title`) and is the pattern the other dropdowns should follow. **P1** (D-004).

*Screen-reader behaviour, focus order, and focus trapping were not tested — no runtime access.*

---

## 15. SOURCE CODE QUALITY AUDIT (UI)

### `next.config.ts:25-27` disables the type gate

```
typescript: {
  ignoreBuildErrors: true,
},
```

`npx tsc --noEmit` exits 2 with **1,305 errors**.

| Error code | Count | Meaning |
|---|---|---|
| `TS2339` | 333 | Property does not exist on type |
| `TS2322` | 211 | Type not assignable |
| `TS2353` | 153 | Unknown object-literal property |
| `TS7006` | 124 | Implicit `any` parameter |
| `TS2345` | 98 | Argument type mismatch |
| `TS2551` | 97 | Property does not exist (near-miss name) |
| `TS2561` | 78 | Unknown property, did you mean… |
| `TS2307` | 10 | **Cannot find module** |
| `TS1149` | 1 | **Casing conflict** — the P0 in §5 |

| Worst file | Errors |
|---|---|
| `src/components/ta-dashboard.tsx` | **199** |
| `src/core/Platform/ProvisioningJobService.ts` | 32 |
| `src/core/ois/DashboardVersioningService.ts` | 19 |
| `src/core/Platform/SeedPackService.ts` | 19 |
| `app/api/projects/[id]/punch/route.ts` | 17 |

The 97 `TS2551` and 78 `TS2561` errors are the ones to worry about: those codes fire on *misspelled or renamed* property names. That is the same class of bug as `activeSite` in §9 — a silent read of `undefined` that renders a wrong value rather than crashing. There are 175 further candidates of that shape, unexamined.

**With `ignoreBuildErrors: true`, a green build proves only that the bundler resolved every import.** It does not indicate correctness. **P1** (D-002).

### Other hygiene signals

| Signal | Count | Verdict |
|---|---|---|
| `console.log` in UI files | 5 files | Acceptable |
| `TODO` / `FIXME` in UI files | **1 file** | Genuinely clean |
| `alert()` | 29 files | See §10 — **P2** |
| `window.location` assignment (defeats client routing) | `ois/page.tsx:72,86`; `login/LoginForm.tsx:79` | **P3** (D-021) |
| Largest UI file | `ScheduleContainer.tsx` @ 101.7 KB | **P3** (D-020) |
| Fabricated display data (`Math.random`) | 0 instances | **Cleared** |

---

## 16. DEPLOYMENT REPRODUCIBILITY — THE APPLICATION IS NOT IN THE REPOSITORY

| Measurement | Value |
|---|---|
| Branch | `develop` |
| HEAD | `6e45b54` — *"fix: support explicit UUID models in seed and bootstrap scripts"*, **2026-08-01** |
| Total working-tree entries changed | **1,164** |
| Untracked files | **895** |
| Modified files | 267 |
| Deleted files | 2 |
| Untracked `.ts`/`.tsx` under `app/` or `src/` | **324** |
| **Route pages untracked** | **14** |
| Route pages modified but uncommitted | 23 |
| Files tracked under `src/components` | 184 (working tree holds far more) |

The 14 untracked routes:

```
app/(dashboard)/execution/page.tsx                              ← M12
app/(dashboard)/execution/mobile/page.tsx                       ← M12
app/(dashboard)/execution/lookahead/page.tsx                    ← M12
app/(dashboard)/execution/plan-vs-actual/page.tsx               ← M12
app/(dashboard)/reports/page.tsx                                ← M14
app/(dashboard)/events/[eventId]/management-intelligence/page.tsx ← M15
app/(dashboard)/events/[eventId]/execution-readiness/page.tsx
app/(dashboard)/asset-register/[assetId]/360/page.tsx
app/(dashboard)/planning/activities/page.tsx
app/(dashboard)/planning/readiness/page.tsx
app/(dashboard)/shutdowns/page.tsx
app/(dashboard)/workpack-factory/page.tsx
app/platform/provisioning-jobs/page.tsx
app/platform/provisioning-templates/page.tsx
```

None of these is git-ignored — `git check-ignore` returns nothing for them. They were simply never added.

`Dockerfile:32` builds with `COPY . .`, so a build run *on this machine* would include them. A build run by CI, or by any other engineer after a clone, would not. **The audited application exists in exactly one place: this working tree.** Everything in §7's orphan register that is untracked is doubly lost — unreachable in the UI *and* absent from version control.

`src/components/Schedule/ScheduleGantt.tsx` — the live Gantt — is among the untracked files. **P0** (D-003).

---

## 17. MODULE-BY-MODULE ASSESSMENT

| Module | Routes | Built? | Reachable? | In git? | Verdict |
|---|---|---|---|---|---|
| Auth / login | 4 | Yes | Yes | Yes | **Usable**, but post-login redirect 404s on a non-ready system (§4) |
| Home / Dashboard | 1 | Yes — real Prisma counts | Yes | Modified | **Usable with 2 broken CTAs** (§4 #4, #5) |
| Digital Plant | 2 | Yes | Yes | Yes | **Usable** |
| Asset Register | 5 | Yes | Partly — 3 sub-routes orphaned | 360 view untracked | **Usable, intake orphaned** |
| Shutdown Scope | 6 | Yes | Partly — compare/create orphaned | Yes | **Usable, incomplete entry points** |
| Engineering Issues | 3 | Yes | Partly — import orphaned | Yes | **Usable** |
| Workpacks | 3 | Yes | Yes | Yes | **Usable** — has `loading.tsx` + `not-found.tsx`, best-practised module |
| Workpack Factory / Intelligence | 5 | Yes | Partly | Factory untracked | **Usable, 68 inline styles** |
| Planning (M10/M11) | 14 | Yes | Yes | 2 untracked | **Usable** |
| Schedule / Gantt (M11) | 1 | Yes | Yes | **Untracked** | **P0 casing defect blocks Linux build** (§5) |
| Execution (M12) | 4 | Yes | 3 of 4; `/mobile` orphaned | **All 4 untracked** | **At risk — absent from git** |
| Control Tower (M13 / OIS) | 6 | Yes | **No — all 6 orphaned** | Yes | **Invisible to users** |
| M13 `ControlTowerDashboard` | — | **No — unbuildable** | No | — | **Dead code** (§5) |
| Reporting (M14) | 6 | Yes | **No — all 6 orphaned** | `/reports` untracked | **Invisible to users** |
| Management Intelligence (M15) | 1 | Yes | **No — orphaned** | **Untracked** | **Invisible and absent from git** |
| AI / M16 | 2+ | Yes | `/dashboard/ai-config` orphaned | Yes | **Partly reachable** |
| Settings | 31 | Yes | Yes | Yes | **Usable**; 2 nav items are "Coming Soon" (§6) |
| Platform console | 38 | Yes | Yes — metadata-driven | 2 untracked | **Usable — best-architected shell** |
| Platform master data | 16 | Partly | Yes | Yes | **5 of 16 are placeholders** (§6) |

---

## 18. LEGACY / DUPLICATE UI REGISTER

| # | Duplication | Evidence | Severity |
|---|---|---|---|
| 1 | Two navigation architectures | Hardcoded `app/(dashboard)/layout.tsx:46-125` vs metadata `PLATFORM_NAV`; violates `docs/PLATFORM_TENANT_SEGREGATION.md:194` | **P1** |
| 2 | Two styling systems | Tailwind vs 1,547 inline `style={{}}` in 132 files; plus a third layer of `.settings-*` classes in `globals.css` | **P2** |
| 3 | Three Gantt implementations | `Schedule/ScheduleGantt` (live), `planner-workspace/WorkspaceGantt` (live), `gantt-task-react` wrappers (dead) | **P1** |
| 4 | Two reporting entry points | `/reports` (M14 Report Center) and `/report-builder` (5 routes) — both orphaned, relationship undocumented | **P1** |
| 5 | Two schedule-page tabs | `/schedule` toggles `ScheduleGantt` and `ScheduleContainer` (101.7 KB) as "Interactive CPM Gantt" / "Shift Execution Tracking" | **P3** |
| 6 | `src/app/` shadow tree | 3 API handlers under `src/app/api/reports/**` that Next.js does not serve; no `app/api/reports/` exists | **P2** |
| 7 | Dead exported metadata | `TENANT_SHELL_SECTIONS` (`navigation.ts:140`) — zero consumers | **P1** |
| 8 | Dead server helper | `getActiveShutdownServer` (`shutdownContext.ts:8`) — zero call sites, documented in 3 milestone reports | **P2** |
| 9 | Dead placeholder component | `app/platform/_components/PlatformComingSoon.tsx` — zero consumers | **P3** |
| 10 | Duplicate route pairs | `/constraints` vs `/projects/[id]/constraints`, `/punch`, `/permits`, `/safety`, `/schedule`, `/reports`, `/imported-schedule`, `/lookahead` — reconciled at runtime by `NavBar.rewriteItems` (`NavBar.tsx:340-353`) | **P3** |

---

## 19. BROWSER VERIFICATION STATUS

**Status: NOT PERFORMED — BLOCKED. Zero routes were loaded in a browser.**

| Requirement | Status |
|---|---|
| Routes loaded in a browser | **0 of 193** |
| Screenshots captured | **0** |
| Controls clicked | **0** |
| Console errors observed | **none — not observable** |
| Network failures observed | **none — not observable** |

**Why:** no browser-automation capability exists in this environment, and no application server was running (`localhost:3000` TCP probe → `False`).

**What this means for the findings above.** The static findings are strong where they rest on file existence, dependency resolution, compiler output, and git state — those are facts, not inferences. They are weakest on rendered appearance. Specifically **unverified**: actual 404 page rendering, hydration errors, real colour contrast, real layout overflow, chart and Gantt rendering fidelity, focus order and focus trapping, and whether the six context-consuming screens visibly re-fetch on shutdown change.

**Minimum runtime verification needed before acting on §11–§14:**

1. `npm run dev`, then load all 193 routes as each of: tenant viewer, planner, execution supervisor, tenant admin, platform admin — recording console errors and HTTP status.
2. `docker build --target builder .` to confirm or clear the P0 in §5.
3. Screenshot every route at 375 px, 768 px, 1440 px, and 2560 px.
4. Run `axe-core` on every route to convert §14's counts into a WCAG violation list.

## 20. VISUAL SCREENSHOT REVIEW

**Status: NOT PERFORMED — BLOCKED.** No screenshots were taken and none are presented. Any visual assessment I offered here would be fabricated. §11's conclusions are derived from stylesheet and class-name evidence only.

---

## 21. PAGE COMPLETENESS MATRIX (AGGREGATE)

| Classification | Routes | Share |
|---|---|---|
| **Complete and reachable** | ~128 | 66.3% |
| **Complete but unreachable (orphaned)** | 33 | 17.1% |
| **Explicit placeholder ("Coming Soon" / "Phase X")** | 13 | 6.7% |
| **Finished UI over a `501` stub backend** | 5 | 2.6% |
| **Visual shell / navigation-only** | 3 (`/punch`, `/permits`, `/imported-schedule`) | 1.6% |
| **Reachable but carrying a dead or false control** | 8 | 4.1% |
| **Hangs on an infinite spinner for a new tenant** | 2 (`/execution`, `/execution/mobile`) | 1.0% |
| **Blocked by a build-level defect** | 1 (`/schedule`) | 0.5% |
| **Redirect shims / legacy aliases** | 5 | — |
| **Referenced but nonexistent (404 targets)** | 14 distinct | — |

Per-route classification: orphans in §7, placeholders in §6, stub backends in §4A, dead controls in §10A. **The ~128 classified as complete rest on static evidence — API-backed fetching and real handlers — not observed behaviour.** Runtime verification could move routes out of that group; it cannot move any into it.

The revision from ~148 to ~128 is the result of the four parallel evidence sweeps: the additional 501-backed screens, project-scoped stubs, navigation-only shells, and dead-control pages were all previously counted as complete.

---

## 22. FINAL DEFECT REGISTER

| ID | Sev | Defect | Primary evidence |
|---|---|---|---|
| **D-001** | **P0** | `/admin/setup` and `/admin/tenants` do not exist; 6 references, including the post-login redirect and 2 Dashboard CTAs | `app/page.tsx:19`; `app/login/LoginForm.tsx:79`; `app/(dashboard)/workpacks/layout.tsx:14`; `app/(dashboard)/dashboard/page.tsx:86,90`; `AdminUsersClient.tsx:127` |
| **D-002** | **P1** | 1,305 TypeScript errors with the type gate disabled | `next.config.ts:26`; `tsc --noEmit` exit 2 |
| **D-003** | **P0** | Application not reproducible from git: 895 untracked files, 324 UI sources, 14 route pages including all of M12 | `git status --porcelain -uall`; HEAD `6e45b54` 2026-08-01 |
| **D-004** | **P1** | Fails WCAG 2.1 A: 1,059 controls / 41 labels; 1,379 buttons / 14 `aria-label`; 85 modals / 1 `role="dialog"`; 0 `aria-live` | Occurrence counts over 490 files, §14 |
| **D-005** | **P1** | 27 complete routes have no inbound navigation, including all of M13, M14, M15 | §7; `app/(dashboard)/layout.tsx:46-125` |
| **D-006** | **P1** | Two navigation architectures; `TENANT_SHELL_SECTIONS` (which declares Reports) has zero consumers | `navigation.ts:140-151`; `security/index.ts:4`; `docs/PLATFORM_TENANT_SEGREGATION.md:194` |
| **D-007** | **P1** | Global Active Shutdown selector governs 6 of 193 routes; server-side resolver is dead code | §8; `shutdownContext.ts:8` (0 call sites) |
| **D-008** | **P1** | Zero `error.tsx` / `global-error.tsx`; 1 `ErrorBoundary` used in 1 place | Recursive search of `app/` and `src/`; `WorkpackTabs.tsx:1599` |
| **D-009** | **P2** | No design system: config not loaded, no tokens, 2,062 hex literals, 1,547 inline styles | `globals.css:1` (no `@config`); `tailwind.config.ts` |
| **D-010** | **P2** | Three competing palettes; dark mode unimplemented but 61 inert `dark:` variants | `#0D2137`×193, `#30363D`×57, `#8B949E`×51; 0 theme providers |
| **D-011** | **P2** | `alert()` is the primary feedback mechanism in 29 files; no global toast | §10 |
| **D-012** | **P2** | `activeSite` does not exist on the context type; fabricated site names render, incl. on the Daily Execution Shift Report | 3× `TS2339`; `ExecutionCockpit.tsx:352,1037` |
| **D-013** | **P2** | Embedded Gantt renders a hardcoded shutdown identity | `ScheduleGantt.tsx:18` |
| **D-014** | **P2** | No type or spacing scale; 3 page-title treatments in 3 sampled pages | `dashboard:43`, `reports:13`, `ois:107` |
| **D-015** | **P2** | 76.5% of UI files have no breakpoint; 144 fixed dimensions; `/execution/mobile` orphaned | §13 |
| **D-016** | **P2** | 9 placeholder routes, 4 of them advertised in navigation | §6 |
| **D-017** | **P2** | API failures render as empty states, indistinguishable from no data | `ois/page.tsx:48`; `ActiveShutdownContext.tsx:64-67` |
| **D-018** | **P2** | `setActiveShutdown` never calls `router.refresh()` — latent stale-server-data trap | `ActiveShutdownContext.tsx:105-116` |
| **D-019** | **P1** | Dead unbuildable UI: M13 `ControlTowerDashboard` (missing `ui/card`, `ui/alert`); 3 Gantt files (missing `gantt-task-react`); tests assert on their source text | 5× `TS2307`; `tests/m11-v1-schedule-view.test.ts:405` |
| **D-020** | **P3** | `ScheduleContainer.tsx` is 101.7 KB in one file | Filesystem |
| **D-021** | **P3** | `window.location` used instead of the router (29 occurrences in UI) | `ois/page.tsx:72,86`; `LoginForm.tsx:79` |
| **D-022** | **P3** | Dead nav active-state checks for nonexistent `/operations` and `/portfolio` | `NavBar.tsx:454,462` |
| **D-023** | **P0** | Integrations "Test connection" fabricates success with a deliberate 1.5 s delay and no network call; 4 of 6 providers succeed unconditionally | `app/api/settings/integrations/test/route.ts:15-42` |
| **D-024** | **P1** | "Commit to Register" (P&ID extraction) and GDPR "Request Full Data Archive" are `alert()`-only; nothing persists | `extract-pid/page.tsx:41-45`; `TabDataStorage.tsx:87-91` |
| **D-025** | **P1** | Execution Cockpit and Mobile Execution hang on an infinite spinner when no shutdown is selected — the state of every new tenant | `MobileExecutionView.tsx:16-17,73`; `ExecutionCockpit.tsx:67-81` |
| **D-026** | **P1** | Self-service password recovery entirely non-functional — 3 endpoints return `501` | `api/auth/{forgot-password,reset-password,verify-token}/route.ts` |
| **D-027** | **P1** | SSO and AI Prompt Library present finished config UIs over `501` stub backends | `api/settings/sso/route.ts`; `api/ai-prompts/route.ts` |
| **D-028** | **P1** | 8 live UI screens call 8 endpoints that do not exist (`/api/sites`, `/api/planner-workspace/readiness`, `/api/templates`, …); failures are swallowed and render as empty data | §10B |
| **D-029** | **P1** | 8 further 404 targets in live UI, incl. the install wizard's final "Go to Login" CTA, "Manual Entry", and "View full audit log" | §4, entries 7–16 |
| **D-030** | **P1** | The Settings 404 page's own recovery links are 404s, marked `available: true` | `settings/not-found.tsx:14,15,17,18` |
| **D-031** | **P2** | 4 project-scoped modules are "Phase X — coming soon" stubs while the same features are complete at org/event scope | `projects/[id]/{equipment,safety,punch,permits}/page.tsx` |
| **D-032** | **P2** | 11 dead or non-functional controls (empty handlers, missing `onClick`, hover-only dropdown) | §10A |
| **D-033** | **P2** | 6 Planner Workspace inspector tabs and 4 user-preference tabs are placeholders; Workpack Factory KPI target hardcoded | `InspectorPanel.tsx:89-101`; `UserPreferencesModal.tsx:9-18`; `workpack-factory/page.tsx:126-133` |
| **D-034** | **P2** | Three icon paradigms: emoji in nav labels and tabs, Lucide in execution/schedule, inline SVG in NavBar | `layout.tsx:47-61`; `ExecutionCockpit.tsx:472`; `NavBar.tsx:116` |
| **D-035** | **P3** | `src/components/ta-dashboard.tsx` — 619 hex literals, 199 TS errors, imported by nothing | §11 correction |
| **D-036** | **P3** | `SettingsSidebar.tsx` — unused component carrying 8 broken hrefs | §4, cleared section |
| **D-037** | **P0** | Import casing mismatch breaks the Linux/Docker build: `@/components/schedule/…` vs on-disk `Schedule/` | `app/(dashboard)/schedule/page.tsx:4`; `tsc` `TS1149`; `Dockerfile:24-38` |

**P0 entries: D-001, D-003, D-023, D-037.** The executive summary lists five release blockers; the fifth (three modules unreachable) is registered as **D-005 at P1 severity** because no single control is broken — the defect is an absence. It is nonetheless release-blocking in commercial terms, since a customer cannot use what they cannot find.

The `/schedule` casing defect (**D-037**) is the single highest-leverage fix in this register: one character, and it unblocks the production container build.

---

## 23. REMEDIATION PRIORITY

Ordered by user impact per unit of effort. **No architecture is reopened. No engine is duplicated. M8.13, M11, M12, M13, M14, M15, and M16 service layers are untouched by every item below.**

### Immediately — restores basic usability (hours)

1. **Repoint 6 references from `/admin/*` to `/platform/*`.** Six one-line edits at the sites in §4. Ends the post-login 404.
2. **Fix the import casing** at `app/(dashboard)/schedule/page.tsx:4`: `@/components/schedule/…` → `@/components/Schedule/…`. One character. Unblocks the Linux/Docker build.
3. **Commit the working tree.** 895 untracked files, 14 of them routes. Until this is done, nothing else in this list is durable.

### Before any customer sees the product (days)

4. **Disable the Integrations "Test connection" button** (D-023). Until a real connectivity check exists, a disabled control is honest and a fabricated success is not. This is a minutes-long change and it removes the audit's only misrepresentation exposure. Do it before item 1 if a demo is imminent.
5. **Add navigation entries for the 33 orphaned routes** — starting with Reports (M14), OIS (M13), Management Intelligence (M15), and `/execution/mobile`. Do this by making the tenant shell read `TENANT_SHELL_SECTIONS`, not by adding more hardcoded array entries; that fixes D-005 and D-006 together and honours `docs/PLATFORM_TENANT_SEGREGATION.md:194`.
6. **Clear the `setLoading(false)` early-return in both execution views** (D-025) and render an empty state. Two lines. Removes the infinite spinner every new tenant currently meets.
7. **Fix the remaining 8 404 targets** (D-029, D-030), prioritising the install wizard's "Go to Login" CTA and the Settings 404 page's own recovery links.
8. **Repoint the 8 nonexistent API calls** at their real endpoints (D-028) — `/api/sites` → `/api/hierarchy/sites`, and so on. These are empty dropdowns on live planning screens today.
9. **Add `app/error.tsx` and `app/global-error.tsx`**, plus segment-level boundaries for `(dashboard)`, `platform`, and `platform-data`. Four files.
10. **Add `activeSite` to `ActiveShutdownContextType`** and populate it from `activeShutdown.site`. Removes the fabricated site name from the Daily Execution Shift Report.
11. **Decide and state the Active Shutdown contract.** Either extend it to the modules a planner expects it to filter, or relabel the pill so it stops promising a filter it does not apply. Deleting the dead `getActiveShutdownServer` or wiring it in is part of this decision.
12. **Label the five `501`-backed screens honestly** (D-027) — SSO, Integrations, AI Prompt Library. A visible "not available in this release" banner costs nothing and prevents an administrator wasting an hour on a form that cannot save.

### Before release (weeks)

13. **Implement password recovery** (D-026), or remove the "Forgot password?" link from the login page and document the administrator-reset path. The current state — a working-looking public form behind a `501` — is the worst of the three options.
14. **Define design tokens.** Add `@theme` to `globals.css` (Tailwind v4) or an `@config` directive, then migrate the 193 `#0D2137` literals first. Delete `tailwind.config.ts` if it stays unloaded.
15. **Add a global toast provider** and replace 29 files' `alert()` calls.
16. **Choose one styling system.** Convert the worst inline-style offenders — `workpack-factory` (68), `CostControlDashboard` (37), `ois/page.tsx` (whole file).
17. **Accessibility pass:** `htmlFor` on 1,059 controls, `aria-label` on icon buttons, `role="dialog"` + `aria-modal` + Escape + focus trap on 85 modals, `aria-live` on async regions, and convert 47 clickable `div`/`span` to `button`.
18. **Either implement dark mode or delete the 61 inert `dark:` variants.** The hard-coded dark execution screens should become a deliberate token-driven choice.
19. **Delete the dead unbuildable code** (D-019, D-035, D-036): `ControlTowerDashboard`, the three `gantt-task-react` files, `ta-dashboard.tsx` (619 hex literals, 199 TS errors), `SettingsSidebar.tsx`, `PlatformComingSoon.tsx`. Replace the source-text-reading M11 tests with behavioural ones.
20. **Wire up or remove the 11 dead controls and 10 placeholder tabs** (D-032, D-033). A removed control is better than a control that does nothing.
21. **Turn `ignoreBuildErrors` off.** Start by fixing the 97 `TS2551` and 78 `TS2561` errors — those are the `activeSite`-class bugs that silently render wrong values.
22. **Remove the `src/app/` shadow tree** after confirming nothing needs `/api/reports/*`.

### Verification gate (must happen before the score in §24 can be raised)

23. Execute the four steps in §19. **No completeness claim above 80% is defensible until at least step 1 is done.**

---

## 24. FINAL PRODUCT COMPLETENESS SCORE AND VERDICT

| Dimension | Weight | Score | Basis |
|---|---|---|---|
| Backend / API surface | 15% | **85%** | 631 route handlers and real Prisma, less 6 `501` stubs and 8 endpoints the UI calls that don't exist |
| Route coverage (pages exist) | 5% | **95%** | 193 routes across every declared module — a weak completeness signal, weighted low |
| Feature depth where implemented | 15% | **82%** | Genuine CPM, EVM, OIS builder, report engine; 13 placeholders and 3 shells |
| **Navigation & reachability** | 15% | **55%** | 33 complete routes have no way in; 3 milestones invisible |
| **Journey integrity (no dead ends)** | 10% | **30%** | 14 distinct 404 targets incl. post-login and end-of-install; 2 screens hang for new tenants; no password recovery |
| **Design consistency** | 10% | **35%** | Zero tokens; 7 live palettes incl. 3 navies; 2 styling systems; 3 icon paradigms |
| **Error / empty / loading states** | 5% | **40%** | Zero error boundaries; failures render as empty; 2 infinite spinners |
| **Accessibility** | 10% | **20%** | Fails WCAG 2.1 A on labels, ARIA, keyboard |
| **Responsive** | 5% | **45%** | 76.5% of files have no breakpoint |
| **Deployability / reproducibility** | 5% | **25%** | Not buildable from git; Linux build blocked |
| **Trustworthiness of UI assertions** | 5% | **20%** | Integrations test fabricates success; fabricated site name on a shift report |
| **Weighted total** | 100% | **53%** | |

*Method: score × weight summed, ÷ 100. Sum = 5,305 ÷ 100 = 53.1%. This is down from the 62% recorded before the four parallel evidence sweeps completed; the reduction comes from the `501`-backed screens, the two hanging execution routes, the absent password recovery, and the fabricated integration test — none of which were visible in the first pass.*

### FINAL SYSTEM VERDICT

**NOT READY FOR RELEASE. NOT READY FOR CUSTOMER DEMONSTRATION. NOT READY FOR PILOT DEPLOYMENT.**

The distinguishing feature of this system is that **its problems are cheap to fix and its strengths are expensive to build**. The engines are real — critical-path scheduling, earned value, an OIS dashboard builder, a report engine, 631 API handlers. That work is done and it is not what is failing.

What is failing is the last mile. A user who logs into a fresh installation lands on a 404 because six string literals were not updated during an `/admin/*` → `/platform/*` rename. Three finished milestones are invisible because one exported metadata object has no consumers. The Docker build cannot succeed on Linux because one import has a lowercase `s`. And none of it is committed to version control.

**The four items that must be true before anything else is worth doing:**

1. The Integrations "Test connection" button no longer fabricates success — **the product stops telling customers something untrue.**
2. `/admin/setup` and `/admin/tenants` no longer referenced — **a user can log in and reach a working screen.**
3. The tenant shell reads `TENANT_SHELL_SECTIONS` — **M13, M14, and M15 become reachable.**
4. The working tree is committed and `docker build` succeeds — **the product exists somewhere other than one laptop.**

Items 1, 2, and 4 are hours of work. Item 3 is days. After them, this becomes a product with quality debt — poor accessibility, no design system, inconsistent theming, several honestly-unfinished features — rather than a product a user cannot get into and cannot trust. That is a materially different conversation with a customer.

**One caution about sequencing.** Items 2 and 3 make previously unreachable surfaces reachable. Some of what becomes reachable is not ready to be seen: the five `501`-backed configuration screens, the 13 placeholders, and the two hanging execution routes. Fixing navigation without also completing items 6, 7, and 12 of §23 would convert invisible defects into visible ones. The reachability work and the honesty work must ship together.

**Confidence statement.** High confidence in every finding grounded in file existence, dependency resolution, compiler output, and git state — those were executed, not estimated. Moderate confidence in the visual and responsive findings, which rest on stylesheet evidence without rendering. **The 53% score is a static-analysis ceiling: runtime verification can only lower it.** Sections 19 and 20 record honestly that no browser verification was performed and explain why.

**On reversals.** Four claims were investigated and then withdrawn rather than reported, and they are documented in place because a forensic audit that hides its own corrections is not auditable: the `#2B7344` "schedule ribbon green" (dead component), the "GitHub-dark TA dashboard skin" (`ta-dashboard.tsx` is imported by nothing), the eight `SettingsSidebar` 404s (component unused), and five "broken" TA-dashboard endpoints (dead fallback branches behind working primaries). A fifth was reframed: `src/middleware.ts` living outside the `app/` root looks like a misconfiguration but is genuinely loaded — `.next/server/middleware-manifest.json` proves it. Each of these would have inflated the defect count with work that does not need doing.

---

*Audit performed read-only. No product code, route, schema, API, or UI file was modified. Architectural authorities M8.13, M11, M12, M13, M14, M15, and M16 were inspected and left intact; no engine was duplicated and no new engine proposed.*
