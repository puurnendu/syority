# AURIANOA R1.0 — OD9.3 PROJECT PORTFOLIO FOUNDATION

**Task:** OD9.3 — Project Portfolio Foundation (Portfolio + Project-owned WBS + standalone Project PM surfaces)
**Predecessor:** OD9.2 Project Domain Separation (AMBER — WBS/Portfolio blockers)
**Date executed:** 2026-09-10
**Database:** `syority` @ PostgreSQL 17.10
**Disposable shadow:** `syority_od93_shadow`
**Prisma:** 7.9.1

**FINAL STATUS: GREEN — PROJECT PORTFOLIO FOUNDATION ESTABLISHED**

OD9.2 isolation is **not reopened**. C2 was **not** performed. Digital Plant was **not** modified.

---

## EVIDENCE TAGGING CONVENTION

| Tag | Meaning |
|---|---|
| `[EXECUTED]` | Verified by running code, a query, a test, or a compiler against the real repository/database |
| `[SOURCE]` | Verified by reading source or schema text |
| `[INFERENCE]` | Reasoned conclusion. **Never** presented as proven |
| `[PRODUCT]` | A product/architecture decision frozen by the OD9.3 instruction |
| `[OPEN]` | Unresolved. Explicitly not closed |

Executed repository/database evidence outranks documentation. No inference in this document is called proven.

**Document-name correction.** The instruction named
`docs/AURIANOA_R1.0_OD9_2_PROJECT_PORTFOLIO_DOMAIN_SEPARATION_AND_REORGANIZATION_RESULT.md`.
That file does **not** exist. The executed OD9.2 result is
`docs/AURIANOA_R1.0_OD9_2_PROJECT_DOMAIN_SEPARATION_RESULT.md`. `[EXECUTED]`

---

## 1. EXECUTIVE SUMMARY

OD9.3 implements the minimum safe schema and services so PROJECT can function as a
general-purpose portfolio / project-management domain **without Event**.

The two OD9.2 AMBER causes are closed:

| OD9.2 defect | OD9.2 state | OD9.3 state |
|---|---|---|
| **OD9-036** — `wbs_nodes.event_id` NOT NULL; Project cannot own a WBS | Fail-closed Project WBS routes | **Closed.** `event_id` nullable + `project_id` TEXT FK + XOR CHECK + same-owner parent trigger `[EXECUTED]` |
| **OD9-038** — Portfolio layer absent | Documented only | **Closed.** `portfolios` table, APIs, overview/dashboard UI, optional `Project.portfolio_id` `[EXECUTED]` |

**What was proven on live `syority` after `migrate deploy`:** `[EXECUTED]`

- Migration `20260910000005_od93_portfolio_and_project_wbs` finished at `2026-09-10T14:29:57.443Z`.
- `wbs_nodes.event_id` is nullable UUID; `wbs_nodes.project_id` is nullable TEXT with FK to `"Project"(id)`.
- CHECK `wbs_nodes_exactly_one_owner` rejects neither-owner and dual-owner inserts (SQLSTATE 23514).
- Trigger `wbs_nodes_parent_same_owner_trg` exists.
- Live row counts after the full regression suite: `Project` **0**, `portfolios` **0**, `wbs_nodes` **0**, `project_communications` **0**, `events` **51**. OD9.3 behavioural writes used rollback-sentinel transactions and did not persist.
- Event count and Event-scoped baselines are unchanged (51 events; 9 Event baselines + 1 pre-existing Project baseline).

**What was proven on disposable `syority_od93_shadow`:** `[EXECUTED]`

- Clone retained Event/Workpack/Activity/baseline populations from the pre-migration dump.
- After applying the same DDL and proof inserts: 1 Event WBS + 2 Project WBS, 0 unowned, 0 dual-owned. Event WBS remained Event-owned.

**Isolation (not reopened):** `[SOURCE]` `[EXECUTED]`

- Project services never call `prisma.event`, `safetyLog`, `permit`, M8.13 `ProgressAggregationService`, or M11 `ScheduleOrchestrationService`.
- `Activity.project_id` was **not** reintroduced.
- `/api/projects/[id]/safety` remains fail-closed **501**.
- Safety/Permits remain under STO navigation only.

**Why GREEN and not AMBER.** All seventeen §27 success criteria have executed evidence (see §22). Remaining gaps are **deferred capabilities** (Project EVM, Project resource leveling, communications beyond notes, leftover `Workpack.portfolio_id`) and **pre-existing** defects (unattributed workpacks, `Project.id` TEXT vs UUID columns, two stale M11 grep tests, 1101 TypeScript errors). Those do not reopen the WBS/Portfolio blockers and do not reintroduce a Project↔Event bridge.

**Why this is not a claim of P6 feature-parity.** `[PRODUCT]` The governing rule is domain separation plus a real Portfolio → Project → WBS → Activity path. Cost/EVM, resource groups/calendars/leveling, and WhatsApp-class communications were inventoried and **not fabricated**.

---

## 2. BEFORE / AFTER ARCHITECTURE

### 2.1 Before OD9.3 (OD9.2 AMBER)

```
DIGITAL PLANT     Asset truth
STO               Event → Workpack → Activity
                  Event WBS (wbs_nodes.event_id NOT NULL)
PROJECT           Project (no Event FK)
                  Workpack.project_id (optional)
                  Project CPM + Project baseline
                  WBS routes FAIL-CLOSED (cannot persist a node)
                  Portfolio ABSENT
```

`[SOURCE]` OD9.2 §§11.3, 13, 27.

### 2.2 After OD9.3

```
AURIANOA
├── DIGITAL PLANT          Asset truth (untouched)
├── STO                    Event → Workpack → Activity
│                          Event WBS: wbs_nodes.event_id set, project_id NULL
├── PROJECT                Portfolio? → Project → WBS → Workpack → Activity
│                          Project WBS: wbs_nodes.project_id set, event_id NULL
│                          Independent CPM, baselines, Project reports, notes
└── ORGANIZATION & ADMIN   Governance (untouched except schema relations)
```

AI/M16 remains a cross-platform interaction layer, not a business domain. `[PRODUCT]`

There is still **no** Project↔Event FK and **no** hidden resolver. `[EXECUTED]` live: `"Project"` has **zero** FKs to `events`.

### 2.3 Cancelled / frozen directions (not reopened)

- R0.4 OPTION B (retire `Project` as an STO container) remains the reason Project must not hold STO authority. OD9.2 already preserved `Project` as a general PM domain. `[SOURCE]`
- OD9.1: do **not** reintroduce `Activity.project_id`. `[PRODUCT]`
- M8.13 / M10 / M11 / M12 / M14 / M15 / M16 production authorities were not redesigned. `[SOURCE]`

---

## 3. PROJECT DOMAIN ARCHITECTURE

Intended hierarchy (general project management, not STO campaign): `[PRODUCT]`

```
Organization
  └── Portfolio (optional)
        └── Project
              └── WBS
                    └── Workpack ── Activity
                          └── Scheduling / CPM
                          └── Baselines
                          └── Resources / Cost   (partial / deferred — §9–12)
                          └── Progress / Reports
                          └── Communications (notes foundation)
```

### 3.1 Dependency map (Phase A, then implemented)

| Layer | Before | After OD9.3 |
|---|---|---|
| Database | `Project` (TEXT id, 0 outgoing FKs except later inbound `Workpack.project_id`) | + `portfolios`, `Project.portfolio_id`, `wbs_nodes.project_id`, `Workpack.wbs_node_id`, `project_communications` `[EXECUTED]` |
| Services | `SchedulingService.calculateProjectSchedule`; baseline POST | + `PortfolioService`, `ProjectWbsService`, `ProjectWorkpackService`, `ProjectReportService`, `ProjectBaselineCompareService`, `ProjectCommunicationService` `[SOURCE]` |
| APIs | Project CRUD, baseline POST, fail-closed WBS, P6/MPP/Excel, fail-closed safety | + portfolios CRUD/dashboard; live Project WBS; baseline list/compare; Project status report; Project CPM calculate; communications; lookahead restored as Project-native `[SOURCE]` |
| UI | All Projects + detail (Overview/Schedule/Lookahead/Constraints) | + Portfolio overview/detail; Project WBS; Baselines; Reports; Communications tabs `[SOURCE]` |
| Navigation | PROJECT: All Projects + Import/Export | + Portfolio Overview. No placeholder Cost/EVM/Communications top-nav entries `[SOURCE]` |
| Integrations | P6 / MPP / Excel under PROJECT | Unmoved. Import still requires explicit Project vs Event scope (OD9.2) `[SOURCE]` |
| Reports | STO report-engine categories only | Project reports are a **separate** service (`authority: 'PROJECT'`), not an STO provider category `[SOURCE]` |
| Permissions | `projects.view` / `workpacks.edit` / `nav.schedule` | Same keys; every new query includes `organization_id` / `org_id` `[SOURCE]` |
| Tests | `tests/od92-project-domain-separation.test.ts` | + `tests/od93-project-portfolio-foundation.test.ts`; OD9.2 T3/T8/T17 updated to the new schema `[EXECUTED]` |

### 3.2 Activity ownership (OD9.1 respected)

Path remains **Project → Workpack → Activity** via retained `Workpack.project_id`. `[SOURCE]`

`Activity.project_id` is still absent (`information_schema` + OD9.2 T4). `[EXECUTED]`

`Workpack.wbs_node_id` is an **optional association** to a WBS node. It is not a second activity hierarchy and not `Activity.project_id`. `[SOURCE]` `prisma/schema.prisma` Workpack comment; `ProjectWorkpackService.createUnderWbs` sets `event_id: null`.

`WorkpackService.create` still **requires Event**. Project workpacks must not go through it. `[SOURCE]`

### 3.3 Leftover `portfolio_id` columns (not this entity)

`Workpack.portfolio_id`, `ConstraintLog.portfolio_id`, `LessonLearned.portfolio_id` remain orphan UUID columns with **no FK** to `portfolios`. They were **not** wired. `[SOURCE]` `[PRODUCT]`

`app/api/dashboard/portfolio-stats` is an existing STO/Event stats route. It is **not** the new Portfolio dashboard. `[SOURCE]`

---

## 4. PORTFOLIO ARCHITECTURE

### 4.1 Model `[SOURCE]`

`portfolios` (`prisma/schema.prisma` `Portfolio`):

| Field | Notes |
|---|---|
| `id` | UUID PK |
| `organization_id` | UUID FK → Organization, required |
| `name`, `code` | Required; `@@unique([organization_id, code])` |
| `description`, `status` (default `active`), `owner_user_id`, `category` | Optional / metadata |
| `start_date`, `finish_date` | Optional |
| `created_at`, `updated_at` | Timestamps |
| `archived_at` | Soft archive |

`Project.portfolio_id` is **optional** UUID FK → `portfolios` ON DELETE SET NULL. A standalone Project remains possible. `[PRODUCT]` `[EXECUTED]`

### 4.2 Service / API `[SOURCE]`

- `PortfolioService.list/get/create/update/archive/dashboard` — all scoped by `organization_id`. UUID possession is not authorization (`findFirst` + org).
- `GET/POST /api/portfolios`
- `GET/PATCH/DELETE /api/portfolios/[id]` (DELETE = archive)
- `GET /api/portfolios/[id]/dashboard`

### 4.3 Dashboard metrics `[SOURCE]`

Derived only from Project-domain rows (Project dates/status + Activity `progress_percent` / `is_critical` via `Workpack.project_id`):

- project count, active, completed, delayed, at-risk
- portfolio-level mean activity progress
- project health / critical projects
- upcoming planned-finish milestones
- mean finish variance (planned SU vs actual SU or now)

Does **not** call M8.13, `EvmSnapshot`, Safety, Permit, or Event. `[SOURCE]`

Does **not** invent CPI/SPI/EVM. `[PRODUCT]`

### 4.4 UI `[SOURCE]`

- `/projects/portfolios` — list + create
- `/projects/portfolios/[id]` — overview + dashboard numbers

---

## 5. WBS OWNERSHIP ARCHITECTURE

### 5.1 Chosen model `[PRODUCT]`

Shared `wbs_nodes` table with dual nullable owners:

```
WbsNode
  ├── event_id    UUID?   → events(id)     ON DELETE CASCADE
  └── project_id  TEXT?   → "Project"(id)  ON DELETE CASCADE
```

**Exactly one** of `event_id` or `project_id` must be populated.

**Why not a separate `project_wbs_nodes` table.** `[INFERENCE]` Live `wbs_nodes` had **0** rows at design time, so relaxing `event_id` cannot reclassify Event WBS as Project WBS. Sharing the table preserves existing STO WBS consumers (`/api/events/[eventId]/wbs`, `/api/wbs/[nodeId]`) without a second hierarchy. A split table would duplicate parent/code/order/depth logic and still need a consumer migration.

**Why `project_id` is TEXT, not UUID.** `"Project".id` is TEXT (OD9-042). A UUID column cannot hold a real FK to `Project`. `[EXECUTED]`

**Why not fabricate Event IDs for Project WBS.** Forbidden by §4 and by OD9.2. Project nodes are written with `event_id: null`. `[SOURCE]` `ProjectWbsService.create`.

### 5.2 Database enforcement `[EXECUTED]`

Live CHECK:

```
CHECK (
  (event_id IS NOT NULL AND project_id IS NULL)
  OR
  (event_id IS NULL AND project_id IS NOT NULL)
)
```

Re-tested on live `syority` (rolled back):

| Insert | Result |
|---|---|
| neither owner | rejected — `wbs_nodes_exactly_one_owner` |
| both owners | rejected — `wbs_nodes_exactly_one_owner` |
| wbs_nodes count after rollback | **0** |

Trigger `wbs_nodes_parent_same_owner_trg` requires parent to share `(organization_id, event_id, project_id)` (`IS NOT DISTINCT FROM`). Shadow Phase C rejected a cross-domain parent. `[EXECUTED]` (shadow leftover: 1 Event node + 2 Project nodes, 0 cross-owned).

Prisma schema **cannot** declare this CHECK/trigger (`@@check` absent). `[SOURCE]` They live only in the SQL migration. `db push` must never be used as a substitute — it would not recreate them and is forbidden by §20.

### 5.3 Project WBS behaviour `[SOURCE]`

`ProjectWbsService`:

- Always queries `organization_id` + `project_id`
- Never writes `event_id` on Project nodes
- Hierarchy, code, name, order, computed depth, tree
- Cycle check on parent change
- Recursive delete (respects `locked`)
- Reorder of a sibling group
- Type = `CUSTOM` (existing `WbsNodeType` enum is STO-oriented: EVENT/UNIT/SYSTEM/HO_WBS/TO_WBS/EQUIPMENT/WORKPACK/CUSTOM)

APIs: `GET/POST /api/projects/[id]/wbs`, `PATCH/DELETE /api/projects/[id]/wbs/[nodeId]`.

STO Event WBS routes were not rewritten as Project routes. Shared `/api/wbs/[nodeId]` parent lookup is XOR-owner (Event parent by `event_id`, Project parent by `project_id`) instead of `event_id: null` matching all Project nodes. `[SOURCE]`

### 5.4 Activity association

Activities attach through a Project workpack optionally placed on a Project WBS node (`Workpack.wbs_node_id`). `[SOURCE]`

---

## 6. DATABASE CHANGES

Migration folder: `prisma/migrations/20260910000005_od93_portfolio_and_project_wbs/migration.sql`. `[SOURCE]`

| Change | Kind | Notes |
|---|---|---|
| `CREATE TABLE portfolios` | Additive | Org FK, unique (org, code) |
| `Project.portfolio_id` | Additive nullable FK | ON DELETE SET NULL |
| `CREATE TABLE project_communications` | Additive | Org + Project FKs |
| `wbs_nodes.event_id DROP NOT NULL` | Relaxation | Safe: 0 WBS rows at apply time |
| `wbs_nodes.project_id TEXT` + FK | Additive | TEXT to match `Project.id` |
| `wbs_nodes_exactly_one_owner` | CHECK | Exactly-one owner |
| `wbs_nodes_parent_same_owner_trg` | Trigger | Cross-domain parent forbidden |
| `Workpack.wbs_node_id` | Additive nullable FK | ON DELETE SET NULL |

`prisma db push` was **not** used. `[EXECUTED]` Live apply: `npx prisma migrate deploy`.

`npx prisma validate` → schema valid. `[EXECUTED]` this session.

`npx prisma generate` was run after deploy (prior session). `[SOURCE]` conversation evidence; client includes `portfolio` / `wbsNode.project_id`.

---

## 7. MIGRATION SAFETY EVIDENCE

### 7.1 Pre-migration / shadow census

Phase A / migration comment (dump used for `syority_od93_shadow`): `[SOURCE]`

| Table | Rows |
|---|---|
| Project | 0 |
| events | 51 |
| wbs_nodes | 0 |
| Workpack | 235 (18 event, 0 project, 217 neither) |
| ScheduleBaseline | 10 (9 event, 1 project) |
| BaselineActivity | 28 |
| Activity | 73 |
| EvmSnapshot | 1 (`event_id` NOT NULL) |
| portfolios | absent |

`psql` is not on PATH; evidence used node `pg` against PostgreSQL 17.10. `[EXECUTED]`

### 7.2 Shadow (`syority_od93_shadow`) — still present `[EXECUTED]` this session

| Table | Rows now |
|---|---|
| Project | 1 (Phase C proof insert, not rolled back on shadow) |
| events | 51 |
| wbs_nodes | 3 (1 event-owned, 2 project-owned, 0 neither, 0 both) |
| Workpack | 235 (18 / 0 / 217) |
| ScheduleBaseline | 10 |
| BaselineActivity | 28 |
| Activity | 73 |
| portfolios | 0 |
| project_communications | 0 |
| EvmSnapshot | 1 |

Shadow has the same CHECK, FKs, and trigger names as live. `_prisma_migrations` on shadow does **not** list `od93` — Phase C applied the SQL file directly on the clone, then live used `migrate deploy`. `[EXECUTED]`

Phase C behavioural proofs (prior session, leftover rows confirm): Event WBS insert OK; Project WBS insert OK without Event; nested Project WBS OK; neither/dual rejected; cross-domain parent rejected. `[EXECUTED]`

### 7.3 Live after deploy + full suite `[EXECUTED]` this session

| Table | Rows | Notes |
|---|---|---|
| Project | **0** | No leaked Project rows |
| portfolios | **0** | |
| wbs_nodes | **0** | No leaked WBS; Event WBS still empty as before |
| project_communications | **0** | |
| events | **51** | Unchanged |
| Workpack | **239** | 18 event, 0 project, 221 neither |
| ScheduleBaseline | **10** | 9 event, 1 project — unchanged split |
| BaselineActivity | **28** | Unchanged |
| Activity | **73** | Unchanged |
| EvmSnapshot | **1** | Unchanged |

**Workpack +4 vs shadow dump.** Newest four rows are titled `Test Submit/Approve/Reject/Issue WP`, `event_id` NULL, `project_id` NULL, `wbs_node_id` NULL, `created_at` `2026-09-10T09:10:00Z` — **before** OD9.3 `migrate deploy` (`14:29:57Z`). They are leftover unattributed test workpacks from earlier suites, not Project-domain writes. **Not deleted.** `[EXECUTED]` `[OPEN]` (see OD9-044)

### 7.4 Rollback strategy `[SOURCE]`

Reversible while Project-owned WBS rows are removed first: DROP trigger/function/CHECK/`project_id`/new tables/columns, then `ALTER wbs_nodes.event_id SET NOT NULL`. With live `wbs_nodes` still at 0, SET NOT NULL remains possible today. After Project WBS data exists, rollback must delete or migrate those rows first.

### 7.5 Drift check `[EXECUTED]`

`npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script --exit-code` → exit **2** (not empty).

The script contains **zero** statements touching `wbs_nodes`, `portfolios`, `project_communications`, or `Project.portfolio_id`. Remaining statements are the **pre-existing OD9.1** non-destructive default/rename/index-name drift (`discovery_work`, `whatsapp_*`, `schedule_scope_changes`, …). OD9.3 did not add to that list and did not apply it.

Prisma schema does not model the XOR CHECK or parent trigger; the live→schema diff does not drop them. They remain SQL-only. **Do not `db push`.** `[INFERENCE]` Prisma will not recreate them.

---

## 8. PROJECT SCHEDULING

Authority: `SchedulingService.calculateProjectSchedule(projectId, orgId, db?)`. `[SOURCE]`

- Loads activities via `workpack.project_id` + `organization_id`.
- Project lookup is `findFirst({ id, org_id })`.
- **Does not call `prisma.event`.** `[EXECUTED]` grep on that file.
- Calendars: org default `ScheduleCalendar` (work days, hours/day, exceptions) or Mon–Sat 10h fallback.
- Relationships: FS / SS / FF / SF + `lag_days`. `[SOURCE]`
- Forward ES/EF, backward LS/LF, total float, free float, critical flag.
- Persist is a sequential update loop (not nested `$transaction`) so interactive test transactions can see inserted rows. `[SOURCE]`
- Entry: `POST /api/projects/[id]/schedule/calculate`.
- Existing `POST /api/projects/[id]/schedule` remains the OD9.2 `EVENT_REQUIRED` fail-closed path (M11 must not be invoked from Project id). `[SOURCE]`

M11 `ScheduleOrchestrationService` is unchanged as STO Event CPM. `[PRODUCT]`

`buildCalendar` still reads the global `prisma` client (org calendar). `[SOURCE]` Not an Event lookup. `[OPEN]` minor test-isolation inconsistency only.

S-curve helper on the same class still uses global `prisma`; not used as STO progress authority. `[SOURCE]`

---

## 9. PROJECT BASELINES

Retained: `POST /api/projects/[id]/baseline` — Project-scoped, no Event. `[SOURCE]`

Added:

- `GET /api/projects/[id]/baseline` — list Project-owned baselines (`organization_id` + `project_id`)
- `GET /api/projects/[id]/baseline/compare?baselineId=` — current vs that baseline

`ProjectBaselineCompareService.compare` computes start/finish/float variance vs `BaselineActivity`. It loads baselines only with `project_id` + org. It does not read Event-scoped baselines as a fallback. `[SOURCE]`

**Not resurrected:** `ProjectBranchingService` (OD9-035 / OD9-037 — missing `isBaseline` / `parentProjectId` / `Project.activities`). Fail-closed remains. `[SOURCE]`

Multiple named baselines are already representable (`ScheduleBaseline` rows per `project_id`). There is no product-level “Baseline 1/2/3” workflow beyond list + compare. `[SOURCE]`

`ScheduleBaseline.project_id` remains UUID without FK to TEXT `Project.id` (OD9-042). The existing 1 Project-keyed baseline row was not rewritten. `[EXECUTED]` `[OPEN]`

---

## 10. PROJECT REPORTING

Standalone PROJECT reporting — **not** the STO report-engine and **not** a global Reports menu. `[PRODUCT]`

| Surface | Authority | Data |
|---|---|---|
| `ProjectReportService.status` | `authority: 'PROJECT'` | Project, optional Portfolio, Workpack counts, Activity dates/progress/critical via `Workpack.project_id` |
| `ProjectReportService.lookahead` | `authority: 'PROJECT'` | Same activity set, upcoming window |
| `GET /api/projects/[id]/reports/status` | Project | |
| `GET /api/projects/[id]/lookahead` | Project-native (OD9.2 empty/retired surface restored without STO PreSD/OP windows as authority) | |
| UI `/projects/[id]/reports/status` | Project | |

Executable source of `ProjectReportService` (comments stripped) contains no `safetyLog`, `permit`, `prisma.event`, or `ProgressAggregationService`. `[EXECUTED]` OD9.3 T12–T14.

STO `providerRegistry` still has no `project` / `portfolio` category (OD9.2 T7). Project reports were **not** added there — that would mix business authorities. `[EXECUTED]`

Shared PDF rendering is unused by these endpoints today. `[SOURCE]`

Planned future report types (executive, histogram, performance) are **unlinked** until they exist. `[PRODUCT]`

---

## 11. PROJECT COMMUNICATIONS

Foundation only. `[SOURCE]` `[PRODUCT]`

- Table `project_communications` (org + project, type/subject/body, timestamps)
- `ProjectCommunicationService` list/create
- `GET/POST /api/projects/[id]/communications`
- UI notes list on the Project detail Communications tab

Not implemented: email, WhatsApp, M16 workflows, STO comms semantics, report distribution jobs.

This is a **domain boundary**, not a mature collaboration product. `[PRODUCT]`

---

## 12. P6 / MPP / EXCEL

Unmoved under PROJECT navigation: `/integrations/import`, `/integrations/export`, `/integrations/export/history`. `[SOURCE]` `[EXECUTED]` OD9.3 T15/T16 + OD9.2 T9.

Export generate still requires `organization_id` on workpack lookup (OD9.2 tenant fix) and explicit Event vs Project scope — no Project-id-as-Event fallback. `[SOURCE]` `app/api/export/generate/route.ts`.

Imported Project schedules do not become STO schedules automatically. `[SOURCE]` OD9.2 export/import disambiguation retained.

OD9-049 (imported-schedule needs absent `ScheduleImportBatch`) remains fail-closed. `[OPEN]`

---

## 13. NAVIGATION

Frozen top-level domains unchanged: DIGITAL PLANT / STO / PROJECT / ORGANIZATION. `[EXECUTED]` OD9.3 T29.

PROJECT top-nav **linked** items only: `[SOURCE]`

| Section | Item |
|---|---|
| Portfolio | Portfolio Overview → `/projects/portfolios` |
| Projects | All Projects → `/projects` |
| Import / Export | P6 / MS Project import, export, history |

**Not linked** (do not exist as complete product surfaces): Active Projects filter, Project Templates, Planning/WBS/Activities/Critical Path as top-nav, Resource Histogram/Cost EVM as top-nav, Baseline Management as top-nav, Project Reports suite as top-nav, Communications as top-nav. Those capabilities that exist are reached from **Project detail**, not as placeholders in the shell.

Project detail tabs: Overview, Schedule, WBS, Lookahead, Baselines, Reports, Communications, Constraints. `[SOURCE]`

**Not restored:** TA Dashboard, STO Workpacks tab, Punch, Safety, Permits, execution, daily report. `[SOURCE]`

Leftover bookmark pages from OD9.2: `/projects/[id]/safety` and `/permits` **redirect to STO** `/safety` and `/permits`. They are not in the tab strip. `[SOURCE]` `[OPEN]` OD9-056 — a direct URL still lands in STO Safety/Permits.

`/ois/*` remains unlinked (OD9-050). `[OPEN]`

No global Reports / Intelligence heading. `[EXECUTED]` T29.

---

## 14. STO ISOLATION VERIFICATION

| Rule | Evidence |
|---|---|
| Project never resolves Event | `src/core/project` + `app/api/projects` have no `prisma.event.find` and no `event_id: projectId` `[EXECUTED]` T24 |
| Project never uses Event as fallback | WBS create sets `event_id: null`; CPM scopes by `Workpack.project_id` `[SOURCE]` |
| Project never invokes M11 | Project calculate route uses `SchedulingService` only `[SOURCE]` |
| Project never invokes M8.13 | No `ProgressAggregationService` under `src/core/project` `[EXECUTED]` T19 |
| STO never requires Project | Event create without `project_id`; Event WBS with `project_id` NULL `[EXECUTED]` T17/T18 |
| No Project id written into Event fields | No new Event writes from Project services `[SOURCE]` |
| No Event id written into Project owner fields | Project WBS never sets `event_id` `[SOURCE]` |
| DigitalPlantProject ≠ Project | Separate model; Project services do not reference it `[SOURCE]` |
| Workpack leftover `portfolio_id` unused | Not referenced by `PortfolioService` `[SOURCE]` |

STO Event WBS consumers still write `event_id`. With 0 live WBS rows, STO behaviour is proven by T18 insert + existing Event WBS routes unchanged. `[EXECUTED]` `[SOURCE]`

---

## 15. SAFETY / PERMIT VERIFICATION

| Check | Result |
|---|---|
| Nav Safety/Permits | STO only `[EXECUTED]` T21/T22/T29 |
| Project detail links | No `/safety` or `/permits` in `ProjectDetailClient` `[EXECUTED]` T33b |
| `/api/projects/[id]/safety` | Still **501** `PROJECT_SAFETY_NOT_AVAILABLE`; does not query `SafetyLog` `[SOURCE]` |
| Project report | No Safety/Permit reads `[EXECUTED]` T12 |
| New Project Safety APIs | None created `[SOURCE]` |

Bookmark redirects `/projects/[id]/safety` → `/safety` remain OD9.2 leftovers. `[OPEN]`

---

## 16. TENANT ISOLATION

Every new list/get/update path uses `organization_id` (or `Project.org_id`) **and** the resource id. `[SOURCE]`

| Test | Result |
|---|---|
| T25–T27 | Foreign org cannot get/update Portfolio, list/update WBS, or read Project report `[EXECUTED]` |
| T28 | Workpack query with a random org returns 0 rows `[EXECUTED]` (weak: not a full HTTP export replay) |
| Resource histogram | `findUnique(projectId)` replaced with `findFirst({ id, org_id })` `[SOURCE]` — OD9.2 export lesson |

Possession of a UUID is not authorization. `[PRODUCT]`

T28 does **not** replay the export HTTP handler. The export route’s `organization_id` filter remains in source from OD9.2. `[SOURCE]` `[OPEN]` strengthen as HTTP test later.

---

## 17. TEST RESULTS

Suite: `tests/od93-project-portfolio-foundation.test.ts` plus updated `tests/od92-project-domain-separation.test.ts`.

Targeted prior run (od93 + od92 + m10 + r04e): **153/153**. `[EXECUTED]` prior session.

| # | Requirement | How tested | Result |
|---|---|---|---|
| 1–2 | Create/read Project without Event | Behavioural tx | PASS |
| 3–4 | Portfolio create + associate | Behavioural tx + dashboard count | PASS |
| 5–6 | Nested Project WBS, no Event | Behavioural tx | PASS |
| 7 | Workpack/activity under Project WBS | Behavioural tx; `event_id` null | PASS |
| 8–9 | Project CPM + critical path | Behavioural tx | PASS |
| 10–11 | Baseline + compare | Behavioural tx; finish variance 10 days | PASS |
| 12–14 | Project report data / no Safety/Event | Behavioural + comment-stripped source | PASS |
| 15–16 | Export/P6 stay Project-scoped | Navigation (not a live XER run) | PASS |
| 17 | Event without Project | Behavioural tx | PASS |
| 18 | Event WBS | Behavioural tx | PASS |
| 19–20 | No M11 / M8.13 in Project services | Comment-stripped walk | PASS |
| 21–22 | No Safety/Permit in Project services/APIs | Comment-stripped walk | PASS |
| 23 | STO reports under STO | Navigation | PASS |
| 24 | No Project→Event write | Comment-stripped walk | PASS |
| 25–27 | Cross-tenant Portfolio/Project/WBS | Behavioural tx | PASS |
| 28 | Cross-tenant export | Org-filtered Workpack query | PASS (weak) |
| 29–33 | Nav domains / Safety only STO / no global Reports | Navigation + detail source | PASS |
| — | Communications note | Behavioural tx | PASS |

OD9.2 suite still passes after T3/T8/T17 updates (`event_id` nullable; Portfolio under Project; `project_communications` in NOT NULL `project_id` tables). `[EXECUTED]`

---

## 18. TYPESCRIPT RESULTS

`npx tsc --noEmit` this session: **1101** errors. `[EXECUTED]`

OD9.2 baseline was **1101**. One OD9.3 lookahead typing error was introduced and **fixed**; recount returned 1101.

The only `api/projects` error still listed is pre-existing
`app/api/projects/[id]/schedule/metrics/route.ts` (`ProgressActivityInput`) — not introduced as new OD9.3 logic. `[EXECUTED]`

Zero new errors in `src/core/project`, portfolio APIs, OD9.3 pages (after the lookahead fix), or the new tests. `[EXECUTED]`

Unrelated M16 / WhatsApp / Digital Plant errors were **not** “fixed”. `[PRODUCT]`

---

## 19. REGRESSION RESULTS

Full Vitest (this session, `full.out`): `[EXECUTED]`

| Metric | Value |
|---|---|
| Test files | 1 failed / 78 passed (79) |
| Tests | **2 failed / 1580 passed (1582)** |
| Failures | `tests/m11-import-deprecation.test.ts` — the same two pre-existing source-grep tests (schedule POST / activity update must import `ScheduleOrchestrationService`). Out of scope; file not modified. |

OD9.2 full suite was 1561/1563. Delta = **+19** tests (the OD9.3 file). Same two failures. `[EXECUTED]`

`prisma validate` pass. `[EXECUTED]`

No Digital Plant, M11, M8.13, M12, or C2 rewrite. `[SOURCE]`

---

## 20. REMAINING DEFECTS

Carried from OD9.2 unless marked closed.

| ID | Status | Notes |
|---|---|---|
| **OD9-036** | **CLOSED** | Project WBS ownership exists `[EXECUTED]` |
| **OD9-038** | **CLOSED** | Portfolio entity exists `[EXECUTED]` |
| **OD9-039** | **PARTIAL** | Status report + notes exist; full report/comms suite does not |
| **OD9-035 / 037** | OPEN | Baseline branching / `ProjectBranchingService` still Class F |
| **OD9-040** | OPEN | `export_history` still has no `event_id` (MC-1) |
| **OD9-041** | OPEN | `Project.id` / `updated_at` still have no DB defaults (MC-3) |
| **OD9-042** | OPEN | `Project.id` TEXT vs UUID `project_id` columns; `ScheduleBaseline.project_id` still UUID without FK (MC-4) |
| **OD9-043** | OPEN | `project_units.project_id` NOT NULL, no FK (MC-5) |
| **OD9-044** | OPEN | **221** workpacks have neither Event nor Project (was 217 on the shadow dump; +4 morning test leftovers). Untouched. |
| **OD9-045** | OPEN | Two stale M11 grep tests |
| **OD9-046** | OPEN | Pre-existing M16 adapter type errors |
| **OD9-047** | OPEN | Dead `DashboardHeader` nav |
| **OD9-048** | OPEN | Project date columns `timestamp without time zone` — C2 |
| **OD9-049** | OPEN | Project imported-schedule unrepairable without forbidden models |
| **OD9-050** | OPEN | `/ois/*` unlinked, domain-ambiguous |
| **OD9-051** | OPEN | Control Tower has no domain-level entry without Event id |
| **OD9-052** | OPEN | Widespread `where: any` pattern |
| **OD9-053** | OPEN | `Workpack.portfolio_id` (and Constraint/Lesson twins) not the new Portfolio entity |
| **OD9-054** | OPEN | `ResourceCapacity` / `ShiftDefinition` are **Event-scoped** — cannot be reused for Project leveling |
| **OD9-055** | OPEN | `EvmSnapshot.event_id` NOT NULL — no Project EVM table |
| **OD9-056** | OPEN | Bookmark `/projects/[id]/safety` and `/permits` still redirect into STO |
| **OD9-057** | OPEN | T15/T16/T28 are not full HTTP P6/export tenant replays |

---

## 21. DEFERRED CAPABILITIES

Explicitly **not** implemented (inventory, then stop):

| Capability | Evidence for deferral |
|---|---|
| Project Cost / EVM (PV/EV/AC/CPI/SPI) | `EvmSnapshot` is Event-only (`event_id` NOT NULL, 1 live row). Fabricating Project EVM fields would fake a dashboard. `[EXECUTED]` `[PRODUCT]` |
| Resource groups / resource calendars / Project leveling | `Resource` / `ActivityResource` exist (org-level). `ResourceCapacity` and `ShiftDefinition` require `event_id`. Histogram API is Project-scoped and tenant-filtered; leveling stays STO Event-scoped. `[SOURCE]` |
| Email / WhatsApp / AI Project comms | Would copy STO/M16 semantics. Notes table only. `[PRODUCT]` |
| Wiring leftover `Workpack.portfolio_id` | Orphan UUID; not this Portfolio. `[SOURCE]` |
| `Activity.project_id` | Forbidden (OD9.1). `[PRODUCT]` |
| Digital Plant / Potential Shutdown Scope → STO Scope | Out of scope. `[PRODUCT]` |
| C2 time-type migration | Out of scope; not authorized. `[PRODUCT]` |
| Full P6-class report pack | Status + lookahead only. `[PRODUCT]` |
| Top-nav entries for unimplemented Planning/Resources/Cost | Honesty rule: do not link placeholders. `[PRODUCT]` |

---

## 22. FINAL STATUS

### GREEN — PROJECT PORTFOLIO FOUNDATION ESTABLISHED

§27 criteria:

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | Portfolio is a real Project-domain entity | ✅ | Table + FK + APIs + UI `[EXECUTED]` |
| 2 | Project independent of Event | ✅ | Create/read without Event; no Event FK `[EXECUTED]` |
| 3 | Project can own a real WBS without Event | ✅ | Service + XOR + tests T5/T6 `[EXECUTED]` |
| 4 | Event WBS remains Event-owned | ✅ | T18; CHECK; shadow 1 Event node `[EXECUTED]` |
| 5 | Project CPM independent | ✅ | `SchedulingService`; no `prisma.event` `[EXECUTED]` |
| 6 | Project baseline independent | ✅ | Create + compare without Event `[EXECUTED]` |
| 7 | Project reporting standalone | ✅ | `ProjectReportService` `authority: 'PROJECT'` `[EXECUTED]` |
| 8 | STO reporting remains STO-owned | ✅ | Nav + provider categories unchanged `[EXECUTED]` |
| 9 | Safety/Permits STO-only | ✅ | Nav + fail-closed API + no Project Safety queries `[EXECUTED]` |
| 10 | P6/MPP/Excel remain Project-owned | ✅ | Nav + routes unmoved `[SOURCE]` `[EXECUTED]` |
| 11 | No Project→Event resolver | ✅ | T24 + OD9.2 T16 still pass `[EXECUTED]` |
| 12 | No Event→Project dependency introduced | ✅ | Event create/WBS without Project `[EXECUTED]` |
| 13 | Tenant isolation verified | ✅ | T25–T27 `[EXECUTED]` |
| 14 | Existing data preserved | ✅ | Events 51; baselines 10/28; Activity 73; WBS 0; no fabricated IDs `[EXECUTED]` |
| 15 | Migration verified on disposable DB | ✅ | `syority_od93_shadow` still holds proof rows `[EXECUTED]` |
| 16 | Behavioural tests pass | ✅ | OD9.3 file + OD9.2 updates `[EXECUTED]` |
| 17 | No new unrelated regressions | ✅ | 1580/1582; same 2 M11 failures; tsc 1101 `[EXECUTED]` |

GREEN means the **foundation and isolation** required by OD9.3 exist. It does **not** mean the product is a complete Primavera-class suite (see §21).

---

## 23. RECOMMENDED NEXT PHASE

Recommended **OD9.4 — Project Resources & Performance (optional product)** — only if the business wants the next P6-class slice:

1. Project-scoped resource capacity (do **not** reuse Event `ResourceCapacity`).
2. Honest decision on Project EVM: new Project-owned snapshot table, or keep Cost/EVM unlinked.
3. HTTP-level export/P6 tenant tests (close OD9-057).
4. Decide leftover `Workpack.portfolio_id` (retire vs migrate vs ignore).
5. Leave `/projects/[id]/safety` redirects as retire-in-place or 410, without creating Project Safety.

**Do not** treat OD9.3 GREEN as C2 authorization. C2 remains a separate time-foundation task. `[PRODUCT]`

**Do not** attribute the 221 unattributed workpacks without a business rule. `[OPEN]`

---

## APPENDIX A — FILES ADDED / CENTRALLY CHANGED IN OD9.3

New services: `src/core/project/PortfolioService.ts`, `ProjectWbsService.ts`, `ProjectWorkpackService.ts`, `ProjectReportService.ts`, `ProjectCommunicationService.ts`, `ProjectBaselineCompareService.ts`.

New/rewritten APIs: `app/api/portfolios/**`, `app/api/projects/[id]/wbs/**`, `baseline/compare`, `reports/status`, `communications`, `schedule/calculate`; Project WBS/lookahead/baseline GET; projects list/create/PATCH portfolio; `app/api/wbs/[nodeId]` XOR parent; resource-histogram tenant `findFirst`.

New UI: `app/(dashboard)/projects/portfolios/**`, `[id]/wbs`, `[id]/baselines`, `[id]/reports/status`, `[id]/communications`.

Schema/migration: `prisma/schema.prisma` (Portfolio, ProjectCommunication, WbsNode owners, Workpack.wbs_node_id); `prisma/migrations/20260910000005_od93_portfolio_and_project_wbs/`.

Nav/detail: `src/config/business-navigation.ts`; `ProjectDetailClient.tsx`.

CPM: `src/modules/Scheduling/Services/SchedulingService.ts` (relationship types, persist loop, Project-authority comment).

Tests: `tests/od93-project-portfolio-foundation.test.ts`; `tests/od92-project-domain-separation.test.ts` (T3/T8/T17).

This repository already contained a large uncommitted working tree from OD9.1/OD9.2. The list above is the OD9.3 increment, not the entire `git status`.

---

## APPENDIX B — SUPERSESSION

OD9.2 AMBER is **superseded for the WBS and Portfolio blockers only**. Historical AMBER sections in the OD9.2 document are **not rewritten**. Closed IDs are recorded here (OD9-036, OD9-038). All other OD9.2 defects remain as in §20.

---

## APPENDIX C — UI VERIFICATION

No Next.js dev server was running in this session’s terminals, and no browser automation tools were available. Portfolio / WBS / report screens were **not** exercised in a browser. `[EXECUTED]` (absence)

API/service behaviour was exercised by transactional Vitest against live `syority` with forced rollback. `[EXECUTED]`
