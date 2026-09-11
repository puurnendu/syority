# AURIANOA R0.4-B — EVENT AS SOLE STO OPERATIONAL CONTAINER
## Architecture & Business Authority Decision Freeze

**Programme:** R0 identity / operational-container correction  
**Phase:** DECISION FREEZE ONLY — not implementation  
**Date:** 2026-09-09  
**Status:** GREEN — DECISION FROZEN  
**Primary evidence:** `docs/AURIANOA_R0.4_PROJECT_EVENT_CONSOLIDATION_FORENSIC_AUDIT.md`  
**Live data:** local Postgres `syority` (R0.4 §30, read-only)

**Governing principle:** ENTER ONCE / STORE ONCE / DERIVE ONCE / REUSE EVERYWHERE.

This document freezes the business and architecture decision. It does not implement it.

---

## 1. Compliance

| Action | Done? |
|---|---|
| Modify source code | No |
| Modify Prisma schema / migrations | No |
| Alter database data / backfill Workpacks | No |
| Delete, rename, or quarantine Project | No |
| Change APIs, UI, tests, or navigation | No |
| Implement Event-only behaviour | No |
| Files created | **Only this document** |

R0.4-B authorizes **no** production change. Later phases (R0.4-C onward) require a separate prompt.

R0.1 `ActivityCreationCommand`, M8.13 math, M10 scoring, M11 CPM, and M12 write rules are **not redesigned** here.

---

## 2. Purpose

R0.4 proved that Event and STO `Project` are the **same campaign concept** implemented twice, plus two other legitimate uses of the word “Project”. Live `syority` then proved this is **not** a Project→Event row migration.

R0.4-B freezes:

1. Event as the **sole** STO operational container for a Turnaround / Shutdown.
2. STO `Project` as **deprecated operational authority** (staged retirement, not immediate deletion).
3. A hard ban on generic `project_id → event_id` mapping.
4. The 177 Event-less Workpacks as **unresolved** until controlled human classification.
5. DigitalPlantProject and P6/MS Project as **different objects**, not campaign containers.

---

## 3. Starting Facts (implementation + live `syority`)

| Fact | Value | Source |
|---|---|---|
| STO `"Project"` rows | **0** | R0.4 §30 |
| `events` rows | **51** | R0.4 §30 |
| `"Workpack"` total | **195** | R0.4 §30 |
| Workpacks with `event_id` | **18** | R0.4 §30 |
| Workpacks with `project_id` | **0** | R0.4 §30 |
| Workpacks with neither | **177** | R0.4 §30 |
| `"Activity"` total | **73** | R0.4 §30 |
| Activities with `event_id` | **69** | R0.4 §30 |
| Live Activity `project_id` column | **Missing** (Prisma declares it) | R0.4 §30 / R0.2 drift |
| `"ScheduleBaseline"` | **10** (Event **9**, Project **1**, both **0**) | R0.4 §30 |
| `"Project".org_id` FK | Column exists; **no FKs on `"Project"`** | R0.4 §30 |
| Project ↔ Event FK / mapping table | **None** | R0.4 §10 |
| Workpack Event / Project | Both nullable FKs | `schema.prisma:100,134` |
| Scope ownership | `ShutdownScope.event_id` unique | `schema.prisma:3772` |

**Therefore:**

- This is **not** a Project→Event data migration. There are **zero** Project rows and **zero** Workpacks with `project_id`.
- The main data problem is **177 Workpacks with no Event**.
- The competing Project *table* is empty. The competing Project *implementation* (routes, enqueue, nav, S-curve) is not.
- Do **not** invent Event assignments.

---

## 4. Why Event and STO Project cannot both own a TA

They describe the same operational job:

| Concept | Event (`schema.prisma:1980`) | STO Project (`schema.prisma:1176`) |
|---|---|---|
| Campaign name / code | `name`, `code` | `name`, `code` |
| Dates | `planned_start` / `planned_end` | `planned_sd_date` / `planned_su_date` |
| Status / lifecycle | `status` | `status` |
| Tenant | `organization_id` FK | `org_id` column, **no org FK** |
| Location | required `site_id` | free-text `plant_name` / `location` |
| Children | Scope, WBS, workpacks, baselines, scenarios, safety | Workpacks only |

Two containers for one campaign violate STORE ONCE. A user who selects “TA-2027” must not also have to select a Project that might be the same campaign, a different campaign, or nothing.

R0.4 already recorded the damage of coexistence:

- Dual nav (`layout.tsx:49-53`).
- Dual TA dashboards.
- CPM engine Event-scoped; enqueue keyed on `project_id` (`ActivityService.ts:15-33`).
- `resolveEventIdFromProject` first-hit, not 1:1 (`ScheduleOrchestrationService.ts:395-421`).
- Control Tower Event KPIs + Project S-curve URL (`ControlTowerDashboard.tsx:177`).
- M16 resolves Event, then navigates to `/projects/...` (`NavigationRegistry.ts:44-110`).

**Decision:** one operational container. That container is Event.

---

## 5. Authoritative meaning of Event

**Event** is one specific operational Turnaround / Shutdown campaign.

Examples of business identity (code / name, not UUID):

- TA-2027
- Shutdown-April-2027
- Major Turnaround 2027

Event owns:

| Ownership | Meaning |
|---|---|
| Campaign identity | `Event.id` (system), `code` / `name` (business) |
| Tenant | `organization_id` |
| Plant / Site | required `site_id`; units/systems via `EventUnit` / `EventSystem` |
| Lifecycle | `status`, planned/actual dates |
| Calendar | `calendar_id` → `ScheduleCalendar` |
| WBS | `WbsNode.event_id` required |
| Scope | `ShutdownScope` 1:1 on `event_id` |
| Workpacks | every STO Workpack must belong to exactly one Event (target) |
| Schedule context | M11 `calculateEventSchedule(eventId, organizationId)` |
| Execution context | M12 `eventId` bind against Activity/Workpack Event |
| Progress context | M8.13 aggregation by organisation + Event |
| Readiness context | M10 Event-scoped; `ScheduleBaseline.event_id` when present |
| Reporting / management / AI | M14 / M15 / M16 Event context |

Parent/child Events (`parent_event_id`) remain a **multi-window campaign tree inside Event**, not a reason to restore Project.

---

## 6. What “Project” means after this freeze

The word “Project” is not one object. Collapsing all occurrences would destroy two legitimate concepts.

### 6.1 STO `Project` — deprecated operational container

The Prisma model `Project` (`schema.prisma:1176`) is a legacy/duplicate Turnaround campaign.

For STO:

- It is **not** an independent operational container.
- It is **not** a security boundary.
- It is **not** schedule, execution, progress, reporting, or AI authority.
- It is **to be retired** as operational authority.

On live `syority` the table has **0 rows**. Retirement of the *table as a store* is low data risk **here**. Retirement of the *implementation* is a controlled later sequence (DEC-015).

### 6.2 DigitalPlantProject — retain (different object)

`DigitalPlantProject` (`schema.prisma:3404`, table `digital_plant_projects`) is an extraction / workspace object on Organisation + Site + Plant + Unit.

- **DigitalPlantProject ≠ Event**
- **DigitalPlantProject ≠ STO Project**
- Do **not** migrate it to Event.
- Do **not** delete it because its name contains “Project”.

### 6.3 MS Project / P6 “project” — retain (integration terminology)

External schedule files and tools use “project” as format language.

```
External P6 / MS Project
        ↓
Import / Export Adapter
        ↓
AURIANOA Event
```

Do **not** create an STO `Project` row merely to accommodate that terminology.

Temporary `Activity.project_id` (where the column exists) may remain **quarantined import provenance** until a designed Event landing exists. It must never become security or Event inference.

### 6.4 Work type = Project — retain (classification)

`Workpack.work_type = "Project"` means Capital Project (or similar work classification) in the create form. It is unrelated to the STO `Project` row. Do not rename or remove it as part of this programme.

---

## 7. Target operating model

```
Organisation
    ↓
Plant / Site
    ↓
EVENT                          ← sole STO campaign container
    ↓
Digital Plant / Equipment      ← asset identity; not a campaign
    ↓
Scope                          ← ShutdownScope.event_id
    ↓
Scope Item
    ↓
Workpack                       ← Workpack.event_id required (target)
    ↓
Activity                       ← inherit Event from Workpack / R0.1
    ↓
Planning
    ↓
M11 Schedule / CPM             ← { organizationId, eventId }
    ↓
M10 Readiness                  ← Event; ScheduleBaseline.event_id
    ↓
M12 Execution                  ← Event → Activity → ExecutionWriteService
    ↓
M8.13 Progress                 ← Event aggregation
    ↓
M13 Control Tower              ← selected Event
    ↓
M14 Reporting                  ← Event campaign dimension
    ↓
M15 Management Intelligence    ← Event
    ↓
M16 AI / WhatsApp / Voice / Mobile  ← EventContext
```

Implemented topology today is **siblings**, not this tree (R0.4 §7). The freeze is the **target**. Implementation is later.

---

## 8. Authority rule

There shall be **exactly one** operational campaign context for an STO: **Event**.

Therefore:

| Claim | Decision |
|---|---|
| Project ≠ STO security boundary | Frozen |
| Project ≠ STO schedule authority | Frozen |
| Project ≠ STO execution authority | Frozen |
| Project ≠ STO progress authority | Frozen |
| Project ≠ STO reporting authority | Frozen |
| Project ≠ STO AI context | Frozen |

Organisation remains the **tenant** security boundary. Event is the **campaign** operational context. Permission remains the **capability** layer.

UUID alone is never authorization.

---

## 9. Required authority table

| Domain | Current Authority (R0.4) | Target Authority | Project Allowed? |
|---|---|---|---|
| STO Campaign | Split (Event + Project UI/APIs) | **Event** | **No** |
| Plant / Site | Event `site_id` / Site | Event / Site | **No** |
| Scope | Event (`ShutdownScope`) | Event | **No** |
| Workpack | Event optional; Project optional | Event (required) | **No** |
| Activity | Event / R0.1; leftover Project write path | Event (via Workpack / command) | **No** as authority |
| Schedule | Event engine / Project UI + enqueue | Event / M11 | **No** |
| Readiness | Event + `project_id IN eventIds` defect | Event / M10 | **No** |
| Execution | Event / M12 | Event / M12 | **No** |
| Progress | Event / M8.13 | Event / M8.13 | **No** |
| Control Tower | Event KPIs; Project S-curve URL | Event | **No** |
| Reporting | Event M14 + legacy Project reports | Event / M14 | **Compatibility only** |
| Management | Event M15 | Event | **No** |
| AI | Event context + Project URLs | Event + Event URLs | **No** |
| P6 / MPP | Project URL / terminology | Event landing | **Yes — integration only** |
| Digital Plant | DigitalPlantProject | DigitalPlantProject | **Yes — different object** |

“Compatibility only” means a leftover Project report must not become a competing source of management truth. It may exist temporarily while consumers move.

---

## 10. Identity propagation rule

Event identity must propagate **downstream** from the authoritative parent. Downstream objects do not invent Event.

**Preferred chain:**

```
Event
 ↓
ShutdownScope.event_id
 ↓
ScopeItem
 ↓
Workpack.event_id
 ↓
Activity.event_id
 ↓
M11 eventId
 ↓
M12 eventId
 ↓
M8.13 eventId
 ↓
M13 eventId
 ↓
M14 event filter
 ↓
M15 eventId
 ↓
M16 EventContext
```

Rules:

- DERIVE ONCE: Activity Event comes from Workpack / R0.1 context, not from a second picker.
- REUSE EVERYWHERE: M11–M16 consume the same Event id the Workpack already stores.
- Normal users never type UUIDs. They select Event **code / name**. The system holds `Event.id`.

**Forbidden reverse inference:**

```
project_id  →  event_id
Project.code  →  Event.code
first Event in the tenant  →  Workpack.event_id
```

---

## 11. Workpack rule

Every **STO Workpack** must belong to **exactly one** Event.

**Future create / instantiate (not implemented here):**

- Require `event_id`, **or** derive it from an already-authoritative Event context (Event workspace, Scope Item of that Event, Workpack Factory instantiated for that Event).
- Must **not** require `project_id`.
- Must **never** infer Event from Project.

Current create form makes Event optional (`WorkpackCreateForm.tsx:686`). That is why 177 live Workpacks have no Event. The freeze forbids continuing that as the STO product rule.

`work_type = "Project"` (capital work classification) does not exempt a Workpack from Event if it is executed as part of an STO campaign. If a future product decision allows non-STO workpacks with no Event, that is a **separate** object class and must be labelled as such — it is not approved here. Default for this programme: STO Workpack ⇒ Event required.

---

## 12. Activity rule

Every STO Activity must inherit Event identity from its authoritative Workpack / creation context.

- **Do not** derive `event_id ← project_id`.
- **Do not** redesign R0.1 `ActivityCreationCommand`. It remains the Activity identity authority.
- R0.1 already never uses `legacyProjectId` as `event_id` (`ActivityCreationCommand.ts:81-82`). That stays.

The Project schedule create path that writes URL `project_id` plus optional body `event_id` (R04-P0-001) is a **defect to retire later**, not a second identity engine.

---

## 13. Project → Event rule (critical)

**There will be no generic `project_id → event_id` mapping.**

Never implement:

```
Project X
    ↓
Event Y
```

automatically unless a **future integration** proves a **deterministic, documented, 1:1** mapping and that rule is explicitly approved.

If:

```
Project X → Event Y
Project X → Event Z
```

the system must **not** choose one. Human resolution is required.

`resolveEventIdFromProject` (first Workpack/Activity with both keys) is **forbidden as architecture**. It is the exact silent many-to-one pick this freeze rejects. Removal is a later implementation item; this decision makes it illegitimate.

On live `syority` the rule is almost unused as data (`project_id` = 0 on Workpack; Project table empty). It remains dangerous in code.

---

## 14. The 177 Event-less Workpacks

**Classification: UNRESOLVED STO OPERATIONAL CONTEXT.**

They must **not** be automatically assigned to an Event based on:

| Forbidden basis | Why |
|---|---|
| Project / `project_id` | 0 Workpacks have it; no Project rows |
| Project name / code | No Project rows to match |
| Plant name | Plant is not a campaign; many Events can share a site |
| Date proximity | Overlapping TAs; guesswork |
| First Event found | Insertion / list order is not identity |
| First matching Workpack | Another package’s Event is not this package’s Event |
| UUID similarity | Accidental collision, not business meaning |
| Database insertion order | Not a business rule |

No automatic assignment is approved by R0.4-B.

A later phase may propose a **named, versioned, deterministic** rule (for example: `Workpack.scope_item_id` → `ScopeItem.scope_id` → `ShutdownScope.event_id` when the chain is complete and organisation matches). That rule is **not approved here**. Even then it should produce a **CANDIDATE**, not a silent write, until an explicit automation approval exists.

---

## 15. Human classification model (define only — do not implement)

Every Event-less Workpack must eventually follow one of these paths.

### Path A — assignable

```
UNREVIEWED
    ↓
CANDIDATE EVENT          ← optional hint, never a write
    ↓
HUMAN CONFIRMED
    ↓
EVENT ASSIGNED           ← auditable write
```

### Path B — not unique

```
UNREVIEWED
    ↓
AMBIGUOUS                ← 0 or >1 plausible Events
    ↓
HUMAN REVIEW             ← choose Event, or quarantine
```

### Path C — not an STO campaign package

```
INVALID / OBSOLETE
    ↓
QUARANTINED              ← no Event invented
```

**State meanings:**

| State | Meaning | Write `event_id`? |
|---|---|---|
| UNREVIEWED | In the 177; no classification yet | No |
| CANDIDATE EVENT | A hint exists; human has not confirmed | No |
| AMBIGUOUS | Hint conflicts or multiple Events plausible | No |
| HUMAN CONFIRMED | Reviewer selected exactly one Event | Not yet (pending apply) |
| EVENT ASSIGNED | `Workpack.event_id` written with audit | Yes |
| QUARANTINED | Not to be placed on a live Event | No |

This is a **process model**, not a schema. No new status column is authorized by R0.4-B.

Recommended review unit: **one Workpack at a time**, same organisation, presenting only Events the reviewer is authorized to see.

---

## 16. Event assignment evidence (reviewer packet)

Show the reviewer **only information that exists**. Do not invent plant names, client terms, or source files that are null.

### 16.1 Present on `Workpack` (or required parent)

| Evidence | Field | Use |
|---|---|---|
| Workpack number | `workpack_number`, `workpack_id_code` | Identity |
| Title | `title` | Identity |
| Scope of work | `scope_of_work` | Description |
| Status / type | `status`, `work_type`, `job_type`, `priority` | Context |
| SAP refs | `sap_work_order`, `sap_notification`, `sap_plant_maintenance_order` | Provenance |
| Planned dates | `planned_start_date`, `planned_end_date` | Compare to Event dates (**hint only**) |
| Created / updated | `created_at`, `updated_at`, `created_by` | Provenance |
| Organisation / site | `organization_id`, `site_id` | Restrict candidate Events to same org; site is a **filter**, not assignment |
| Plant / unit / system | `plant_id`, `unit_id`, `unit_code`, `system_id` | Filter Events that include those units/systems; **not** auto-assign |
| Equipment type (text) | `equipment_type`, `equipment_technical_data` | Context |
| Asset | `asset_id` | Join Asset if set |
| Discipline | `discipline_id` | Context |
| Contractor | `contractor_id` | Context |
| Scope item | `scope_item_id` | Strongest **candidate** hint if set (via ShutdownScope) |
| Template | `template_id` | Provenance |
| Instantiation Event | `WorkpackInstantiation.event_id` if row exists | Candidate hint only |

### 16.2 Present via existing joins (if FK is set)

| Evidence | Join | Use |
|---|---|---|
| Equipment tag / name | `Asset.tag_number`, `Asset.name` | Display |
| Plant / unit / system names | `Plant`, `Unit`, `System` | Display / filter |
| Scope item reason / asset | `ScopeItem` | Display |
| Scope Event | `ScopeItem` → `ShutdownScope.event_id` | Candidate Event id — **not** an approved auto-write |
| Child activities | `Activity` (`description`, `event_id`, dates, `p6_activity_id`) | If children already have Event, show it; do not copy silently to siblings |
| Documents | `WorkpackDocument.original_filename`, `source` | Source file name if present |

### 16.3 Not a Workpack field — do not invent

| Prompted item | Verdict |
|---|---|
| Area | **Not on Workpack.** `DigitalPlantProject.area_id` is a different object. Show only if a governed join exists later. |
| Client terminology | **Not on Workpack.** `Project.client` exists on STO Project, which has 0 rows. |
| Project name / code | **No live Project rows** and Workpack `project_id` is null. |
| “Source provenance” beyond existing columns | Use `WorkpackDocument.source`, Asset `data_source`, Activity `schedule_source` **only if the column exists on that row**. Live Activity `schedule_source` / `project_id` may be missing on `syority`. |

### 16.4 Candidate Event list

Present Events in the **same organisation**, preferably same `site_id` as the Workpack, with `code`, `name`, dates, status. The reviewer picks. The system does not pick.

If `scope_item_id` or `WorkpackInstantiation.event_id` yields exactly one Event in that organisation, label it **CANDIDATE** and still require HUMAN CONFIRMED.

---

## 17. No silent repair

Identity repair must be auditable.

Every future Workpack Event assignment (human or later-approved automation) must record:

| Field | Required |
|---|---|
| Workpack id | Yes |
| Previous Event | Yes (null if none) |
| New Event | Yes |
| Reason | Yes |
| Evidence (what the reviewer saw / rule used) | Yes |
| Assigned By | Yes |
| Approved By | Yes (may equal Assigned By if policy allows) |
| Timestamp | Yes |
| Source | Yes (`HUMAN` / `RULE` / import name) |

If automated later, also retain:

| Field | Required |
|---|---|
| Rule ID | Yes |
| Rule Version | Yes |
| Confidence | Yes |
| Evidence | Yes |

R0.4-B does not create this audit table. It forbids writes that skip it.

---

## 18. Tenant and Event security

```
Authenticated Organisation
        ↓
Event ownership (Event.organization_id = session org)
        ↓
Workpack ownership (Workpack.organization_id + Workpack.event_id)
        ↓
Activity ownership (Activity.organization_id + inherited event_id)
        ↓
Permission
```

Frozen rules:

- UUID is an identifier, not authorization.
- Do not use `project_id` as a security boundary.
- Do not use `event_id` without proving organisation ownership (and, for writes, Event membership of that organisation).
- Cross-tenant generic “not found” remains the R0.3 pattern — do not disclose that an id exists in another tenant.

R0.4 defects R04-P0-002 (Workpack create stores client Event/Project ids without org proof) and R04-P2-003 (S-curve Project load without org) are **recorded**, not fixed here.

---

## 19. Module freezes (engines unchanged)

### 19.1 M11 — Schedule / CPM

M11 calculation is **Event-scoped**.

Future triggers must use:

```json
{ "organizationId": "<org>", "eventId": "<event>" }
```

not `projectId` as the operational key.

- Do not redesign CPM.
- Do not create another scheduler.
- Connect the existing `calculateEventSchedule` authority to Event consistently.
- `enqueueRecalculate` skipping unless `workpack.project_id` is set (R04-P1-001) is illegitimate under this freeze.

### 19.2 M10 — Readiness

M10 is **Event-scoped**.

Where a baseline belongs to Event, **`ScheduleBaseline.event_id` is authoritative**.

Do not use `project_id` as an alias for Event (`PlanningReadinessService` `project_id IN eventIds` is a defect — R04-P1-003).

Live: 9 baselines Event-keyed, 1 Project-keyed, 0 Project rows. The leftover `project_id` is an **orphan key**, not an Event.

### 19.3 M12 — Execution

M12 remains the **sole execution write authority**.

```
Event → Activity → ExecutionWriteService
```

Project must not become an execution context. M12 already has no `project_id` writer (R0.4 §19). Keep it that way.

`remove_activity` / invented CANCEL remains forbidden (R0.3).

### 19.4 M8.13 — Progress

M8.13 remains the **sole progress calculation and aggregation authority**.

Project is not a progress dimension. Progress is queried with Event context (`organizationId` + `eventId`).

Do not change M8.13 math.

### 19.5 M13 — Control Tower

Control Tower is **Event-scoped**. Every metric belongs to the selected Event.

No Project-based KPI authority. Passing Event id into `/api/projects/:id/s-curve` is a container bug (R04-P1-004), not a dual-authority design.

### 19.6 M14 — Reporting

Reports use **Event** as the STO campaign dimension.

A Project report may remain **temporarily** for compatibility. It must not become a competing source of management truth.

### 19.7 M15 — Management Intelligence

Management Intelligence uses **Event** context. No Project-based management authority.

M15 remains intelligence-only. This freeze does not expand M15 into execution.

### 19.8 M16 — AI / WhatsApp / Voice / Mobile

AI resolves **Event** context, not STO Project context.

Example:

> “Show me TA-2027 progress.”

must resolve to `Event.code = TA-2027` (via `EventContextResolver`), not `Project.code = TA-2027`.

Navigation generated by M16 must **eventually** use `/events/{eventId}/...`, not `/projects/{eventId}/...`.

Do not implement the URL change in R0.4-B.

---

## 20. P6 / MS Project rule

External terminology may say “Project”. The imported STO campaign becomes **Event**.

Do not create an STO `Project` to host the import.

Workpack-level export (`/api/workpacks/[id]/export/ms-project`) remains file interchange (P5), not a reason to keep STO Project as campaign authority.

---

## 21. Digital Plant rule

`DigitalPlantProject` stays a separate business object: extraction / workspace, not the STO campaign.

Do not migrate it. Do not hide Digital Plant from the product because of the word “Project”. In UX, keep the label in the **Digital Plant** domain, not as a peer of Events / TAs.

---

## 22. Normal-user UX rule

Intended experience:

1. User selects **TA-2027** (Event code / name).
2. System sets **Current Event = that Event**.
3. Scope, workpacks, schedule, execution, progress, tower, reports, AI all reuse that Event.

The user must not repeatedly select Project, Event, Project UUID, Event UUID, `project_id`, or `event_id`.

Business users select **Turnaround / Event name or code**. The system manages UUIDs internally.

Planner cookie / workspace `selectedEventId` is the existing direction (R0.4 §9). Dual Projects menu contradicts it.

---

## 23. Navigation rule (target only)

**STO campaign entry:** Events / TAs.

Do **not** expose Projects as a peer STO campaign entry.

Future classification of Project-related routes (not implemented here):

| Class | Meaning |
|---|---|
| EVENT ROUTE | Canonical `/events/{eventId}/...` |
| LEGACY / COMPATIBILITY | Temporary `/projects/...` that must not write new authority |
| ACTIVE INTEGRATION | P6/MPP adapters, retargeted to Event |
| DEPRECATED | Documented sunset |
| REMOVED | After consumers and data are clear |

Digital Plant `/digital-plant/[projectId]` is **not** this list. It is a different object’s workspace.

Contractor redirect to `/projects/:id/reports` (R0.4 §44) is a later compatibility item, not a reason to keep Project as authority.

---

## 24. Database authority rule

**Future target:** `Workpack.event_id` is **REQUIRED** for STO Workpacks.

Eventually `project_id` must not participate in STO operational identity.

**Do not remove the column in this phase.**

Controlled sequence:

1. Classify usage (R0.4 done; live counts done).
2. Resolve live data (177 Workpacks — human classification; later phase).
3. Migrate consumers (enqueue, APIs, UI, M16 URLs).
4. Verify (behavioral tests).
5. Quarantine Project writes / create.
6. Remove columns and the STO `Project` table **only when safe**.

Live Activity `project_id` is already absent on `syority` while Prisma still declares it. That drift is **not** a licence to treat Prisma `project_id` as live authority.

---

## 25. Retirement is not deletion

**Decision:** retire STO Project as an **operational business concept**.

This does **not** mean: delete every table, field, route, variable, or word containing “Project” immediately.

| Keep | Retire as STO authority | Delete only later |
|---|---|---|
| DigitalPlantProject | STO `Project` model as campaign | STO `Project` table (0 rows here) after consumers gone |
| P6 / MS Project parsers | `/projects` as peer TA entry | Broken schema-incompatible Project APIs after quarantine |
| `work_type = Project` | `project_id` as security / Event inference | `Workpack.project_id` after unused |
| Quarantined import provenance | `resolveEventIdFromProject` | — |

---

## 26. Decision log

| ID | Decision | Binding |
|---|---|---|
| **DEC-001** | Event is the sole STO operational campaign container. | Frozen |
| **DEC-002** | STO `Project` is deprecated as a business authority. | Frozen |
| **DEC-003** | No `project_id → event_id` automatic mapping. | Frozen |
| **DEC-004** | Every new STO Workpack must have Event context (`event_id` or derived from authoritative Event parent). | Frozen (implement later) |
| **DEC-005** | The 177 Event-less Workpacks require controlled classification. No auto-assign. | Frozen |
| **DEC-006** | Activity Event identity derives from authoritative Workpack / R0.1 context. Do not redesign the command. | Frozen |
| **DEC-007** | M11 is Event-scoped. Triggers use `{ organizationId, eventId }`. CPM unchanged. | Frozen |
| **DEC-008** | M10 is Event-scoped. `ScheduleBaseline.event_id` is authoritative. `project_id` is not an Event alias. | Frozen |
| **DEC-009** | M12 remains the sole execution write authority. Project is not an execution context. | Frozen |
| **DEC-010** | M8.13 remains the sole progress calculation and aggregation authority. Project is not a progress dimension. | Frozen |
| **DEC-011** | M13 / M14 / M15 / M16 operate on Event context. M16 navigation target is `/events/{eventId}/...`. | Frozen |
| **DEC-012** | DigitalPlantProject remains a separate business object. Do not migrate. | Frozen |
| **DEC-013** | P6 / MS Project remains integration / file terminology. Import lands on Event. | Frozen |
| **DEC-014** | UUIDs are system identities, not normal business inputs. Users select Event code / name. | Frozen |
| **DEC-015** | Project retirement is staged, not immediate deletion. | Frozen |

---

## 27. Required impact matrix

| Area | Impact | Risk | Future Action |
|---|---|---|---|
| Schema | Target: Workpack.event_id required; Project not operational identity | High if NOT NULL applied before 177 resolved | Classify → attach → then constrain. Do not drop `project_id` yet. |
| Workpack Factory | Already Event-oriented on instantiate; create form Event optional | Medium — more Event-less packs if unchanged | Require Event on STO create; prove org ownership (R04-P0-002). |
| Activity creation | R0.1 already Event-correct; Project schedule API dual-writes | Medium | Keep command; retire Project schedule create as authority. |
| M11 | Engine already Event; enqueue/UI still Project | High — Event-native CPM skipped on this DB (`project_id` = 0) | Enqueue `{eventId}`; remove first-hit resolve. |
| M10 | Baseline query aliases Event ids as `project_id` | Medium — misses 9 Event baselines | Query `event_id`; treat 1 leftover `project_id` as orphan. |
| M12 | Already Event/org; no Project writer | Low | No engine change. Keep Project out. |
| M13 | Event dashboard; S-curve hits Project API | Medium — empty/wrong curve | Event S-curve; stop passing Event id as Project id. |
| M14 | Event dimension exists; leftover Project reports | Medium — dual numbers | Event as management truth; Project reports compatibility only. |
| M15 | Already Event | Low | No Project management authority. |
| M16 | Resolves Event; emits Project URLs | Medium — user lands in wrong shell | Repoint `NavigationRegistry` to `/events/...`. |
| Navigation | Peer Events + Projects menus | Medium — re-entry / dual TA | Events / TAs only as campaign entry. |
| P6 / MPP | Imports bound to `/api/projects/[id]/...` | Medium — invites new Project rows | Adapter → Event. Do not create STO Project for the file. |
| Digital Plant | Name collision only | Low if left separate | Do not migrate. Keep in Digital Plant UX. |
| Existing 177 Workpacks | Unresolved Event | **High** if auto-assigned | Human classification (§15–17). No Project map (nothing to map). |
| STO `Project` table | 0 rows | Low data; high if APIs keep creating | Quarantine create; do not delete table until consumers gone. |
| 1 Project-keyed baseline | Orphan `project_id` | Low/medium — M10 miss/false hit | Human / later design; no auto Event map. |

---

## 28. Acceptance criteria

| Criterion | Met? |
|---|---|
| **Business** | |
| What Event means | Yes — §5 |
| What STO Project means | Yes — §6.1 |
| Why they cannot both own the same TA | Yes — §4 |
| Why DigitalPlantProject remains | Yes — §6.2, DEC-012 |
| Why P6 / MS Project remains as integration terminology | Yes — §6.3, §20, DEC-013 |
| **Architecture** | |
| Event is the single STO operational context | Yes — DEC-001 |
| Project cannot be an operational authority | Yes — DEC-002, §8–9 |
| Event propagation is defined | Yes — §10 |
| No Project→Event inference | Yes — DEC-003, §13 |
| **Data** | |
| 177 Event-less Workpacks explicitly unresolved | Yes — §14, DEC-005 |
| No automatic assignment approved | Yes — §14 |
| Future classification method defined | Yes — §15 (not implemented) |
| **Security** | |
| Tenant remains security boundary | Yes — §18 |
| Event ownership is validated | Yes — §18 |
| UUID is not authorization | Yes — DEC-014, §18 |
| **Modules** | |
| M8.13, M10, M11, M12, M13, M14, M15, M16 retain existing authorities | Yes — §19 |
| **UX** | |
| User selects Event as business context | Yes — §22 |
| UUIDs remain internal | Yes — DEC-014 |
| Project should not be a peer STO campaign selector | Yes — §23 |

All acceptance criteria are satisfied **as a decision**. Implementation is not authorized.

---

## 29. What R0.4-B does not authorize

- Requiring `Workpack.event_id` in schema or UI.
- Backfilling the 177.
- Deleting or renaming `Project`.
- Changing M16 URLs, nav, or Control Tower S-curve.
- Removing `resolveEventIdFromProject`.
- Changing M11/M10/M12/M8.13 engines.
- Creating the classification state machine or audit table.
- Starting R0.5, Discipline/SAT creation, or a second identity engine.

Next authorised conversation, if requested: **R0.4-C** — classify the 177 (process / review design), still without silent assignment unless a later prompt explicitly implements a human-confirmed write path.

---

## 30. Final decision

R0.4-B DECISION

APPROVED ARCHITECTURE:

Event is the sole authoritative operational container
for an AURIANOA Turnaround / Shutdown.

STO Project is deprecated as an operational campaign
container.

No project_id → event_id automatic mapping is permitted.

The 177 Event-less Workpacks require controlled human
classification before Event assignment.

DigitalPlantProject remains a separate business object.

P6 / MS Project remains an external integration/file
concept.

No implementation is authorized by R0.4-B itself.

---

**R0.4-B STATUS: GREEN — DECISION FROZEN**
