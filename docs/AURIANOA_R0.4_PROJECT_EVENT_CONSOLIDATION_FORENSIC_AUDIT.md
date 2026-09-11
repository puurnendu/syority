# AURIANOA R0.4 — PROJECT → EVENT CONSOLIDATION
## Forensic Audit (Read-Only)

**Programme:** R0 identity / operational-container correction  
**Phase:** FORENSIC AUDIT ONLY — not implementation  
**Date:** 2026-09-09  
**Mode:** Read-only. No production code, schema, migration, or data was modified.  
**Only artefact:** this document.

**Evidence standard.** Implementation wins. Documentation, comments, and prior audits are cited only as contradiction or context. Material claims cite file and line.

---

## 1. Executive Summary

The platform has **two competing STO campaign containers** plus **two other uses of the word “Project”** that must not be collapsed into one recommendation.

| Name in code | What it actually is | Verdict |
|---|---|---|
| `Project` (`prisma/schema.prisma:1176`) | A tenant-scoped campaign with shutdown/startup dates (`planned_sd_date` / `planned_su_date`), workpacks, and a full `/projects` UI | **Duplicate of Event** for Turnaround/Shutdown |
| `Event` (`schema.prisma:1980`) | Organisation + Site campaign with lifecycle, calendar, WBS, scope, baselines, scenarios, safety, materials | **Intended STO operational container** — already used by modern M8–M16 |
| `DigitalPlantProject` (`schema.prisma:3404`) | Extraction workspace on Plant/Unit/System | **Genuinely different** — not a TA |
| MS Project / P6 “project” | File/import interchange | **Integration boundary** |

**Core question:** Can AURIANOA STO operate using Event as the single authoritative business container, without Project remaining as a competing operational concept?

## **PARTIALLY**

Event already owns the modern lifecycle (scope, workpack factory via `event_id`, M11 `calculateEventSchedule`, M12, M8.13 aggregation, M13, M14, M15, M16 event context). Project still owns or contaminates schedule pages, P6/MPP import URLs, CPM enqueue, S-curve, punch/constraints/permits, M16 navigation URLs, and a second TA dashboard.

The system **cannot yet drop Project** without breaking or silently disabling those paths. It also **cannot treat Project as the STO authority** without contradicting Event-scoped modules.

Live `syority` (§30): **0** STO `Project` rows; **51** Events; **0** Workpacks with `project_id`; **18** Workpacks with `event_id`; **177** Workpacks with neither. The competing Project *table* is empty; the competing Project *implementation* is not. The real data gap is Event coverage on Workpack, not Project→Event row mapping.

**Final disposition:** **OPTION B** — retire the STO `Project` table as an operational container; retain Digital Plant extraction projects and MS Project/P6 interchange as non-STO concepts.

---

## 2. Audit Objective

Determine whether Project and Event are duplicates, how identity actually flows, what a future consolidation must move/replace/quarantine, and what must remain for integration — without performing the migration.

---

## 3. Scope

**In scope:** schema, APIs, UI, services, workers, permissions, imports/exports, tests, and live row counts on `syority` (§30).

**Out of scope / not reopened:** M8.13 math, M10 scoring model, M11 CPM algorithm, M12 write rules, M13/M14/M15/M16 engines. Defects in those modules are recorded as integration defects only.

**Not done:** no code change, no schema change, no backfill, no R0.5 start.

---

## 4. Read-Only Compliance

| Action | Done? |
|---|---|
| Modify production code | No |
| Modify Prisma schema / migrations | No |
| Alter database data | No |
| Rename/delete/refactor | No |
| Create compatibility code | No |
| Files created | **Only this document** |
| Temporary build/test artefacts left behind | None created by this audit |

---

## 5. Methodology

1. Schema sweep of `Project`, `Event`, `project_id`, `event_id`.
2. Repository-wide search of APIs, UI, services, workers, seeds, tests.
3. Authority trace for create/schedule/execute/progress/report/AI.
4. Reachability analysis for Project-only services that contradict the current schema.
5. Classification P1–P7 and defect register.
6. Live read-only SQL against local Postgres `syority` (session `BEGIN READ ONLY`). Counts are in §30.

---

## 6. Business Context

The desired STO model is Organisation → Plant/Site → **Event** → Scope → Workpack → Activity → M11/M12/M8.13 → M13–M16.

The implemented model is a **fork**:

- Planning nav offers **both** “Events / TAs” and “Projects” (`app/(dashboard)/layout.tsx:49-53`).
- Workpack may carry **both** `event_id` and `project_id` (`Workpack` `schema.prisma:100,134,144-148`).
- Activity may carry **both** `event_id` (no Prisma `@relation`) and `project_id` (no FK) (`Activity` `schema.prisma:14,53-56`).
- There is **no** `Project` ↔ `Event` foreign key.

---

## 7. Organisation / Plant / Event / Project Model

**Actual database topology (siblings, not a tree):**

```
Organization
 ├── Event          (organization_id FK, site_id FK)
 │     ├── Workpack.event_id (nullable FK)
 │     ├── ShutdownScope (1:1 event_id)
 │     ├── WbsNode, EventMilestone, Safety*, ScheduleBaseline.event_id,
 │     │   ScheduleScenario, DiscoveryWork, ScheduleScopeChange
 │     └── Activity.event_id (column; Prisma relation missing)
 └── Project        (org_id column; NO Organization @relation in Prisma)
       └── Workpack.project_id (nullable FK)
             └── Activity.project_id (column; no FK)
```

Not:

```
Organization → Event → Project
```

and not:

```
Project → Event
```

`DigitalPlantProject` hangs off Organisation + Site + Plant + Unit (`schema.prisma:3404-3433`). It does not reference `Event` or STO `Project`.

`Site` is the Event’s location FK. `Project.plant_name` is a free string (`schema.prisma:1183`). Event is plant-bound via `site_id`; Project is not.

---

## 8. Complete Project Inventory

### 8.1 STO `Project` model

| Artifact | Type | Location | Purpose | Used by | Authority | Recommendation |
|---|---|---|---|---|---|---|
| `Project` | DB model | `schema.prisma:1176-1196` | Campaign: name, code, client, location, plant_name, status, SD/SU dates | Workpack FK; `/api/projects`; `/projects` UI | Self-declared campaign | **P1/P2** move/replace with Event |
| `Project.id` | PK | `:1177` | String `@id`, **no `@default`**, no `@db.Uuid` | Create path does not set `id` in `app/api/projects/route.ts:54-65` | Identifier | **BROKEN** unless DB default exists |
| `Project.org_id` | column | `:1178` | Tenant | List API uses it (`projects/route.ts:13`) | Tenant filter | Keep as tenant; add real FK in a later design |
| `Project.Workpack[]` | relation | `:1195` | Only declared child | Schedule GET, S-curve | Partial | Replace with Event |
| Organization relation | missing | — | No `Organization @relation` on `Project` | — | **Not DB-enforced in Prisma** | Propose FK later |

### 8.2 `project_id` columns

| Artifact | Type | Location | Purpose | Authority | Recommendation |
|---|---|---|---|---|---|
| `Workpack.project_id` | nullable FK | `schema.prisma:134,148` | Optional Project parent | Client-supplied on create (`WorkpackService.ts:120`) | **P2** |
| `Activity.project_id` | nullable, **no FK** | `schema.prisma:53-54` | Comment: “Legacy project association (P6/MPP); prefer event_id” | `legacyProjectId` in `ActivityCreationCommand.ts:81-82,488` | **P3/P5** |
| `ScheduleBaseline.project_id` | nullable, indexed | `schema.prisma:1386,1401` | Parallel to `event_id` | M10 readiness **queries this with Event UUIDs** (`PlanningReadinessService.ts:325-335`) | **P0/P1** dangerous alias |
| `SafetyLog.project_id` | nullable | `schema.prisma:1328` | Extra to required `event_id` | Safety APIs | **P3** |
| `DocLibrary.project_id` | nullable | `schema.prisma:730` | Docs | Unknown consumers | **P3** |
| `Permit.project_id` | nullable | `schema.prisma:1104` | Permits | `/projects/[id]/permits` | **P2** |
| `export_history.project_id` | nullable | `schema.prisma:2061` | Export audit | Export APIs | **P5/P7** |
| `project_constraints.project_id` | nullable | `schema.prisma:2377-2379` | Constraint list | `/api/projects/[id]/constraints` | **P2** |
| `project_units.project_id` | required | `schema.prisma:2396-2398` | Legacy unit list under Project | Project equipment/units UI | **P3** — Event uses `EventUnit` |
| `punch_items.project_id` | nullable | `schema.prisma:2408` | Legacy punch (parallel to `PunchListItem`) | `/api/projects/[id]/punch` | **P3** dual punch model |

### 8.3 Project APIs (STO)

| Endpoint | Method | Auth | Notes | Recommendation |
|---|---|---|---|---|
| `/api/projects` | GET/POST | `withTenantGuard` + `projects.view` | List/create uses `org_id` / snake_case — **matches schema** (`projects/route.ts:12-65`) | Quarantine create |
| `/api/projects/[id]` | GET | `projects.view` | `where: { id, orgId }` and `plantName` (`[id]/route.ts:13-21`) — **schema has `org_id` / `plant_name`** | **BROKEN vs schema** |
| `/api/projects/[id]/schedule` | GET | `workpacks.view` | Filters `workpack.project_id` and loose `activity.project_id` (`schedule/route.ts:15-58`) | **P2** Event schedule |
| `/api/projects/[id]/schedule/activities` | POST | `nav.schedule` | Sets `project_id` from URL **and** accepts `body.event_id` (`activities/route.ts:21-27`) | **P0** dual identity |
| `/api/projects/[id]/s-curve` | GET | `workpacks.view` | Loads `Project.plannedSdDate` (`s-curve/route.ts:56-64`) — **schema field is `planned_sd_date`** | **BROKEN** + used by Control Tower with Event UUID |
| `/api/projects/[id]/baselines` | GET/POST | view/schedule | `parentProjectId`, `isBaseline`, `primaryBaselineId` — **not in schema**; calls `ProjectBranchingService` | **DEAD/BROKEN** vs schema; Event baselines exist separately |
| `/api/projects/[id]/import/p6-xml`, `p6-xer`, `ms-project` | POST | import | Import into Project URL | **P5** then Event |
| `/api/projects/[id]/lookahead`, `resource-histogram`, `imported-schedule`, `wbs`, `metrics`, `export` | * | schedule | Project-scoped schedule extras | **P2** |
| `/api/projects/[id]/punch`, `constraints`, `safety`, `reports/daily`, `daily-report` | * | various | Project-scoped execution-adjacent | **P2** |
| `/api/projects/[id]/ai-assistant` | POST | AI | Project-scoped assistant | **P2** — M16 is Event |

### 8.4 Project UI

| Page | Location | Purpose | Recommendation |
|---|---|---|---|
| `/projects` | `app/(dashboard)/projects/page.tsx` | List/create Projects (name, code, SD/SU) | Duplicate Event list |
| `/projects/[id]` | `page.tsx` + `ProjectDetailClient.tsx` | Project home | Duplicate Event home |
| `/projects/[id]/schedule` | schedule page | Execution schedule | Competing M11 surface |
| `/projects/[id]/ta-dashboard` | `ta-dashboard/page.tsx` | TA dashboard | Duplicate of `/events/[eventId]/ta-dashboard` |
| `/projects/[id]/workpacks`, equipment, constraints, punch, permits, safety, reports, lookahead, imported-schedule | under `projects/[id]/` | Campaign workspace | **P2** |
| Nav rewrite | `NavBar.tsx:338-349` | When URL is `/projects/:id`, rewrites workpacks/schedule/etc. into Project URLs | Forces Project context |
| Layout | `layout.tsx:49-53` | Both Events and Projects in planning menu | UX duplication |

### 8.5 Project services

| Service | Location | Reachable? | Notes |
|---|---|---|---|
| `ProjectBranchingService` | `src/lib/services/ProjectBranchingService.ts` | Called by `/api/projects/[id]/baselines` | Uses `project.activities`, `orgId`, `isBaseline`, `parentProjectId` — **not on current `Project` model**. **BROKEN if invoked** |
| `ScheduleOrchestrationService.resolveEventIdFromProject` | `ScheduleOrchestrationService.ts:395-421` | Worker + schedule routes | First Workpack/Activity with `event_id` — **ambiguous** |
| `ActivityService.enqueueRecalculate` | `ActivityService.ts:15-33` | After activity create/update | **Skips CPM unless `workpack.project_id` is set** |

### 8.6 Other “Project” that is not STO `Project`

| Artifact | Classification |
|---|---|
| `DigitalPlantProject` + `/digital-plant`, `/api/digital-plant/projects` | **P6** different business object |
| `MsProjectXmlParser` / `MsProjectXmlFormatter` | **P5** file format |
| Workpack `work_type: "Project"` = “Capital Project” (`WorkpackCreateForm.tsx:793`) | Label collision only |
| M16 `PipelineInput.projectId` (`M16InteractionPipeline.ts:93-94`) | Navigation URL parameter — often an Event UUID misnamed |
| `SCurveChart.projectId` (`SCurveChart.tsx:19-20`) | Prop name; Control Tower passes **Event** id (`ControlTowerDashboard.tsx:177`) |

---

## 9. Complete Event Inventory

| Artifact | Type | Location | Purpose |
|---|---|---|---|
| `Event` | DB | `schema.prisma:1980-2034` | STO campaign: org, site, parent/child, dates, status, calendar, budget |
| `EventMilestone` | DB | `:2037-2055` | Planning milestones |
| `EventUnit` / `EventSystem` | DB | Event relations `:2008-2009` | Campaign plant scope |
| `ShutdownScope` | DB | `:3769-3811` | **1:1 Event** (`event_id @unique`) |
| `WbsNode` | DB | `:2638-2662` | **Required `event_id`** |
| `ScheduleScopeChange` / `DiscoveryWork` | DB | Event relations | M8.11 |
| `ScheduleBaseline.event_id` | DB | `:1388-1395` | M8.8 comment: “authoritative scope” |
| `ScheduleScenario` | DB | Event relation | M8.9 |
| `SafetyLog` / `SafetyIncident` | DB | required `event_id` | Safety |
| `whatsapp_sessions.event_id` | DB | `:2670-2671` | M16 continuity |
| `EventPlanningService` | Service | `src/core/planning/EventPlanningService.ts` | List/create/get/update |
| `/api/events` | API | `app/api/events/route.ts` | Session org; **no `guardApi` / `withTenantGuard`** on GET/POST |
| `/api/events/[eventId]/**` | API | 60+ routes | Scope, progress, schedule, EVM, materials, safety, M15, R0.3 scope-change |
| `/events`, `/events/new`, `/events/[eventId]/*` | UI | dashboard events | Event workspace |
| Planner `selectedEventId` | Client state | `useWorkspaceStore.ts:113-232` | Event context |
| Cookie `syority_active_event` | Session | `shutdownContext.ts:14` | Active Event |
| `EventContextResolver` | M16 | `EventContextResolver.ts` | Session → single active → AMBIGUOUS |
| `ProgressAggregationService` | M8.13 | org + `event_id` | Progress |
| `ExecutionWriteService` | M12 | optional `eventId` match | Execution |
| `DecisionIntelligenceService` | M15 | `event_id` | Management |
| Control Tower | M13 | `eventId` prop | Intelligence |

Event creation UI (`EventCreateForm.tsx:21-53`) uses **name, code, site select, dates** — no manual Event UUID.

---

## 10. Database Relationship Analysis

| Relationship | FK? | Nullable | Cascade | Tenant | Notes |
|---|---|---|---|---|---|
| Event → Organization | Yes | No | — | Yes | Sound |
| Event → Site | Yes | No | — | Via site | Sound |
| Event → parent Event | Yes | Yes | — | Same table | Multi-shutdown |
| Workpack → Event | Yes | **Yes** | — | App-level | Event optional at create |
| Workpack → Project | Yes | **Yes** | — | App-level | Project optional |
| Activity → Event | **Prisma: no `@relation`** | Yes | — | App-level | Known R0 drift |
| Activity → Project | **No FK** | Yes | — | None | Any string |
| ShutdownScope → Event | Yes unique | No | — | Yes | Event owns scope |
| ScheduleBaseline → Event | Yes | Yes | SetNull | Yes | Also has `project_id` **without Project `@relation`** |
| Project → Organization | **No Prisma relation** | `org_id` required | — | Column only | Weaker than Event |
| Project ↔ Event | **None** | — | — | — | No mapping table |

**Implicit application relationship:** `resolveEventIdFromProject` (`ScheduleOrchestrationService.ts:395-421`) infers Event from the first Workpack or Activity that has both `project_id` and `event_id`. Not unique. Not a constraint.

**Delete:** Event soft-delete (`deleted_at`). Project has **no `deleted_at`**.

---

## 11. Project Semantic Analysis

| Use | Classification |
|---|---|
| `Project` name/code/SD/SU/status | **Turnaround / Shutdown campaign** (same job as Event) |
| `/projects` list titled “Projects” | Operational container |
| Schedule/import under `/api/projects/[id]` | **Schedule container** + **integration identifier** |
| `Activity.project_id` comment + `legacyProjectId` | **Legacy P6/MPP compatibility** |
| `enqueueRecalculate` jobId `recalc-${project_id}` | **Schedule trigger key** (dangerous if Event-only) |
| `Permit` / `project_constraints` / `punch_items` | Historical/legacy campaign bag |
| `DigitalPlantProject` | **Not this object** — extraction workspace |
| `work_type = Project` | Capital vs STO **job type**, not the `Project` row |
| M16 `projectId` in URLs | **Misnamed Event or leftover Project path** |

Project is **not** the tenant boundary (`organization_id` / `org_id` is). It is **not** a proven external-system primary key except as the URL id for P6/MPP import.

---

## 12. Event Semantic Analysis

| Question | Implementation |
|---|---|
| Owns lifecycle/status? | Yes — `status` default `planning` (`schema.prisma:1993`) |
| Owns dates? | `planned_start/end`, `actual_start/end` |
| Owns plant/site? | `site_id` required |
| Owns organisation? | `organization_id` required |
| Owns scope? | `ShutdownScope.event_id` unique |
| Owns workpacks? | `Workpack.event_id` optional FK |
| Owns activities? | Denormalized `Activity.event_id`; derived from workpack in R0.1 command |
| Owns schedule? | `ScheduleOrchestrationService.calculateEventSchedule(eventId, orgId)` (`ScheduleOrchestrationService.ts:14` comment + worker `:47`) |
| Owns execution? | M12 `options.eventId` vs activity/workpack event (`ExecutionWriteService.ts:126-129`) |
| Used in reports? | M14 `DimensionFilter` / providers use `params.event` → `event_id` |
| Used in AI? | `EventContextResolver`; intents `requiresEventContext` |
| Calendar? | `Event.calendar_id` → `ScheduleCalendar` |
| Parent/child shutdowns? | `parent_event_id` |

Event **is** the STO operational campaign in the modern stack.

---

## 13. Project/Event Authority Matrix

| Operation | Project required? | Event required? | Actual authority | Correct authority |
|---|---|---|---|---|
| Create Event | No | Yes (is the create) | `EventPlanningService.create` + site | Event |
| Create Project | Yes | No | `POST /api/projects` | Should not exist as STO container |
| Create Scope | No | **Yes** (`ShutdownScope.event_id`) | Event | Event |
| Scope Change (R0.3) | No | Yes | Event + tenant | Event |
| Create Workpack | **No** (optional `project_id`) | **No** (optional Event select, label “optional”) | Client may send either, neither, or both (`WorkpackCreateForm.tsx:686,235`; `WorkpackService.ts:101,120`) | Event |
| Create Activity (command) | No | Derived from workpack, or loose + event, or loose + `legacyProjectId` | R0.1 | Event |
| Create Activity (project schedule API) | **Yes** (URL) | Optional body | **Both** (`schedule/activities/route.ts:21-27`) | Event |
| Create Activity (`/api/activities`) | No | Optional `event_id` | Event/workpack | Event |
| M11 CPM calculate | No | **Yes** | `calculateEventSchedule` | Event / M11 |
| M11 CPM enqueue | **De facto yes** | Resolved if project has a linked event | `enqueueRecalculate` skips without `project_id` | Event |
| Execution M12 | No | Optional bind | Event | Event / M12 |
| Progress M8.13 | No | **Yes** (aggregation) | `event_id` | Event / M8.13 |
| M10 readiness | Filter `event_id` | Preferred | Event; baseline lookup wrongly uses `project_id in eventIds` | Event |
| Reports M14 | No | Filter `event` | Event | Event |
| M15 | No | **Yes** | `event_id` | Event |
| M16 | Navigation `projectId` | **Yes** for domain intents | Event resolver | Event |
| Control Tower | Prop named eventId | Yes | Event; S-curve calls Project API | Event |
| Digital Plant extract | DigitalPlantProject | No | Different object | Not Event |

---

## 14. Identity Propagation Analysis

### 14.1 Realistic chain (Event-native)

```
Event (id, organization_id, site_id)
  → Equipment (Asset.organization_id; not Event-owned)
  → ShutdownScope.event_id
  → ScopeItem.scope_id
  → Workpack.event_id (+ optional project_id)
  → Activity.event_id (from command / workpack)
  → M11 calculateEventSchedule(eventId)
  → M12 applyAction({ eventId })
  → ProgressLog via activity
  → ProgressAggregationService(organizationId, eventId)
  → ControlTowerDashboard({ eventId })
  → M14 params.event
  → M15 eventId
  → M16 EventContextResolver
```

This chain **can** run **without** `Project` if workpacks have `event_id` and callers enqueue CPM with `eventId`.

### 14.2 Competing chain (Project-native)

```
Project (org_id, SD/SU)
  → Workpack.project_id
  → Activity.project_id (loose or copied)
  → GET /api/projects/:id/schedule (project_id filter)
  → enqueueRecalculate({ projectId })
  → resolveEventIdFromProject → first event_id
  → calculateEventSchedule(that event)
```

If Workpacks have `project_id` but **null** `event_id`, CPM worker throws “Missing eventId” (`scheduleRecalculateWorker.ts:41-42`).

If Workpacks have `event_id` but **null** `project_id`, Activity create **does not enqueue CPM** (`ActivityService.ts:23`).

### 14.3 Critical identity question

**Can `Activity.event_id` and `Activity.project_id` disagree?**

**YES.** There is no constraint and no service that keeps them aligned.

| Consumer | Which wins |
|---|---|
| M11 `calculateEventSchedule` | **Event** |
| Project schedule GET | **Project** (may omit Event-only activities) |
| M12 | **Event** (if `eventId` passed) |
| M8.13 aggregation | **Event** |
| M14/M15/M16 | **Event** |
| S-curve Project API | **Project** dates + workpacks by `project_id` |
| Security tenant | **Organization**, not Project or Event alone |
| R0.3 Scope Change | **Event** (Project unused) |

This split is **not** a documented dual-key design. It is accidental coexistence.

---

## 15. Activity Creation Analysis

| Path | `project_id` | `event_id` | Notes |
|---|---|---|---|
| `ActivityCreationCommand` | `legacyProjectId` only; **never used as event_id** (`:81-82,305-309,488`) | Derived from workpack or context | R0.1 authority |
| `ActivityService.createActivity` | Passed through as `legacyProjectId` (`:114`) | `context.eventId` | Adapter |
| Template instantiate | No | `opts.event_id` (`TemplateLibraryService.ts:581,614`) | Event |
| Workpack clone | No | Copies `source.event_id` (`WorkpackService.ts:337`) | Event |
| `/api/workpacks/[id]/activities` | No (R0.1) | From workpack | Event |
| `/api/activities` | No | Optional body | Event |
| `/api/activities/bulk` | No | **Required** (`bulk/route.ts:19-21`) | Event |
| `/api/projects/[id]/schedule/activities` | **URL id** | Optional body | **Both** |
| P6/MPP import | Project URL | May set both | Integration |
| Seed / tests | varies | varies | Not production authority |
| Scope Change apply (R0.3) | No | Scope Change event | Event |

**Do not** recommend `project_id → event_id` as a general map. `resolveEventIdFromProject` is first-hit, not 1:1.

---

## 16. Workpack Analysis

| Field | Role |
|---|---|
| `event_id` | FK, optional; Factory/template/clone/R0.1/M12/M8.13/M14 use this |
| `project_id` | FK, optional; schedule-by-project, CPM enqueue, S-curve, nav |

Create form: Event select **optional** (`WorkpackCreateForm.tsx:686-696`). `project_id` is **not shown** as a named picker in Operational Context; it is carried from `?project_id=` (`workpacks/new/page.tsx:16,56`) and submitted blindly (`:235`).

`WorkpackService.createWorkpack` writes both IDs **without** proving Project or Event belong to the caller org (`WorkpackService.ts:101,120`). UUID is not authorization.

Workpack Factory / templates: Event-oriented (`event_id` on instantiate).

---

## 17. Scope Analysis

Shutdown scope is **Event-owned** (`ShutdownScope.event_id` unique). Scope Change (M8.11 / R0.3) is Event-bound. Project does not appear on those models.

`/shutdown-scope` in nav is Event/scope workflow, not Project.

Project **cannot** legitimately own scope in the current schema. A Project-only user has no `ShutdownScope`.

---

## 18. Schedule / M11 Analysis

| Fact | Evidence |
|---|---|
| CPM engine is Event-scoped | `ScheduleOrchestrationService.ts:14`; worker calls `calculateEventSchedule` |
| Legacy job payload is Project | `ActivityService.ts:27`; worker `:33-38` |
| Project → Event resolution is first match | `:395-421` |
| Project schedule read path | `/api/projects/[id]/schedule` filters `project_id` |
| Event schedule / EVM / leveling / baselines | `/api/events/[eventId]/schedule/**` |
| Two baseline implementations | Event: `ScheduleBaselineService` (reachable). Project: `ProjectBranchingService` (schema-incompatible) |
| Calendar | `Event.calendar_id` → `ScheduleCalendar`; Project has no calendar FK |
| Tests | `tests/m11-v1-schedule-view.test.ts:109-111,469-471` are **SOURCE-LEVEL** (`toContain`) |

M11 math is not redesigned here. The **integration defect** is dual entry (Event vs Project) and enqueue keyed on Project.

---

## 19. Execution / M12 Analysis

`ExecutionWriteService` has **no `project_id`**. Isolation is org + optional `eventId` vs `Activity.event_id` / `Workpack.event_id` (`ExecutionWriteService.ts:126-129`).

Project does **not** create a second execution writer. Project UI (punch/permits/safety under `/projects/[id]`) can still **display** a different population than Event execution.

Expected model `Event → Activity → EWS` is already the write path. Project is a **competing read/navigation** path, not a second M12.

---

## 20. Progress / M8.13 Analysis

`ProgressCalculationService` is pure math (no `project_id`). `ProgressAggregationService` queries `organization_id` + `event_id` (`ProgressAggregationService.ts:14,59,366`).

Project is **not** a progress dimension in M8.13. Project TA dashboard may still fetch Event progress APIs or its own metrics — two dashboards exist (`projects/.../ta-dashboard` vs `events/.../ta-dashboard`).

---

## 21. Control Tower / M13 Analysis

`ControlTowerDashboard({ eventId })` (`ControlTowerDashboard.tsx:17`). Summary API is Event-scoped.

**Defect:** S-curve uses `<SCurveChart projectId={eventId} />` (`:177`) which GETs `/api/projects/${projectId}/s-curve` (`SCurveChart.tsx:19-20`). That route loads **`prisma.project`** by that id and workpacks by `project_id` (`s-curve/route.ts:56-78`). An Event UUID will not be a Project row → **422 / empty**. Control Tower can show Event KPIs and a **failed Project S-curve** on the same page.

Selecting a Project in the Project TA dashboard can show Project-filtered workpacks that belong to a **different Event** than the planner workspace Event cookie.

---

## 22. Reporting / M14 Analysis

M14 providers and `DimensionFilter.ts:14-15` treat **`event`** as the campaign dimension. No parallel Project dimension in those providers.

Project daily-report / `/api/projects/[id]/reports` is a **separate, older** reporting surface. Risk: **duplicate management numbers** if both `/projects/:id/reports` and Event M14 are used for the same TA.

---

## 23. Management / M15 Analysis

`DecisionIntelligenceService` and M15 routes under `/api/events/[eventId]/management/**` are Event-only. No `project_id` in M15 service queries reviewed.

M15 remains intelligence-only. Project is not an M15 authority.

---

## 24. AI / M16 Analysis

| Topic | Implementation |
|---|---|
| “Show TA-2027 progress” | Intent + `EventContextResolver` against **`Event.code` / session Event** — not `Project.code` |
| Ambiguous events | `AMBIGUOUS` — user must choose Event |
| Prisma as authority | Tools go through registry; Event id is trusted context, not LLM |
| Navigation | `NavigationRegistry` builds **`/projects/${projectId}/...`** (`NavigationRegistry.ts:44-110`) even when the runtime id is an Event | **P1** wrong container in URLs |
| Pipeline | `projectId: string` required on `PipelineInput` (`:93-94`) | Naming leftover |

AI resolves **Event**, then may **link the user into Project URLs**. That is a container contradiction, not a second AI authority.

---

## 25. Navigation and UX Analysis

**Violations of “select Turnaround once (Event)”:**

1. Layout lists **Events / TAs** and **Projects** as peers (`layout.tsx:49-53`).
2. `/projects` create form asks for TA-like SD/SU dates (`projects/page.tsx:29-36`) — second campaign create.
3. Workpack create: Event optional; may also inherit hidden `project_id` (`WorkpackCreateForm.tsx:686`; `workpacks/new/page.tsx:16`).
4. `NavBar` remaps schedule/workpacks into `/projects/:id/...` when the path is a Project (`NavBar.tsx:338-349`).
5. Two TA dashboards.
6. Planner workspace uses `selectedEventId`; Project schedule page uses Project id.
7. Digital Plant uses yet another “project” word (`/digital-plant/[projectId]`).

A normal STO user **cannot** stay in Event-only if they follow Projects, Project schedule, or M16 deep links.

---

## 26. UUID / ID Entry Analysis

| Field / screen | Classification |
|---|---|
| Event create code/name/site | **BUSINESS SELECTION** — UUID auto (`Event` `@default` uuid) |
| Event URLs `/events/[eventId]` | System id in path — not typed by user |
| Project create name/code | **BUSINESS SELECTION** — but `Project.id` has **no `@default`** in schema |
| Workpack Event dropdown | **BUSINESS SELECTION** |
| Workpack `project_id` from query string | Hidden UUID — **LEGITIMATE ADMIN/legacy** if used; **WRONG** as normal UX |
| `/api/projects/[id]/schedule/activities` `event_id` in JSON | API — not a business form |
| Digital Plant `[projectId]` | Different object’s UUID in path |
| Scope Change (R0.3) | No UUID entry in dashboard; API-only items |

No Event create form asks the user to type an Event UUID. Project create does not ask for a Project UUID either.

---

## 27. API Analysis (condensed)

**Both IDs:** `POST /api/projects/[id]/schedule/activities` (URL Project + body Event). `POST /api/workpacks` (body may include both). Worker `{ projectId }` → resolve Event.

**Project only:** `/api/projects/**` schedule/import/s-curve/punch/constraints.

**Event only:** `/api/events/[eventId]/**` (modern STO).

**Infer one from the other:** `resolveEventIdFromProject` only (Project → Event). No Event → Project resolver found.

**Project as authorization:** `projects.view` is a **permission**, not ownership proof. `[id]` GET uses `orgId` (broken field name). Event routes typically filter `organization_id`.

**`/api/events` GET/POST** uses session org **without** `guardApi('events.view')` (`events/route.ts:7-14`) while route registry lists `events.view` (`routeRegistry.ts:65`). **Auth inconsistency.**

---

## 28. Security and Tenant/Event Isolation

| Rule | Actual |
|---|---|
| Tenant boundary | `organization_id` / `org_id` / `withTenantGuard` |
| Event boundary | Present on Event-scoped services (R0.1, R0.3, M12, M8.13, M15) |
| Project as security boundary | **No.** It is a filter key |
| UUID = authorization? | **No** — but Workpack create accepts raw `project_id` / `event_id` without ownership proof |
| Project bypass Event? | **Yes, as a data view:** Project schedule can list activities by `project_id` that have a different `event_id`, or none |
| Cross-tenant Project UUID | List API scopes `org_id`. S-curve `findUnique({ id })` **does not include org in the Project load** (`s-curve/route.ts:56-58`); activities are org-scoped. Project dates could theoretically leak if ids were guessable — **P1** |
| Tests | R0.3 Event/tenant behavioral tests exist. **No behavioral suite** for Project vs Event mismatch. M11 project tests are source-text |

Required matrix (implementation, tests **not added** this audit):

| Case | Expected | Actual (from code) | Tested? |
|---|---|---|---|
| Tenant A Event A Activity A | Pass | Event paths yes | R0.1/R0.3 yes |
| Tenant A Event A Activity B (other tenant) | Reject | R0.3 Scope Change yes; Workpack create **not proven** | Partial |
| Tenant A Event B Activity A | Reject | R0.3 / M12 event bind | Partial |
| Tenant A Project B Event A | ? | Allowed if IDs written | **NOT PROVEN** |
| Project A → Event B | ? | First-hit resolve | **NOT PROVEN** |
| Null Event Activity | Loose allowed with event or legacy project (`ActivityCreationCommand.ts:305-309`) | Yes | R0.1 |
| Null Project Activity | Allowed | Yes | Common Event path |

---

## 29. Import / Export Analysis

| Path | Container | Classification |
|---|---|---|
| `/api/projects/[id]/import/p6-xml`, `p6-xer`, `ms-project` | Project URL | **P5** then land on Event |
| `/api/projects/[id]/schedule/export`, `export/xer` | Project | **P5** |
| `/api/workpacks/[id]/export/ms-project`, `primavera` | Workpack | **P5** file |
| `/api/export/generate` | `project_id` optional on history | **P7** |

External systems legitimately use “project” as **P6 / MS Project file** terminology. That is **INTEGRATION BOUNDARY — NOT STO BUSINESS AUTHORITY**.

---

## 30. Database Data Quality

Live read-only quantification on local Postgres **`syority`** (no writes). Table names as stored: `"Project"`, `events`, `"Workpack"`, `"Activity"`, `"ScheduleBaseline"`.

| Object | Total | `project_id` set | `event_id` set | Both | Neither |
|---|---:|---:|---:|---:|---:|
| `"Project"` | **0** | — | — | — | — |
| `events` | **51** | — | — | — | — |
| `"Workpack"` | **195** | **0** | **18** | **0** | **177** |
| `"Activity"` | **73** | **column missing** | **69** | n/a | **4** (null `event_id`) |
| `"ScheduleBaseline"` | **10** | **1** | **9** | **0** | **0** |

**`"Project".org_id`:** column exists. **No foreign key** on `"Project"` at all (confirmed via `information_schema` / `pg_constraint`).

**`"Project"` sample:** empty. **`events` sample (code / name):** `0009f875` T1, `08bae790` T2, `2bd0f650` Scenario Event 2, `3631a589` T1, `74d4d272` Scenario Test Event, `846aa01b` T1, `adf92be1` T2, `b855dada` T2, `bcbfe542` Scenario Event 1, `c0a1d333` Scenario Test Event.

**What the numbers prove**

- The STO `Project` table is **unused** on this database (0 rows). Project is a competing *implementation*, not a populated campaign store.
- **177 / 195 Workpacks have neither Event nor Project.** Event is not yet the parent of most packages. Consolidation is not “move Project → Event”; it is “attach the 177 loose Workpacks to an Event” — **HUMAN REVIEW**, not `project_id → event_id`.
- **0 Workpacks carry `project_id`.** `ActivityService.enqueueRecalculate` (`project_id` required) will **skip CPM for every live Workpack** unless a job is enqueued with `eventId` another way.
- Live `"Activity"` still **lacks `project_id`** (R0.2 drift confirmed). Prisma `Activity.project_id` writes are unsafe against this database.
- **9 / 10** baselines are Event-scoped; **1** still uses `project_id` only. M10’s `project_id IN eventIds` lookup will miss the 9 Event baselines unless that one leftover id happens to equal an Event UUID.

**Schema-level (unchanged):** Workpack/Activity dual keys remain legal; `Project` has no Event link and no org FK; dual punch models remain.

---

## 31. Duplication Matrix

| Concept | Project field | Event field | Same meaning? | Who wins | Risk |
|---|---|---|---|---|---|
| Campaign identity | `Project.id/code` | `Event.id/code` | **Yes** (TA) | Split by caller | Duplicate TAs |
| Name | `name` | `name` | Yes | Split | Re-entry |
| Start | `planned_sd_date` | `planned_start` | Yes (shutdown start) | S-curve uses Project; CPM uses Event calendar | Conflicting windows |
| End | `planned_su_date` | `planned_end` | Yes | Same | Same |
| Status | `status` default `Planning` | `status` default `planning` | Yes | Split | Two lifecycles |
| Location | `plant_name` string | `site_id` FK | Overlap | Event is real | Project plant not digital plant |
| Scope | none | `ShutdownScope` | No — Project has no scope | Event | Project users skip freeze |
| Workpack | `project_id` | `event_id` | Dual parent | Both optional | Orphans / dual |
| Schedule | Project routes | `calculateEventSchedule` | Competing | Engine = Event; UI often Project | Wrong activity set |
| Baseline | `ProjectBranchingService` (broken) | `ScheduleBaseline.event_id` | Competing | Event service works | M10 looks at `project_id` |
| TA dashboard | `/projects/.../ta-dashboard` | `/events/.../ta-dashboard` | Yes | Two screens | Duplicate KPIs |
| Progress | not in M8.13 | `event_id` | Event only | Event | Project dashboard may diverge |

Date/time: Project SD/SU vs Event planned/actual vs Activity planned vs M11 early/late. **R1** owns the time model. Recorded here as **conflicting campaign-date authorities** (Project SD/SU vs Event planned).

---

## 32. Current-State Process

```
User
 ├─► /events  → EventPlanningService → Event
 │                 → Scope / WBS / Factory / planner-workspace(selectedEventId)
 │                 → M11 Event CPM / M12 / M8.13 / M13 / M14 / M15 / M16
 │
 └─► /projects → Project (SD/SU)
                   → /projects/:id/schedule (project_id filter)
                   → import P6/MPP
                   → enqueueRecalculate(projectId) ──► resolveEventIdFromProject?
                   → NavBar keeps user inside /projects/:id/*

Workpack create: Site required; Event optional; project_id hidden
Activity: R0.1 Event from workpack  OR  Project schedule API writes both
```

**Breaks ENTER ONCE:** campaign created twice; Event optional on workpack; CPM skipped without Project; M16 links to `/projects`.

---

## 33. Current-State Data Lineage

```
Event.id ──► Workpack.event_id ──► Activity.event_id ──► M11/M12/M8.13/M14/M15
Project.id ──► Workpack.project_id ──► Activity.project_id ──► Project schedule / S-curve
                \________ no FK between Project and Event ________/
```

Control Tower: `eventId` ──(misnamed)──► `/api/projects/:eventId/s-curve` ──► `prisma.project.findUnique`.

---

## 34. Target Architecture

```
Organization
    → Site / Plant
        → Event                          ← sole STO campaign
            → ShutdownScope / ScopeItem
            → Workpack (event_id required)
            → Activity (event_id derived)
            → M11 / M10 / M12 / M8.13
            → M13 / M14 / M15 / M16

DigitalPlantProject                  ← keep (extraction)
MS Project / P6 files                ← keep as import/export format
STO table "Project"                  ← retire as container
```

---

## 35. Target Identity Propagation

| Object | How Event is obtained |
|---|---|
| Event | User creates/selects once (code/name/site) |
| Equipment | Not Event-owned; org + plant hierarchy |
| Scope / ScopeItem | From `ShutdownScope.event_id` |
| Workpack | Inherit Event from context; **require** `event_id` |
| Activity | Derive from Workpack (R0.1); never from Project |
| Schedule / CPM | `event_id` only; enqueue `{ eventId, orgId }` |
| Execution | M12 + Event bind |
| Progress | M8.13 + Event |
| Reports / M15 / M13 | Event filter |
| AI | `EventContextResolver` + Event URLs (not `/projects`) |

---

## 36. Project Classification

| Item | Class |
|---|---|
| STO `Project` model as TA container | **P1** move to Event / **P2** replace |
| `/projects` UI and Project schedule/import/s-curve | **P2** |
| `Workpack.project_id` | **P2** then **P3** |
| `Activity.project_id` | **P3** / **P5** (P6 leftover) — do not auto-map to Event |
| `ScheduleBaseline.project_id` | **P2** (Event already has `event_id`) |
| `ProjectBranchingService` + Project baselines API | **P4** after confirming no live client — currently **BROKEN** |
| `project_constraints`, `project_units`, `punch_items` | **P3** |
| `Permit.project_id`, `SafetyLog.project_id`, `DocLibrary.project_id` | **P3** |
| `export_history.project_id` | **P7** |
| P6/MPP/MS Project import-export | **P5** |
| `DigitalPlantProject` | **P6** |
| M16 `projectId` URL param | **P2** rename/repoint to Event |
| Work type “Project” | Retain as work_type string — not this programme |

Nothing classified **P4 DELETE** except schema-incompatible baseline branching **after** reachability confirmation (route exists; runtime cannot match schema).

---

## 37. Migration Impact

**Do not migrate in R0.4.**

| Candidate | Action | Deterministic? | Human review? |
|---|---|---|---|
| Workpack with `event_id` set, `project_id` set | Keep Event; drop Project later | Yes for Event | Review if Event ≠ user’s intended Project |
| Workpack with only `project_id` | Live `syority`: **0 rows** | n/a | None on this DB |
| Workpack with neither | Live `syority`: **177 / 195** | **No** | **HUMAN REVIEW** — do not invent Event |
| Activity `project_id` only | No `project_id → event_id` | **No** | Human + R0.2 leftovers |
| `resolveEventIdFromProject` many Events | **Forbidden auto-pick** | No | Human |
| `ScheduleBaseline.project_id` vs `event_id` | Prefer `event_id` when set | If both set and differ: human | Yes |
| DigitalPlantProject | **Do not migrate** | n/a | n/a |
| P6 import landing | Redesign to Event id | Process change | Yes |

Rollback: snapshot Workpack/Activity `(id, project_id, event_id)` before any future write.

Security: dropping Project filters without requiring Event would widen queries. Require Event first.

---

## 38. Defect Register

| ID | Pri | Component | File:line | Current | Expected | Impact | Root | Rec | Migration risk |
|---|---|---|---|---|---|---|---|---|---|
| R04-P0-001 | **P0** | Identity | `schedule/activities/route.ts:21-27` | Project URL + optional Event on create | Event-only identity | Dual context on one Activity | Legacy schedule API | Stop writing `project_id` as authority | Medium |
| R04-P0-002 | **P0** | Isolation | `WorkpackService.ts:101,120` | Client `event_id`/`project_id` stored without org proof | Resolve + prove like R0.3 | Cross-tenant/event attach | Missing service check | Service ownership | Low |
| R04-P1-001 | **P1** | M11 enqueue | `ActivityService.ts:15-33` | No `project_id` → **no CPM job** | Enqueue `eventId` | Event-native schedules stale | Project-era queue key | Worker already accepts `eventId` | Low |
| R04-P1-002 | **P1** | M11 resolve | `ScheduleOrchestrationService.ts:395-421` | First Event under Project | No silent many-to-one | Wrong Event CPM | Ambiguous map | Remove auto-pick | High if used |
| R04-P1-003 | **P1** | M10 | `PlanningReadinessService.ts:325-335` | Baseline `project_id IN eventIds` | `event_id IN eventIds` | False “not baselined” | Comment admits alias | Query `event_id` | Low |
| R04-P1-004 | **P1** | M13 | `ControlTowerDashboard.tsx:177` + `SCurveChart.tsx:19-20` | Event id → Project S-curve API | Event S-curve | Broken/wrong curve | Prop named projectId | Event route | Low |
| R04-P1-005 | **P1** | M16 UX | `NavigationRegistry.ts:44-110` | Links to `/projects/${projectId}` | `/events/${eventId}` | User lands in Project shell | Leftover registry | Repoint | Medium |
| R04-P1-006 | **P1** | Schema | `Project` vs `[id]/route.ts:13`, `s-curve:56`, `baselines:13-24`, `ProjectBranchingService.ts:10-37` | camelCase / extra fields not in schema | One Project shape | Project APIs **BROKEN** | Schema drift | Quarantine Project APIs | High |
| R04-P1-007 | **P1** | UX | `layout.tsx:49-53` | Two campaign menus | One Event | Re-entry | Historical | Hide Projects | Low |
| R04-P2-001 | P2 | Workpack UX | `WorkpackCreateForm.tsx:686` | Event optional | Event required for STO | Event-less workpacks | Legacy | Require Event | Medium |
| R04-P2-002 | P2 | Auth | `events/route.ts:7-14` vs `routeRegistry.ts:65` | Events API without `guardApi` | Same guard model | Weaker Event API | Inconsistent | Align | Low |
| R04-P2-003 | P2 | S-curve | `s-curve/route.ts:56-58` | Project load by id only | + org | Date leak risk | Missing org | Org predicate | Low |
| R04-P2-004 | P2 | Project create | `schema.prisma:1177` + `projects/route.ts:54` | No id default | Server UUID | Create may fail | Incomplete model | N/A if retiring | — |
| R04-P3-001 | P3 | Dual punch | `PunchListItem` vs `punch_items` | Two punch tables | One | Confusion | Legacy | Deprecate | Medium |
| R04-P3-002 | P3 | Tests | `m11-v1-schedule-view.test.ts:109` | Source-text | Behavioral Event/Project | False confidence | Weak tests | New tests later | — |

---

## 39. Test Quality

| Test | Type | Proves Project/Event consolidation? |
|---|---|---|
| R0.1 activity identity | Behavioral | Event derivation — not Project retirement |
| R0.3 scope-change | Behavioral | Event/tenant — Project unused |
| R0.2 backfill | Behavioral | Event from Workpack — no Project map |
| `m11-cross-event-safety` | Behavioral | Event isolation |
| `m11-v1-schedule-view` Project asserts | **SOURCE-LEVEL** | Only that strings exist |
| M14 TenantEventIsolation | Behavioral | Event, not Project |
| M16 event-context | Mixed | Event resolver |
| Project vs Event mismatch | — | **NOT PROVEN** |
| `resolveEventIdFromProject` many Events | — | **NOT PROVEN** |
| ProjectBranchingService | — | Would fail schema — **untested against current model** |

Weak source-text tests are **not** treated as proof of safe coexistence.

---

## 40. Final Scorecard

| Area | Rating |
|---|---|
| Project/Event semantic clarity | **RED** — same campaign, two objects, plus two other “Project” meanings |
| Database authority | **RED** — no Project↔Event FK; dual nullable parents; Activity.project_id unconstrained |
| Identity propagation | **AMBER** — Event-native path exists; Project path still writes |
| Tenant isolation | **AMBER** — org guards exist; Project/Event IDs not always proved |
| Event isolation | **AMBER** — strong on modern modules; weak on Project schedule |
| API consistency | **RED** — two trees; Project APIs contradict schema |
| UI consistency | **RED** — two menus, two TA dashboards |
| Activity creation | **AMBER** — R0.1 Event-correct; Project schedule API dual |
| Workpack Factory | **AMBER** — Event on instantiate; create form Event optional |
| Scheduling | **AMBER** — engine Event; enqueue/UI Project |
| Execution | **GREEN** — M12 Event/org, no Project writer |
| Progress | **GREEN** — M8.13 Event aggregation |
| Reporting | **AMBER** — M14 Event; leftover Project reports |
| AI context | **AMBER** — resolves Event; navigates to Project URLs |
| Migration readiness | **AMBER** — STO `Project` table empty (0 rows); **177** Event-less Workpacks need **human** Event attachment, not `project_id → event_id` |

---

## 41. Final YES / PARTIALLY / NO Answer

> Can AURIANOA STO operate using Event as the single authoritative business container for a Turnaround/Shutdown, without Project remaining as a competing operational concept?

## **PARTIALLY**

**Why not YES:** Project is still a live menu, a live schedule/import URL tree, the CPM enqueue key, the Control Tower S-curve target, and M16 navigation prefix. Workpack Event is optional. Project and Event are not linked.

**Why not NO:** Event already owns scope, modern schedule engine, execution, progress, M13–M16 context, and R0.1/R0.3 identity. A carefully Event-only operational path exists in code.

**Implementation, not documentation.** Comments that say “prefer event_id” (`Activity` schema `:53`) and “Event-scoped, NOT project-scoped” (`ScheduleOrchestrationService.ts:14`) **contradict** enqueue and Project UI. **IMPLEMENTATION WINS:** both containers are live.

---

## 42. Project Disposition

## **OPTION B**

Retire STO `Project` as an operational Turnaround container. Keep:

- **DigitalPlantProject** (P6 — different object)
- **MS Project / P6 file interchange** (P5 — format, not a row in `Project`)
- Temporary `Activity.project_id` as **quarantined import provenance** until a designed Event landing exists (P5/P7) — **never** as security or Event inference

**Not OPTION A** as a blanket wipe: that would delete Digital Plant and file-import meaning of “project”.

**Not OPTION C** for STO `Project` vs `Event`: they are the **same campaign concept** (SD/SU vs planned start/end). Coexistence is accidental, not a product design.

**Not OPTION D:** evidence is sufficient. Live `syority` counts (§30) show **0** STO `Project` rows and **177** Workpacks with no Event — retirement of the table is easy; attaching loose Workpacks is the real migration.

---

## 43. Recommended Remediation Roadmap

**Do not implement in this audit.**

| Step | Work | Automation vs human |
|---|---|---|
| R0.4-A | Inventory freeze (this document) | Done |
| R0.4-B | Decision: Event is sole STO container; DigitalPlantProject and MS Project files out of scope | Human |
| R0.4-C | Classify every live Workpack/Activity. On `syority`: Event-only **18**, Project-only **0**, both **0**, neither **177** | SQL done for counts; **human** Event attachment for the 177 |
| R0.4-D | Design: require Workpack.event_id; stop writing project_id; enqueue `{eventId}`; fix M10 baseline query; Event S-curve; M16 URLs | Mostly **SAFE AUTOMATION** after B |
| R0.4-E | Quarantine `/api/projects/**` schedule/import behind compatibility flag | Human + automation |
| R0.4-F | Remove Projects from planning nav; Event-only workspace | Human UX |
| R0.4-G | Quarantine `Project` table; no new rows | Safe |
| R0.4-H | Behavioral tests: Event-only CPM enqueue; reject Project-as-Event; Control Tower S-curve on Event; no `project_id → event_id` auto map | Required |

**Never:** `Project X → Event Y` when X maps to Y and Z.

---

## 44. Risks and Open Questions

- Live `syority`: `"Project"` = 0; Workpack `project_id` = 0; Activity `project_id` column missing; 177 Workpacks have no Event.
- Project-schedule / S-curve paths that filter `project_id` will return **empty** on this database.
- Whether any customer integration **requires** the STO `Project` row (vs P6 file only) is **NOT PROVEN**.
- `ProjectBranchingService` may still be clicked in UI — runtime error vs silent unused: **reachability of UI button NOT fully traced**.
- Contractor tenant redirect to `/projects/:id/reports` (`projects/[id]/page.tsx:24-25`) couples contractors to Project URLs.

---

## 45. Evidence Index

| Claim | Evidence |
|---|---|
| Project model TA-shaped | `schema.prisma:1176-1196` |
| Event model | `schema.prisma:1980-2034` |
| Dual Workpack FKs | `schema.prisma:100,134,144-148` |
| Activity dual ids | `schema.prisma:14,53-56` |
| No Project–Event FK | schema (absence) |
| Scope is Event | `schema.prisma:3772` |
| Dual nav | `layout.tsx:49-53` |
| Event optional on WP create | `WorkpackCreateForm.tsx:686-696` |
| Unvalidated IDs on WP create | `WorkpackService.ts:101,120` |
| Dual activity create | `app/api/projects/[id]/schedule/activities/route.ts:21-27` |
| CPM skip without Project | `ActivityService.ts:23-27` |
| Ambiguous Project→Event | `ScheduleOrchestrationService.ts:395-421` |
| Worker Event calculate | `scheduleRecalculateWorker.ts:33-47` |
| M10 baseline alias | `PlanningReadinessService.ts:325-335` |
| CT S-curve | `ControlTowerDashboard.tsx:177`; `SCurveChart.tsx:19-20`; `s-curve/route.ts:56-78` |
| M16 Event resolve | `EventContextResolver.ts:32-100` |
| M16 Project URLs | `NavigationRegistry.ts:44-110` |
| Broken Project schema vs API | `[id]/route.ts:13-21`; `baselines/route.ts:13-24`; `ProjectBranchingService.ts:10-37` |
| R0.1 never uses Project as Event | `ActivityCreationCommand.ts:81-82` |
| DigitalPlantProject distinct | `schema.prisma:3403-3433` |
| Live `syority` counts | §30 — `"Project"` 0; `events` 51; Workpack 195 (event 18 / project 0 / neither 177); Activity 73 (`project_id` column missing, event 69); ScheduleBaseline 10 (event 9 / project 1); `"Project"` has no FKs |

---

## Acceptance checklist (audit)

| Question | Answer |
|---|---|
| What is Event? | STO campaign (org+site+dates+lifecycle+children) |
| What is Project? | Duplicate campaign table + other homonyms |
| Duplicates? | **Yes** for STO `Project` vs `Event` |
| Legitimate coexistence? | Only DigitalPlantProject + file interchange |
| Who owns an STO? | **Event** in modern modules; **both** in leftover UI |
| Can user run STO on Event alone? | **Partially** — until CPM enqueue, nav, and WP Event-required |
| Silent Event from Project? | **Yes** — first-hit resolve |
| Silent Project from Event? | **No resolver found** |
| Project cross Event? | **Yes** as a filter/view |
| UUID as auth? | Still used as attach keys on Workpack create |
| One operational container? | **No — not yet** |
| Safe Project retirement? | Table empty on `syority` — low row-migration risk; **177** Event-less Workpacks still need **human** Event attachment |

---

**R0.4 complete. No code was changed. R0.4-B+ is not started.**
