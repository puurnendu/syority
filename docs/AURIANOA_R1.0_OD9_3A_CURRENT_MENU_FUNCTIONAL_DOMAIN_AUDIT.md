# AURIANOA R1.0 — OD9.3A CURRENT MENU FUNCTIONAL & DOMAIN AUDIT

**Task:** OD9.3A — Read-only forensic audit of the tenant menu after OD9.3 GREEN  
**Date:** 2026-09-10  
**Mode:** READ-ONLY. No code, database, route, navigation, API, service, or schema changes.  
**Browser testing:** **NOT VERIFIED**  
**Predecessor constraints:** OD9.2 domain freeze; OD9.3 Project Portfolio Foundation GREEN

---

## 1. EXECUTIVE SUMMARY

The prompt’s “current visible menu” (DASHBOARD / PLANNING / EXECUTION / INTELLIGENCE / IMPORT-EXPORT) is the **pre-OD9.2 activity-type shell**. It is **not** what the tenant application renders today.

**What the tenant actually sees** (source of truth):

```
Logo / “Dashboard”  →  /dashboard
DIGITAL PLANT
STO
PROJECT
ORGANIZATION & ADMINISTRATION
```

Definition: `src/config/business-navigation.ts`. Render: `app/(dashboard)/layout.tsx` → `NavBar`. Security metadata (`TENANT_SHELL_SECTIONS`) follows those four domains and does not invent items.

**A. Clearly correct today**

- Four frozen business domains are the live shell.
- Events / TAs is the STO campaign entry (`Event`).
- Portfolio + All Projects are the OD9.3 Project entry; Project is not an STO campaign.
- Safety and Permits appear only under STO in the shell.
- STO reports sit under STO, not a global Reports heading.
- P6/MPP/Excel **export** is a genuine shared adapter with explicit `projectId` **or** `eventId` (never interchangeable).
- Project CPM (`SchedulingService`) and STO M11 (`ScheduleOrchestrationService`) are separate authorities.

**B. Clearly misplaced / misleading**

- `/punch` is labelled STO Punch List but tells the user to open a **Project**.
- `/integrations/import` is linked as a working import; it is a **retired** banner (M11-R0).
- Home `/dashboard` is titled “Organisation portfolio overview” but drives **STO/M8.13** stats (`/api/dashboard/portfolio-stats`), not OD9.3 `Portfolio`.
- Import/Export live only under PROJECT even though export already serves Event scope.
- `ActiveShutdownSelector` (Event) is global chrome on Project pages as well.

**C. Ambiguous (product, not code)**

- Units / Systems: plant master with Event overlay — STO Planning vs Digital Plant vs Organization hierarchy.
- `/schedule` mixes Event M11 Gantt + org-wide execution grid.
- Documents: org library with optional Event association.
- OIS / BRE / Control Tower / M15: working or API-backed, domain ownership not frozen in the shell.

**D. Duplicated (names, not always functions)**

- Two “portfolio” words: OD9.3 `portfolios` vs dashboard `PortfolioDashboard`.
- Two constraint models: STO `Constraint` vs Project `project_constraints`.
- Two lookaheads: Event M12 vs Project `ProjectReportService`.
- Two baseline authorities: Event `ScheduleBaselineService` vs Project `ProjectBaselineCompareService`.
- Two schedule surfaces: `/schedule` vs `/projects/[id]/schedule`.
- Multiple STO report surfaces (dashboard / center / builder) — related, not true duplicates.

**E. Broken or materially misleading**

- `/punch` (wrong domain signpost).
- `/integrations/import` and `/imported-schedule*` (retired / empty).
- Project schedule toolbar baseline modals → `/api/projects/[id]/baselines` **501**.
- Global Excel export from `/schedule` Execution tab → `/api/schedule/export` **does not exist**.
- Project CPM calculate API exists but is **not wired** in `ScheduleContainer`.

**F. Working but hidden**

- `/ois/*`, `/rules`, `/alerts`.
- Event WBS page (no hub link).
- Event materials page (M16 path only).
- Event Control Tower / M15 (Event hub only, not top nav).
- `/projects/[id]/workpacks` (orphan live).

**G–K.** See §21–§22 and the master tables.

**L.** Product decisions: PD-01…PD-12 in §23.

**M. C2:** The current menu is **not a C2 blocker**. C2 is a time-foundation / schema task. Menu placement, retired import, and punch signposts do not authorize or prevent C2.

---

## 2. AUDIT SCOPE

**In scope**

- Every href emitted by `buildDigitalPlantItems` / `buildStoItems` / `buildProjectItems` / `buildOrganizationItems`.
- The extra top-level **Dashboard** link in `NavBar` (not in `business-navigation.ts`).
- The prompt’s historical group list (mapped, not assumed current).
- Working routes with no inbound shell link (orphans).
- Project vs STO schedule / import / export / baseline / report / workpack surfaces.
- Competing navigation sources.

**Out of scope**

- Redesign or implementation.
- Platform console (`PLATFORM_NAV`) except as a competing source.
- C2.
- Browser/UI click-through (**NOT VERIFIED**).
- Mutating tests.

**Method limits**

- Static source + schema + prior OD9 executed evidence.
- API behaviour from route handlers, not live HTTP unless cited from prior OD9 runs.
- “WORKING” means the page exists and is wired to real handlers — not that a user was observed using it.

---

## 3. CURRENT NAVIGATION SNAPSHOT

### 3.1 What is actually visible

| Shell control | Source | Href |
|---|---|---|
| Logo + “Dashboard” | `NavBar.tsx` ~414–450 | `/dashboard` (tenant) |
| Digital Plant dropdown | `buildDigitalPlantItems` | 3 items |
| STO dropdown | `buildStoItems` | 27 items (feature/role filtered) |
| Project dropdown | `buildProjectItems` | 5 items |
| Organization dropdown | `buildOrganizationItems` | 1–5 items |
| Active Event selector | `ActiveShutdownSelector` | chrome, not a menu item |

Gates: `hasPermission`, feature flags (`ASSET_REGISTER`, `SAFETY_MODULE`, `WHATSAPP_REVIEWS`, `DOCUMENT_MANAGEMENT`), contractor tenant hiding of units/systems/workpacks, `showAdmin` / `canViewOrgSettings`.

### 3.2 Prompt list vs live shell

| Prompt group / label | Live location | Notes |
|---|---|---|
| DASHBOARD | Top-level link, not a group | `/dashboard` |
| PLANNING → Planner Workspace | STO → Planning | |
| PLANNING → Events / TAs | STO → Events | Canonical STO campaign |
| PLANNING → Workpack Templates | STO → Workpacks | |
| PLANNING → Units | STO → Planning | Also Org settings hierarchy |
| PLANNING → Workpacks | STO → Workpacks | |
| PLANNING → Projects | PROJECT → Projects | **Moved in OD9.2** |
| PLANNING → Systems | STO → Planning | Also Org settings hierarchy |
| PLANNING → Execution Schedule | STO → Planning | `/schedule` |
| PLANNING → Baseline Schedule | **Not in shell** | Orphan title on `/imported-schedule` (OD9.2 removed it) |
| PLANNING → Asset Register | DIGITAL PLANT | |
| PLANNING → Digital Plant | DIGITAL PLANT | |
| PLANNING → Scope Intelligence | DIGITAL PLANT | `/engineering-issues` |
| PLANNING → Shutdown Scope | STO | |
| PLANNING → Workpack Intelligence | STO | |
| EXECUTION → Constraints | STO → Execution | |
| EXECUTION → Punch List | STO → Execution | Page is Project-pointing |
| EXECUTION → Permits / PTW | STO → Safety & Permits | Honest placeholder |
| INTELLIGENCE → Intelligence Dashboard | STO → STO Reports | `/reporting` |
| INTELLIGENCE → Shift Reports | STO → STO Reports | |
| INTELLIGENCE → WhatsApp Reviews | STO → STO Communications | Feature-flagged |
| INTELLIGENCE → Lessons Learned | STO → STO Reports | `/lessons` |
| IMPORT / EXPORT (all three) | PROJECT → Import / Export | Export is dual-scope |
| SAFETY | STO → Safety & Permits | |
| DOCUMENTS | ORGANIZATION | Feature-flagged |
| ORG SETTINGS | ORGANIZATION | Settings hub redirects to organisation |

Additional live STO items **not** in the prompt list: Event Review, Workpack Factory, Spreadsheet WBS Grid, Planning Readiness, Field Execution, Plan vs Actual, 24h/72h Lookahead, Mobile Execution, Report Center, Report Builder, Portfolio Overview.

---

## 4. CURRENT NAVIGATION ARCHITECTURE

| Source | Role | Consumers |
|---|---|---|
| `src/config/business-navigation.ts` | **Authoritative tenant item list** | `layout.tsx`, OD9.2/OD9.3 tests |
| `app/(dashboard)/layout.tsx` | Builds four item arrays, passes to NavBar | Tenant chrome |
| `src/components/NavBar.tsx` | Renders Dashboard + four dropdowns; hardcoded **active-prefix** lists; mobile groups | Visible UI |
| `src/security/navigation.ts` `TENANT_SHELL_SECTIONS` | Four domain ids only; **no items** | Tests; comment says do not add items |
| `TENANT_SETTINGS_NAV` | Settings **sidebar** | `SettingsNavItems.tsx` |
| `PLATFORM_NAV` / `platform-navigation.ts` | Platform console | Platform layouts (`showPlatform` false in tenant layout) |
| `src/components/DashboardHeader.tsx` | **Dead** Planning/Execution/Intelligence header | **0 import sites** (OD9-047) |
| `src/core/m16/navigation/NavigationRegistry.ts` | M16 deep-links (Event URLs) | Interaction layer, not the shell |
| `ProjectDetailClient.tsx` | Project **tabs** | Project detail only |
| Event hub `events/[eventId]/page.tsx` | Action buttons, not a tab strip | Event detail only |

**Conclusion:** Tenant top nav is **one authoritative item module** + NavBar presentation. Competing leftover: dead `DashboardHeader`, settings sidebar, platform nav, M16 registry, in-page tabs. They are **not** consolidated. Do not treat `TENANT_SHELL_SECTIONS` as an item registry.

NavBar active-state is a **second hardcoded prefix list** (`NavBar.tsx` 456–506). It can mark STO active for `/shutdowns` even though that href is not a menu item. It does **not** include `/ois`, `/rules`, `/alerts`.

---

## 5. FUNCTIONAL AUDIT METHOD

For each visible item: menu definition → href → page → APIs/services → models → authority → context → status.

Classification uses implementation, not menu location.

Status scale: GREEN / AMBER / RED / GREY / BLUE / PURPLE as specified in the prompt.

Confidence: **HIGH** = this audit read the page/API; **MEDIUM** = page + API files confirmed, deep service not fully walked; **LOW** = filename/comment only (avoided).

---

## 6. COMPLETE VISIBLE MENU INVENTORY

Authoritative table of every **currently emitted** tenant-shell item (plus Dashboard). Historical intent ≠ current domain.

| # | Current Group | Current Label | Route | Actual Function | Domain | Context | Authority | Data/Models | API/Service | Status | Duplicate/Overlap | Historical Intent | Recommended Future Home | Confidence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | (top link) | Dashboard | `/dashboard` | Org home: STO-leaning KPI cards + `PortfolioDashboard` (M8.13 stats) | CROSS-DOMAIN (STO-weighted) | Organization; optional Event filter in stats API | M8.13 + org Prisma counts | Workpack, Activity, Constraint, PunchListItem, EventSystem | `/api/dashboard/portfolio-stats`, `/api/dashboard/system-progress` | AMBER | Name clash with OD9.3 Portfolio | Generic ops home | KEEP — CROSS-DOMAIN or split; **PD-05** | HIGH |
| 2 | Digital Plant | Plant Overview | `/digital-plant` | Digital Plant extraction workspaces | DIGITAL PLANT | Site/Plant/Unit — **DigitalPlantProject** | Digital Plant (`DigitalPlantService`) | DigitalPlantProject, PlantDocument, ExtractionCandidate | `/api/digital-plant/projects` | GREEN | Distinct from `Project` | Digital Plant | KEEP — CURRENT LOCATION | HIGH |
| 3 | Digital Plant | Asset Register | `/asset-register` | Asset hierarchy register | DIGITAL PLANT | Asset / org | Digital Plant / asset master; 360 may read M8.13 | Site, Plant, Unit, System, Asset | `/api/assets/*` | GREEN | Related to Org hierarchy settings | Plant master | KEEP — CURRENT LOCATION | HIGH |
| 4 | Digital Plant | Scope Intelligence | `/engineering-issues` | Engineering issue / integrity batches | DIGITAL PLANT | Asset / org (not Event) | M7.2 `IssueService` | engineering issue batches | `/api/engineering-issues/*` | GREEN | Related to Shutdown Scope (handoff later) | Asset integrity | KEEP — CURRENT LOCATION | HIGH |
| 5 | STO | Events / TAs | `/events` | Event campaign list/create | STO | Event | Event / planning | Event | Prisma + `/api/events` | GREEN | `/shutdowns` alias redirect | STO campaign | KEEP — CURRENT LOCATION | HIGH |
| 6 | STO | Shutdown Scope | `/shutdown-scope` | Formal shutdown scope vs Event | STO | Event → Scope | `ShutdownScopeService` | shutdown scopes | `/api/shutdown-scope/*` | GREEN | Related to Scope Intelligence | STO scope | KEEP — CURRENT LOCATION | HIGH |
| 7 | STO | Workpacks | `/workpacks` | Org workpack register | STO | Event / org (Workpack.event_id optional) | `WorkpackService` | Workpack | WorkpackService | GREEN | Project orphan `/projects/[id]/workpacks` | STO work | KEEP — CURRENT LOCATION | HIGH |
| 8 | STO | Event Review | `/workpacks/identity-review` | Queue to attach workpacks to Events | STO | Event + Workpack | `WorkpackIdentityReviewService` | WorkpackIdentityReview | `/api/workpacks/identity-review` | GREEN | — | STO identity | KEEP — CURRENT LOCATION | HIGH |
| 9 | STO | Workpack Factory | `/workpack-factory` | Instantiate workpacks from scope | STO | Event / Scope / Asset | M9 `WorkpackFactoryService` | scope items, Workpack | `/api/workpack-factory/*` | AMBER | Internal “V1 Configuration Placeholder” | STO factory | KEEP — CURRENT LOCATION | MEDIUM |
| 10 | STO | Workpack Intelligence | `/workpack-intelligence` | Strategy / intelligence / readiness | STO | Event / Scope / Workpack | WorkpackIntelligence + M10 on subroutes | Workpack, scope | `/api/workpack-intelligence/*` | GREEN | Related to Planning Readiness | STO | KEEP — CURRENT LOCATION | MEDIUM |
| 11 | STO | Workpack Templates | `/planning/templates` | Template library | STO (org library) | Organization | M8.5 `TemplateLibraryService` | templates | `/api/planning/templates` | GREEN | Platform also has templates | STO planning library | KEEP — CURRENT LOCATION | MEDIUM |
| 12 | STO | Planner Workspace | `/planner-workspace` | Event-selected multi-pane planner (schedule, EVM, materials, resources, scope change) | STO | Event (`selectedEventId`) | M11 + M8.8–M8.12 + M8.10 | Event, Activity, ScheduleBaseline, EvmSnapshot | `/api/events/[eventId]/schedule/*`, planner APIs | GREEN | Overlaps `/schedule` Gantt | STO planner | KEEP — CURRENT LOCATION | HIGH |
| 13 | STO | Spreadsheet WBS Grid | `/planning/activities` | Activity planning grid | STO | Event (`useActiveShutdown`) | M11-adjacent activity writes | Activity | `/api/activities`, `/api/activities/bulk` | GREEN | Related to Event WBS page | STO planning | KEEP — CURRENT LOCATION | MEDIUM |
| 14 | STO | Execution Schedule | `/schedule` | Tab A: Event CPM Gantt (M11). Tab B: org-wide execution grid (Prisma) | SHARED PROJECT + STO **UI**; Gantt is STO | Event (Gantt) / Org (grid) | **M11** on Gantt; none/Prisma on grid | Activity, Workpack | `POST /api/schedule/calculate`; `GET /api/schedule` | AMBER | `/projects/[id]/schedule` | Historical Project schedule **and** STO CPM | KEEP — TWO ENTRY POINTS conceptually; **PD-02** | HIGH |
| 15 | STO | Units | `/planning/units` | Plant units + Event list | CROSS-DOMAIN | Asset + Event | Org/plant master | Unit, Event | Prisma | AMBER | Org `/settings/hierarchy/units` | Planning master | **PD-07** | HIGH |
| 16 | STO | Systems | `/planning/systems` | Plant systems + EventSystem | CROSS-DOMAIN | Asset + Event | Org/plant master | System, EventSystem | Prisma | AMBER | Org hierarchy systems | Planning master | **PD-07** | HIGH |
| 17 | STO | Planning Readiness | `/planning/readiness` | Workpack planning readiness | STO | Event / Workpack | **M10** `PlanningReadinessService` | Workpack, ScheduleBaseline | `/api/planning/readiness` | GREEN | Related to Workpack Intelligence readiness | STO M10 | KEEP — CURRENT LOCATION | HIGH |
| 18 | STO | Safety | `/safety` | Daily HSE log; Event selector | STO | Event | STO Safety (`SafetyLog.event_id`) | SafetyLog | `/api/events/[id]/safety` | AMBER | Event `/safety` page; leftover Project redirect | STO safety | KEEP — CURRENT LOCATION; fix fallback **PD-leak** | HIGH |
| 19 | STO | Permits / PTW | `/permits` | Signpost only — no register | STO | Event / Workpack (claimed) | none on this page (`PermitService` cited in comment) | Permit (not queried here) | none | GREY | Project `/permits` redirects here | STO PTW | KEEP — CURRENT; incomplete | HIGH |
| 20 | STO | Field Execution Workspace | `/execution` | M12 cockpit | STO | Event | **M12** | Activity execution state | `/api/execution/*` | GREEN | — | STO execution | KEEP — CURRENT LOCATION | HIGH |
| 21 | STO | Plan vs. Actual Variance | `/execution/plan-vs-actual` | Plan vs actual | STO | Event | **M12** (reads planned + actuals) | Activity | `/api/execution/plan-vs-actual` | GREEN | Related to Project schedule variance | STO | KEEP — CURRENT LOCATION | HIGH |
| 22 | STO | 24h & 72h Lookahead | `/execution/lookahead` | Execution lookahead | STO | Event | **M12** | Activity | `/api/execution/lookahead` | GREEN | Related but distinct from Project lookahead | STO | KEEP — CURRENT LOCATION | HIGH |
| 23 | STO | Mobile Execution | `/execution/mobile` | Field mobile | STO | Event | **M12** | Activity | `/api/execution/board`, `/api/mobile/execute` | GREEN | — | STO M12 | KEEP — CURRENT LOCATION | HIGH |
| 24 | STO | Constraints | `/constraints` | Central STO constraint register | STO | Event / Workpack | M12-adjacent central register | Constraint | `/api/central/constraints` | GREEN | Distinct from `project_constraints` | STO | KEEP — CURRENT LOCATION | HIGH |
| 25 | STO | Punch List | `/punch` | Text: select a **Project** | LEGACY / UNKNOWN (labelled STO) | Wrong: Project | none | PunchListItem unused on this page | none | RED | Project punch placeholder | STO punch (intent) / Project (page) | REPAIR BEFORE EXPOSING or HIDE | HIGH |
| 26 | STO | Intelligence Dashboard | `/reporting` | STO reporting dashboard | STO | Event / org | **M14** | report deliveries | `/api/reporting/*` | GREEN | Related to Report Center / OIS | STO M14 | KEEP — CURRENT LOCATION | HIGH |
| 27 | STO | Report Center | `/reports` | M14-R5 catalog with authority badges | STO | Event / org | **M14** (reads M11/M12/M8.13/M10) | report_definitions | `/api/report-builder/*` | GREEN | Related, not duplicate of Project status report | STO M14 | KEEP — CURRENT LOCATION | HIGH |
| 28 | STO | Report Builder | `/report-builder` | Definition library | STO | Org / STO | **M14** `ReportGenerationService` | report definitions | `/api/report-builder/library` | GREEN | Platform also has report-builder | STO M14 | KEEP — CURRENT LOCATION | HIGH |
| 29 | STO | Shift Reports | `/shift-reports` | Shift report UI | STO | Event / org | **M14** | shift reports | `/api/shift-reports` | GREEN | — | STO | KEEP — CURRENT LOCATION | MEDIUM |
| 30 | STO | Lessons Learned | `/lessons` | Central lessons register | STO | Event / Workpack | STO lessons | LessonLearned | `/api/central/lessons` | GREEN | — | STO | KEEP — CURRENT LOCATION | HIGH |
| 31 | STO | WhatsApp Reviews | `/whatsapp-reviews` | Channel review queue | STO (M16 layer) | Event / Workpack | **M16** | whatsapp_updates | `/api/whatsapp/updates` | GREEN | Not a business domain | STO comms / M16 | KEEP — CURRENT LOCATION | HIGH |
| 32 | Project | Portfolio Overview | `/projects/portfolios` | OD9.3 Portfolio CRUD + dashboard | PROJECT | Organization → Portfolio → Project | `PortfolioService` (Project data only) | Portfolio, Project, Activity via Workpack | `/api/portfolios`, `/dashboard` | GREEN | Distinct from `/dashboard` PortfolioDashboard | PROJECT (new) | KEEP — CURRENT LOCATION | HIGH |
| 33 | Project | All Projects | `/projects` | General Project list/create | PROJECT | Project (no Event required) | Project APIs | Project | `/api/projects` | GREEN | — | PROJECT | KEEP — CURRENT LOCATION | HIGH |
| 34 | Project | Import Schedule (P6 / MS Project) | `/integrations/import` | Deprecation banner; APIs 410 | LEGACY | none | none (M11-R0 retired) | ScheduleImportBatch **absent** | `/api/projects/[id]/import/*` 410 | RED / GREY | Orphan imported-schedule UI | Historical PROJECT import | HIDE FROM NORMAL USERS; **PD-04** | HIGH |
| 35 | Project | Export Schedule | `/integrations/export` | Workpack/Activity file export; user picks Project **or** Event | PURPLE | Project XOR Event | Export builders (not CPM) | Workpack, Activity, export_history | `/api/export/generate` | GREEN | Shared adapter, one menu home | Historical PROJECT; now dual-scope | KEEP — TWO DOMAIN ENTRY POINTS; **PD-01** | HIGH |
| 36 | Project | Export History | `/integrations/export/history` | Org export audit | PURPLE | Organization | none | export_history | `/api/export/history` | GREEN | Event rows cannot store event_id (OD9-040) | PROJECT/export | KEEP — TWO ENTRY POINTS or stay with export | HIGH |
| 37 | Organization | Documents | `/documents` | Document library | ORGANIZATION (Event-associable) | Org / Event | Document management | documents | `/api/documents` | GREEN | — | Docs | KEEP — CURRENT; **PD-08** | MEDIUM |
| 38 | Organization | Organisation | `/settings/organization` | Org profile | ORGANIZATION | Organization | Org settings | Organization | `/api/settings/organization` | GREEN | — | Admin | KEEP — CURRENT LOCATION | HIGH |
| 39 | Organization | Users | `/settings/users` | User admin | ORGANIZATION | Organization | Org governance | User | user APIs | GREEN | — | Admin | KEEP — CURRENT LOCATION | HIGH |
| 40 | Organization | Settings | `/settings` | Redirect to organisation | ORGANIZATION | Organization | none | — | redirect | GREEN (redirect) | Sidebar has many more items | Admin hub | KEEP — CURRENT LOCATION | HIGH |
| 41 | Organization | License & Subscription | `/settings/subscription` | Licence / features | ORGANIZATION | Organization | Org licence | Organization, features | Prisma counts | GREEN | — | Admin | KEEP — CURRENT LOCATION | HIGH |

Settings **sidebar** (not top-nav items): profile, notifications, roles, responsibility matrix, integrations, SSO, audit, site/plant/area/unit/system/asset hierarchy, AI prompts/logs, WhatsApp config, calendars, certificate templates, clearance parties, item catalog. Domain: ORGANIZATION (hierarchy overlaps Digital Plant).

---

## 7. DASHBOARD AUDIT

| | |
|--|--|
| Route | `/` → `/dashboard` (`app/page.tsx`); logo/`NavLink` → `/dashboard` |
| Page | `app/(dashboard)/dashboard/page.tsx` |
| Cards | Workpacks, Activities (`/schedule`), Constraints, Punch (`/punch`) — **STO objects**, org-scoped counts |
| `PortfolioDashboard` | Fetches `/api/dashboard/portfolio-stats` which imports **`ProgressAggregationService` (M8.13)** and optional `event_id` |
| OD9.3 Portfolio | **Not used** on this page |

**Domain:** CROSS-DOMAIN chrome; **business data is STO progress**, not Project Portfolio.  
**Status:** AMBER — functional wiring, wrong “portfolio” word, punch card links to a RED page.  
**Browser:** NOT VERIFIED.

---

## 8. PLANNING MENU AUDIT

The live “Planning” **section** is inside STO, not a top-level group.

Covered in §6 rows 5–17. Additional evidence:

- **Events** is the sole STO campaign list. `/shutdowns` redirects to `/events`.
- **Planner Workspace** is the richest STO planning surface and is Event-keyed. It is where Event baselines, EVM, resource leveling, and M11 Gantt actually hang together.
- **Execution Schedule** (`/schedule`) is **not** Project CPM. Gantt: `ScheduleGantt` → `POST /api/schedule/calculate` → `ScheduleOrchestrationService.calculateEventSchedule` (M11) with `event_id` from `ActiveShutdownContext`.
- **Units/Systems** are plant master lists that also load Events — not Digital Plant extraction, not Project WBS.

---

## 9. EXECUTION MENU AUDIT

STO Execution section: Field Execution, Plan vs Actual, Lookahead, Mobile, Constraints, Punch.

- M12 surfaces (#20–23) are Event-scoped via active shutdown / `event_id` query. GREEN at source.
- Constraints (#24) is the STO `Constraint` register — **RELATED BUT DISTINCT** from Project Constraints tab (`project_constraints`).
- Punch (#25) is **RED** (see §18).

---

## 10. INTELLIGENCE MENU AUDIT

There is **no** top-level Intelligence group. Former intelligence items are STO Reports / STO Communications.

| Surface | Authority | Notes |
|---|---|---|
| `/reporting` | M14 | Intelligence Dashboard |
| `/reports` | M14 | Report Center |
| `/report-builder` | M14 | Builder |
| `/shift-reports` | M14 | |
| `/lessons` | STO lessons | |
| `/whatsapp-reviews` | M16 | Not M14 |
| Event Control Tower | M13 | **Not in shell** |
| Event Management Intelligence | M15 | **Not in shell** |
| `/ois` | M7.6C OIS | **Not in shell** |

These are **RELATED BUT DISTINCT** M14 products, not true duplicates of Project `/projects/[id]/reports/status` (`authority: 'PROJECT'`).

---

## 11. IMPORT / EXPORT AUDIT

### 11.1 Import (by format)

| Format | UI | API | Writes to | Status |
|---|---|---|---|---|
| P6 XER | Retired banner; leftover project upload UI | `POST /api/projects/[id]/import/p6-xer` → **410** | Historically Project `Activity` + removed `ScheduleImportBatch` | LEGACY / BROKEN |
| P6 XML | same | `.../p6-xml` **410** | same | LEGACY |
| MS Project XML | same | `.../ms-project` **410** | same | LEGACY |
| MPP binary | no live route found | — | — | NOT VERIFIED / absent |
| Excel import | not on `/integrations/import` | — | — | NOT VERIFIED as schedule import |
| `/imported-schedule` | “Baseline Schedule” placeholder | none | none | PLACEHOLDER / ORPHAN |
| `/projects/[id]/imported-schedule` | Upload UI | GET empty stub; POST 410 | none | LEGACY / BROKEN |

**Does import create Project or Event WBS?** Current code: **neither** — pipeline retired.  
**Subsequent CPM:** N/A.  
**Historical intent:** PROJECT. **Current implementation:** retired for both domains.  
M11-R0 copy on the page describes an **STO native** creation chain (Digital Plant → … → CPM). That is product language on a Project-nav item — **ambiguous**.

### 11.2 Export (by format)

One page, one POST, `format` discriminator (`integrations/export/page.tsx` FORMATS):

| Format | Builder | Scope | Creates schedule? |
|---|---|---|---|
| Excel / CSV | `buildCSV` | Project XOR Event workpack ids | No — read only |
| MS Project XML | `buildMSProjectXML` | same | No |
| P6 XER | `buildP6XER` | same | No |
| P6 XML | `buildP6XML` | same | No |

`export/generate/route.ts` 47–65: `projectId` and `eventId` are **never interchangeable**. Workpacks filtered by `organization_id`.  
`export_history` cannot store Event id (OD9-040).  
**Shared capability, single Project-nav entry.** Not STO-only. Not Project-only.

### 11.3 Other “export”

- Project schedule Excel: `/api/projects/[id]/schedule/export` — Project grid.
- Project XER: `/api/projects/[id]/schedule/export/xer`.
- `/api/schedule/export` — **missing**; Execution tab still opens it when `projectId` is absent.
- Report/PDF: M14 generate paths — STO reporting, not this menu.
- OIS dashboard export — orphan OIS.

---

## 12. SAFETY AUDIT

| Route | Role | Status |
|---|---|---|
| `/safety` (shell) | Event daily log | AMBER: if `/api/events` empty, UI falls back to **`/api/projects`** and may put a Project id into `/api/events/${id}/safety` (`safety/page.tsx` 34–56, 66) |
| `/events/[eventId]/safety` | Event incidents + log | GREEN (source) |
| `/projects/[id]/safety` | Redirect → `/safety` | Bookmark leak into STO |
| `/api/projects/[id]/safety` | 501 fail-closed | Correct isolation |

**Domain: STO only.** No Project Safety authority.

---

## 13. DOCUMENTS AUDIT

`/documents` — feature `DOCUMENT_MANAGEMENT`, permission `workpacks.view`, Organization dropdown. Org document library; Event association possible. **KEEP ORGANIZATION** unless product wants Event-scoped docs under STO. **PD-08.**

---

## 14. ORGANIZATION SETTINGS AUDIT

Top-nav: Organisation, Users, Settings (redirect), License.  
Real configuration surface is **`TENANT_SETTINGS_NAV`** sidebar (hierarchy, SSO, calendars, WhatsApp, catalog, …).

Hierarchy settings are **plant master** (Digital Plant-adjacent) living under Organization. **RELATED BUT DISTINCT** from `/planning/units` and `/planning/systems`.

---

## 15. PROJECT VS STO DIFFERENTIATION AUDIT

### 15.1 Project surfaces (OD9.3)

| Function | Route | Authority | Event? |
|---|---|---|---|
| Portfolio | `/projects/portfolios` | `PortfolioService` | No |
| Project list/detail | `/projects`, `/projects/[id]` | Project APIs | No |
| Project WBS | `/projects/[id]/wbs` | `ProjectWbsService` (`event_id: null`) | No |
| Project schedule grid | `/projects/[id]/schedule` | Prisma `Workpack.project_id` | No |
| Project CPM API | `POST /api/projects/[id]/schedule/calculate` | `SchedulingService` | No — **UI does not call it** |
| Project lookahead | `/projects/[id]/lookahead` | `ProjectReportService` | No |
| Project baselines | `/projects/[id]/baselines` | `ProjectBaselineCompareService` | No |
| Project status report | `/projects/[id]/reports/status` | `authority: 'PROJECT'` | No |
| Project communications | `/projects/[id]/communications` | notes | No |
| Project constraints | `/projects/[id]/constraints` | `project_constraints` | No |

STO authorities are not imported by `src/core/project` (OD9.3 tests). **HIGH.**

### 15.2 STO campaign chain

```
Event (/events)
  → Scope (/shutdown-scope, /events/[id]/scope)
  → Workpack (/workpacks, factory, intelligence)
  → Schedule (M11 via /schedule Gantt + planner)
  → Execution (M12 /execution*)
  → Progress (M8.13 — dashboard, report providers, 360)
  → Reporting (M14)
  → Intelligence (M13 Control Tower, M15 — Event hub, not shell)
```

Event context: **ActiveShutdownSelector** + planner `selectedEventId`. Event hub does **not** link WBS or Materials pages.

### 15.3 Classification of contested functions

| Function | PROJECT? | STO? | SHARED? | Legacy? |
|---|---|---|---|---|
| `/schedule` Gantt | No | Yes (M11) | UI shared with execution tab | Hybrid page |
| `/schedule` Execution tab | No | Org-wide, not Event-filtered | — | Ambiguous STO |
| `/projects/[id]/schedule` | Yes (grid) | No | — | CPM button/API split |
| Import | Retired | Retired | — | Yes |
| Export | Yes if `projectId` | Yes if `eventId` | **Yes — adapter** | Historical Project UI |
| Event baselines (planner) | No | Yes | Shared `ScheduleBaseline` table | — |
| Project baselines | Yes | No | Same table, XOR scope | — |
| `/punch` | Page says yes | Menu says yes | — | **Broken hybrid** |
| Constraints | Project tab | STO register | **No — two models** | — |
| Lookahead | Project report | M12 execution | **No** | — |
| Reports | Project status | M14 suite | **No** | — |
| Workpacks | Orphan project filter | Canonical register | `Workpack.project_id` optional | Unattributed rows exist |

---

## 16. DUPLICATE FUNCTION REGISTER

| Pair | Class | Why |
|---|---|---|
| `/dashboard` “portfolio” vs `/projects/portfolios` | RELATED BUT DISTINCT | M8.13 org/event stats vs OD9.3 Portfolio entity |
| `/schedule` vs `/projects/[id]/schedule` | RELATED BUT DISTINCT | M11 Event Gantt + org grid vs Project workpack grid |
| `/schedule` Gantt vs Planner Schedule Control | SHARED UNDERLYING FUNCTION | Both M11 / Event schedule APIs |
| Event baselines vs Project baselines | RELATED BUT DISTINCT | Same tables, different owner columns |
| `/constraints` vs `/projects/[id]/constraints` | RELATED BUT DISTINCT | `Constraint` vs `project_constraints` |
| `/execution/lookahead` vs `/projects/[id]/lookahead` | RELATED BUT DISTINCT | M12 vs Project report |
| `/reports*` vs Project status report | RELATED BUT DISTINCT | M14 vs PROJECT authority |
| `/reporting` vs `/reports` vs `/report-builder` | RELATED BUT DISTINCT | Three M14 UIs |
| `/planning/units` vs `/settings/hierarchy/units` | RELATED BUT DISTINCT | Planning overlay vs org master |
| `/safety` vs `/events/[id]/safety` | SHARED UNDERLYING FUNCTION | Same Event Safety APIs |
| `/punch` vs `/projects/[id]/punch` | LEGACY COMPATIBILITY / both incomplete | Neither is a working register |
| `/permits` vs `/projects/[id]/permits` | LEGACY | Redirect loop avoided; Project → STO |
| DigitalPlantProject vs Project | NOT DUPLICATE | Different models |
| `DashboardHeader` vs `NavBar` | LEGACY | Dead vs live |
| Workpack register vs `/projects/[id]/workpacks` | RELATED BUT DISTINCT | Org/Event vs project_id filter |

**No TRUE DUPLICATE** of two fully working write-paths for the same authority was proven, except two UIs calling the same M11 calculate endpoint (`ScheduleGantt` in `/schedule` and planner).

---

## 17. ORPHANED WORKING FUNCTION REGISTER

| Route | Function | Domain | Authority | Working? | Current Inbound Link | Recommended Future Location | Priority |
|---|---|---|---|---|---|---|---|
| `/ois`, `/ois/*` | OIS dashboards/cockpits/TV | UNKNOWN / CROSS-DOMAIN | OIS (M7.6C) | Source-wired to `/api/ois/*` | **None** in tenant shell (OD9-050) | **PD-06** | High (visibility) |
| `/rules` | BRE rules/formulas/KPIs | CROSS-DOMAIN | BRE | Source-wired `/api/bre/*` | None | **PD-06** | Medium |
| `/alerts` | BRE alerts | CROSS-DOMAIN | BRE | Page + `AlertsDashboard` | None | **PD-06** | Medium |
| `/events/[id]/control-tower` | M13 Control Tower | STO | M13 | Linked from Event hub | Event hub only | STO (Event) — **PD-12** | Medium |
| `/events/[id]/management-intelligence` | M15 | STO | M15 | Event hub | Event hub only | STO (Event) | Medium |
| `/events/[id]/wbs` | Event WBS manager | STO | Event WBS | Page + `/api/events/[id]/wbs` | **No hub link** (count only) | STO Event detail | High |
| `/events/[id]/materials` | Material shortage | STO | M8.12 | Page + APIs | M16 registry; planner materials | STO Event / planner | Medium |
| `/events/[id]/ta-dashboard` | Lightweight TA metrics | STO | Event aggregates | Event hub | Event hub | STO Event | Low |
| `/events/[id]/execution-readiness` | Execution readiness | STO | M12-adjacent | Event hub | Event hub | STO Event | Medium |
| `/events/[id]/scope` | Event units/systems | STO | Event scope | Event hub “Manage Scope” | Event hub | STO Event | Medium |
| `/planner-workspace` Event schedule APIs | Health, variance, EVM, leveling | STO | M11 / M8.x | Via planner | Planner (in shell) | — already reachable | — |
| `/projects/[id]/workpacks` | Workpacks by `project_id` | PROJECT | WorkpackService | Live query | **Not in Project tabs** | PROJECT detail or hide | Medium |
| `/projects/[id]/*` tabs | WBS, schedule, baselines, reports, comms | PROJECT | Project services | In tabs | Project detail (not shell) | Correct as in-project | — |
| `/imported-schedule` | “Baseline Schedule” placeholder | LEGACY | none | Placeholder | **None** (deliberate) | Stay unlinked | — |
| `/shutdowns` | Redirect to Events | STO | none | Redirect | NavBar active prefix only | Keep alias | Low |
| `/settings/*` sidebar | Org config / hierarchy | ORGANIZATION | org | Settings layout | Settings, not shell | Stay sidebar | — |
| Platform `/platform/*` | Platform console | (platform) | platform | Separate layout | Not tenant | Out of tenant scope | — |

---

## 18. BROKEN / PLACEHOLDER FUNCTION REGISTER

| Route/Menu | Function | Failure | Severity | User Impact | Domain | Recommended Action |
|---|---|---|---|---|---|---|
| STO → Punch List `/punch` | Punch register | Instructs user to open Project; no `PunchListItem` query | High | Menu lies; dashboard Punch card hits this | Labelled STO | Hide or build Event-scoped register — do not send to Project |
| PROJECT → Import `/integrations/import` | P6/MPP import | Retired banner; APIs 410 | High (misleading) | Users think import works | Legacy | Hide from normal users or relabel “Retired” |
| `/imported-schedule` | “Baseline Schedule” | Placeholder “select a project” | Medium | Dead URL | Legacy | Stay unlinked |
| `/projects/[id]/imported-schedule` | Imported baseline | Empty GET; import 410 | Medium | Upload UI cannot succeed | Legacy | Leave unlinked |
| `/projects/[id]/schedule` baseline **modals** | Branching baselines | `GET/POST /api/projects/[id]/baselines` **501** | Medium | Toolbar “maintain baseline” fails; real page is singular `/baseline` | PROJECT | Do not advertise modals |
| `/schedule` Execution tab Excel | Export | `window.open('/api/schedule/export')` — **no route file** | Medium | Global export broken | STO/org | Repair or remove button (not in this audit) |
| `/projects/[id]/schedule` CPM | Project CPM | Calculate API exists; `ScheduleContainer` does not call it; POST `/schedule` is 409 EVENT_REQUIRED | Medium | Users cannot run Project CPM from the grid | PROJECT | **PD-11** |
| `/projects/[id]/s-curve` | S-curve | Retired empty arrays | Low | Empty chart if toggled | PROJECT | Leave retired |
| `/permits` | PTW register | Honest empty signpost | Medium | No permit list | STO | Keep honest or build register |
| `/projects/[id]/punch` | Punch | “Phase 6 coming soon” | Low | Orphan | — | Stay unlinked |
| `/projects/[id]/equipment` | Equipment | Placeholder shell | Low | Orphan | — | Stay unlinked |
| `/safety` fallback | Event picker | May send **Project id** to Event Safety API | High if no events | Failed/empty safety or wrong identity | STO | **Leak** — see §19 |
| Settings → `/settings` | Hub | Redirect only | Low | Fine | ORG | Keep |

---

## 19. CONTEXT AND AUTHORITY LEAKAGE REGISTER

| ID | Finding | Evidence | Severity |
|---|---|---|---|
| L-01 | `/safety` falls back to `/api/projects` and uses `list[0].id` as Event id | `safety/page.tsx` 34–56, 66 | High (historical Project/Event smell) |
| L-02 | `/punch` treats Project as punch context | `punch/page.tsx` 6–14 | High (menu/domain inversion) |
| L-03 | Global `ActiveShutdownSelector` on Project routes | `NavBar` ContextPill always renders it for tenants | Medium — decorative on Project? **NOT VERIFIED** whether it changes Project queries |
| L-04 | Dashboard `portfolio-stats` is M8.13 Event/org, named like Portfolio | `portfolio-stats/route.ts` 6, 157–162 | Medium (naming leak) |
| L-05 | Project schedule POST still documents Event CPM | `api/projects/[id]/schedule/route.ts` 409 EVENT_REQUIRED | Not a leak — isolation — but UI split is confusing |
| L-06 | Activity update under Project schedule may enqueue **Event** recalc if `activity.event_id` set | Agent trace of `schedule/activities` | Medium if mixed workpacks exist |
| L-07 | `/projects/[id]/safety` and `/permits` redirect into STO | OD9.2 retain | Low (bookmark) |
| L-08 | Export is correctly disambiguated | `export/generate/route.ts` 47–65 | None (fixed) |
| L-09 | Project services do not call M11/M8.13/Safety | OD9.3 T19–T24 | None proven in Project core |
| L-10 | No `resolveEventIdFromProject` in production | OD9.2/R0.4 guards | None |
| L-11 | `/api/schedule/export` missing | glob 0 files; `ScheduleContainer.tsx` 1565 | Broken, not a domain swap |

**No new Project→Event resolver** was found in Project-domain services. L-01 is the clearest remaining identity leak in a **visible STO** page.

---

## 20. NAVIGATION ARCHITECTURE FINDINGS

1. **One live tenant item source** (`business-navigation.ts`) + **one renderer** (`NavBar`).
2. **Dashboard is not in the item module** — hardcoded in NavBar.
3. **Active-prefix lists are hardcoded** and can desync from items (e.g. `/shutdowns`).
4. **Dead second architecture:** `DashboardHeader` Planning/Execution/Intelligence — 0 consumers.
5. **Settings sidebar** is a third nav (correct for settings).
6. **Platform nav** is a fourth (tenant layout sets `showPlatform={false}`).
7. **M16 NavigationRegistry** is a fifth (deep links, Event-only).
8. **In-page tabs** (Project, Event hub buttons) are a sixth layer — Event hub is incomplete vs existing pages (WBS, materials).
9. Prompt’s PLANNING/EXECUTION/INTELLIGENCE grouping is **obsolete as shell structure** (OD9.2).

Do not consolidate in this audit.

---

## 21. DOMAIN CLASSIFICATION MATRIX

| Function | Current Entry | Project | STO | Digital Plant | Organization | Shared? | Correct Future Entry |
|---|---|---|---|---|---|---|---|
| Home dashboard | Dashboard link | stats no | **yes** (M8.13) | no | chrome | naming only | **PD-05** |
| Plant Overview | Digital Plant | no | no | **yes** | no | no | Digital Plant |
| Asset Register | Digital Plant | no | no | **yes** | hierarchy overlap | no | Digital Plant |
| Scope Intelligence | Digital Plant | no | related | **yes** | no | no | Digital Plant |
| Events / TAs | STO | no | **yes** | no | no | no | STO |
| Shutdown Scope | STO | no | **yes** | handoff later | no | no | STO |
| Workpacks | STO | optional `project_id` | **yes** | no | no | association | STO |
| Event Review / Factory / Intelligence | STO | no | **yes** | no | no | no | STO |
| Templates | STO | no | **yes** (org library) | no | platform twin | no | STO |
| Planner Workspace | STO | no | **yes** | no | no | no | STO |
| Activity grid | STO | no | **yes** | no | no | no | STO |
| Execution Schedule | STO | grid is sibling route | **Gantt yes** | no | no | **page hybrid** | **PD-02** |
| Units / Systems | STO | no | overlay | master | settings master | **ambiguous** | **PD-07** |
| Planning Readiness | STO | no | **M10** | no | no | no | STO |
| Safety / Permits | STO | redirect leftovers | **yes** | no | no | no | STO |
| M12 execution suite | STO | no | **yes** | no | no | no | STO |
| STO Constraints | STO | no | **yes** | no | no | no | STO |
| Punch (menu) | STO | page points here | intended | no | no | **broken** | STO after repair |
| M14 reports suite | STO | no | **yes** | no | no | no | STO |
| Lessons | STO | no | **yes** | no | no | no | STO |
| WhatsApp Reviews | STO | no | M16 | no | settings config | layer | STO / M16 |
| Portfolio Overview | Project | **yes** | no | no | no | no | Project |
| All Projects + detail tabs | Project | **yes** | no | no | no | no | Project |
| Schedule import | Project | retired | retired | cited in copy | no | no | Hide; **PD-04** |
| Schedule export | Project | **yes** | **yes** | no | history org | **YES** | Two entries; **PD-01** |
| Export history | Project | audit | incomplete event id | no | **yes** | yes | With export |
| Documents | Organization | no | optional Event | no | **yes** | maybe | **PD-08** |
| Org settings / license | Organization | no | no | hierarchy | **yes** | no | Organization |
| OIS / BRE | (none) | ? | ? | ? | ? | **unknown** | **PD-06** |
| Control Tower / M15 | Event hub | no | **yes** | no | no | no | STO Event |
| Event WBS | (URL only) | no | **yes** | no | no | no | STO Event |
| DigitalPlantProject | Digital Plant | **no** | no | **yes** | no | no | Digital Plant |

---

## 22. RECOMMENDED FUTURE MENU PLACEMENT

Placement **recommendations only** — not a nav spec.

```
DIGITAL PLANT     Plant Overview, Asset Register, Scope Intelligence
STO               Events, Scope, Workpacks+factory+intelligence+templates,
                  Planner, Activity grid, Readiness, Safety/Permits,
                  M12 execution, Constraints, Punch (after repair),
                  M14 reports, Lessons, WhatsApp
                  + Event-detail: WBS, materials, Control Tower, M15
PROJECT           Portfolio, Projects (+ in-page WBS/Schedule/Baselines/Reports/Comms)
                  Export: keep and/or add STO entry (PD-01)
                  Import: hide until product resurrects a domain-explicit importer
ORGANIZATION      Documents, settings, users, licence, hierarchy sidebar
CROSS-DOMAIN      Dashboard home (PD-05); maybe Units/Systems (PD-07)
```

**Do not** move Export to STO-only. **Do not** move Project list into STO. **Do not** add Punch under Project.

---

## 23. PRODUCT DECISIONS REQUIRED

| Decision ID | Question | Evidence | Options | Recommended Option | Reason |
|---|---|---|---|---|---|
| PD-01 | Should schedule export have two domain entry points? | One UI already scopes Project XOR Event; menu is Project-only | (a) two entries same page (b) stay Project (c) move to cross-domain | **(a)** two entries | Shared adapter; hiding Event export under Project is location-wrong, not function-wrong |
| PD-02 | What is `/schedule`? | Gantt = M11 Event; grid = org Prisma | (a) split pages (b) keep hybrid under STO (c) Event-only Gantt | **NEEDS PRODUCT** | Code is hybrid; do not guess |
| PD-03 | Punch? | STO menu + Project copy; both punch pages incomplete | (a) Event register (b) hide (c) Project punch | **(a) or (b)** | Safety/Permit rule: punch is STO execution residue, not Project |
| PD-04 | Keep Import in the Project menu? | Retired 410 | (a) hide (b) keep as retired notice (c) rebuild dual-scope import | **(a)** or honest (b) | Linking it as “Import Schedule” is misleading |
| PD-05 | What is Dashboard? | M8.13 “portfolio” vs OD9.3 Portfolio | (a) STO ops home (b) Project portfolio home (c) chooser | **NEEDS PRODUCT** | Naming collision is proven; desired home is not |
| PD-06 | Where do OIS / BRE live? | Working, unlinked; OD9-050 | (a) STO (b) Organization (c) cross-domain (d) stay hidden | **NEEDS PRODUCT** | Domain genuinely ambiguous |
| PD-07 | Units/Systems home? | STO Planning + Org hierarchy | (a) Digital Plant (b) Organization (c) STO overlay + org master | **(c)** | Two jobs: master vs Event overlay |
| PD-08 | Documents? | Org flag, Event-associable | (a) Organization (b) also STO | **(a)** unless Event doc packs are required | Insufficient Event-doc product evidence |
| PD-09 | Active Event selector on Project pages? | Always rendered | (a) hide on Project (b) keep as site chrome | **NEEDS PRODUCT** | Not proven to leak Project queries |
| PD-10 | Project constraints vs STO constraints | Two models | (a) keep both (b) unify later | **(a)** | Distinct tables; not duplicates |
| PD-11 | Wire Project CPM into schedule UI? | API exists; container unused | (a) wire calculate (b) leave API-only | **NEEDS PRODUCT** | Foundation exists; exposing is UX |
| PD-12 | Control Tower / M15 in STO dropdown? | Event-hub only | (a) Event-only (b) STO section needing Event | **(a)** | They require Event id (OD9-051) |

---

## 24. RELEASE / PRODUCTION IMPACT

- **No production change** from this audit.
- **User-facing risk already in production (source):** Punch menu, Import menu label, Safety Project-id fallback, missing `/api/schedule/export`, 501 baseline modals.
- **Not a release blocker for C2.**
- **Not a reason to reopen OD9.3 GREEN** — those defects are navigation/legacy surfaces, not the Portfolio/WBS foundation.

---

## 25. RECOMMENDED NEXT STEP

**OD9.3B (product workshop, not code):** resolve PD-01, PD-02, PD-03, PD-04, PD-05, PD-06.

Then a **separate navigation implementation task** — only after decisions — to hide retired Import, fix Punch ownership, and optionally add a second Export entry.

Do **not** start C2 from this document. Do **not** move routes in the meantime.

---

## 26. EVIDENCE APPENDIX

### 26.1 Navigation sources

- `src/config/business-navigation.ts` (full item list, gates)
- `app/(dashboard)/layout.tsx` 52–99
- `src/components/NavBar.tsx` 374–506
- `src/security/navigation.ts` 139–166, `TENANT_SETTINGS_NAV`, `PLATFORM_NAV`
- `src/components/DashboardHeader.tsx` (dead Planning/Execution/Intelligence)
- `src/core/m16/navigation/NavigationRegistry.ts`

### 26.2 Critical pages / APIs

- Dashboard: `app/(dashboard)/dashboard/page.tsx`; `app/api/dashboard/portfolio-stats/route.ts` (M8.13)
- Schedule: `app/(dashboard)/schedule/page.tsx`; `ScheduleGantt.tsx`; `app/api/schedule/calculate/route.ts` (M11)
- Project schedule: `projects/[id]/schedule/page.tsx`; `api/projects/[id]/schedule/route.ts` (409); `schedule/calculate/route.ts` (Project CPM)
- Import: `integrations/import/page.tsx`; `api/projects/[id]/import/p6-xer/route.ts` (410)
- Export: `integrations/export/page.tsx`; `api/export/generate/route.ts` 47–84
- Punch: `punch/page.tsx`; `projects/[id]/punch/page.tsx`
- Safety: `safety/page.tsx` 34–66
- Permits: `permits/page.tsx`
- Portfolio: `projects/portfolios/page.tsx`; `src/core/project/PortfolioService.ts`
- Event hub: `events/[eventId]/page.tsx` 58–160
- OIS: `ois/page.tsx` → `/api/ois/dashboards`
- Imported schedule title: `imported-schedule/page.tsx` 11
- Missing export: `ScheduleContainer.tsx` 1565; no `app/api/schedule/export`

### 26.3 Prior executed constraints (not rediscovered as design)

OD9.2 / OD9.3: Project retained; Event sole STO identity; DigitalPlantProject ≠ Project; shared `wbs_nodes` XOR owner; no `Activity.project_id`; Project CPM ≠ M11; M8.13/M12/M14/M15/M16 frozen; Safety/Permits STO-only; no Project EVM/leveling claimed; C2 not done.

### 26.4 Git / change control

**Before this audit:** working tree was **already dirty** (OD9.1 / OD9.2 / OD9.3 and prior uncommitted work). `git status` showed hundreds of modified/deleted files. This task did **not** commit and did **not** modify those files.

**Intended new artifact:** this report only  
`docs/AURIANOA_R1.0_OD9_3A_CURRENT_MENU_FUNCTIONAL_DOMAIN_AUDIT.md`

No tests were run that write data. No `db push`. No schema change.

### 26.5 What was not verified

- Browser rendering, dropdown overflow, mobile drawer contents.
- Live HTTP status codes (410/501/409 asserted from source).
- Whether `ActiveShutdownSelector` mutates any Project page query.
- Whether OIS widgets execute correctly for a tenant.
- PunchListItem data presence vs empty UI.
- Platform console menu (tenant `showPlatform={false}`).

---

## FINAL EXECUTIVE CONCLUSION

**A. Clearly correct:** Four-domain shell; Event = STO campaign; Project = standalone PM; Safety/Permits under STO; STO owns M14 reports; Project CPM ≠ M11; export domain-disambiguated.

**B. Clearly misplaced:** Punch → Project; Import presented as live; Dashboard “portfolio” = M8.13; Export-only-under-Project despite Event scope; Import copy describes STO native chain.

**C. Ambiguous:** Units/Systems; `/schedule` hybrid; Documents; OIS/BRE; Dashboard purpose; Event selector on Project pages.

**D. Duplicated:** Related pairs (two portfolios, two constraints, two lookaheads, two baselines, three M14 UIs) — mostly **distinct**, one shared M11 Gantt.

**E. Broken:** Punch, Import/imported-schedule, `/api/schedule/export`, Project baseline **plural** 501, Safety Project-id fallback, unwired Project CPM button.

**F. Hidden working:** OIS, BRE, Event WBS, Event materials, M13/M15 (hub only), Project workpacks orphan.

**G. Project:** Portfolio, Projects, Project WBS/schedule/baselines/reports/comms/constraints; export when `projectId`.

**H. STO:** Events and the campaign chain; M10/M11/M12/M8.13/M14/M15/M16; Safety/Permits; punch **should** be here once real.

**I. Digital Plant:** Plant Overview, Asset Register, Scope Intelligence; **not** `Project`.

**J. Organization:** Settings, users, licence, documents (pending PD-08), hierarchy sidebar.

**K. Cross-domain / shared:** Export adapter; Dashboard chrome; Units/Systems overlay; calendars (org) used by both CPMs.

**L. Product decisions:** PD-01…PD-12.

**M. C2 blocker?** **No.** Menu debt does not block C2.

---

**OD9.3A IS AN AUDIT ONLY. NO CODE, DATABASE, ROUTE, NAVIGATION, API, SERVICE, OR SCHEMA CHANGES WERE MADE.**
