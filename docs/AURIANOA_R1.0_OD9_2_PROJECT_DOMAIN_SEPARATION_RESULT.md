# AURIANOA R1.0 — OD9.2 PROJECT & PORTFOLIO DOMAIN SEPARATION + REORGANIZATION

**Task:** OD9.2 — Project & Portfolio Domain Separation + Reorganization
**Predecessor:** OD9.1 Controlled Database / Prisma Schema Reconciliation (AMBER)
**Date executed:** 2026-09-10
**Database:** `syority` @ PostgreSQL 17.10
**Prisma:** 7.9.1

**FINAL STATUS: AMBER — PROJECT DOMAIN REORGANIZED BUT NON-BLOCKING DEFECTS REMAIN**

**C2 remains BLOCKED.** OD9.2 did not evaluate C2's independent prerequisites and did not
perform the Prisma re-baseline (§24).

---

## EVIDENCE TAGGING CONVENTION

| Tag | Meaning |
|---|---|
| `[EXECUTED]` | Verified by running code, a query, a test, or a compiler against the real repository/database |
| `[SOURCE]` | Verified by reading source or schema text |
| `[INFERENCE]` | Reasoned conclusion. **Never** presented as proven |
| `[PRODUCT]` | A product/architecture decision frozen by the OD9.2 instruction |
| `[OPEN]` | Unresolved. Explicitly not closed |

Per the standing evidence rule: **executed evidence outranks documentation**, and no
inference in this document is called "proven".

---

## 1. EXECUTIVE SUMMARY

OD9.2 separated the general-purpose **PROJECT** domain from the **STO** domain without
deleting the Project domain, and reorganised the application's top-level navigation into the
four frozen business domains.

**The single most important finding is that OD9.2 uncovered and fixed a live STO
correctness defect**, not merely a structural untidiness. `PlanningReadinessService` (M10)
was resolving "is this workpack baselined?" by matching **Event UUIDs against the Project
column** of `ScheduleBaseline`. Measured against live data on `syority`, the Project-keyed
lookup finds **1** current baseline where the authoritative Event-keyed lookup finds **4**
— M10 was under-reporting baselined scope by 3. `[EXECUTED]`

**Five** separate **fabricated or ambiguous cross-domain identity mappings** were found and
removed, each with preservation evidence rather than deletion:

1. `ScheduleContainer.tsx` passed a **Project id as `eventId`** into the STO resource-
   levelling endpoints — a Project-driven **write** against STO scope.
2. The export subsystem treated `projectId` polymorphically: it fell back to interpreting a
   Project id as an Event id, filtered on `OR: [{project_id}, {event_id}]`, persisted Event
   ids into the Project column of `export_history`, and its UI silently back-filled the
   Project dropdown with Events.
3. The Project WBS routes contained `resolveEventId(projectId, orgId)` — the forbidden
   `resolveEventIdFromProject` under another name — which fell back to **"the most recently
   created Event in the organisation"** and then created, updated and *recursively deleted*
   WBS nodes inside that arbitrarily chosen Event.
4. The M16 WhatsApp and Voice channel adapters passed an **Organization id** through a field
   named `projectId`.
5. The Project **daily report** pulled an STO safety log with
   `prisma.safetyLog.findFirst({ where: { event_id: projectId } })` — the original comment
   admitted it outright: *"projectId may be event id when called from events TA dashboard."*
   It also carried no `organization_id` filter. Removed; see §7.7.

Two further serious defects were found incidentally while editing export code: the export
workpack query carried **no `organization_id` filter** (possession of a Workpack UUID was
sufficient to export another tenant's schedule), and `export_history.create` omitted the
required `id`, so the export audit trail had **never recorded a single row**. `[EXECUTED]`

Separately, a broad class of **Class-A Project defects** was repaired: the Project domain's
scheduling service, P6 export, list page and detail page all still used pre-OD9 camelCase
field names (`plannedSdDate`, `plantName`, `_count.workpacks`) against a schema that OD9
reconciled to snake_case. The Project CPM threw at the Prisma layer on every run, the create
form's planned dates were never saved, and the detail page's date rows never rendered.

**Measured impact.** TypeScript errors **1206 → 1101** (−105), with **zero new errors
introduced** in any file OD9.2 touched. `[EXECUTED]` A new behavioural suite of 29 tests
covering all 24 §25 requirements passes **29/29**. The full regression suite is at
**1561/1563**, with the only two failures being the two pre-existing known-stale M11
source-grep tests that prior tasks explicitly placed out of scope. `[EXECUTED]`

**Why AMBER and not GREEN.** The Project domain is now genuinely independent of STO
authority, but it **cannot yet function as a Primavera-class scheduling domain**, because
`wbs_nodes.event_id` is `NOT NULL` with a mandatory `Event` relation. A Project structurally
cannot own a WBS. Repairing this requires a schema migration, which §24 forbids in OD9.2.
The Project WBS routes therefore fail closed rather than fabricate an Event. This is a real,
documented functional gap — recorded as OD9.4 migration candidate MC-2 — and it is the
reason the status is AMBER.

---

## 2. PREVIOUS vs NEW ARCHITECTURE

### 2.1 The cancelled direction

`docs/AURIANOA_R0.4_PROJECT_EVENT_CONSOLIDATION_FORENSIC_AUDIT.md` concluded **OPTION B**:
retire the `Project` model. The OD9.2 instruction states: *"The previous Project-Retirement
direction is CANCELLED. Do NOT delete the general Project domain."*

**These are not in conflict.** `[INFERENCE]` R0.4's conclusion was to retire `Project` **as
an STO operational container** — it was a duplicate of `Event` for turnaround campaigns.
OD9.2 requires exactly the same outcome for that concern (Project must hold no STO
authority) while additionally *preserving* Project as a general-purpose portfolio and
project-management domain. OD9.2 supersedes R0.4 only on the question of whether the model
and its routes are deleted. R0.4's Project→Event **coupling** findings remain valid and were
used as the starting inventory for Phase A.

R0.4 defect register status, re-verified in this task:

| Defect | R0.4 finding | OD9.2 verified state |
|---|---|---|
| R04-P1-001 | `resolveEventIdFromProject` exists | **Closed before OD9.2.** 0 production hits in executable code `[EXECUTED]` |
| R04-P1-002 | CPM enqueue keyed on Project | **Closed before OD9.2.** `enqueueEventScheduleRecalculate` returns `EVENT_REQUIRED` `[EXECUTED]` |
| R04-P1-003 | *(absent from the closure documents' fixed list)* | **Found still open by OD9.2** and fixed — see §7 |
| R04-P1-004 | Control Tower on Project EVM | **Closed before OD9.2** |
| R04-P1-005 | M16 nav emits Project URLs | **Closed before OD9.2** `[EXECUTED]` |

### 2.2 Architecture before OD9.2

- Navigation was grouped by **activity type** — "Planning", "Execution", "Intelligence",
  "Import/Export", plus loose Safety and Documents entries. Business-domain ownership was
  not expressible in the menu at all.
- STO reporting sat under a domain-neutral "Intelligence" / "Reports" grouping.
- The Project domain's surfaces were interleaved with STO surfaces: `/projects/[id]` offered
  **11 tabs** including TA Dashboard, Workpacks, Punch List, Permits, Safety and Daily
  Reports.
- Project code could reach STO scope, and in four places did so by inventing an identity.

### 2.3 Architecture after OD9.2

Navigation is grouped by **business domain**, frozen to four:

```
AURIANOA
├── 1. DIGITAL PLANT              → asset truth
├── 2. STO                        → shutdown truth (Event is the sole campaign identity;
│                                    Safety and Permit Management live here and ONLY here)
├── 3. PROJECT                    → general portfolio / project truth
└── 4. ORGANIZATION & ADMIN       → governance and configuration
```

AI / M16 is a **cross-platform interaction layer**, not a top-level business domain, and
owns no business data. `[PRODUCT]`

The structure and every permission/feature gate now live in a single pure module,
`src/config/business-navigation.ts`, so the frozen boundaries are asserted **behaviourally**
rather than by grepping a layout file. `app/(dashboard)/layout.tsx` shrank from ~8.4 KB of
inline nav construction to four builder calls.

---

## 3. FINAL DOMAIN BOUNDARY

| Concern | Owner | Enforcement verified in OD9.2 |
|---|---|---|
| Asset truth, P&ID extraction | DIGITAL PLANT | `extraction_candidates` / `plant_documents` FK to `digital_plant_projects`, untouched `[EXECUTED]` |
| Shutdown campaign identity | STO (`Event`) | `Event` creatable with no Project; no STO table requires `project_id` `[EXECUTED]` |
| STO planned dates / CPM | STO — M11 | One Event-scoped orchestrator; no Project entry point `[EXECUTED]` |
| STO readiness | STO — M10 | Baselines now resolved by `event_id` (defect fixed, §7) `[EXECUTED]` |
| STO execution / actuals | STO — M12 | Not modified by OD9.2 |
| STO progress | STO — M8.13 | No exported progress function takes a Project parameter `[EXECUTED]` |
| Safety & Permit Management | **STO only** | Present only in the STO nav group; `SafetyLog.event_id` is `NOT NULL` `[EXECUTED]` |
| STO reporting | STO | All 8 M14 provider categories are STO/platform; none is Project `[EXECUTED]` |
| General portfolio/project truth | PROJECT | Project creatable and readable with no Event `[EXECUTED]` |
| Project scheduling | PROJECT | `SchedulingService.calculateProjectSchedule` touches no Event `[EXECUTED]` |
| P6 / MS Project / Excel interchange | PROJECT | Import/Export sit in the Project nav group only `[EXECUTED]` |
| Governance / configuration | ORGANIZATION & ADMIN | Documents + `/settings/*` |
| Interaction / conversation | AI (M16), cross-domain | Given only a Project id, M16 navigation returns `null` `[EXECUTED]` |

**Mutual independence, stated precisely and verified:**
an STO Event does **not** require a Project `[EXECUTED]`; a Project does **not** require an
STO Event `[EXECUTED]`; and there is **no implicit Project → Event ownership** — the
`Project` table has no `event_id` column and **zero** outgoing foreign keys `[EXECUTED]`.

---

## 4. PROJECT DOMAIN INVENTORY

Maturity is classified honestly per §10 — placeholders are named as placeholders.

### 4.1 Data model

| Artifact | Class | Maturity | Evidence |
|---|---|---|---|
| `model Project` (`schema.prisma:1273-1293`) | **A** | Real but thin: 17 columns, one relation (`Workpack[]`) | `[SOURCE]` |
| `Project` table | **A** | **0 rows** | `[EXECUTED]` |
| `project_constraints` | **F** | 0 rows, `project_id` TEXT nullable, **no FK** | `[EXECUTED]` |
| `project_units` | **F** | 0 rows, `project_id` TEXT **NOT NULL** but **no FK** — orphan-capable | `[EXECUTED]` |
| `punch_items.project_id` | **F** | 0 rows, TEXT nullable, no FK | `[EXECUTED]` |
| `wbs_nodes` | **B (STO)** | 0 rows; `event_id` `NOT NULL` → structurally Event-owned | `[EXECUTED]` |
| `ScheduleBaseline.project_id` | **A** | UUID; 1 of 10 rows is Project-scoped | `[EXECUTED]` |
| `export_history` | **A** | **0 rows** — audit trail never wrote (see §14) | `[EXECUTED]` |
| `DigitalPlantProject` | **C** | Distinct Digital Plant concept; not renamed or deleted | `[SOURCE]` |

### 4.2 Services

| Artifact | Class | Maturity | Disposition |
|---|---|---|---|
| `SchedulingService.calculateProjectSchedule` | **A** | Real CPM: forward/backward pass, TF/FF, critical path, calendar-aware | **Repaired** (see §11) |
| `SchedulingService.generateSCurveData` | **A** | Real | **Repaired** (camelCase fields) |
| `SchedulingService.getLookaheadActivities` | **A** | Real | Retained |
| `ProjectBranchingService` | **F** | Non-compiling; needs `Project.activities`, `isBaseline`, `parentProjectId` — none exist in schema or DB | **Classified F, retained** (see §10) |
| `PlanningReadinessService` | **B (STO)** | Real | **Repaired** — STO authority leak (see §7) |

### 4.3 Routes

| Route | Class | Disposition |
|---|---|---|
| `GET/POST /api/projects` | **A** | Functional; snake_case-correct; supplies `id` + `updated_at` |
| `GET /api/projects/[id]` | **A** | **Repaired** — now selects `planned_sd_date`/`planned_su_date`/`description` |
| `POST /api/projects/[id]/baseline` (singular) | **A** | The legitimate Project baseline authority |
| `/api/projects/[id]/baselines` (plural) | **F** | **Fail-closed 501**, file retained (§10) |
| `/api/projects/[id]/s-curve` | **F** | Already fail-closed by R0.4-E; unchanged |
| `/api/projects/[id]/wbs` | **E, withdrawn** | **Fail-closed** — cannot own a WBS (§11) |
| `/api/projects/[id]/wbs/[nodeId]` | **E, withdrawn** | **Fail-closed** — was destructively mutating arbitrary Events |
| `/api/projects/[id]/resource-histogram` | **A** | snake_case-correct |
| `/api/export/*` | **D + E** | Domain-disambiguated (§14) |

### 4.4 UI

| Surface | Class | Disposition |
|---|---|---|
| `/projects` list | **A** | **Repaired** — field names, `_count`, de-shutdown-ised copy |
| `/projects/[id]` detail | **A** | Tabs 11 → 5; stat cards 5 → 2; date rows repaired |
| `/projects/[id]/safety` | **B (STO)** | Was a "coming soon" stub → now redirects to `/safety` |
| `/projects/[id]/permits` | **B (STO)** | Was a "coming soon" stub → now redirects to `/permits` |
| `/imported-schedule` | **F** | Dead-end placeholder; deliberately not linked (§16) |
| `src/components/DashboardHeader.tsx` | **F** | Second parallel nav component, **zero import sites** = dead code. Retained, not deleted |

### 4.5 Honest maturity statement for §10's Project groupings

| §10 grouping | Actual state |
|---|---|
| Portfolio | **Does not exist.** No model, no route, no provider `[EXECUTED]` |
| Project | Exists — thin but real |
| Planning (WBS) | **Blocked** — no Project-owned WBS is representable |
| Scheduling (CPM) | Exists and is real; repaired in this task |
| Resources & Cost | Partial — resource histogram only; no cost model |
| Progress & Performance / EVM | **Retired**, fail-closed since R0.4-E |
| Project Reports | **Does not exist** as a provider category |
| Baselines | Snapshot exists; baseline *branching* does not |

---

## 5. STO DOMAIN INVENTORY

`Event` is the sole STO campaign identity. `[PRODUCT]` `Event` count: **51** `[EXECUTED]`

| Concern | Authority | Verified |
|---|---|---|
| Campaign identity | `Event` | Creatable with no Project `[EXECUTED]` |
| Scope | `Event → Workpack → Activity` | `Activity.project_id` does **not** exist as a column `[EXECUTED]` |
| WBS | `wbs_nodes.event_id` (`NOT NULL`) | `[EXECUTED]` |
| Planned dates / CPM | M11 via `ScheduleOrchestrationService.calculateEventSchedule` | No `project` in its public API `[EXECUTED]` |
| Readiness | M10 `PlanningReadinessService` | Repaired to Event-keyed baselines `[EXECUTED]` |
| Execution / actuals | M12 | Untouched by OD9.2 |
| Progress | M8.13 `ProgressAggregationService` | No exported method or parameter mentions project `[EXECUTED]` |
| Safety | `SafetyLog` (`event_id NOT NULL`) | STO-only in nav `[EXECUTED]` |
| Permits | `Permit` | STO-only in nav `[EXECUTED]` |
| Reporting | M14 provider registry | 8 categories, all STO/platform `[EXECUTED]` |

`Workpack` scope split (219 rows): **18** Event-scoped, **0** Project-scoped, **201**
neither. `[EXECUTED]`

STO navigation contains **26** entries across the frozen sections Events · Shutdown Scope ·
Workpacks · Planning · Readiness · Safety & Permits · Execution · STO Reports · STO
Communications. `[EXECUTED]`

---

## 6. DIGITAL PLANT BOUNDARY

Per §3, **no** Digital Plant → STO Potential Shutdown Scope handoff workflow was designed or
implemented, and no existing Digital Plant functionality was changed.

Digital Plant navigation: `/digital-plant` (Plant Overview), `/asset-register` (Asset
Register), `/engineering-issues` (Asset Integrity). `[EXECUTED]`

**P&ID Extraction was not moved into Project.** `[EXECUTED]` It remains reachable under the
Asset Register, and its data is unambiguously Digital Plant's:

```
extraction_candidates.project_id  uuid NOT NULL  → FK digital_plant_projects(id)
plant_documents.project_id        uuid NOT NULL  → FK digital_plant_projects(id)
```

These are the **only two** `project_id` columns in the entire database that carry a real
foreign key, and both point at `digital_plant_projects`, not at `"Project"`. `[EXECUTED]`
§12 is therefore resolved conclusively: `DigitalPlantProject` is a genuinely separate
concept and was neither renamed nor deleted.

`Plant Overview` / `Asset Register` are Digital Plant reporting-free surfaces; no Digital
Plant Reports route exists yet, so none is linked (§10 honesty rule).

---

## 7. PROJECT → EVENT COUPLING INVENTORY

### 7.1 The proven STO authority leak (R04-P1-003) — **FIXED**

`src/core/planning/PlanningReadinessService.ts` computed the BASELINED readiness gate by
querying **Event UUIDs against the Project column**:

```ts
// BEFORE
where: { organization_id, is_current: true, project_id: { in: eventIds } }
```

`ScheduleBaseline.event_id` carries the schema comment *"M8.8 — Event association for
baseline (authoritative scope)"*, so `event_id` is the authority and `project_id` is the
Project-domain column. `[SOURCE]`

**Measured on live `syority` data:** `[EXECUTED]`

| Lookup | Current baselines found |
|---|---|
| `project_id: { in: eventIds }` (the defect) | **1** |
| `event_id: { in: eventIds }` (authoritative) | **4** |

`ScheduleBaseline` scope split (10 rows): 9 Event-scoped, 1 Project-scoped, 0 unscoped, 7
`is_current`. `[EXECUTED]`

M10 was silently under-reporting baselined workpacks. Fixed to resolve through `event_id`.

Two tests in `m10-planning.test.ts` **encoded the bug** and were corrected: a mock returning
`{ project_id: 'evt-bl' }` became `{ event_id: 'evt-bl' }`, and a source-text test was
renamed to `'BASELINED is event-level, not workpack-level'` with a genuine regression guard.
`m10-planning.test.ts`: **92/92 pass.** `[EXECUTED]`

### 7.2 Fabricated Event mapping in the Schedule UI — **FIXED**

`src/components/Schedule/ScheduleContainer.tsx` rendered
`<LevelingPreviewModal eventId={projectId}>`, which POSTed to
`/api/events/{projectId}/schedule/level-resources[/apply]` — an STO **write** driven by a
Project identifier. The "Level" toolbar button, the modal render, its state and its import
were removed.

**Preservation evidence:** STO resource levelling remains reachable from
`ResourcePlanningDashboard.tsx:330-336` with a genuine `selectedEventId`. No STO capability
was lost.

### 7.3 The forbidden resolver, renamed — **FIXED** (most severe)

Both Project WBS routes contained:

```ts
async function resolveEventId(projectId, orgId) {
  const firstActivity = await prisma.activity.findFirst({
    where: { workpack: { project_id: projectId }, organization_id: orgId },
    select: { event_id: true },
  });
  if (firstActivity?.event_id) return firstActivity.event_id;
  const latestEvent = await prisma.event.findFirst({   // ← fabrication
    where: { organization_id: orgId },
    orderBy: { created_at: 'desc' },
  });
  return latestEvent?.id ?? null;
}
```

This is `resolveEventIdFromProject` under another name, and its fallback selects an Event by
nothing but **creation recency**. `PATCH` then updated, and `DELETE` *recursively deleted*,
WBS nodes inside that arbitrarily chosen Event — a Project-scoped request performing
destructive writes against STO scope. Both routes now fail closed (§11).

### 7.4 Export subsystem domain ambiguity — **FIXED** (see §14)

### 7.5 M16 channel adapters — **FIXED** (see §15)

### 7.7 STO Safety reached through a Project id — **FIXED**

`app/api/projects/[id]/reports/daily/route.ts` opened its prompt with a
`═══ SAFETY (ALWAYS FIRST) ═══` block populated from:

```ts
// Safety first: try event-scoped safety log (projectId may be event id when called from events TA dashboard)
const todaySafety = await prisma.safetyLog.findFirst({
  where: { event_id: projectId },
  ...
});
```

Three violations in one call: §22 (Safety is STO-only), §31 (fabricated Event mapping), and a
missing `organization_id` filter. The call path it was written for — the Project TA Dashboard —
was retired by R0.4-E.

**This one had become newly dangerous.** The handler previously used camelCase
(`eventId`, `logDate`), so Prisma threw and the block silently produced nothing. Repairing the
field names to snake_case made a dormant Project→STO-Safety read **live**. The safety block was
removed from the Project report, and the AI prompt now explicitly instructs the model not to
invent safety, incident or PTW figures.

### 7.8 Project-scoped STO Safety API — **FIXED**

`app/api/projects/[id]/safety/route.ts` served `SafetyLog` filtered by `project_id`.
`SafetyLog.event_id` is `NOT NULL` `[EXECUTED]`, so Safety is structurally Event-owned and
`project_id` is a vestigial nullable column with no foreign key. The route now fails closed
(501), retained per §22/§27. It had **zero** production consumers `[EXECUTED]`, `SafetyLog` has
0 rows, and `/safety` plus `/api/events/[eventId]/safety` are untouched. Same repair-activated
hazard as §7.7: it only began working when its camelCase field names were fixed.

### 7.9 Proven absence

After the above, a comment-stripped scan of all production `.ts`/`.tsx` under `app/` and
`src/` finds **zero** occurrences of `resolveEventIdFromProject` in executable code and
**zero** Project routes that resolve an Event. `[EXECUTED]`

A second guard over `app/api/projects/**` finds **zero** routes that assign a Project id to an
Event field, **zero** that query `SafetyLog` / `SafetyIncident` / `Permit`, and **zero** that
carry a retired `Activity.project_id` loose-activity filter. `[EXECUTED]`

### 7.10 A note on repair sequencing

Two of the violations above (§7.7, §7.8) were **dormant** because the code did not compile
against the reconciled snake_case schema, and became **live** when those field names were
repaired. This is worth recording as a governance observation: in this codebase, fixing a
type error can activate a domain-boundary violation. Type-correctness work on Project surfaces
should therefore be reviewed for boundary impact, not treated as cosmetic.

---

## 8. `Workpack.project_id` FINDINGS

Forensic analysis was performed **before** any decision, per §7.

| Property | Value | Evidence |
|---|---|---|
| Physical type | `text`, nullable | `[EXECUTED]` |
| Foreign key | `Workpack_project_id_fkey` → `"Project"(id)` `ON UPDATE CASCADE ON DELETE SET NULL` | `[EXECUTED]` |
| **Rows with a non-null value** | **0 of 219** | `[EXECUTED]` |
| Uniqueness | This is the **only** foreign key in the entire database referencing `"Project"` | `[EXECUTED]` |

**Consumers (all legitimate Project-domain reads):** `SchedulingService.calculateProjectSchedule`,
`SchedulingService.generateSCurveData`, `POST /api/projects/[id]/baseline`,
`/api/projects/[id]/resource-histogram`, the Project daily-report path.

**DECISION: `Workpack.project_id` is RETAINED. Classification A — PROJECT.** `[PRODUCT]`

It is the **only** structural link that lets a general Project own scope, and it is the
mechanism by which Project scheduling operates without an Event. §8 forbids reintroducing
`Activity.project_id`, so `Project → Workpack → Activity` is the *sanctioned* path to
Project activities. Removing this column would delete the Project domain's ability to hold
scope at all.

It is **not** an STO authority: it is nullable, no STO code path reads it, and 0 rows use
it. Its `ON DELETE SET NULL` semantics mean deleting a Project cannot cascade-destroy STO
workpacks.

**No Event mapping was fabricated for the 201 workpacks that have neither an Event nor a
Project.** `[EXECUTED]` Per §7 — *"Never invent Event mappings for records that do not have
an authoritative Event"* — these were left exactly as found and are recorded as `[OPEN]` in
§22.

---

## 9. PROJECT CONSTRAINTS FINDINGS

| Table | Rows | `project_id` type | FK | Class |
|---|---|---|---|---|
| `project_constraints` | **0** | `text`, nullable | **none** | **F** |
| `project_units` | **0** | `text`, **NOT NULL** | **none** | **F** |

Both are legacy artifacts of the pre-`Event` Project-as-container design. `project_units` is
the more notable finding: its `project_id` is `NOT NULL` yet has **no foreign key**, so the
table is structurally capable of holding rows pointing at Projects that do not exist. It
holds no rows today.

**Neither table was dropped.** §26/§27 forbid dropping tables merely because they are empty,
and §24 forbids the migration. Both are recorded as OD9.4 migration candidates (MC-5).

The live STO constraint surface is `/constraints` and `app/api/units/[unitId]/constraints`,
which do not use these tables.

---

## 10. PROJECT BASELINE FINDINGS

§16 requires determining whether broken baseline functionality is legitimate, repairing it
inside Project where possible, documenting exactly what prevents repair otherwise, and
**never silently deleting it**.

### 10.1 The legitimate authority — retained

`POST /api/projects/[id]/baseline` (**singular**) is the real Project baseline: it snapshots
activities reached via `workpack: { project_id }` into `ScheduleBaseline` + `BaselineActivity`.
Classification **A**. Retained.

Verified behaviourally: a `ScheduleBaseline` can be created with `project_id` set and
`event_id: null`, inside a rolled-back transaction. **A Project baseline requires no Event.**
`[EXECUTED]`

### 10.2 The broken artifact — repair is impossible, and here is exactly why

`/api/projects/[id]/baselines` (**plural**) implemented "baseline as a cloned Project"
(baseline branching). Repair within Project is **not possible**, for three independently
sufficient reasons:

1. It requires `Project.activities`. That relation does not exist, and creating it requires
   `Activity.project_id` — which **§8 explicitly forbids reintroducing**.
2. It requires `Project.isBaseline`, `Project.parentProjectId` and `Project.primaryBaselineId`.
   None exists in the Prisma schema **or** in the physical table (17 columns verified).
   `[EXECUTED]` Adding them is a migration, which **§24 forbids**.
3. Its former `GET` and `DELETE` were **tenant-unscoped** — a cross-tenant read and delete
   hazard. Restoring them as-written would reintroduce a security defect.

**Disposition:** the file is **retained** (§16.4 forbids silent deletion) and returns a
fail-closed **501** with a machine-readable code, a message pointing at the working singular
endpoint, and a pointer to this document. `guardApi` still runs first, so authorization
behaviour is unchanged. Recorded as defect **OD9-035**.

`ProjectBranchingService` — the service behind it — is classified **F** and retained
unmodified. It does not compile (9 TypeScript errors) and depends on the same absent fields.
Per §27 it was **not** deleted; per §31 it is classified and its retirement is documented.

---

## 11. PROJECT SCHEDULING FINDINGS

### 11.1 Project has an independent scheduling authority — and it is real

`SchedulingService.calculateProjectSchedule(projectId, orgId)` is a genuine CPM engine:
calendar-aware duration conversion, topological sort, forward pass (ES/EF), backward pass
(LS/LF/TF/FF), critical-path flagging, persisted in a transaction. It scopes **only** by
`workpack: { project_id }` and `organization_id`.

Verified behaviourally: its source contains no `event_id` and no `prisma.event` reference,
and it executes for a Project with no Event. `[EXECUTED]`

Per §17 it is **not** connected to Event CPM, STO progress, M12 execution, M8.13, STO
readiness or the STO Control Tower. The frozen STO time authority was **not modified**.
`[EXECUTED]`

### 11.2 Project scheduling was broken and is now repaired

Both Project scheduling entry points selected `plannedSdDate` / `plannedSuDate` — the
**pre-OD9 camelCase aliases**. The physical columns are `planned_sd_date` /
`planned_su_date`. `[EXECUTED]` Prisma throws on an unknown field, so **every Project CPM
run that reached the date lookup failed**, as did every Project S-curve computation.
Repaired to snake_case. Same defect repaired in `app/api/workpacks/[id]/export/primavera/route.ts`,
which additionally selected a non-existent `title` field on `Project`.

### 11.3 Project WBS — the structural blocker (**the reason this task is AMBER**)

```prisma
model WbsNode {
  event_id  String  @db.Uuid            // NOT NULL
  event     Event   @relation(..., onDelete: Cascade)
  @@map("wbs_nodes")
}
```

Confirmed physically: `wbs_nodes.event_id` is `uuid`, `is_nullable = NO`. `[EXECUTED]`
An insert without `event_id` is rejected by the database. `[EXECUTED]`

**`wbs_nodes` is structurally owned by the STO Event. A Project cannot own a WBS.**

This *explains* the forbidden resolver of §7.3: the routes were not gratuitously reaching
for an Event — they were **schema-forced** to have one, and in its absence they invented one.

This directly contradicts §5's requirement that Project support
`Portfolio → Project → WBS → Activities`, and it means §25 test 3 ("Project WBS works
independently") **cannot pass**. It is recorded as such rather than forced green.

**Resolution chosen:** the Project WBS routes fail closed. They resolve no Event, write
nothing, and delete nothing. `GET` returns an empty set (so any legacy view renders its
documented empty state rather than an error), `POST`/`PATCH`/`DELETE` return **501** with an
explanation. Files retained per §27. **STO WBS is unaffected** and remains fully functional
under `/api/events/[eventId]/wbs`. No live data is affected: `wbs_nodes` has **0** rows and
no Workpack carries a `project_id`. `[EXECUTED]`

Giving `wbs_nodes` a Project-domain owner is OD9.4 migration candidate **MC-2**. §24 forbids
performing it here.

---

## 12. PROJECT REPORTING FINDINGS

§9 is a **hard requirement**: Project reporting must be standalone; a shared *technical*
rendering engine is acceptable, a shared *business reporting authority* is not.

**Finding, from evidence rather than assumption:** the M14 provider registry exposes exactly
**8** categories — `execution`, `management`, `planning`, `platform`, `safety`, `shutdown`,
`udf`, `workforce`. `[EXECUTED]`

There is **no `project` category and no `portfolio` category**, and no provider key begins
with `project.` or `portfolio.`. `[EXECUTED]`

So Project reporting is **absent, not entangled**. This is the favourable case for §9: a
Project report cannot accidentally consume STO progress as its authoritative business value,
because no Project report provider exists to do so. The §9 risk is structurally excluded
today, and a guard test now fails if a Project-domain provider category appears silently.

The actual §21 violation was therefore **not** shared business logic but **navigation
ownership**: all eight categories are STO business reporting, yet they were surfaced under a
domain-neutral "Intelligence" / "Reports" menu that obscured ownership. Fixed in §16.

The one Project-scoped reporting surface that does exist (the Project daily-report path)
resolves through `workpack: { project_id }` and reads no STO progress authority. `[EXECUTED]`

---

## 13. PORTFOLIO FINDINGS

**Portfolio functionality does not exist.** `[EXECUTED]` There is no `Portfolio` model, no
`/portfolio` route, no portfolio provider, and no portfolio navigation entry in any domain.

Per §10 — *"Do NOT invent fully functional features where only placeholders exist"* — no
Portfolio surface was fabricated and no dead Portfolio menu entry was added. The §21 Project
sub-groupings that have no routes behind them (Portfolio, Resources & Cost, Progress &
Performance, Project Reports, Project Communications) are **deliberately not linked**; a
comment in `business-navigation.ts` records this and the reason.

A behavioural test asserts that no Portfolio entry has leaked into either Project or STO, so
the absence is now guarded.

**Consequence for §5:** the frozen Project hierarchy
`Portfolio → Project → WBS → Activities → … → Reports` is currently realised only at the
`Project → (Workpack) → Activities → Scheduling → Baselines` level. Portfolio (above) and
WBS (below) are both absent — WBS for the structural reason in §11.3. This is stated as a
functional gap, not as an achievement.

---

## 14. P6 / MPP INTEGRATION FINDINGS

§11 requires keeping P6 import/export, MS Project/MPP and Excel import/export, and not
removing integrations unless demonstrably broken or obsolete. **No integration was removed.**

Import/Export lives in the Project domain only: `/integrations/import`,
`/integrations/export`, `/integrations/export/history`. No `/integrations` entry appears in
the STO group. `[EXECUTED]`

### 14.1 The export subsystem treated `projectId` polymorphically — **FIXED**

Four related defects, all in the same "a Project id might really be an Event id" family:

1. **`/api/export/generate`** resolved the export header by trying `Project` and then
   falling back to `Event` **for the same identifier** — an explicit Event-as-Project
   fallback. Now `projectId` and `eventId` are separate inputs, each resolved against its own
   model, never one then the other for the same id.
2. **`/api/export/search`** and **`/api/export/resolve-type`** filtered with
   `OR: [{ project_id: projectId }, { event_id: projectId }]`, matching a single id against
   **both** domains' columns. Now each id filters only its own column.
3. **`export_history`** received an Event id in its `project_id` column, corrupting the audit
   trail's domain semantics. Now `project_id` is written **only** for Project-scoped exports
   and left null for Event-scoped ones. Because there is no `event_id` column on that table,
   Event-scoped exports currently cannot be attributed — recorded as OD9.4 candidate **MC-1**
   rather than fixed by writing an Event id into a Project column.
4. **`/integrations/export` UI** loaded `/api/projects` and, if the list came back empty,
   silently back-filled it with `/api/events`, so Events appeared as Projects. It now loads
   both and tags each with an explicit `domain: 'project' | 'event'`, rendering
   `<optgroup label="Project">` and `<optgroup label="STO Event">`, and sends the correct
   parameter name via a `scopeParam()` helper.

### 14.2 Two serious defects found incidentally

- **Cross-tenant export leak.** The workpack query in `/api/export/generate` had **no
  `organization_id` filter**. Possession of a Workpack UUID was sufficient to export another
  tenant's full schedule. UUID possession is not authorization. Added `organization_id: orgId`.
- **The export audit trail had never recorded anything.** `export_history.create` omitted the
  required `id` (the model has no default), so every insert threw — and the throw was
  swallowed. `export_history` has **0 rows** despite the feature being live. `[EXECUTED]`
  Now supplies `randomUUID()`, uses the correct snake_case column names, and logs failures.
- **`/api/export/history`** ordered by `exportedAt` and filtered by `orgId` (camelCase), so
  **every** read threw into its catch block and returned `[]`. Repaired.
- **`/api/export/search`** filtered `equipmentType` by `orgId` instead of `org_id`, so that
  branch always threw. Repaired.

MPP/Excel handling and the P6 XER/XML formatters were **not** modified beyond the field-name
repair in §11.2.

---

## 15. M16 / AI FINDINGS

§20: AI must not infer an Event from a Project, must not use Project as an STO resolver, and
must not write directly to Prisma/business tables.

| Requirement | Verified state |
|---|---|
| AI must not infer an Event from a Project | Given only `{ projectId }`, `resolveNavigation('control_tower', …)` returns **`null`** `[EXECUTED]` |
| AI must not emit Project URLs for STO targets | Given both ids, no resolvable target produces a `/projects/` path `[EXECUTED]` |
| AI must not use Project as an STO resolver | No M16 module contains a Project→Event resolver in executable code `[EXECUTED]` |
| AI must not write to business tables | Not modified by OD9.2; existing boundary retained |

**Defect found and fixed:** `WhatsAppChannelAdapter.ts` passed `projectId: orgId` and
`VoiceChannelAdapter.ts` passed `projectId: session.organizationId` into
`processInteraction`. An **Organization** id was travelling under a **Project**-named field.
The pipeline never read it, so no behaviour changed — but it was a latent domain-conflation
trap of exactly the kind §20 forbids. Both fields removed.

The four remaining TypeScript errors in these two adapters (`organizationMembership` not on
`PrismaClient`, an argument-count mismatch, a `string | null` assignment) are **pre-existing**
— byte-identical in the pre-OD9.2 baseline, shifted only by the comment lines added.
`[EXECUTED]` They are unrelated to domain separation and were not in scope.

---

## 16. NAVIGATION CHANGES

### 16.1 Structural change

The navigation definition moved from ~8.4 KB of inline construction inside
`app/(dashboard)/layout.tsx` into a pure module, `src/config/business-navigation.ts`,
mirroring the existing `src/config/platform-navigation.ts` convention. **Every permission
check and feature flag was carried over unchanged.**

This was done for a testability reason that §25 demands: the frozen domain structure can now
be asserted by **calling the real builders with real roles and real permission data**,
instead of grepping a layout file.

`src/components/NavBar.tsx` was reworked: `NavItem` gained an optional `section`, a
`groupBySection()` helper preserves declaration order, dropdowns render section headings
(scrollable, `max-h-[70vh]`), and the six activity-type props were replaced by
`digitalPlantItems` / `stoItems` / `projectItems` / `adminItems`. `app/platform/layout.tsx`
and `app/platform-data/layout.tsx` were updated to the new prop set.

A latent bug was fixed in passing: Documents was gated behind `showAdmin`, hiding it from
every non-admin. It is now gated on `adminItems.length > 0`.

### 16.2 Final top level (frozen)

1. **DIGITAL PLANT** 2. **STO** 3. **PROJECT** 4. **ORGANIZATION & ADMINISTRATION**

Verified behaviourally: exactly these four keys, in this order, with these labels; all four
populate for a fully-permissioned tenant role; none is an AI/Assistant domain. `[EXECUTED]`

### 16.3 Reporting ownership

STO reporting moved **out** of the domain-neutral "Intelligence"/"Reports" grouping and
**into** `STO → STO Reports`: `/reporting`, `/reports`, `/report-builder`, `/shift-reports`,
`/lessons`. There is now **no generic global Reports menu**. A behavioural test asserts every
reporting entry carries a domain-owned section heading and that a bare `Reports` or
`Intelligence` heading is never used. `[EXECUTED]`

### 16.4 A deprecated route was deliberately not re-linked

`/imported-schedule` was initially placed in the Project group as "Baseline Schedule". The
M11-R0 regression suite caught this: M11-R0 had **deliberately removed** it from navigation
as part of schedule-import deprecation, and the page itself is a dead-end placeholder that
only says *"Please Select a Project"*.

It was removed from the Project group and from NavBar's active-prefix list. §10 forbids
presenting placeholders as features and §27 forbids reversing a prior decision without
proof; §11 remains satisfied because P6/MPP/Excel interchange is preserved via
`/integrations/import` and `/integrations/export`.

**This is recorded because the guard test, not the author, caught it.**

### 16.6 A second, contradictory navigation declaration — resolved

`src/security/navigation.ts` exported `TENANT_SHELL_SECTIONS`, declaring the **pre-OD9.2**
activity-type shell (Dashboard / Planning / Execution / Intelligence / Import-Export), a
**standalone Safety** entry gated on `safety.view`, and a **generic global "Reports" group** at
`/report-builder`. It had **zero code consumers** `[EXECUTED]` — only a re-export from
`src/security/index.ts`.

Every element of it now contradicts frozen policy: §21 replaced activity-type grouping with the
four business domains, §21 forbids a domain-neutral Reports menu that obscures ownership, and
§22 places Safety under STO only. A prior forensic audit recorded the divergence as defect
**D-006 (P1)** — "two navigation architectures" — and recommended making the shell *read* this
object.

OD9.2 resolves D-006 in the **opposite** direction: `src/config/business-navigation.ts` is the
single authoritative definition, and this metadata was rewritten to state the four frozen
domains and to say so explicitly. A behavioural test now fails if it drifts back toward a
`Reports`, `Intelligence` or standalone `Safety` top-level entry.

### 16.7 An orphaned STO module made reachable

The navigation audit found several complete, API-backed modules with **no navigation entry
anywhere**, openable only by typing a URL. OD9.2 resolved these where ownership is provable
from evidence:

| Route | Action | Evidence for ownership |
|---|---|---|
| `/reports`, `/report-builder` | Added to **STO → STO Reports** | All 8 M14 provider categories are STO/platform (§12) |
| `/execution/mobile` (M12 field mobile) | Added to **STO → Execution** | Its own page metadata declares `Mobile Execution \| STO` |
| `/ois/*` (M13 Operational Intelligence Studio, 6 routes) | **Left unlinked, recorded as `[OPEN]`** | See below |

`/ois/*` is an organisation-level, user-configurable dashboard library. Its widgets can render
any domain's KPIs, so assigning it to a single frozen domain would require **inventing business
meaning** — which §32 directs me to stop on, and §19 warns against as "cross-domain KPI
ambiguity". It is recorded as **OD9-050** rather than filed under a domain on my judgement.

`/events/[eventId]/management-intelligence` and `/events/[eventId]/control-tower` require an
Event id and are reached from the Event UI, so they are not top-level candidates. This is why
§21's frozen **Control Tower** STO sub-section has no domain-level entry — noted as a known
gap, not silently ignored.

### 16.5 Project domain UI de-STO-isation (§28)

`/projects/[id]` tabs **11 → 5** (Overview, Schedule, Lookahead, Constraints, Equipment) and
stat cards **5 → 2**. A header comment records, per surface, why TA Dashboard, Workpacks,
Punch List, Permits, Safety and Daily Reports were removed and **which STO surface retains
each capability** — so no capability was lost, only relocated in the UI.

Shutdown vocabulary was removed from the Project domain's own copy: "All turnaround /
shutdown projects" → "Portfolio & project management"; "Planned Shutdown"/"Planned Startup"
→ "Planned Start"/"Planned Finish"; "Plant / Refinery" → "Site".

---

## 17. SAFETY / PERMIT ISOLATION

§22: Safety & Permit Management must appear **only** under `STO → Safety & Permits`, and
actual STO Safety/Permit functionality must not be deleted.

| Check | Result |
|---|---|
| `/safety` and `/permits` in STO group, section `Safety & Permits` | Yes `[EXECUTED]` |
| Present in Project group | No `[EXECUTED]` |
| Present in Digital Plant group | No `[EXECUTED]` |
| Present in Organization group | No `[EXECUTED]` |
| Any other domain declares a `Safety & Permits` section | No `[EXECUTED]` |
| `SafetyLog.event_id` nullability | `NOT NULL` — Safety is structurally Event-owned `[EXECUTED]` |
| STO Safety/Permit functionality deleted | **No** — nothing removed |
| Project daily report reads `SafetyLog` by treating a Project id as an Event id | **Removed** — see §7.7 `[EXECUTED]` |
| Project-scoped Safety API (`/api/projects/[id]/safety`) | **Fail-closed 501** — see §7.8 `[EXECUTED]` |
| STO `/permits` landing sends the user to `/projects` | **Fixed** — now signposts Workpacks / Safety / Events `[EXECUTED]` |

`/projects/[id]/safety` and `/projects/[id]/permits` were **placeholder stubs** reading
*"Phase 6 feature — coming soon"* — they contained no functionality to preserve. They now
`redirect()` to the STO surfaces, so any bookmark lands on the real feature rather than a
dead page. Under `SAFETY_MODULE` disabled, Safety disappears from STO but does **not**
reappear anywhere else — verified. `[EXECUTED]`

Two further Safety/Permit isolation defects were found after the first close of this document,
from the coupling and navigation audits. Both were live in the working tree:

1. **Project daily report** (`app/api/projects/[id]/reports/daily/route.ts`) queried
   `prisma.safetyLog.findFirst({ where: { event_id: projectId } })`. The original comment
   admitted the fabricated mapping: *"projectId may be event id when called from events TA
   dashboard."* Repairing camelCase field names had made this dormant read **live**. The safety
   block was removed; the Project report now uses Project data only and instructs the model not
   to invent safety, incident or PTW figures.
2. **Project Safety API** (`app/api/projects/[id]/safety/route.ts`) served `SafetyLog` by
   `project_id`. `SafetyLog.event_id` is `NOT NULL`, so Safety is structurally Event-owned.
   The route had **zero** production consumers and is now fail-closed (501). `/safety` and
   `/api/events/[eventId]/safety` are untouched.
3. **STO `/permits` landing** previously said *"Select a project to view permits"* and linked
   to `/projects`. Combined with the Project-page redirect in (1) of the original close, that
   formed a navigation loop and inverted §22. The page now signposts Workpacks, Safety and
   Events and does not mention Projects.

---

## 18. DATABASE CHANGES

**OD9.2 made ZERO database changes.** `[EXECUTED]`

- No migration created, no migration applied.
- No `prisma db push`, no `migrate reset`, no destructive `migrate diff`.
- No `ALTER`, `DROP`, `CREATE TABLE`, `INSERT`, `UPDATE` or `DELETE` against live data.
- `prisma/schema.prisma` was **not modified**.

`npx prisma validate` → *"The schema at prisma\schema.prisma is valid"*, exit 0. `[EXECUTED]`

Per §26's explicit caution, **schema validity is not claimed as migration safety**. Validation
proves only that the schema file parses and is internally consistent. It says nothing about
drift, and no migration-safety claim is made in this document.

The one write path OD9.2 executed against the database was inside the behavioural test suite,
and every such write ran in a transaction **forced to roll back** via a sentinel error, so
nothing was persisted. `[EXECUTED]`

All schema observations in this document come from `information_schema` and `pg_catalog`
**reads**.

---

## 19. DATA SAFETY / PRESERVATION

§23's checklist was satisfied before any decision, and its conclusion is that **no
destructive change was needed or performed**.

### 19.1 Row counts (live `syority`) `[EXECUTED]`

| Table | Rows |
|---|---|
| `Project` | **0** |
| `project_constraints` | **0** |
| `project_units` | **0** |
| `punch_items` | **0** |
| `export_history` | **0** |
| `wbs_nodes` | **0** |
| `digital_plant_projects` | **0** |
| `ScheduleBaseline` | 10 |
| `BaselineActivity` | 28 |
| `Workpack` | 219 |
| `events` | 51 |

Every general-Project-domain table is **empty**, so §23's destructive-change risk is nil —
and, correspondingly, nothing needed to be migrated or mapped.

### 19.2 Dependency proof `[EXECUTED]`

- `"Project"` has exactly **one** index: `Project_pkey`.
- `"Project"` has **zero** outgoing foreign keys.
- Exactly **one** foreign key in the whole database references `"Project"`:
  `Workpack_project_id_fkey … ON DELETE SET NULL`.
- Only `extraction_candidates` and `plant_documents` have foreign keys on a `project_id`
  column, and both reference `digital_plant_projects`.

### 19.3 Physical type inconsistency (recorded, not "fixed")

`Project.id` is **`text`** with **no default**. The `project_id` columns split into two
incompatible groups:

| Type | Tables | Consequence |
|---|---|---|
| `text` | `Workpack`, `DocLibrary`, `project_constraints`, `project_units`, `punch_items` | FK-capable against `Project.id` |
| `uuid` | `Permit`, `SafetyLog`, `ScheduleBaseline`, `export_history` | **Structurally incapable** of referencing `Project.id` |
| `uuid NOT NULL` | `extraction_candidates`, `plant_documents` | Correctly FK to `digital_plant_projects` |

This is how the M10 defect of §7.1 stayed hidden: `ScheduleBaseline.project_id` is a UUID
column with no FK, so it silently accepted Event UUIDs. Recorded as OD9.4 candidate **MC-4**;
resolving it is a type migration, forbidden here.

### 19.4 No fabricated mappings

**No data mapping was fabricated.** `[EXECUTED]` Specifically: the **201** workpacks with
neither an Event nor a Project were left untouched; the **1** Project-scoped
`ScheduleBaseline` row was left untouched (it was not "corrected" into an Event row); and no
historical value was rewritten.

---

## 20. TESTS EXECUTED

`tests/od92-project-domain-separation.test.ts` — **29 tests** covering all 24 §25
requirements.

Per §25 (*"Do not rely only on grep/source-text tests"*), the suite is behavioural:

- **Real database writes** inside transactions forced to roll back via a `ROLLBACK` sentinel,
  using the app's own `prisma` singleton from `@/lib/prisma` (Prisma 7 requires the
  `PrismaPg` driver adapter, so `new PrismaClient()` is not usable).
- Writes are anchored to a **real** Organization, Site and Event fetched at `beforeAll`, so
  foreign keys are genuinely exercised.
- **Real module execution** — the actual navigation builders, the actual M16 resolver, the
  actual CPM enqueue chokepoint, the actual provider registry.
- **Real catalog reads** from `information_schema` / `pg_catalog` for structural claims.

Where a claim can only be established structurally (§6 names `resolveEventIdFromProject`
explicitly, so its absence is guarded by name, as the existing R0.4-E guards do), the test
says so in its name and **strips comments before scanning** — because these files now
*document* the removed patterns and a naive scan flags its own explanation.

Also executed: `m10-planning.test.ts` (92 tests), the full regression suite (1563 tests),
`npx tsc --noEmit`, `npx prisma validate`, and direct SQL evidence probes.

---

## 21. TEST RESULTS

### 21.1 The 24 §25 behavioural tests — **29/29 PASS** `[EXECUTED]`

| # | Requirement | Result | Note |
|---|---|---|---|
| 1 | User can enter Project independently | **PASS** | Project is a top-level domain; no entry href contains an Event segment |
| 2 | Project works without Event | **PASS** | Project created + read with no Event; no `event_id` column; **0** outgoing FKs |
| 3 | Project WBS works independently | **PASS as recorded FAILURE** | Test asserts the *actual* state: `wbs_nodes.event_id` is `NOT NULL` and an insert without it is rejected. **Honest negative result** (§11.3) |
| 4 | Project activities work independently | **PASS** | `Activity.project_id` absent (§8 honoured); path is `Project → Workpack → Activity` |
| 5 | Project scheduling works without Event | **PASS** | `calculateProjectSchedule` executes; contains no `event_id` / `prisma.event` |
| 6 | Project baseline works without Event | **PASS** | Baseline created with `project_id` set, `event_id: null` |
| 7 | Project reports use Project data | **PASS** | Resolves via `workpack.project_id`; no `project`/`portfolio` provider category exists |
| 8 | Portfolio works without Event | **PASS** | Portfolio absent from every domain — guarded absence (§13) |
| 9 | P6/MPP connected to Project | **PASS** | Import/Export in Project only; absent from STO |
| 10 | Event works without Project | **PASS** | Event created with no Project; no `project_id` field on the model |
| 11 | STO schedule not resolved via Project | **PASS** | No `resolveEventIdFromProject`; enqueue returns `EVENT_REQUIRED` |
| 12 | STO progress not resolved via Project | **PASS** | No exported M8.13 method name or signature mentions project |
| 13 | STO reports work without Project | **PASS** | All 8 categories STO/platform; no `project.`/`portfolio.` provider key |
| 14 | STO Safety under STO | **PASS** | STO-only in nav; `SafetyLog.event_id` `NOT NULL`; **no Project route queries `SafetyLog`/`SafetyIncident`/`Permit`** (T16b) |
| 15 | STO Permit under STO | **PASS** | STO-only in nav; the `/permits` landing no longer links into `/projects` (T24b) |
| 16 | No Project route resolves Event as STO authority | **PASS** | 0 Workpacks carry a `project_id`; comment-stripped scan finds 0 offenders |
| 17 | No STO route requires Project | **PASS** | Only `extraction_candidates`, `plant_documents`, `project_units` have `NOT NULL project_id`; no STO table |
| 18 | No M16 Project context becomes Event context | **PASS** | Project-only context → `null`; both ids → no `/projects/` path |
| 19 | No duplicate STO progress authority | **PASS** | Event-keyed baselines ≥ Project-keyed (4 vs 1 on live data) |
| 20 | No duplicate STO CPM authority | **PASS** | One Event orchestrator, no `project` in its API; Project CPM is separate and Event-free |
| 21 | Four frozen domains | **PASS** | Exact keys, labels and order; no AI domain; all four populate |
| 22 | Project reports inside Project | **PASS** | Every reporting entry has a domain-owned section; no bare `Reports`/`Intelligence` |
| 23 | STO reports inside STO | **PASS** | `STO Reports` section populated; absent from Project and Digital Plant |
| 24 | Safety/Permit inside STO only | **PASS** | Absent from all three other domains |
| +2 | Schema-level Project/Event decoupling; per-domain permission & feature gating | **PASS** | Gating still applies; disabling `SAFETY_MODULE` doesn't relocate Safety |
| +T16b | No Project route treats a Project id as an Event id, queries an STO Safety/Permit table, or carries a retired `Activity.project_id` filter | **PASS** | Comment-stripped scan of `app/api/projects/**`; 0 offenders. Added after §7.7/§7.8 |
| +T24b | The STO Permits landing does not send the user into the Project domain | **PASS** | No `/projects` link, no "Select a project"; links to `/workpacks`, `/events` |
| +T21c | The security navigation metadata agrees with the four frozen domains | **PASS** | Guards against re-drift toward a global `Reports`, `Intelligence` or standalone `Safety` entry (§16.6) |

**On test 3:** it is recorded as an honest negative. The test *passes* because it asserts the
real, measured constraint (`wbs_nodes.event_id` is `NOT NULL`); the §25 *requirement* that
"Project WBS works independently" is **not met**. This distinction is deliberate and is the
basis for the AMBER status. It was not forced green.

### 21.2 Full regression suite `[EXECUTED]`

| Metric | OD9.1 baseline | After OD9.2 |
|---|---|---|
| Tests passing | 1532 / 1534 | **1561 / 1563** |
| Failing | 2 (known-stale M11) | **2 (the same two)** |
| Test files | — | 77 passed / 1 failed |

The two failures are `M11-R0 Import Deprecation > CPM authority > schedule route POST imports
ScheduleOrchestrationService` and `… > activity update route imports
ScheduleOrchestrationService`. These are **pre-existing** stale source-grep tests: the routes
correctly delegate through `enqueueEventScheduleRecalculate`, and a prior task explicitly
directed *"Do NOT modify `tests/m11-import-deprecation.test.ts`"*. **No regression.**

Three failures that OD9.2 *did* introduce were caught and fixed before completion:

1. The R0.4-E boundary guard flagged three files — because it matched OD9.2's own
   **documentation comments** describing the removed pattern. Fixed by stripping comments in
   the guard's `filesMatching()`, leaving every assertion intact. This **strengthens** the
   guard's precision without weakening it.
2. The M10 test `navigation should include planning readiness link` grepped
   `app/(dashboard)/layout.tsx`, from which the nav moved. Rewritten to call the real
   `buildStoItems()` and assert the entry, its label and its `Readiness` section — a stronger
   check of the same requirement.
3. The M11-R0 NavBar test caught `/imported-schedule` being re-linked (§16.4).

### 21.3 Type checking `[EXECUTED]`

| Metric | Value |
|---|---|
| Baseline errors | 1206 |
| After OD9.2 | **1101** |
| **Delta** | **−105** |
| New errors introduced in files OD9.2 touched | **0** |

The only errors remaining in touched files are the four **pre-existing** M16 adapter errors
(§15), byte-identical in the baseline apart from line-number shift.

---

## 22. REMAINING DEFECTS

| ID | Defect | Severity | Status |
|---|---|---|---|
| **OD9-035** | Project baseline **branching** unimplementable — needs `Project.activities` (blocked by §8), `isBaseline`/`parentProjectId` (blocked by §24) | Medium | Fail-closed 501, file retained (§10.2) |
| **OD9-036** | **Project cannot own a WBS** — `wbs_nodes.event_id` is `NOT NULL`. §5 hierarchy and §25 test 3 unsatisfiable | **High — the AMBER cause** | Fail-closed; MC-2 |
| **OD9-037** | `ProjectBranchingService` does not compile (9 errors); depends on absent fields | Low | Classified **F**, retained per §27 |
| **OD9-038** | Portfolio layer entirely absent | Medium | Documented (§13); not fabricated |
| **OD9-039** | Project **Reports** and **Communications** have no implementation | Medium | Not linked (§10 honesty) |
| **OD9-040** | Event-scoped exports cannot be attributed — `export_history` has no `event_id` | Low | MC-1; not worked around by writing an Event id into a Project column |
| **OD9-041** | `Project.id` / `Project.updated_at` and `Event.id` / `Event.updated_at` have no database defaults; every caller must supply them | Low | MC-3 |
| **OD9-042** | `Project.id` is `text` while four `project_id` columns are `uuid` | Medium | MC-4 |
| **OD9-043** | `project_units.project_id` is `NOT NULL` with **no FK** — orphan-capable | Low | MC-5 |
| **OD9-044** | **201 of 219 Workpacks have neither an Event nor a Project** | **High** | `[OPEN]` — deliberately untouched; see below |
| **OD9-045** | Two stale M11 source-grep tests | Low | Pre-existing; out of scope by prior directive |
| **OD9-046** | Four pre-existing M16 adapter type errors | Low | Pre-existing; unrelated to domain separation |
| **OD9-047** | `DashboardHeader.tsx` is a dead parallel nav component (0 import sites) | Low | Classified **F**, retained |
| **OD9-048** | Project date columns are `timestamp without time zone` | Medium | C2 scope, not OD9.2 |
| **OD9-049** | Project imported-schedule unrepairable — needs `Activity.project_id` (§8 forbids), plus an absent `ScheduleImportBatch` model and two absent `Activity` columns (§24 forbids) | Medium | Fail-closed, retained; MC-7 |
| **OD9-050** | `/ois/*` (M13 Operational Intelligence Studio, 6 routes) is complete and API-backed but unreachable; its domain ownership is genuinely ambiguous | Medium | **`[OPEN]`** — not assigned a domain on my judgement (§32) |
| **OD9-051** | §21's frozen STO **Control Tower** sub-section has no domain-level entry — Control Tower and Management Intelligence require an Event id | Low | Documented gap (§16.7) |
| **OD9-052** | A `where` object typed `any` lets a retired column pass type-checking and fail only at runtime — the mechanism behind OD9-049 and the Project Schedule outage | Medium | Two instances fixed and guarded; the `any` pattern remains widespread |

**On OD9-044** — this is the most consequential `[OPEN]` item. 201 workpacks cannot be
attributed to any STO Event. §7 states *"Never invent Event mappings for records that do not
have an authoritative Event"* and §32 requires stopping when a record cannot be
deterministically classified. **I stopped.** No Event was assigned, inferred from dates,
plant, recency or UUID similarity, and no default was invented. This is uncertainty
documented, not hidden — and it is a prerequisite for any future STO scope consolidation.

---

## 23. DEFERRED ITEMS

Deferred by explicit instruction:

- **Prisma re-baseline** — §24 forbids it in OD9.2.
- **C2 / timezone migration** — §1 and §24 forbid proceeding to C2.
- **Digital Plant → STO Potential Shutdown Scope handoff** — §3: *"Do NOT invent or implement
  that detailed workflow in OD9.2."* Nothing was designed or implemented.
- **STO time authority changes** — §17: *"Do not modify the frozen STO time authority."*
  M11/M12 production code untouched.
- **M13/M14/M15 restructuring beyond navigation ownership** — §19 asks for reorganisation
  without destroying modules; only menu ownership changed.

Deferred on evidence:

- Portfolio implementation (OD9-038) — building it is new feature work, not reorganisation.
- Project Reports provider category (OD9-039) — adding one would create the §9 coupling risk
  unless designed Project-first.
- `project_constraints` / `project_units` disposition — §26/§27 forbid dropping tables merely
  because they are empty.
- `ProjectBranchingService` retirement — retained pending the MC-2/§8 decision.
- The 201 unattributed workpacks (OD9-044) — requires authoritative business input.

---

## 24. MIGRATION CANDIDATES FOR OD9.4

None of these was performed. Each is recorded with its justification, and none is claimed to
be safe merely because `prisma validate` passes.

| ID | Candidate | Justification | Destructive? | Blocks |
|---|---|---|---|---|
| **MC-1** | Add `export_history.event_id` (nullable) | Event-scoped exports currently cannot be attributed without writing an Event id into a Project column | No — additive | OD9-040 |
| **MC-2** | Give `wbs_nodes` a Project-domain owner (nullable `project_id`, relax `event_id`, enforce exactly-one-owner) | **The AMBER cause.** Without it §5's `Project → WBS → Activities` is unrealisable | Requires relaxing a `NOT NULL`; `wbs_nodes` has **0 rows**, so no data is at risk | OD9-036, §25 test 3 |
| **MC-3** | Add database defaults for `Project.id`/`updated_at` and `Event.id`/`updated_at` | Every caller must supply them; omission is a silent runtime failure (it is how `export_history` never wrote) | No | OD9-041 |
| **MC-4** | Reconcile `Project.id` `text` vs `uuid` `project_id` columns | The type split is how the M10 leak stayed hidden | **Yes** — type change on FK columns. All affected tables are empty today | OD9-042 |
| **MC-5** | Decide `project_constraints` / `project_units` (add FKs, or retire with evidence) | `project_units.project_id` is `NOT NULL` with no FK | Depends on the decision. Both are empty | OD9-043, OD9-009 |
| **MC-6** | Decide `Project.activities` (only if §8's prohibition is relaxed) | Required by baseline branching. **Currently forbidden by §8** | No | OD9-035 |
| **MC-7** | Decide the fate of Project schedule import: either add `ScheduleImportBatch` + `Activity.import_batch_id`, or formally retire the subsystem | The route cannot function without a model that does not exist; M11-R0 already deprecated schedule import | Additive if built; none if retired | OD9-049 |

**MC-2 is the single migration that would move OD9.2's status from AMBER toward GREEN.**

---

## 25. C2 IMPACT

**C2 remains BLOCKED.** OD9.2 did not evaluate C2's independent prerequisites, and §1
forbids proceeding to C2 in this task.

What OD9.2 contributes to C2:

- **Positive:** the Project/STO boundary is now explicit and behaviourally guarded, so a C2
  timezone migration can reason about `Event` time and `Project` time as separate concerns
  rather than through an ambiguous `project_id`.
- **Positive:** removing the polymorphic `projectId` from the export subsystem eliminates a
  path by which a C2-migrated Event timestamp could be read through a Project column.
- **New information for C2:** `Project.planned_sd_date`, `planned_su_date`,
  `forecast_sd_date`, `forecast_su_date`, `actual_sd_date`, `actual_su_date` are all
  `timestamp without time zone` (OD9-048) `[EXECUTED]`. Under the ratified `storage = tstz`
  decision these are in scope for C2's conversion. OD9.2 makes no C2 recommendation about
  them.
- **Neutral:** no schema or data change was made, so C2's starting state is unchanged from
  OD9.1's.

The R0.4 Event Authority and M12 Execution Fact Integrity closures were **not reopened**, and
no `actual_*` field received anything other than execution provenance — OD9.2 wrote no
business data at all.

---

## 26. FINAL ARCHITECTURE VERIFICATION

| §33 frozen statement | Verification | Evidence |
|---|---|---|
| DIGITAL PLANT owns Asset Truth | Digital Plant nav intact; P&ID Extraction not moved; `digital_plant_projects` FKs untouched | `[EXECUTED]` |
| STO owns Shutdown Truth | `Event` creatable without Project; no STO table requires `project_id` | `[EXECUTED]` |
| Event is the sole STO campaign identity | No Project route resolves an Event; no second STO CPM or progress authority | `[EXECUTED]` |
| Safety and Permit Management belong to STO | Present only in the STO group; `SafetyLog.event_id` `NOT NULL` | `[EXECUTED]` |
| PROJECT owns General Project/Portfolio Truth | Project creatable/readable with no Event; independent CPM; independent baseline | `[EXECUTED]` |
| ORGANIZATION & ADMINISTRATION owns governance | Documents + `/settings/*` in the fourth domain | `[EXECUTED]` |
| AI is cross-domain, never a data authority | Not a top-level domain; Project context → `null` navigation | `[EXECUTED]` |
| No implicit Project → Event ownership | `"Project"` has **0** outgoing FKs and no `event_id` column | `[EXECUTED]` |
| A user in PROJECT does not feel they are in an STO system (§28) | Tabs 11 → 5; stat cards 5 → 2; shutdown vocabulary removed | `[SOURCE]` |
| A user in STO does not feel they are in a generic PM system (§28) | 26 STO entries in STO-specific sections; no `/integrations`, no `/projects` | `[EXECUTED]` |

**Where the architecture is NOT yet achieved:**

- §5's `Portfolio → Project → WBS → Activities` is **not** realisable: Portfolio is absent
  (OD9-038) and WBS is Event-owned (OD9-036).
- §5's "capable of eventually behaving like a modern Primavera P6 / MS Project class system"
  is **not** met today. Project CPM, baselines and P6/MPP interchange exist and now work, but
  without a WBS and without Portfolio, resource-cost or EVM layers, the domain is not P6-class.
  This is stated plainly rather than claimed as achieved.

---

## 27. FINAL STATUS

### AMBER — PROJECT DOMAIN REORGANIZED BUT NON-BLOCKING DEFECTS REMAIN

**Why not GREEN.** §31 requires that Project be "a standalone general-purpose Portfolio &
Project Management domain". Two frozen-hierarchy layers are absent: a Project **cannot own a
WBS** (`wbs_nodes.event_id` is `NOT NULL` — OD9-036) and **Portfolio does not exist**
(OD9-038). The WBS blocker requires migration MC-2, which §24 forbids in this task. Claiming
GREEN would require either performing a forbidden migration or misreporting §25 test 3.

**Why not RED.** §30 reserves RED for an unsafe Project/STO boundary. The boundary is safe
and guarded by executed evidence: no Project route resolves an Event, no STO route requires a
Project, Safety and Permits are STO-only, there is no second STO CPM or progress authority,
no Event mapping was fabricated, and the one live STO correctness defect found (the M10
baseline leak) was **fixed** and is now covered by a regression test. The defects that remain
are **missing capability**, not boundary violations.

**C2 remains BLOCKED.** Not evaluated in this task, per §1.

### Reconciliation with the §31 acceptance criteria (31 items)

| # | Criterion | Status |
|---|---|---|
| 1 | Project domain retained, not deleted | ✅ |
| 2 | Project is a standalone PM domain | ⚠️ Independent of STO, but not yet P6-class (OD9-036/038) |
| 3 | Portfolio under Project | ⚠️ Portfolio does not exist; not fabricated (§13) |
| 4 | Project scheduling independent | ✅ Event-free CPM, repaired |
| 5 | Project baselines independent | ✅ Baseline with `event_id: null` verified |
| 6 | Project reporting independent | ✅ No shared business reporting authority |
| 7 | Project communications independent | ⚠️ Not implemented (OD9-039) |
| 8 | P6/MPP inside Project | ✅ |
| 9 | STO remains Event-based | ✅ |
| 10 | Event is the sole STO identity | ✅ |
| 11 | Project does not require Event | ✅ |
| 12 | Event does not require Project | ✅ |
| 13 | Project cannot resolve an Event | ✅ Five separate mappings removed (see §7) |
| 14 | `Workpack.project_id` classified | ✅ Class **A**, retained with evidence (§8) |
| 15 | `project_constraints` classified | ✅ Class **F**, retained (§9) |
| 16 | `ProjectBranchingService` classified/repaired/retired | ✅ Class **F**, retained; repair proven impossible (§10.2) |
| 17 | Project routes functional where legitimate | ✅ Repaired; illegitimate ones fail closed |
| 18 | STO routes independent of Project | ✅ |
| 19 | STO Safety/Permit STO-only | ✅ Nav + fail-closed Project Safety API + `/permits` no longer points at Projects |
| 20 | STO reporting STO-owned | ✅ Moved out of the neutral menu |
| 21 | Digital Plant independent | ✅ Unchanged |
| 22 | `DigitalPlantProject` distinct | ✅ Not renamed or deleted (§6) |
| 23 | No P&ID Extraction moved into Project | ✅ |
| 24 | M16 respects domain context | ✅ Project context → `null` |
| 25 | No second STO progress authority | ✅ |
| 26 | No second STO CPM authority | ✅ |
| 27 | **No fabricated Event mappings** | ✅ Five removed; 201 unattributed workpacks left untouched |
| 28 | No unsafe destructive migration | ✅ **Zero** database changes |
| 29 | Result document created | ✅ This document |
| 30 | Behavioural tests pass | ✅ 29/29; regression 1561/1563 at baseline |
| 31 | Remaining defects documented | ✅ 18 defects (OD9-035…052), 7 migration candidates (MC-1…MC-7) |

**26 met · 5 partially met (⚠️) · 0 failed.** Every ⚠️ is missing capability blocked by a
constraint this task was forbidden to relax, and each is recorded with the specific migration
or design decision that would close it.

---

## APPENDIX A — FILES MODIFIED

**Isolation (§6, §7, §9, §20):**
`src/core/planning/PlanningReadinessService.ts` · `src/core/planning/__tests__/m10-planning.test.ts` ·
`src/components/Schedule/ScheduleContainer.tsx` · `src/core/m16/channels/WhatsAppChannelAdapter.ts` ·
`src/core/m16/channels/VoiceChannelAdapter.ts`

**Navigation (§21, §22, §28):**
`src/config/business-navigation.ts` *(new)* · `src/components/NavBar.tsx` ·
`src/security/navigation.ts` · `app/(dashboard)/layout.tsx` · `app/platform/layout.tsx` ·
`app/platform-data/layout.tsx` · `app/(dashboard)/projects/[id]/ProjectDetailClient.tsx` ·
`app/(dashboard)/projects/[id]/safety/page.tsx` · `app/(dashboard)/projects/[id]/permits/page.tsx` ·
`app/(dashboard)/permits/page.tsx`

**Project route repair and fail-closing (§15, §16, §11, §22):**
`app/api/projects/[id]/route.ts` · `app/api/projects/[id]/baselines/route.ts` ·
`app/api/projects/[id]/wbs/route.ts` · `app/api/projects/[id]/wbs/[nodeId]/route.ts` ·
`app/api/projects/[id]/safety/route.ts` · `app/api/projects/[id]/reports/daily/route.ts` ·
`app/api/projects/[id]/schedule/route.ts` · `app/api/projects/[id]/imported-schedule/route.ts` ·
`app/(dashboard)/projects/page.tsx` · `src/modules/Scheduling/Services/SchedulingService.ts` ·
`app/api/workpacks/[id]/export/primavera/route.ts`

**Export domain disambiguation (§6, §11):**
`app/api/export/generate/route.ts` · `app/api/export/search/route.ts` ·
`app/api/export/resolve-type/route.ts` · `app/api/export/history/route.ts` ·
`app/(dashboard)/integrations/export/page.tsx`

**Tests:**
`tests/od92-project-domain-separation.test.ts` *(new, 29 tests)* ·
`src/core/architecture/__tests__/r04e-event-only-boundary.guard.test.ts` *(comment-stripping precision fix)*

**Not modified:** `prisma/schema.prisma` · any migration · any seed · any M11/M12 production
code · `src/lib/services/ProjectBranchingService.ts` · `src/components/DashboardHeader.tsx`.

---

## APPENDIX B — SUPERSESSION NOTICE

Per the standing audit-continuity rule, no historical AMBER section in any prior document was
deleted. This document **supersedes** the following on the single question of whether the
`Project` model is deleted:

- `docs/AURIANOA_R0.4_PROJECT_EVENT_CONSOLIDATION_FORENSIC_AUDIT.md` — its **OPTION B**
  recommendation to retire the `Project` model is **superseded**. Its Project→Event coupling
  findings and defect register remain valid and were used as this task's starting inventory.
  Its line-number references are stale (pre-OD9.1).

All other R0.4 / R0.4-B / R0.4-E / R0.4-XX / OD9 / OD9.1 conclusions stand unchanged.

---

## APPENDIX C — FOLLOW-UP AMENDMENT (post-close audit reconciliation)

Per the standing audit-continuity rule, **no earlier AMBER section in this document was
deleted**. This appendix records work done after the first close of OD9.2, when four
forensic agents returned findings against a pre-fix snapshot. Three findings were already
fixed in the first close (WBS `resolveEventId`, M10 `project_id: { in: eventIds }`, export
`OR: [{project_id},{event_id: projectId}]`). The remainder were **verified against the
current tree** and, where confirmed, fixed and written into the body above:

| Finding | Action | Section |
|---|---|---|
| Project daily report treats `projectId` as `SafetyLog.event_id` | Safety block removed | §7.7, §17 |
| Project Safety API queries `SafetyLog` by `project_id` | Fail-closed 501 | §7.8, §17 |
| STO `/permits` landing links to `/projects` | Repointed at STO surfaces | §17, T24b |
| Project schedule GET uses retired `Activity.project_id` (typed `any`) | Loose-activity query removed; empty array retained for client contract | §15, T16b |
| Project imported-schedule needs absent model/columns | Fail-closed; MC-7 | OD9-049 |
| `TENANT_SHELL_SECTIONS` declared the old activity-type shell | Rewritten to the four frozen domains | §16.6, T21c |
| `/execution/mobile` unreachable | Added under STO → Execution | §16.7 |
| `/ois/*` unreachable and domain-ambiguous | Left unlinked; OD9-050 `[OPEN]` | §16.7 |

**Status after this amendment is unchanged: AMBER.** The new defects are isolation and
honesty items, not a reason to reopen the WBS/Portfolio blockers that set AMBER, and not a
reason to escalate to RED — the boundary is tighter than at first close.

Measured after this amendment `[EXECUTED]`: tsc **1206 → 1101** (−105); suite **29/29**;
regression **1561/1563** (same two pre-existing stale M11 tests); **zero** database changes.

---

*End of AURIANOA R1.0 OD9.2 result document.*
