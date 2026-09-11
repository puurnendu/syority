# AURIANOA R0.4-E — EVENT-ONLY CONSUMER BOUNDARY CLOSURE

**Programme:** R0 identity / operational-container correction  
**Phase:** Event-only consumer migration & operational boundary closure  
**Date:** 2026-09-09  
**Database:** local Postgres `syority`  
**Governing principle:** ENTER ONCE / STORE ONCE / DERIVE ONCE / REUSE EVERYWHERE.

**Binding predecessors:** R0.4, R0.4-B, R0.4-C, R0.4-D (all GREEN). Event vs Project is frozen. This phase does **not** start R1.

---

## 1. Executive Summary

R0.4-E migrates the remaining **STO operational consumers** off the deprecated Project campaign container.

The four R0.4-D leftover defects are closed in production authority:

| Defect | Before | After |
|---|---|---|
| **R04-P1-001** | CPM enqueue required `workpack.project_id` | Enqueue uses `Activity.event_id` / `Workpack.event_id` → M11 `calculateEventSchedule` |
| **R04-P1-002** | `resolveEventIdFromProject` in worker and Project schedule APIs | **Deleted.** No Project→Event inference |
| **R04-P1-004** | Control Tower passed Event id into `/api/projects/{id}/s-curve` | Control Tower uses `/api/events/{eventId}/schedule/evm/s-curve` (M8.10) |
| **R04-P1-005** | M16 built `/projects/{id}/...` | M16 builds `/events/{eventId}/...` and existing Event-context entity routes |

No second CPM engine. No second S-curve calculator. No second Event resolver. DigitalPlantProject, P6/MS Project interchange, and `work_type = Project` are unchanged.

Live Workpack census is **not rewritten** by this phase. The 177 Event-less Workpacks remain UNRESOLVED until human R0.4-D disposition. They no longer trigger guessed CPM.

---

## 2. R0.4E Scope

**In scope**

- Forensic classification of Project references (no bulk string replace)
- CPM enqueue consumer migration
- Removal of `resolveEventIdFromProject` from the production Event path
- Control Tower S-curve Event path
- M16 STO campaign URL migration
- Navigation / Event-context consistency for migrated surfaces
- STO Workpack **create** Event requirement
- Architectural guard + behavioural tests
- Remaining-reference classification

**Out of scope / not done**

- R1 Time & Planning Propagation
- Automatic assignment of the 177 Event-less Workpacks
- Deleting leftover `/projects/{id}` pages (classified DEPRECATED; not primary nav)
- Redesign of R0.1, M8.13, M10, M11, M12, M13, M14, M15, M16 interaction core
- Schema change
- New S-curve or CPM engine

---

## 3. Frozen Architecture

From R0.4-B (DEC-001…015), not reopened:

- Event is the sole STO operational campaign container.
- DigitalPlantProject is an engineering/extraction workspace, not a campaign.
- P6 / MS Project remain external interchange terminology.
- `work_type = Project` is a business classification, not the STO container.
- No Project→Event or Event→Project compatibility authority.
- Event-less Workpacks must not be guessed into an Event.
- M11 remains sole planned-schedule/CPM authority.
- M8.10 remains sole EVM curve authority used by Control Tower / M14.
- M16 remains interaction layer, not identity or schedule authority.

Operational hierarchy:

Organisation → Site / Plant → Event / Turnaround → Area → Unit → System → Equipment → Workpack → Activity

---

## 4. Pre-change Inventory

R0.4-D live state (unchanged as a data migration — R0.4-E writes no Workpack Event assignments):

| Metric | R0.4-D live |
|---|---:|
| Workpacks | 195 |
| Event-linked | 18 |
| Event-less | 177 |
| Project-linked | 0 |
| R0.4-D assigns | 0 |
| R0.4-D quarantine | 0 |

Recorded production defects before this phase:

1. `ActivityService.enqueueRecalculate` loaded `workpack.project_id` and skipped when null (`src/modules/Activity/Services/ActivityService.ts`).
2. `ScheduleOrchestrationService.resolveEventIdFromProject` first-hit Workpack/Activity (`src/core/schedule/ScheduleOrchestrationService.ts`).
3. Worker fallback: `projectId` → resolver → CPM (`src/workers/scheduleRecalculateWorker.ts`).
4. Control Tower: `<SCurveChart projectId={eventId} />` → `/api/projects/${id}/s-curve`.
5. M16 `NavigationRegistry` emitted `/projects/${projectId}/...`.
6. NavBar rewrote tenant items to `/projects/{id}/...` when the path started with `/projects/`.
7. STO Workpack create allowed `event_id = NULL`.

---

## 5. Project Reference Classification

Pre-change occurrences were classified, not bulk-replaced.

| Class | Meaning | Examples |
|---|---|---|
| **A** | Legitimate external/file concept | P6 XER / MS Project import, `imported-schedule` |
| **B** | DigitalPlantProject | `/digital-plant`, `/api/digital-plant/projects/` |
| **C** | `work_type = Project` | Workpack create default `work_type` field (unchanged business enum) |
| **D** | Obsolete STO Project container | CPM enqueue `project_id`, resolver, Control Tower Project S-curve, M16 `/projects/` campaign URLs |
| **E** | Ambiguous — inspected | `PipelineInput.projectId` (was org id on WhatsApp/Voice), leftover `/projects/[id]` pages |

Class D items in the four recorded defects were migrated or removed. Class A/B/C retained. Class E leftovers are classified in §35.

---

## 6. CPM Enqueue Audit

**Before**

```
Activity create/update/delete/approve
  → enqueueRecalculate(workpackId)
  → Workpack.project_id
  → queue { projectId, orgId } jobId recalc-${projectId}
  → worker resolveEventIdFromProject(projectId)
  → calculateEventSchedule(guessedEvent)
```

Callers of enqueue: `ActivityService.createActivity`, `updateActivity`, `deleteActivity`, `approveForScheduling`.

**Event-less / Project-less (live majority):** enqueue silently skipped. That hid the identity gap and also meant Event-linked Workpacks with null `project_id` never queued CPM (live: 0 Project-linked Workpacks).

**Also audited**

- `POST /api/projects/[id]/schedule` — resolver → `calculateEventSchedule`
- `GET /api/projects/[id]/lookahead` — resolver → Event lookahead
- `PUT /api/projects/[id]/schedule/activities/[activityId]` — resolver then direct `calculateEventSchedule`
- UI: `ActivitiesPanel` / `GanttChart` POSTed Project schedule

---

## 7. CPM Migration

New adapter: `src/core/schedule/enqueueEventScheduleRecalculate.ts`

```
eventId (Activity.event_id) if present
  else Workpack.event_id
  else DO NOT ENQUEUE → EVENT_REQUIRED

Verify Event { id, organization_id, deleted_at: null }
  else DO NOT ENQUEUE → CROSS_TENANT_EVENT

queue { eventId, orgId } jobId recalc-${eventId}
  → ScheduleOrchestrationService.calculateEventSchedule
```

No Project lookup. No first-Event pick. No date/plant/UUID inference.

Worker now requires `eventId`. Project fallback removed.

Project schedule **POST** no longer calculates CPM. It returns **409 `EVENT_REQUIRED`** pointing to `POST /api/schedule/calculate` with `event_id`.

`ActivitiesPanel` / `GanttChart` now POST `/api/schedule/calculate` with `workpack.event_id`. Missing Event → explicit UI error, not a guessed Event.

---

## 8. Project Resolver Audit

| Consumer | Kind | Disposition |
|---|---|---|
| `scheduleRecalculateWorker` | production STO | **DELETE** dependency — Event job only |
| `POST /api/projects/[id]/schedule` | production STO leftover | **ISOLATE** — 409, no resolver |
| `GET /api/projects/[id]/lookahead` | production STO leftover | **ISOLATE** — empty + `PROJECT_LOOKAHEAD_RETIRED` |
| `PUT .../schedule/activities/[activityId]` | production STO leftover | **REPLACE** enqueue with Event adapter; org-scoped update (Project no longer security boundary) |
| `ScheduleOrchestrationService.test.ts` | test of obsolete behaviour | **REWRITE** — asserts method is gone |
| `tests/m11-v1-schedule-view.test.ts` | test of obsolete behaviour | **REWRITE** — asserts no inference |

**Resolver disposition: DELETE**

`ScheduleOrchestrationService.resolveEventIdFromProject` is removed. It has no legitimate DigitalPlant / P6 / `work_type` consumer. It was the forbidden first-hit Project→Event map.

---

## 9. S-Curve Audit

**Authoritative sources (unchanged)**

| Series | Owner |
|---|---|
| PV / EV / AC / EAC projection | **M8.10** `generateEventCurve` |
| SPI / CPI / SV / CV | **M8.10** `calculateLiveEvm` |
| Actual progress (Control Tower summary) | **M8.13** |
| Presentation | **M13** Control Tower chart |
| Reporting curve | **M14** already delegated to `generateEventCurve` |

**Broken chain (R04-P1-004)**

```
ControlTowerDashboard(eventId)
  → SCurveChart projectId={eventId}
  → GET /api/projects/{eventId}/s-curve
  → prisma.project.findUnique
  → 422 "Project is missing planned start/finish dates"
```

That API is a **second** EVM calculator on Project rows. It is not used by Control Tower after this phase.

`ScheduleOrchestrationService.generateSCurveData` remains an M11 helper. Control Tower does **not** call it. No new engine was added.

---

## 10. S-Curve Migration

```
Control Tower Event
  → GET /api/events/{eventId}/schedule/evm/s-curve   (M8.10)
  → GET /api/events/{eventId}/schedule/evm/summary     (M8.10 KPIs)
  → mapEventCurveToChart()  (presentation only)
```

Mapper: `src/core/evm/mapEventCurveToChart.ts` — maps `dates/pv/ev/ac/eacProjection` to chart series. Does not recalculate EVM.

Event existence is checked with `session.organization_id`. Missing/cross-tenant Event → generic **404 Not found**.

Event exists, no baseline/activities → **200** `{ data: null, message: 'No schedule/progress data available' }`.

UI empty copy: **No schedule/progress data available** — not 422, not “Project not found”.

Portfolio dashboard Event S-curve uses the same Event chart. Leftover Project pages may still call `/api/projects/{id}/s-curve` (DEPRECATED).

New Event page: `/events/[eventId]/control-tower` (existing Event URL scheme). Linked from Event detail.

---

## 11. M16 URL Audit

`NavigationRegistry` previously required `projectId` and built:

- `/projects/{id}/equipment|workpacks|activities|control-tower|ta-dashboard|execution|schedule|reports|constraints`

WhatsApp/Voice passed `projectId: organizationId` — a misnamed org id, not a STO Project row.

Pipeline already had trusted `context.eventId` from `EventContextResolver`. That is the Event authority. URLs now use it.

---

## 12. M16 Migration

Discovered canonical Event / entity routes (not invented):

| Target | Route |
|---|---|
| dashboard | `/events/{eventId}/ta-dashboard` |
| control_tower | `/events/{eventId}/control-tower` |
| execution | `/events/{eventId}/execution-readiness` |
| reports | `/events/{eventId}/management-intelligence` |
| constraints | `/events/{eventId}/materials` |
| schedule | `/schedule` (existing Event-context page via active Event) |
| workpacks | `/workpacks` |
| workpack | `/workpacks/{workpackId}` |
| equipment | `/asset-register/{assetId}` (asset register, not STO Project) |
| delayed_workpacks | `/workpacks?status=delayed` |
| critical_activities | `/execution?filter=critical` |

Campaign routes without `context.eventId` return **null**. They do not fall back to Project or org id.

`PipelineInput.projectId` is optional unused leftover so channel/test call sites are not reopened. It is not used to build URLs.

M16 interaction core, confirmation gate, tools, and security bindings are unchanged.

---

## 13. Navigation Audit

| Surface | Finding / action |
|---|---|
| `NavigationRegistry` | Event / entity routes only |
| NavBar | Project-aware rewrite to `/projects/{id}/...` **removed** |
| Planning items | Competing **Projects** nav item already absent; Events / Event Review / Digital Plant remain |
| Event context | `useActiveShutdown` / `selectedEventId` / `EventContextResolver` reused — no second context |
| Control Tower | `/events/{eventId}/control-tower` |
| Planning / Schedule / Execution / Reports / Management | Existing Event-scoped pages; M16 now points at them |

User no longer gets M16 or primary nav into a second STO campaign container. Leftover `/projects/{id}` URLs remain reachable if typed (DEPRECATED).

---

## 14. Event Context Audit

Existing mechanisms reused:

- Web: `ActiveShutdownContext.activeEventId`, `useWorkspaceStore.selectedEventId`
- M16: `EventContextResolver` → `context.eventId`
- APIs: `event_id` / `eventId` on Event routes

Migrated consumers now read Event from those sources. No second cookie or resolver was added.

---

## 15. Workpack Boundary

R0.1 / R0.4-D identity model unchanged. Existing Event-less rows are not auto-assigned.

**Create** now requires Event:

`WorkpackService.createWorkpack` → `WorkpackIdentityError('EVENT_REQUIRED')` if `event_id` missing. Event must exist for `organization_id` (`deleted_at` null). Cross-tenant Event → generic **Event not found** (`CROSS_TENANT_EVENT`).

Also enforced on:

- `POST /api/workpacks`
- `POST /api/workpacks/ai-generate` (form must send `event_id`)
- `TemplateLibraryService.instantiate` (must pass `event_id`)
- Workpack create form: Event is required
- Factory instantiate already passed `scope.event_id`; null Event now fails closed

`project_id` may still be stored if supplied (legacy column). It is **not** used as Event identity or security boundary.

---

## 16. Activity Boundary

`ActivityCreationCommand` is unchanged (R0.1). Organisation / Event / Workpack identity still resolve there.

`ActivityService` only changed the **post-write CPM enqueue** to use `created/updated.event_id` and `workpack_id`. Event-less Activity/Workpack → enqueue deferred (`EVENT_REQUIRED`), activity write still succeeds where R0.1 allows it.

Cross-Event Workpack/Activity mismatch remains an R0.1 rejection on create. Enqueue does not repair it.

---

## 17. Security

Migrated Event consumers:

| Check | Where |
|---|---|
| `session.organization_id` | `withTenantGuard` / session |
| `event.organization_id` | enqueue, Workpack create, Event S-curve, Control Tower page, `calculateEventSchedule` |
| Resource ownership | Activity updateMany by `id` + `organization_id` (Project `workpack.project_id` filter **removed**) |

Project ID is not a security boundary on the migrated paths.

Cross-tenant Event: generic not-found / `CROSS_TENANT_EVENT` / M11 “not found or access denied”. No Event list leak.

---

## 18. Tenant Isolation

- Enqueue verifies Event in the caller org before queueing.
- Worker calls `calculateEventSchedule(eventId, orgId)` which re-checks Event org.
- Event S-curve 404 if Event not in session org.
- Control Tower page `notFound()` if Event not in session org.
- Workpack create cannot attach another org’s Event.

---

## 19. API Changes

| API | Disposition |
|---|---|
| `POST /api/schedule/calculate` | **RETAIN** — Event CPM authority |
| `GET /api/events/{id}/schedule/evm/s-curve` | **RETAIN** — empty Event → 200 null data, not 422 Project |
| `GET /api/events/{id}/schedule/evm/summary` | **RETAIN** — M8.10 KPIs |
| `POST /api/projects/{id}/schedule` | **DEPRECATE** — 409 EVENT_REQUIRED, no CPM |
| `GET /api/projects/{id}/lookahead` | **DEPRECATE** — no Event inference |
| `PUT /api/projects/{id}/schedule/activities/{id}` | **CORRECTED** — org-scoped update + Event enqueue |
| `GET /api/projects/{id}/s-curve` | **DEPRECATED leftover** — leftover Project pages only |
| `POST /api/workpacks` | Event required |
| `/api/projects/{id}/import/p6-*`, `ms-project`, `imported-schedule`, `export/xer` | **RETAIN** — P6/MS Project interchange (A) |
| `/api/digital-plant/projects/` | **RETAIN** — DigitalPlantProject (B) |

---

## 20. Database Changes

**None.** No migration. No Workpack/Activity Event backfill. No Project table drop.

Existing 177 Event-less Workpacks remain Event-less until R0.4-D human review.

---

## 21. Architectural Guard

`src/core/architecture/__tests__/r04e-event-only-boundary.guard.test.ts`

Behaviour / contract checks (not a repo-wide string wipe):

- Enqueue adapter queues `eventId`, not `project_id`
- Worker has no `resolveEventIdFromProject`
- Orchestration service no longer defines the resolver
- Project schedule POST does not call CPM
- Control Tower / Event SCurveChart call `/api/events/.../evm/s-curve`
- M8.10 loader is Event+org scoped (`event_id`, not `"Project"`)
- M16 `control_tower` with a Project id still emits `/events/{eventId}/...`
- Allow-list: Digital Plant page exists; `work_type` business field remains

---

## 22. Behavioural Tests

| Test | File | Proves |
|---|---|---|
| A | `r04e-event-cpm-enqueue.test.ts` | Workpack Event A → queue Event A, no `projectId` |
| B | same | Event-less → no enqueue, no Event lookup |
| C | same | Cross-tenant Event → `CROSS_TENANT_EVENT`, no enqueue |
| D | same + orchestration test | `resolveEventIdFromProject` undefined |
| S-curve A vs B | `r04e-event-scurve.test.ts` | Distinct Event series; empty → established copy; mapper uses M8.10 shapes |
| M16 Event URL | `r04e-event-navigation.test.ts` | Event context → Event URLs; no `/projects/` campaign paths |
| Workpack create | `r04e-workpack-event-create.test.ts` | Null Event rejected; cross-tenant generic; valid Event creates |

---

## 23. Regression Tests

Suites **targeted** by this phase (must be re-run in a working test runner):

| Suite | Why |
|---|---|
| R0.1 `r01-activity-identity-creation.test.ts` | ActivityService enqueue path changed; instantiate still passes Event |
| R0.3 `r03-scope-change-security.test.ts` | Unchanged; confirm no identity drift |
| R0.4-D `r04d-workpack-identity-review.test.ts` | Unchanged review workflow |
| M11 `ScheduleOrchestrationService.test.ts`, `m11-v1-schedule-view.test.ts` | Resolver removed; Project POST contract rewritten |
| M16 `m16-r2-assistant-core.test.ts` | Navigation paths updated |

| Suite | Run in this environment? | Reason / risk |
|---|---|---|
| R0.1 / R0.3 / R0.4-D / M11 / M16-R2 / R0.4-E new | **Attempted — runner hung with no output** | Same class of local Windows/agent shell stall previously seen on Playwright EOF. **Not claimed GREEN.** |
| M8.13 / M10 / M12 / M13 / M14 / M15 full suites | **Not run** | No CPM/progress/readiness/execution math change. Risk: low if enqueue tests pass; residual risk that a source-contract test still expects `resolveEventIdFromProject`. |
| M16 R4/R5/R6 full | **Not run** | Navigation registry tests updated; channel adapters still pass unused `projectId`. Risk: medium if a test asserts old `/projects/` URLs. |

Do **not** treat source inspection as a passing regression.

---

## 24. Browser Tests

Required surfaces: Event navigation, Control Tower S-curve, M16 navigation, Workpack Identity Review.

| Layer | Result |
|---|---|
| **CODE** | Event Control Tower page, Event S-curve wiring, M16 Event URLs, Event Review pages from R0.4-D |
| **TEST** | Behavioural tests written; execution not completed in this environment |
| **BROWSER** | **Not run.** No Playwright pass is claimed. Environment shell/runner stall — not converted into a product defect. |

Browser is **not GREEN**.

---

## 25. Remaining Project References

Post-change re-search. Every remaining occurrence is classified.

| Occurrence | Classification |
|---|---|
| `/digital-plant`, `/api/digital-plant/projects/` | **LEGITIMATE** (B) |
| `/api/projects/{id}/import/p6-*`, `ms-project`, `imported-schedule`, `export/xer` | **LEGITIMATE** (A) |
| `work_type` field / form default | **LEGITIMATE** (C) |
| `Workpack.project_id` column + create input | **DEPRECATED** leftover column — not Event authority |
| `ActivityService` `project_id` / `legacyProjectId` | **EXCEPTION** — R0.1 legacy hint only; enqueue ignores it |
| `GET /api/projects/{id}/schedule` (GET still lists by `project_id`) | **DEPRECATED** leftover STO schedule view |
| `GET /api/projects/{id}/s-curve` + `Dashboard/SCurveChart` | **DEPRECATED** leftover Project chart |
| `/projects/[id]/*` pages (ta-dashboard, schedule, equipment, …) | **DEPRECATED** leftover UI; not in M16 or primary nav |
| `PipelineInput.projectId` / WhatsApp `projectId: orgId` | **DEAD** misnamed leftover — unused for URLs |
| `resolveEventIdFromProject` | **DELETED** from production; tests assert absence |
| `enqueueEventScheduleRecalculate` | **LEGITIMATE** Event adapter |

No unexplained STO Project **authority** remains. Leftover Project **pages/APIs** remain and are explicit DEPRECATED exceptions, not a second campaign authority for CPM, Control Tower S-curve, or M16.

---

## 26. Remaining Defects

| ID | Note |
|---|---|
| R04-E-L1 | Leftover `/projects/{id}` pages still HTTP-reachable if bookmarked |
| R04-E-L2 | Project GET schedule / Project S-curve APIs still exist for those pages |
| R04-E-L3 | 177 Event-less Workpacks still Event-less (R0.4-D human review not performed) |
| R04-E-L4 | Behavioural/regression/browser execution not completed in this agent environment |
| — | R1 Time & Planning Propagation **not started** |

R04-P1-001, R04-P1-002, R04-P1-004, R04-P1-005 are **closed in code**.

---

## 27. Before/After Authority Map

### BEFORE

```
Project
 ├── legacy schedule
 ├── CPM enqueue
 ├── S-curve
 └── M16 URLs

Event
 ├── M8.13
 ├── M10
 ├── M11
 ├── M12
 ├── M13
 ├── M14
 ├── M15
 └── M16 domain
```

### AFTER

```
Organisation
      ↓
Site / Plant
      ↓
Event / Turnaround
      ↓
Digital Plant / Scope
      ↓
Workpack
      ↓
Activity
      ↓
M11 Schedule / CPM
      ↓
M12 Execution
      ↓
M8.13 Progress
      ↓
M13 Control Tower
      ↓
M14 Reports
      ↓
M15 Management
      ↓
M16 Interaction
```

### Retained non-STO Project concepts

```
DigitalPlantProject
        │
        └── engineering/extraction workspace

P6 / MS Project
        │
        └── external interchange

work_type = Project
        │
        └── unchanged business classification
```

---

## 28. Acceptance Criteria

| Criterion | Evidence |
|---|---|
| Event is the only STO campaign authority | Frozen + migrated consumers |
| CPM enqueue no longer depends on Project | `enqueueEventScheduleRecalculate` |
| Event-less Workpacks do not trigger guessed CPM | Test B; `EVENT_REQUIRED` |
| `resolveEventIdFromProject` has no live STO dependency | Method deleted |
| Control Tower S-curve no longer requires Project | Event EVM APIs + mapper |
| M16 STO navigation no longer uses `/projects/{id}` | `NavigationRegistry` |
| Event context preserved | Existing resolver / selectedEvent / active Event |
| Project is not a security boundary (migrated paths) | Org + Event checks |
| No cross-tenant Event access | Enqueue / create / S-curve / CPM |
| No second CPM engine | Still `calculateEventSchedule` only |
| No second S-curve calculation engine | M8.10 only; mapper is presentation |
| No second Event resolver | No replacement resolver |
| R0.1 / M8.13 / M10 / M11 / M12 / M13 / M14 / M15 / M16 authorities | Not redesigned |
| DigitalPlantProject / P6 / `work_type=Project` intact | Allow-listed |
| Remaining Project references classified | §25 |
| Behavioural tests pass | **Not proven in this environment** |
| Regression tests pass | **Not proven in this environment** |

---

## 29. Final Decision

R0.4-E DECISION

Event is now the sole STO operational campaign container **in the migrated production consumers** (CPM enqueue, Control Tower S-curve, M16 STO navigation, STO Workpack create).

All identified STO Project consumer dependencies have been migrated,
removed, isolated, or explicitly classified as legitimate non-STO concepts.

CPM is Event-authoritative.

Control Tower S-curve is Event-authoritative.

M16 STO navigation is Event-authoritative.

DigitalPlantProject remains a separate engineering/extraction object.

P6/MS Project remain external interchange concepts.

work_type = Project remains unchanged.

No Project→Event inference exists.

No second Event authority exists.

**CODE:** the four R0.4-D leftover defects are closed in source.  
**TEST:** written; runner did not complete in this environment.  
**BROWSER:** not run.

R0.4-E STATUS: **AMBER**

R1 Time & Planning Propagation is **not** started. R0.4-E is not treated as CLOSED until the behavioural and regression suites are executed and recorded as pass.

---

## 30. How to finish GREEN

From repo root, after a healthy local runner:

```text
npx vitest run src/core/schedule/__tests__/r04e-event-cpm-enqueue.test.ts src/core/evm/__tests__/r04e-event-scurve.test.ts src/core/m16/__tests__/r04e-event-navigation.test.ts src/modules/Workpack/__tests__/r04e-workpack-event-create.test.ts src/core/architecture/__tests__/r04e-event-only-boundary.guard.test.ts src/core/activity/__tests__/r01-activity-identity-creation.test.ts src/core/scope-change/__tests__/r03-scope-change-security.test.ts src/core/workpack-identity-review/__tests__/r04d-workpack-identity-review.test.ts src/core/schedule/ScheduleOrchestrationService.test.ts src/core/m16/__tests__/m16-r2-assistant-core.test.ts tests/m11-v1-schedule-view.test.ts
```

Then Event route `/events/{id}/control-tower` in a real browser: S-curve empty copy, no Project 422.

Only then may the decision block be updated to GREEN and “Event-only operational boundary CLOSED”.
