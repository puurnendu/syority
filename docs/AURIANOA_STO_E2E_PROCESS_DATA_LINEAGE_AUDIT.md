# AURIANOA STO — END-TO-END PROCESS & DATA-LINEAGE FORENSIC AUDIT

**Audit type:** READ-ONLY forensic audit. No code, schema, migration, UI, configuration or seed data was modified.
**Scope:** Whole product as one integrated business process — not module-by-module.
**Method:** Primary inspection of `prisma/schema.prisma` (5,694 lines, 212 models), migration SQL, service layer, API routes and UI components, plus four parallel authority sweeps (progress, schedule, execution, propagation) whose severe claims were independently re-verified before inclusion.
**Compiler evidence:** `npx tsc --noEmit` → **1,305 errors**.
**Evidence standard:** every finding cites file and line. Claims I could not prove are marked UNVERIFIED. Documentation and test assertions were treated as claims to be checked, not as evidence.

---

## 1. EXECUTIVE SUMMARY

AURIANOA STO contains a **genuinely excellent execution authority layer** sitting on top of a **broken planning-to-schedule handoff** and a **structurally inadequate time model**, spread across **two parallel product chains**.

The most important finding is not a duplication or a stale copy. It is that **the product's intended happy path does not connect**.

### The single most severe finding

When a workpack is created the intended way — approved scope → instantiate from template — the activities it generates are written **without `event_id`**:

```608:624:src/core/planning/TemplateLibraryService.ts
        await tx.activity.create({
          data: {
            id: actId,
            organization_id: opts.organizationId,
            workpack_id: workpack.id,
            site_id: opts.siteId,
            sequence_number: seqNum,
            description: a.description,
            activity_number: `${workpack.workpack_number}-${seqNum.toString().padStart(4, '0')}`,
            activity_library_id: libraryId,
            duration_hours: a.duration_hours,
            hold_point_type: a.hold_point_type,
            hold_point_description: a.hold_point_description,
            status: 'not_started',
            created_by: opts.userId,
          },
        });
```

No `event_id`. No `asset_id`. No `discipline_id`. No `standard_activity_type_id`.

Every downstream engine filters on that exact column:

| Engine | Filter | Line |
|---|---|---|
| M11 CPM | `event_id: eventId` | `ScheduleOrchestrationService.ts:97` |
| M8.13 event progress | `event_id: eventId` | `ProgressAggregationService.ts:59, 365` |
| Baseline snapshot | `event_id: eventId` | `ScheduleBaselineService.ts:90` |
| Execution board | `whereEvent = { event_id: eventId }` | `FieldExecutionService.ts:107, 228` |

**No backfill script or repair path exists.** The routes that *do* set `event_id` correctly (`/api/activities/bulk`, `/api/workpacks/[id]/activities`, the planning grid) are the *manual* paths. The templated path — the one the Workpack Factory drives — omits it.

**Consequence:** activities produced by the primary business workflow are invisible to CPM, are not baselined, are not counted in event progress, and do not appear on most execution board queries. The planner sees them inside the workpack and nowhere else.

One query in the execution service does it correctly, by traversing the relation instead of the copy — proving the correct pattern is known:

```142:142:src/core/execution/FieldExecutionService.ts
        ...(eventId ? { workpack: { event_id: eventId } } : {}),
```

### What is genuinely good — protect this during remediation

| Area | Finding |
|---|---|
| **M12 execution authority** | Effectively a single writer. `$transaction` over Activity + ProgressLog + AuditLog, **optimistic concurrency** (compare-and-swap on `status`, throws `Execution conflict` if `count !== 1`), workpack status gate, tenant-scoped. `ExecutionWriteService.ts:361-427` |
| **Channel compliance** | Web, mobile, AI, WhatsApp (live webhook), voice, and Excel bulk-upload **all** route through EWS. No live API route writes execution state directly. Schedule-import routes return **410 deprecated**. |
| **M8.13 progress core** | Pure, deterministic, no I/O; documented weighting `Σ(dur×pct)/Σ(dur)`; explicitly disclaims EVM, planning readiness and schedule health. `ProgressCalculationService.ts:1-32, 150-156` |
| **Planning/execution field separation** | Four planning routes **reject execution fields with HTTP 409**. `ActivityService.updateActivity` throws on them. `activities/bulk/route.ts:51-65`, `activities/[id]/route.ts:17-22` |
| **CPM relationship semantics** | All four relationship types **and lag** are correctly implemented in the forward and backward pass. `scheduleEngine.ts:271-278` |
| **Scope→Equipment referencing** | `ScopeItem.asset_id` required non-nullable FK, `@@unique([scope_id, asset_id])`. Equipment is never re-entered. `schema.prisma:3819, 3870` |
| **The correct date rule exists in one UI** | `ActivitiesPanel.tsx:84-85` treats `planned_start`/`planned_end` as `date_ro` — **read-only, derived**. The intended design is known; it is just not applied consistently. |

### The nine structural defects

| # | Finding | Class |
|---|---|---|
| 1 | **Template-created activities have no `event_id`** → invisible to CPM, baseline, event progress, execution | **P0** |
| 2 | **All planned/actual operational dates are `DATE`** — no time-of-day. All four specified time examples unstorable | **P0** |
| 3 | **`planned_start`/`planned_end` have no authority.** CPM writes `early_*` instead; ≥7 writers accept manual dates | **P0** |
| 4 | **CPM ignores working days and holidays** — naive 24-hour arithmetic; `CalendarEngine.addWorkingDays()` exists but is never called | **P0** |
| 5 | **Nothing triggers recalculation** in the Event chain; the worker is not deployed | **P0** |
| 6 | **A fabricated S-curve** is served as actual data (`actualProgress * (i / 14)`) | **P0** |
| 7 | **Execution readiness enforces 3 of 9 dimensions** — material and isolation never gate START | **P0** |
| 8 | **Two parallel product chains**; the legacy one is reachable and **throws at runtime** | **P0** |
| 9 | **Conflicting progress numbers** for the same business fact (duration-weighted vs simple average vs average-of-averages) | **P1** |
| 10 | **16 of 17 emitted domain events have no subscriber** — the bus is live but used only for workpack notifications | **P1** |

### Answer to the governing question

**PARTIALLY — coverage is strong in execution and progress, and broken in planning, time and phase handoff.** Full answer in §28.

---

## 2. ACTUAL END-TO-END PROCESS FLOW

Two chains exist plus an authority layer.

### Chain A — modern Event chain (intended)

```
Plant → Area → Unit → System → Asset (equipment master)
                                 │
                                 ├── ScopeItem.asset_id  [REQUIRED FK ✓]
                                 │      └── ShutdownScope (event_id @unique) — approval at SET level only
                                 │             └── [MANUAL instantiate action required]
                                 │
                                 └── Workpack.asset_id / event_id  [FK ✓]
                                        └── Activity.workpack_id  [FK ✓]
                                               └── event_id  [✗ NULL when template-created]
                                                      ↓
                                        CPM / baseline / progress / execution SILENTLY MISS IT
```

### Chain B — legacy Project chain (reachable, partly broken)

```
Project → Workpack.project_id [FK] → Activity.project_id [NOT an FK]
        → punch_items, project_constraints
        → /api/projects/[id]/*  (28 routes; punch, s-curve, daily report throw at runtime)
```

### Verified structural facts

`Activity` carries both parents and **neither is a foreign key**:

```9:56:prisma/schema.prisma
model Activity {
  id                         String                 @id @db.Uuid
  organization_id            String                 @db.Uuid
  site_id                    String                 @db.Uuid
  workpack_id                String?                @db.Uuid
  event_id                   String?                @db.Uuid
  // ...
  /// Legacy project association (used by old P6/MPP import path; prefer event_id)
  project_id                 String?
  /// Provenance: 'workpack' (native) | 'imported' (legacy P6/MPP) | null
  schedule_source            String?
```

`Activity` declares relations for `workpack`, `organization`, `site`, `discipline` and `standard_activity_type` — but **no `event` relation and no `project` relation**. Both are unconstrained columns. `Workpack`, by contrast, has real FKs to *both* `event` and `project` (`schema.prisma:143, 147`), so one workpack may belong to both parents simultaneously — and those parents carry different date and status vocabularies (§7).

The namespaces are actively conflated. This route will store a **project UUID inside the `event_id` column**:

```74:74:app/api/activities/route.ts
      event_id: body.event_id || body.project_id || null,
```

### Where the intended chain breaks

| Intended link | Implemented? | Evidence |
|---|---|---|
| Equipment → Scope | **YES** — required FK | `schema.prisma:3819` |
| Scope approved → Workpack appears | **Query-driven only**; creation is manual | `WorkpackFactoryService.ts:47-50`; schema: *"never auto-creates workpack"* |
| Workpack → Activity | **YES** — FK | `schema.prisma:62` |
| **Activity → Event** | **BROKEN for templated activities** | `TemplateLibraryService.ts:608-624` |
| Equipment → Activity | **No direct link** — only via `Workpack.asset_id` | no `asset_id` on Activity |
| Planning → CPM-derived dates | **NO** | `ScheduleOrchestrationService.ts:173-190` |
| Workpack issue → activities generated | **NO** — issue only flips status | `WorkflowService.ts:99-115` |
| Execution → schedule feedback | **NO** | EWS never calls CPM |
| Any phase → next via events | **NO** — 16 of 17 event types have no subscriber | `eventSubscribers.ts:13` |

---

## 3. ACTUAL DATA FLOW

Data moves by **query, not propagation**. There is no push mechanism in the product.

Downstream screens appear populated because they query upstream tables by key at render time. Where the FK chain is intact this is sound and is why the product feels integrated. The failure mode is therefore **not stale copies** but **absent derivation and absent denormalisation upkeep**:

- values that must be *computed* (planned dates, aggregate progress, readiness) are not triggered, not persisted, or not consumed
- values that are *denormalised for filtering* (`Activity.event_id`, `ScopeItem.unit_id`) are not reliably populated

Three declared caches exist and are honestly labelled:

| Cached value | Model | Refresh trigger | Staleness risk |
|---|---|---|---|
| `overall_progress` | `Workpack` | Post-transaction in EWS via M8.13 | **Silent** — failure caught and logged only |
| `plant_id`/`unit_id`/`system_id` | `ScopeItem` | Set at insert (`ScopeItemService.addItem:51-53`) | Diverges if asset re-parented |
| `total_items`/`total_estimated_hrs` | `ShutdownScope` | UNVERIFIED | Diverges from `COUNT(items)` |

```418:427:src/core/execution/ExecutionWriteService.ts
    // ── 7. Post-transaction: Workpack sync (cache, not authoritative) ────
    // This is outside the transaction because it's a cache refresh.
    // Failure here does NOT roll back the core execution write.
    if (existing.workpack_id) {
      try {
        await FieldExecutionService.syncWorkpackProgress(orgId, existing.workpack_id);
      } catch (err) {
        console.error('[ExecutionWriteService] Workpack sync failed (non-critical):', err);
      }
    }
```

Defensible — execution truth must not fail on a cache refresh — but `Workpack.overall_progress` can silently drift and nothing detects it. WhatsApp, the portfolio dashboard and report providers read that cache directly. **P2.**

---

## 4. BUSINESS OBJECT LIFECYCLE

### A. Equipment (`Asset`)

Proper master: `@@unique([organization_id, tag_number])`, self-referencing hierarchy, EAV attributes, provenance (`data_source`), controlled `criticality` enum.

**Two competing type representations on one row:**

```462:465:prisma/schema.prisma
  asset_type                                 String?
  /// M8.13 — Normalized equipment type FK (supplements free-text asset_type)
  equipment_type_id                          String?
  equipment_type_rel                         EquipmentType? @relation(fields: [equipment_type_id], references: [id])
```

*"supplements"* means both are live and can disagree. **P1.**

**Two competing status representations on one row:**

```468:471:prisma/schema.prisma
  is_active                                  Boolean?        @default(true)
  /// M8.14-R1 — Controlled lifecycle status (replaces boolean is_active for new code)
  status                                     AssetStatus     @default(draft)
```

An asset can be `is_active = true` and `status = archived`. **P1.**

**Area has no owner.** `Asset` links to plant/unit/system but has **no `area_id`**, though an `Area` model exists. Area is carried as free text in `Asset.plot_area` and as a free-text string on `ScopePackage.area`. **P1.**

### B. Scope Item — the best-modelled object

```3814:3824:prisma/schema.prisma
model ScopeItem {
  id                  String              @id @default(uuid()) @db.Uuid
  organization_id     String              @db.Uuid
  scope_id            String              @db.Uuid
  /// Asset linkage (required — every scope item tied to an asset)
  asset_id            String              @db.Uuid
  /// Hierarchy context (denormalized from asset for fast filtering)
  plant_id            String?             @db.Uuid
  unit_id             String?             @db.Uuid
  system_id           String?             @db.Uuid
```

Required FK, unique per `(scope_id, asset_id)`, no duplication of tag/type/description. This should be the template for the rest of the product.

**Defects:** `discipline` is free text here while `Workpack.discipline_id` and `Activity.discipline_id` are FKs — discipline **cannot propagate across the boundary**. The denormalised hierarchy IDs have no FK relations. There is **no per-item approval field**; approval exists only on `ShutdownScope`, so per-item transition is inexpressible.

### C. Workpack — heavily denormalised

Correct FKs to `asset_id`, `unit_id`, `system_id`, `discipline_id`, `contractor_id`, `work_type_id` — **plus copies of the same facts**:

| Business fact | FK | Duplicate column | Line |
|---|---|---|---|
| Unit | `unit_id` | `unit_code String?` | 90, 98 |
| Work type | `work_type_id` | `work_type String?` | 104-105 |
| Equipment type | via `asset_id` | `equipment_type String?` | 122 |
| Equipment technical data | via `asset_id` | `equipment_technical_data Json?` | 124 |

`equipment_technical_data` is a JSON copy of equipment data with no resync path. **P1.**

**Two competing Workpack↔ScopeItem links in opposite directions:** `Workpack.scope_item_id` (line 135, **no relation declared**) versus `ScopeItem.workpack_id` (line 3863, real FK). A workpack can have `scope_item_id = X` while `scope_items` contains Y. Authority undefined. **P1.**

**Approver identity unverifiable:** `approved_by_name` and `approved_by_email` are free text (lines 130-131) while `created_by`/`updated_by`/`locked_by` are `User` FKs. The one governance-critical identity cannot be joined or revoked. **P1.**

`WorkpackInstantiation` compounds this: `scope_item_id`, `scope_id`, `template_id`, `asset_id`, `event_id` are all indexed UUIDs with **no relations**.

### D. Activity

Three identifiers coexist: `id` (PK), `activity_number` (unique per org), `activity_id` (nullable string, purpose UNVERIFIED). Free-text where masters exist: `responsible`, `work_category`, `manpower_type`, `window`. **No `contractor_id`** — an activity performed by a different contractor than its workpack cannot be represented. **No `asset_id`** — equipment is reachable only transitively. `activity_library_id` is stored with **no relation** to `ActivityLibrary`, so generated activities are **detached copies** of their template rows.

---

## 5. AUTHORITY MATRIX

| Business fact | Declared authority | Actual authority | Verdict |
|---|---|---|---|
| Execution state (`status`, `progress_percent`, `actual_start`, `actual_end`) | M12 EWS | **M12 — genuinely enforced** across all channels | ✅ **HOLDS** |
| Execution progress calculation | M8.13 | **M8.13** — pure, delegated to by Equipment 360, Control Tower, M16, report providers | ✅ **HOLDS** for the core rollup |
| Planning completeness score | `planningProgress.ts` | Same — distinct business fact, explicitly disclaims execution | ✅ **HOLDS** |
| CPM float / critical / `early_*` / `late_*` | M11 | **M11** — sole writer, one engine | ✅ **HOLDS** |
| **`planned_start` / `planned_end`** | implied M11 | **≥7 manual writers; CPM never writes them** | ❌ **NO AUTHORITY** |
| **`Activity.event_id`** | — | **Set by 4 paths, omitted by the primary one** | ❌ **UNRELIABLE** |
| **Planned progress / S-curve / SPI** | implied M8.10 EVM | **6+ independent implementations, one fabricated** | ❌ **CONFLICTING** |
| **Execution readiness** | M12 `ExecutionReadinessService` | M12 — but 3 of 9 dimensions | ⚠️ **NARROW** |
| **Readiness score (stored)** | — | Two models, **contradictory defaults (0 vs 100)** | ❌ **CONFLICTING** |
| **Punch list** | — | Two live models across the two chains | ❌ **CONFLICTING** |
| **Constraints** | — | Four live models; only `ConstraintLog` gates execution | ⚠️ **PARTIAL** |
| **Turnaround start/finish** | `Event` | `Event.planned_start` **and** `Project.planned_sd_date` | ❌ **CONFLICTING** |
| **Equipment type** | `EquipmentType` | FK + `Asset.asset_type` + `Workpack.equipment_type` + UDF string | ❌ **CONFLICTING** |
| **Area** | `Area` | No `area_id` anywhere | ❌ **NO OWNER** |
| **Discipline** | `Discipline` | FK downstream, **free text on ScopeItem / ScopePackage / EngineeringIssue** | ⚠️ **TYPE-SPLIT** |
| **Working calendar** | `ScheduleCalendar` | Only `hours_per_day` consumed; work days and holidays **ignored** | ❌ **NOT CONSUMED** |

---

## 6. DATA-LINEAGE MATRIX

D = Derived, C = Copied, R = Referenced by FK, M = Manual entry.

| Business Fact | First Entry | Authoritative Model | Authoritative Service | Downstream Consumers | D/C/R | Editable Downstream? | Duplicate? | Risk |
|---|---|---|---|---|---|---|---|---|
| Equipment Tag | Asset Register | `Asset.tag_number` | Digital Plant | Scope, Workpack, 360, reports | R | No | `EngineeringIssue.equipment_tag_raw` | P2 |
| Equipment Type | Asset Register | `EquipmentType` | Digital Plant | Workpack, templates, reports | R+**C** | **Yes** | `Asset.asset_type`, `Workpack.equipment_type`, UDF | **P1** |
| Area | Hierarchy | `Area` | — | ScopePackage, UDF | **C text** | **Yes** | `Asset.plot_area`, `ScopePackage.area` | **P1** |
| Unit | Hierarchy | `Unit` | — | Scope, Workpack, Activity | R+**C** | **Yes** | `Workpack.unit_code`, `ScopeItem.unit_id` | **P1** |
| System | Hierarchy | `System` | — | Scope, Workpack | R+**C** | No | `ScopeItem.system_id` (no FK) | P2 |
| Service / Criticality | Asset Register | `Asset` | Digital Plant | Scope, reports | R | No | `System.criticality` (different scale) | P2 |
| Equipment Status | Asset Register | `Asset.status` | Digital Plant | filters | **two fields** | **Yes** | `is_active` | **P1** |
| Scope Description | Scope Builder | `ScopeItem.reason` | `ScopeItemService` | Workpack title | **C** | **Yes** | `Workpack.title`/`scope_of_work` | P2 |
| Recommendation | AI enrichment | `ScopeItem.ai_recommendation` | — | Scope Builder | D | Yes | — | P3 |
| Priority | Scope Builder | `ScopeItem.priority` | — | Workpack | **C** (transformed) | **Yes** | `Workpack.priority` | P2 |
| Discipline | Scope Builder | `Discipline` | — | Workpack, Activity | **text→FK break** | **Yes** | 3 representations | **P1** |
| Responsibility | Planning | `Activity.responsible` | — | Execution | **M text** | Yes | `ScopeItem.requested_by` | P2 |
| Workpack | Factory | `Workpack` | `WorkpackIntelligenceService` | Activities, execution | R | — | bidirectional scope link | **P1** |
| Contractor | Workpack | `Contractor` | — | reports | R+**C** | **Yes** | `ScopePackage.contractor`, UDF | **P1** |
| Activity | Instantiate/grid | `Activity` | `ActivityService` / EWS | all downstream | R | — | — | — |
| Standard Activity | Template | `StandardActivityType` | — | progress grouping | R | No | **not set at instantiate** | **P1** |
| Activity Code | Template | `ActivityLibrary` | — | resources | **C, no FK** | — | detached copy | P2 |
| Duration | Planning | `Activity.duration_hours` | — | CPM, progress weight | **M** | **Yes** | `BaselineActivity.duration` | P2 |
| Calendar | Event setup | `ScheduleCalendar` | `CalendarEngine` | CPM | **NOT CONSUMED** | — | — | **P0** |
| Predecessor / Successor / Lag | Planning | `ActivityRelationship` | CPM | CPM | R | Yes | — | — |
| Lag value | Planning | `lag_days Int` | CPM | CPM | **M, integer days** | Yes | — | **P1** |
| Resource / Material | Planning | `ActivityResource` / `WorkpackMaterial` | — | leveling, readiness | R | Yes | template copies | P2 |
| Constraint | Planning/Execution | `ConstraintLog` | EWS | readiness, Control Tower | R | Yes | 3 other models | **P1** |
| Document | Digital Plant | `AssetDocumentLink` | — | Workpack | R+C | Yes | `WorkpackDocument` | P2 |
| **Planned Start / Finish** | **Planning (manual)** | `Activity.planned_start/end` | **NONE** | every screen, exports, baseline | **M** | **Yes, everywhere** | `early_*`, Workpack, Baseline, Scenario | **P0** |
| Early/Late Start/Finish | CPM | `Activity.early_*/late_*` | M11 | lookahead, S-curve, 360 | **D** | No | — | ✅ |
| **Actual Start / Finish** | Execution | `Activity.actual_start/end` | **M12 EWS** | progress, reports, 360 | **M (field fact)** | No — guarded | `BaselineActivity` clone | ✅ (time truncated) |
| Progress | Execution | `Activity.progress_percent` | M12 write, M8.13 rollup | everything | M + D | No — guarded | `Workpack.overall_progress` cache | ✅ |
| Status | Execution | `Activity.status` | M12 EWS | everything | **M** | No — guarded | scope-change `cancelled` bypass | P2 |
| Hold / Delay | Execution | `status` + `ConstraintLog` | M12 EWS | Control Tower | D | No | — | P2 (no ProgressLog on delay) |
| Remaining Duration | Planning | `Activity.remaining_duration` | — | — | **M** | **Yes** | — | P2 |
| Float / Critical Flag | CPM | `total_float`, `is_critical` | M11 | Gantt, Control Tower | **D** | **Yes via bulk API** | `BaselineActivity` | **P1** |
| Workpack Progress | derived | `Workpack.overall_progress` | M8.13 | WhatsApp, dashboards, reports | **D→cache** | No | — | P2 |
| Event Progress | derived | *(not stored)* | M8.13 | Control Tower, reports | **D** | No | 6 duplicate implementations | **P1** |
| Identical Activity Progress | derived | *(not stored)* | M8.13 | reports | **D** | No | — | ✅ |
| Readiness | Planning/Execution | 5 engines | — | execution gate | D | — | `Workpack` + `WorkpackInstantiation` | **P0/P1** |
| Verification / Closure | Execution | `Activity.status` | M12 EWS | certificates | **M** | No | — | ✅ |
| Report Data | derived | report providers | M14 | reports, OIS | D | — | inline EVM in 3 routes | **P1** |
| Management Recommendation | M15 | `m15_management_decisions` | M15 | Management | D | Yes | — | ✅ |

---

## 7. TIME / DATE LINEAGE — THE CENTRAL STRUCTURAL FAILURE

The stated principle: **ONE TIME ENTRY → AUTOMATICALLY AVAILABLE IN THE NEXT PHASE.** If A finishes 10-Apr-2027 **14:00** and B is FS+0, B starts **14:00**.

**Not achievable, for four independent reasons.**

### 7.1 The columns cannot hold a time of day

36 columns are `@db.Date`. PostgreSQL `DATE` has no time component. Migration SQL confirms the physical type:

```
prisma/migrations/**/migration.sql:255-258
  "planned_start" DATE,
  "planned_end" DATE,
  "actual_start" DATE,
  "actual_end" DATE,
```

Every specified example maps to a date-only column:

| Specified example | Column | Storable? |
|---|---|---|
| TYPE 1 — TA Start **06:00** | `Event.planned_start` | ❌ |
| TYPE 2 — successor start **14:00** | `Activity.planned_start` | ❌ |
| TYPE 3 — START pressed **10:37** | `Activity.actual_start` | ❌ |
| TYPE 4 — Material available **10:00** | `MaterialConstraint.constraint_date` | ❌ |

Affected operational models: `Activity` (25-28), `Event` (1988-1991), `Workpack` (108-109), `EventMilestone` (2043-2044), `MaterialConstraint` (5985, 5992), `MaterialSupplyRecord` (5955-5956), `ScenarioActivityOverride` (5822-5823), `ScheduleScopeChangeItem` (5931-5932), `WorkpackMaterial` (1698), `Constraint` (663-664).

### 7.2 Internal contradiction in granularity

CPM's own output columns **are** timestamps, and duration and float are in **hours**:

```39:52:prisma/schema.prisma
  early_start                DateTime?
  early_finish               DateTime?
  late_start                 DateTime?
  late_finish                DateTime?
  /// CPM total float in HOURS (canonical). UI converts to days via ScheduleCalendar.hours_per_day.
  total_float                Decimal?               @db.Decimal(12, 2)
```

The system reasons in hours and persists planned/actual dates in days. A 6-hour and a 4-hour activity in the same shift are indistinguishable. Lag compounds this — it is stored as **integer days** with a hardcoded 8-hour divisor at the API boundary (`lagHours / 8`), so sub-day lag cannot be expressed:

```235:248:prisma/schema.prisma
  lag_days             Int?     @default(0)
```

Note the inversion: the **legacy** `Project` model *can* store time-of-day (`planned_sd_date DateTime?`, no `@db.Date`); the **modern** `Event` cannot.

### 7.3 CPM does not write the fields the UI uses

`ScheduleOrchestrationService` persists **only** CPM-native columns:

```173:190:src/core/schedule/ScheduleOrchestrationService.ts
    if (persist && result.success) {
      await prisma.$transaction(
        result.activities.map((act) =>
          prisma.activity.update({
            where: { id: act.id },
            data: {
              early_start: act.early_start ? new Date(act.early_start) : null,
              early_finish: act.early_finish ? new Date(act.early_finish) : null,
              late_start: act.late_start ? new Date(act.late_start) : null,
              late_finish: act.late_finish ? new Date(act.late_finish) : null,
              total_float: act.total_float_hours,
              free_float: act.free_float_days * calendar.getHoursPerDay(),
              is_critical: act.is_critical,
            },
          })
        )
      );
    }
```

`planned_start`/`planned_end` are absent. CPM *reads* them as an anchor for activities with no predecessors and never writes them back:

```252:262:src/lib/scheduleEngine.ts
      // Activity with no predecessors: starts at day offset 0 (or its planned_start diff)
      const act = activityMap.get(id)!;
      let startOffset = 0;
      if (act.planned_start) {
```

FS logic is computed correctly — into the wrong destination:

```271:278:src/lib/scheduleEngine.ts
      if (type === 'FS') {
        candidateES = predEF + lag;
      } else if (type === 'SS') {
        candidateES = predES + lag;
      } else if (type === 'FF') {
        candidateES = predEF + lag - dur;
      } else if (type === 'SF') {
        candidateES = predES + lag - dur;
      }
```

**Seven writers set `planned_start` from user input:**

| Writer | Source | Line |
|---|---|---|
| `POST /api/activities` | `body.planned_start` | 77 |
| `POST /api/activities/bulk` | `item.planned_start` | 91, 104, 133 |
| `PUT /api/projects/[id]/schedule/activities/[activityId]` | `body.planned_start` | 60-66 |
| `POST /api/projects/[id]/schedule/activities` | `body.planned_start \|\| new Date()` — **fabricates today** | 40 |
| `POST /api/planner-workspace/batch-update` | grid cell | `PlannerWorkspaceService.ts:493-496` |
| `ResourceLevelingApplyService` | leveling proposal | 121-122 |
| `ScheduleChangeControlService`, `ScopeChangeApplicationService` | change payload | 271-273 / 128-144 |

The planning grid explicitly truncates to date:

```102:102:src/components/planning/ActivityPlanningGrid.tsx
        planned_start: a.planned_start ? String(a.planned_start).slice(0, 10) : '',
```

**The correct rule already exists in one UI** — `ActivitiesPanel.tsx:84-85` marks these fields `date_ro` (read-only, derived). Two other UIs (`ActivityPlanningGrid`, `ScheduleContainer`) allow direct editing. The design intent is known and inconsistently applied.

### 7.4 CPM ignores the working calendar

The engine advances dates with naive 24-hour arithmetic:

```96:99:src/lib/scheduleEngine.ts
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setTime(result.getTime() + days * 24 * 60 * 60 * 1000);
  return result;
```

`ScheduleOrchestrationService.loadCalendar()` loads `work_days`, `hours_per_day` and `exceptions` into a `CalendarEngine` — but **only `getHoursPerDay()` is consumed**. A correct working-day function exists and is **never called**:

```36:44:src/lib/CalendarEngine.ts
  addWorkingDays(start: Date, days: number): Date {
    const result = new Date(start);
    let remaining = Math.abs(days);
    const direction = days >= 0 ? 1 : -1;
    while (remaining > 0) {
      result.setDate(result.getDate() + direction);
      if (this.isWorkingDay(result)) remaining--;
    }
    return result;
  }
```

**Consequence:** CPM schedules straight through weekends, holidays and shift patterns. Every derived date after the first non-working day is wrong. **P0.**

Related dead integration: `MaterialScheduleIntegrationService` is documented to adjust `planned_start` for material ETAs *before* CPM runs, but is **never imported by the orchestration service** — only re-exported from `materials/index.ts`. This is why material constraints influence neither the schedule nor readiness.

### 7.5 Two disagreeing planned dates per activity

| Representation | Written by | Type | Displayed in |
|---|---|---|---|
| `planned_start`/`planned_end` | **the user** | date-only | Planning grid, Workpack, Equipment 360, exports, baseline |
| `early_start`/`early_finish` | **M11 CPM** | timestamp | Lookahead, S-curve planned line, Equipment 360 |

Both persist and are never reconciled. Equipment 360 selects **both sets** (`app/api/assets/[assetId]/360/route.ts:140-151`), exposing the contradiction on one screen.

### 7.6 Time propagation classification

| Field | Intended | Actual | Correct? |
|---|---|---|---|
| `Event.planned_start` | TYPE 1 | TYPE 1, time truncated | ⚠️ |
| **`Activity.planned_start/end`** | **TYPE 2 derived** | **TYPE 1 manual** | ❌ **Type 2 requested as Type 1** |
| `Activity.early_*/late_*` | TYPE 2 | TYPE 2 — correct but unused by planning UI, and calendar-blind | ⚠️ |
| `Activity.actual_start/end` | TYPE 3 | TYPE 3 via EWS, time truncated | ⚠️ |
| `MaterialConstraint.constraint_date` | TYPE 4 | TYPE 4, truncated, **never consumed** | ❌ |
| Manual override of a derived value | TYPE 5, audited | **Not modelled** — no flag, no original, no reason | ❌ |

### 7.7 What happens when an upstream value changes

**Nothing, in the modern chain.** Five independent breaks:

**Break 1 — recalculation is only enqueued for the legacy chain:**

```14:33:src/modules/Activity/Services/ActivityService.ts
async function enqueueRecalculate(workpackId: string | null | undefined, orgId: string) {
  if (!workpackId) return;

  const workpack = await prisma.workpack.findUnique({
    where: { id: workpackId },
    select: { project_id: true },
  });

  if (!workpack?.project_id) return; // activity not tied to a project — skip
```

For an Event-chain workpack, `project_id` is null and it **returns without enqueueing**.

**Break 2 — the worker is not deployed.** It is correctly written and even resolves `projectId → eventId` (`scheduleRecalculateWorker.ts:33-38`), but nothing starts it: `package.json` has `"worker": "tsx src/workers/index.ts"` as a manual script, `Dockerfile` runs `CMD ["node", "server.js"]`, and `deploy` is `prisma migrate deploy && npx prisma db seed && next start`.

**Break 3 — adding a predecessor triggers nothing.** `predecessors/route.ts` creates the relationship with no call to `calculateEventSchedule` or the queue. The single most schedule-relevant edit a planner can make does not recalculate.

**Break 4 — execution never feeds back.** EWS declares it *"never touches schedule fields"* (`ExecutionWriteService.ts:25`); no CPM call exists in the execution path. An activity finishing late updates no successor.

**Break 5 — the primary write paths bypass the enqueue.** Only `app/api/workpacks/[id]/activities/**` uses `ActivityService`. `/api/activities` and `/api/activities/bulk` write Prisma directly, so they get neither the enqueue nor an audit log.

The only paths that do recalculate: the manual "Recalculate CPM" button, Gantt page load, `POST /api/projects/[id]/schedule`, one legacy PUT route, and resource-leveling apply.

---

## 8. PHASE-TO-PHASE PROPAGATION MATRIX

| Transition | Automatic? | Carried by FK | Copied | Re-entered | Missing propagation |
|---|---|---|---|---|---|
| Digital Plant → Scope | Manual add; asset picked by ID | `asset_id` | plant/unit/system IDs (no FK) | `reason`, priority, discipline (text) | Area has no owner |
| Scope → Workpack | **Explicit instantiate action** | `asset_id`, `event_id`, bidirectional scope link | title, priority, activities, materials, resources, certificates | template choice, optional title | `Workpack.scope_item_id` orphan; `/workpacks/new` bypasses scope entirely |
| Workpack → Activities | At **instantiate**, not at issue | `workpack_id` | description, duration, hold points | manual grid rows | **`event_id`, `asset_id`, `discipline_id`, `standard_activity_type_id` all omitted** |
| Workpack issue → field | Status flip only | — | — | — | Emits `WorkpackIssuedToField` to a bus with no subscribers |
| Activities → Planning | Query on `event_id` | — | — | grid edits | **Templated activities missing** |
| Planning → Schedule | Query on `event_id` | duration, logic, calendar | CPM → `early_*` | — | **Derived dates never written to `planned_*`**; calendar ignored |
| Schedule → Execution | Query + `workpack.status ∈ {issued, in_execution}` | activity set | — | — | 6 of 9 readiness dimensions unenforced |
| Execution → Progress | **Yes** — EWS → ProgressLog → M8.13 | all | workpack cache | — | Cache may fail silently |
| Progress → Control Tower | **Yes** | all | — | — | Lookahead recomputes progress inline |
| Execution → Schedule | **NO** | — | — | — | No reschedule on actuals |
| Data → Reports | **Partial** — providers delegate; 3 routes inline their own EVM | — | — | — | See §12 |
| Data → AI/WhatsApp/Mobile | **Yes** | all | — | — | — |

### The §22 automatic-appearance requirement

**The event mechanism exists, is wired, and is used for one thing only.**

`registerEventSubscribers` is invoked at server startup through the Next.js instrumentation hook, so the bus is genuinely live in production:

```27:28:src/instrumentation.ts
        const { registerEventSubscribers } = await import('@/lib/eventSubscribers');
        registerEventSubscribers(eventBus);
```

But it registers exactly **one** handler, and that handler sends **notifications** — it propagates no business state:

```13:13:src/lib/eventSubscribers.ts
    bus.on('WorkflowTransitioned', async (data) => {
```

**17 distinct event types are emitted. Exactly 1 is subscribed.** The 16 with no consumer include every execution event and every handoff event:

`ActivityStarted` · `ActivityCompleted` · `ActivityProgressUpdated` · `ActivityHeld` · `ActivityResumed` · `ActivityReleased` · `ActivityVerified` · `ActivityClosed` · `ExecutionDelayReported` · `activity.approved_for_scheduling` · `WorkpackIssuedToField` · `WorkpackCreated` · `workpack.approved` · `form.submitted` · `qa.clearance_created` · `qa.clearance_deleted`

(The apparent second subscription to `workpack.approved` is the usage example in `eventBus.ts:14`, not a handler.)

So no event triggers CPM recalculation, cache refresh, or phase propagation. **This is good news for remediation:** the bus does not need building, only handlers — the P0-5 recalculation trigger has a working delivery mechanism already registered at startup.

What substitutes today is **query-driven appearance**: downstream screens filter upstream tables by status. This satisfies the requirement's intent where the key chain is intact — and fails silently where the denormalised key (`Activity.event_id`) is unpopulated.

The Workpack Factory is a good example of the pattern working:

```47:50:src/core/workpack-factory/WorkpackFactoryService.ts
    const scopeWhere: any = {
      organization_id: orgId,
      deleted_at: null,
      status: { in: ['approved', 'frozen'] },
```

Approved scope items with `workpack_id IS NULL` appear in the factory queue automatically, and the factory pre-fills tag, asset name, type, unit, system, reason, discipline and priority as **read-only** — the user types nothing but the template choice. **This is the product's best propagation surface and should be the model for the others.**

---

## 9. DUPLICATE ENTRY FINDINGS

| # | Duplicated fact | Where twice | Intentional? | Diverge? | Should own |
|---|---|---|---|---|---|
| 1 | Equipment type | `Asset.asset_type` + `equipment_type_id` + `Workpack.equipment_type` + UDF | No — *"supplements"* | **Yes** | `EquipmentType` FK |
| 2 | Equipment status | `Asset.is_active` + `status` | Incomplete migration | **Yes** | `Asset.status` |
| 3 | Equipment technical data | `Asset.*` + `Workpack.equipment_technical_data` JSON | No | **Yes** | `Asset` |
| 4 | Unit | `Workpack.unit_id` + `unit_code` | No | **Yes** | `Unit` FK |
| 5 | Work type | `Workpack.work_type_id` + `work_type` | No | **Yes** | `WorkType` FK |
| 6 | Discipline | `ScopeItem.discipline` / `ScopePackage.discipline` / `EngineeringIssue.discipline` text vs FK downstream | No | **Yes** | `Discipline` FK |
| 7 | Area | `Area` model + `Asset.plot_area` + `ScopePackage.area` | No | **Yes** | new `area_id` FK |
| 8 | Contractor | `Workpack.contractor_id` + `ScopePackage.contractor` text + UDF | No | **Yes** | `Contractor` FK |
| 9 | Scope↔Workpack link | `Workpack.scope_item_id` (no FK) + `ScopeItem.workpack_id` (FK) | No | **Yes** | `ScopeItem.workpack_id` |
| 10 | Planned dates | `planned_start` manual vs `early_start` CPM | No | **Already do** | M11 |
| 11 | Turnaround dates | `Event.planned_start` vs `Project.planned_sd_date` | Legacy | **Yes** | `Event` |
| 12 | Readiness score | `Workpack` (default 0) + `WorkpackInstantiation` (compliance default **100**) | No | **Guaranteed** | one store |
| 13 | Approver | free-text name/email vs `User` FK elsewhere | No | **Yes** | `User` FK |
| 14 | Equipment dimensions in planner workspace | UDF **string copies** (`dimVals['UNIT']`, `['EQUIPMENT']`, `['AREA']`…) not live Asset FKs | Performance | **Yes** | Asset FK |

### `ProgressLog` — duplicate columns inside one model

```180:198:prisma/schema.prisma
model ProgressLog {
  id               String    @id @db.Uuid
  activity_id      String    @db.Uuid
  log_date         DateTime
  progress_percent Decimal
  manhours_actual  Decimal?
  logged_by        String?   @db.Uuid
  remarks          String?
  created_at       DateTime  @default(now())
  organization_id  String?   @db.Uuid
  recorded_at      DateTime? @default(now())
  data_date        DateTime?
  percent_complete Float?
  actual_cost      Float?
  recorded_by      String?   @db.Uuid
```

Two progress fields, two author fields, two cost fields, four timestamps — two development eras writing one table. **Mitigated:** EWS is the sole production writer and defensively populates both halves of each pair it uses (`ExecutionWriteService.ts:388-393`). `percent_complete` is never written — an orphan column. Severity **P2**, contingent on EWS remaining sole writer. `organization_id` is **nullable** here. **P2 defence-in-depth.**

---

## 10. DUPLICATE DATABASE FINDINGS

### Punch list — two live registers split across the chains

| | `PunchListItem` (1197) | `punch_items` (2405) |
|---|---|---|
| Key | UUID | plain String |
| Tenant column | `organization_id` **required** | **none** |
| Parent | `workpack_id` **required FK** | `project_id`, `workpack_id` nullable, no FK |
| Category/status | enums | free text, default `"Open"` |
| Identity | UUID FKs | free text |
| Live uses | **23** | **5** (legacy chain only) |

**Operational consequence.** `JobCompletionService.validateCompletion` counts punch **only** from `PunchListItem`:

```19:24:src/modules/certificates/services/JobCompletionService.ts
        const [incompleteActivities, openCatA, totalPunchB, totalPunchC] = await Promise.all([
            prisma.activity.count({ where: { workpack_id: workpackId, NOT: { status: 'completed' } } }),
            prisma.punchListItem.count({ where: { workpack_id: workpackId, category: 'A', NOT: { status: 'closed' } } }),
```

`punch_items.workpack_id` exists, so a Category-A punch in the legacy register **does not block issuance of a Job Completion Certificate**. **P0.** Also `_orgId` is accepted and unused, so counts are not org-scoped inside the service. **P2.**

### Lessons learned — two live registers

`LessonLearned` (2244, `@@map("lessons_learned")`, 18 uses, has the `is_in_central_register` flag) versus `lessons_learnt` (2270, no relations, 3 uses via `LessonsLearntService`). Lessons captured through the latter are **invisible to the central register and closure reports**. **P1.**

### Constraints — four live models

| Model | Line | Uses | Gates execution? |
|---|---|---|---|
| `ConstraintLog` | 1878 | 39 | **Yes — the only one** |
| `Constraint` | 651 | 17 | No |
| `project_constraints` | 2376 | 3 | No |
| `MaterialConstraint` | 5976 | 3 | No |

Verified correct: `EWS.createDelayConstraint` writes to `prisma.constraintLog` (line 478) — the same model readiness reads — so a critical delay does correctly block execution. Constraints in the other three have **no effect**.

### Stale schema files

Seven unused schema files in `prisma/`: `schema_clean_download.prisma` and `schema_server_105kb.prisma` (both 102.8 KB, apparently identical), `schema_part1-5.prisma`, `test.prisma`. Only `prisma/schema.prisma` is active. Risk: editing the wrong file. **P3.**

---

## 11. DUPLICATE API / SERVICE FINDINGS

**28 routes** under `app/api/projects/**`, **69** under `app/api/events/**`; 13 and 12 UI pages. Features built twice:

| Feature | Project chain | Event chain |
|---|---|---|
| Daily report | `reports/daily` **and** `daily-report/generate` | `events/[eventId]/reports/daily` |
| Baselines | `baseline` **and** `baselines` | `schedule/baselines` |
| S-curve | `s-curve` | `schedule/evm/s-curve` |
| Safety | `safety` | `safety` + `incidents` + `photos` |
| Constraints | `constraints` | `schedule/constraints` |
| WBS | `wbs` | `wbs` + `wbs/generate` |
| Resource histogram | `resource-histogram` | `resource-loading`, `resource-heatmap` |
| Schedule metrics | `schedule/metrics` | `schedule/health`, `variance` |
| Punch | `punch` → `punch_items` | `workpacks/[id]/punch-list` → `PunchListItem` |
| Activity write | `schedule/activities` | `/api/activities` |

Two *intra-chain* duplicates: `baseline`/`baselines` and `reports/daily`/`daily-report/generate`.

### The legacy chain throws at runtime

The duplicate is dead on arrival — camelCase against snake_case models:

```
app/api/projects/[id]/punch/route.ts(13,29): error TS2561: 'orgId' does not exist in type 'ProjectWhereInput'. Did you mean 'org_id'?
app/api/projects/[id]/punch/route.ts(21,16): error TS2561: 'projectId' does not exist in type 'punch_itemsWhereInput'. Did you mean 'project_id'?
app/api/projects/[id]/s-curve/route.ts(58,17): error TS2561: 'plannedSdDate' does not exist in type 'ProjectSelect'
app/api/projects/[id]/s-curve/route.ts(130,16): error TS2561: 'activityId' does not exist in type 'ProgressLogWhereInput'
```

Prisma validates arguments at runtime and throws `PrismaClientValidationError`, so these return 500. Error counts: punch 17, `reports/daily` 16, `s-curve` 15. Masked by `next.config.ts` → `typescript: { ignoreBuildErrors: true }`.

In the punch route the *tenant check itself* is malformed (`orgId` vs `org_id`), so it throws before querying — it **fails closed**. No cross-tenant leak; the endpoint is simply unusable.

### The legacy chain is still reachable

`/punch`, `/permits` and `/imported-schedule` link to `/projects`, and these components call the legacy API: `ScheduleContainer` (**6**), `MaintainBaselinesModal` (4), `WbsView` (4), `AssignBaselinesModal` (2), **two duplicate `SCurveChart` components** (1 each), `AIAssistantPanel` (1).

`ScheduleContainer` — the principal schedule UI — branches on `projectId`:

```915:915:src/components/Schedule/ScheduleContainer.tsx
      const url = projectId ? `/api/projects/${projectId}/schedule/activities` : `/api/activities`;
```

Two write paths for one business object with different behaviour: the legacy one defaults `planned_start` to `new Date()` and triggers CPM; the modern one does neither.

Positively: legacy MS Project / P6 import routes now return **410 deprecated**, and the deprecated `SchedulingService` CPM has **zero callers**.

---

## 12. DUPLICATE CALCULATION FINDINGS

### Authoritative and correct

| Calculation | Location | Class |
|---|---|---|
| Weighted execution progress + all dimension rollups | `ProgressCalculationService.ts` | **AUTHORITATIVE** |
| DB aggregation / identical-activity intelligence | `ProgressAggregationService.ts` | **AUTHORITATIVE** |
| CPM forward/backward pass, float, critical path | `scheduleEngine.ts` via `ScheduleOrchestrationService` | **AUTHORITATIVE** |
| Execution mutations | `ExecutionWriteService.ts` | **AUTHORITATIVE** |
| Planning completeness | `planningProgress.ts` | **Distinct fact, not a duplicate** |
| EVM cost/schedule performance | `EvmCalculationService`, `EvmSnapshotService` (M8.10) | **Separate domain by design** |
| Equipment 360, Control Tower summary, M16 read tools, report providers | delegate to M8.13 | **ADAPTER** ✅ |

### Confirmed duplicates — conflicting numbers for the same fact

| # | Location | What it recomputes | Why it conflicts |
|---|---|---|---|
| 1 | `projects/[id]/activities/unit-progress/route.ts:65` | Per-unit actual progress as a **simple average** | M8.13 `byUnit` is **duration-weighted** — two different numbers for "unit progress" |
| 2 | `report-engine/providers/ShutdownProviders.ts:172, 214, 256` | Multi-event unit/contractor/discipline progress as **average of per-event M8.13 averages** | Mathematically wrong when events differ in size — an average of averages |
| 3 | `control-tower/ControlTowerQueryService.ts:276, 291` | Lookahead earned duration and actual % inline | Parallel formula outside M8.13 |
| 4 | `reporting/dashboard-data/route.ts:59, 74, 126` | Org-wide BCWP, SPI, CPI, and unit progress by WBS prefix (simple average) | Inline EVM outside M8.10; third unit-progress formula |
| 5 | `projects/[id]/s-curve/route.ts:194, 218, 274` | Full independent BCWS/BCWP/SPI/CPI curve | Uses neither M8.13 nor `EvmCalculationService` — **and throws at runtime** |
| 6 | `projects/[id]/schedule/metrics/route.ts:75, 76, 103` | Planned progress, execution SPI, planned S-curve | Actual comes from M8.13; the rest is independent |
| 7 | `ScheduleOrchestrationService.ts:326, 334` | Planned and actual S-curve percentages | Progress maths inside the schedule service |
| 8 | `ScheduleContainer.tsx:616`, `WbsView.tsx:89` | Client-side WBS rollups | Parallel formulas in the browser |

### DANGEROUS — fabricated data served as fact

```106:106:app/api/projects/[id]/schedule/metrics/route.ts
        actualProgress * (i / 14)
```

The "actual" S-curve series is **synthesised by linear extrapolation** from a single current value. This is not a calculation error; it is invented history presented to management as measured progress. Under the stated risk rubric — *"major false information"* — this is **P0**.

### Obsolete

`SchedulingService.generateSCurveData` (identical formula, `@deprecated`, zero callers), `src/components/ta-dashboard.tsx` (199 type errors, unreferenced).

**Verdict:** M8.13 is a real single authority for the **core weighted execution rollup**. It is *not* a single authority for planned progress, S-curves, SPI, or unit-level aggregates, where at least six independent implementations disagree.

---

## 13. UI WORKFLOW FINDINGS

| Screen | System already knows | User must still enter | Verdict |
|---|---|---|---|
| **Asset Register → new** | site | tag, name, type — **canonical entry point** | ✅ Correct |
| **Scope Builder** | asset tag/name/type from hierarchy; issues by join | selection only; `reason` auto-generated | ✅ **Best-practice** |
| **Workpack Factory** | tag, name, type, unit, system, reason, discipline, priority — all **read-only** | template confirmation only | ✅ **Best-practice** |
| **Instantiate page** | scope item passed by ID | template choice, optional title | ✅ Good |
| **`/workpacks/new`** | cascading hierarchy dropdowns | **entire context re-selected**; title, scope of work, SAP fields, dates, manhours, discipline, equipment type, priority, work type — **no `scope_item_id` link at all** | ❌ **Bypasses scope entirely** |
| **Activity Planning Grid** | nothing pre-filled from upstream | description, wbs, discipline, duration, **dates**, responsible, notes | ❌ **Full manual entry; dates editable** |
| **Workpack Activities Panel** | all | — | ✅ **`planned_start`/`planned_end` are `date_ro`** |
| **Schedule Container** | all | inline-editable `planned_start`/`planned_end` | ❌ **Contradicts the panel above** |
| **Planner Workspace detail** | shows Unit/System/Equipment/Area/Contractor from **UDF string copies**, not live FKs | read-only | ⚠️ Copies can be stale |
| **Equipment 360** | full chain incl. both date representations | — | ⚠️ Exposes the contradiction |

**Screens representing the same object in different places:** Activity appears in Planning Grid, Activities Panel, Schedule Container, Planner Workspace, Execution Cockpit and Mobile Execution — with **three different date-editability rules** across them.

---

## 14. EQUIPMENT 360 FINDINGS

`app/api/assets/[assetId]/360/route.ts` traverses Asset → Workpack (`asset_id`) → Activity (`workpack_id`) → ProgressLog, tenant-isolated at each level, and **correctly delegates progress to M8.13** (`ProgressAggregationService.getWorkpackProgress`, line 191).

Chain breaks:

1. **Activities are reached only through `Workpack.asset_id`.** An activity whose workpack has a null `asset_id` is invisible.
2. **Multi-equipment workpacks** carry one `asset_id`; other equipment on the same workpack shows nothing.
3. **No `Activity.asset_id`**, so equipment attribution is always transitive.
4. M8.13 is called in a **per-workpack loop** (N+1).
5. Both `planned_*` and `early_*` are returned, surfacing the date contradiction.

---

## 15. WORKPACK FLOW FINDINGS

Workpack → Scope → Equipment → Activities holds by FK. The breaks:

1. Creation requires an **explicit instantiate action**; approval alone does nothing.
2. `/workpacks/new` creates workpacks with **no scope linkage**.
3. **Issue does not generate activities** — it only transitions status and emits to a bus with no subscribers.
4. Activities generated at instantiate **lack `event_id`**, so the workpack's activities do not reach schedule or execution.
5. Readiness and compliance scores are stored on two models with contradictory defaults.

---

## 16. ACTIVITY FLOW FINDINGS — AUTHORITATIVE OWNER PER FIELD

| Field | Owner | Notes |
|---|---|---|
| Activity ID / Name | `Activity` | three identifiers coexist |
| Equipment | **none directly** | transitive via workpack |
| Workpack | `Activity.workpack_id` | ✅ FK |
| Event | `Activity.event_id` | ❌ **not set at instantiate** |
| Standard Activity | `StandardActivityType` | ❌ not set at instantiate |
| Discipline | `Discipline` | ❌ not set at instantiate |
| Contractor | **not modelled on Activity** | workpack only |
| Duration | `Activity.duration_hours` | manual |
| Calendar | `ScheduleCalendar` | ❌ not consumed by CPM |
| Predecessor/Successor | `ActivityRelationship` | ✅; lag integer days |
| Planned Start/Finish | **no owner** | manual, 7 writers |
| Actual Start/Finish | **M12 EWS** | ✅ guarded |
| Progress | **M12 write / M8.13 rollup** | ✅ guarded |
| Status | **M12 EWS** | ✅ except scope-change `cancelled` |
| Constraint / Hold / Delay | `ConstraintLog` via EWS | delay has no ProgressLog |
| Verification / Closure | `Activity.status` via EWS | ✅ |

---

## 17. PROGRESS AUTHORITY FINDINGS

M8.13 owns the weighted execution rollup and is widely and correctly consumed. Progress is **not** stored on `ScopeItem`, `Asset`, `Event`, `System`, `Unit`, `Area` or `WbsNode` — a genuinely good normalisation outcome.

Stored progress columns:

| Column | Written by | Read by | Stale risk |
|---|---|---|---|
| `Activity.progress_percent` | **EWS only** | M8.13 input, everything | Source fact — sound |
| `Workpack.overall_progress` | M8.13-delegated sync | WhatsApp, portfolio UI, report providers, M16 | **Yes — silent** |
| `ProgressLog.progress_percent` | EWS, in transaction | history, legacy s-curve | History fact — sound |
| `ProgressLog.percent_complete` | **never written** | — | Orphan |
| `BaselineActivity.progress_percent` | baseline snapshot | comparisons | By design |

Six duplicate implementations of planned progress / S-curve / SPI / unit progress are listed in §12, including one that fabricates data.

---

## 18. SCHEDULE AUTHORITY FINDINGS

One CPM engine, correctly implemented for relationship semantics and lag, orchestrated event-scoped, persisting float in canonical hours. That part is sound.

The failures are all at the boundaries:
- writes `early_*`, not `planned_*` (§7.3)
- ignores working days and holidays (§7.4)
- reads `planned_start` as an anchor, creating a circular dependency on a manually-typed value
- `is_critical` and `total_float` — CPM outputs — are **writable by the bulk planning API** (`activities/bulk/route.ts:104-105`), so a user can assert a critical flag CPM did not derive. **P1.**
- `MaterialScheduleIntegrationService` is documented as a pre-CPM adjustment step and is never called
- scenario CPM results stay in `snapshot_json`, correctly isolated from live rows

---

## 19. DUPLICATION COUNTS BY CATEGORY

Factual counts, not optimised for a low number.

| Category | Count | Detail |
|---|---|---|
| **A. Duplicate UI entry** | **14** | §9 table |
| **B. Duplicate database fields** | **~24** | 14 cross-model + 10 intra-model (`ProgressLog` ×8, `Asset` ×4) |
| **C. Duplicate APIs** | **12** | 10 cross-chain + 2 intra-chain |
| **D. Duplicate services** | **3** | `SchedulingService` (obsolete), `LessonsLearntService`, two S-curve generators |
| **E. Duplicate calculations** | **8** | §12 |
| **F. Duplicate status engines** | **1** | Only EWS transitions `Activity.status`; scope-change `cancelled` is the sole exception ✅ |
| **G. Duplicate date/time calculations** | **4** | CPM `early_*` vs manual `planned_*`; scenario overrides; client-side `planned_end` derivation in the grid; baseline snapshot |
| **H. Duplicate dashboards** | **4** | 2 `SCurveChart`, portfolio vs reporting dashboard-data, TA dashboard vs Control Tower |
| **I. Duplicate report logic** | **3** | `ShutdownProviders` multi-event averaging, `reporting/dashboard-data` inline EVM, legacy s-curve |
| **J. Duplicate workflow/state machines** | **1** | Workpack `WorkflowService` vs Activity EWS state machine — different objects, no conflict ✅ |
| **K. Duplicate business objects** | **4** | punch ×2, lessons ×2, constraints ×4, containers (`Project`/`Event`/`DigitalPlantProject`) |
| **L. Disconnected navigation** | **6+** | `/projects` chain reachable from `/punch`, `/permits`, `/imported-schedule`; legacy components; per the prior UI audit, orphaned routes remain |

---

## 20. AI / WHATSAPP / MOBILE FINDINGS

**These are correctly built as interaction channels, not alternative engines.** This is the strongest part of the product.

```1:26:src/core/m16/tools/writeTools.ts
/**
 * M16-R3 — Write Tool Implementations
 *
 * Every write tool delegates to ExecutionWriteService.applyAction().
 * M16 NEVER calls prisma.activity.update() directly.
 * ...
 * DOES NOT:
 *   - prisma.activity.update/create/delete
 *   - Calculate progress (EWS delegates to M8.13)
 *   - Calculate CPM
 */
```

Verified: 9 write tools all route through `executeViaEWS`; no direct Prisma mutation in `writeTools.ts`. Voice → `VoiceChannelAdapter` → M16 pipeline → writeTools → EWS. Live WhatsApp webhook → `WhatsAppChannelAdapter` → pipeline → EWS. Planner approval of a WhatsApp update → EWS `UPDATE_PROGRESS`. Mobile → `MobileChannelAdapter` → EWS with risk classification. AI does **not** calculate progress or schedule.

Two real defects:

**1. Mobile idempotency is not durable.** High-risk actions require a `requestId`, but deduplication is an **in-memory `Map` with a 5-minute TTL inside the adapter**, and the ID is **never passed to EWS**:

```92:95:src/core/m16/channels/MobileChannelAdapter.ts
const idempotencyStore = new Map<string, CachedExecution>();
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL
```

```243:257:src/core/m16/channels/MobileChannelAdapter.ts
    const result = await ExecutionWriteService.applyAction(
      session.organizationId,
      session.userId,
      {
        activityId: request.activityId,
        action: request.action,
        // ... no requestId passed
```

A retry from a different replica, after a restart, or past the TTL **executes twice**. The optimistic status lock absorbs duplicate *transitions* (the second fails the CAS), but a repeated `UPDATE_PROGRESS` — same expected status — will apply twice. **P1 for field data integrity.**

**2. Legacy WhatsApp code is misleading.** `MessageProcessor.applyProgressUpdate` is a disabled stub returning an error (lines 293-303) yet still labels records `status: 'auto_updated'` (line 401). It is not wired to the live webhook. **P3**, but it is exactly the kind of dead path that misleads the next reader — and it did mislead a prior audit document (§29).

---

## 21. CURRENT VS TARGET ARCHITECTURE

| Dimension | Current | Target |
|---|---|---|
| Containers | `Project` + `Event` + `DigitalPlantProject` | **`Event` only** |
| Activity→Event | unenforced column, unset at instantiate | **FK, always populated** |
| Planned dates | manual `planned_*` + CPM `early_*` | **single CPM-derived set, `timestamptz`** |
| Time granularity | `DATE` | **`timestamptz`**, lag in minutes/hours |
| Calendar | `hours_per_day` only | **work days + holidays honoured** |
| Recalculation | manual button; queue skips event chain; worker undeployed | **automatic on any schedule-relevant change; worker deployed** |
| Propagation | query-driven; bus live but notifications-only | **query-driven + the existing bus extended to cache/recalc** |
| Progress | M8.13 core sound; 6 rival planned/S-curve implementations | **M8.13 + M8.10 only** |
| Readiness | 5 engines, 3 of 9 enforced | **one aggregator consuming all nine** |
| Execution | ✅ single authority | **unchanged — protect it** |
| Punch / lessons / constraints | 2 / 2 / 4 models | **1 / 1 / 2** (register + material) |
| Override | not modelled | **explicit, audited, preserves derived value** |

---

## 22. CORRECTED END-TO-END PROCESS

1. **Digital Plant** owns equipment truth. Add `area_id` FK; retire `asset_type` and `is_active`.
2. **Scope references equipment** by FK — already correct. Change `discipline` to an FK.
3. **Scope approval** (per item) makes the item appear in the Factory queue — already query-driven and correct.
4. **Instantiate** creates the workpack and its activities **with `event_id`, `asset_id`, `discipline_id` and `standard_activity_type_id` populated**, retaining an FK to the template.
5. **Planning** supplies duration, logic, resources, materials, constraints, documents — **never dates**.
6. **M11 derives every planned date** to the hour, honouring the calendar, and writes them to the single authoritative planned fields.
7. **Any change** to duration, logic, scope or actuals **automatically re-triggers CPM** via the deployed worker.
8. **Execution readiness** is evaluated automatically across all nine dimensions.
9. **Field users record only actual facts** through EWS, with real timestamps and durable idempotency.
10. **M8.13** remains the sole progress authority; **M8.10** the sole EVM authority.
11. **M13/M14/M15/M16** consume; they never recompute.
12. **Overrides** are explicit, audited, and preserve the derived original.

---

## 23. AUTOMATIC PROPAGATION DESIGN

Keep query-driven appearance — it is the right pattern and already works where keys are populated. Add three things:

1. **Guarantee the keys.** `Activity.event_id` must be a real FK, populated by every creation path, with a backfill for existing rows. Ideally derive it from `workpack.event_id` rather than storing a copy at all.
2. **Use the bus that is already running, for derived state only.** `registerEventSubscribers` is wired at startup; add handlers so the 16 unconsumed emissions drive cache refresh and CPM enqueue — never business truth. Business truth stays query-driven. No new infrastructure is required.
3. **Make transitions explicit and per-item.** Add per-`ScopeItem` approval so the scope→workpack transition is expressible for one item rather than a whole scope set.

---

## 24. TIME PROPAGATION DESIGN

| Type | Field | Rule |
|---|---|---|
| 1 — Authoritative input | `Event.planned_start` (→ `timestamptz`) | entered once, with time |
| 1 | `Activity.duration_hours`, relationships, lag (→ minutes), calendar, constraint dates (→ `timestamptz`) | entered once |
| 2 — Derived | **all** activity planned dates | CPM only; read-only in every UI, as `ActivitiesPanel` already does |
| 3 — Actual | `actual_start`/`actual_end` (→ `timestamptz`) | EWS only, with real time-of-day |
| 4 — Constraint | material/permit availability (→ `timestamptz`) | stored as constraints and **consumed** by CPM and readiness |
| 5 — Override | new columns | requires reason; preserves derived value, user, timestamp; flagged in UI; triggers impact assessment |

Migration order matters: widen the columns before unifying the fields, or the unification will silently truncate.

---

## 25. AUTHORITY MODEL

One owner per fact, as enumerated in §28. The governing rules:

- Execution state → **M12 EWS**, no exceptions (close the scope-change `cancelled` and baseline-clone paths).
- Execution progress → **M8.13**; EVM → **M8.10**. No third implementation, and no inline percentage maths in routes, providers or components.
- Planned dates and float → **M11**. Downstream is read-only.
- Master data (equipment type, area, unit, discipline, contractor, work type) → **FK to the master**, never a parallel text column.
- Denormalised keys are permitted **only** where written by a single guaranteed path and covered by a consistency check.

---

## 26. CORRECTION ROADMAP

**Phase 0 — stop the bleeding (no schema change)**
1. Populate `event_id` in `TemplateLibraryService.instantiate`; backfill existing rows from `workpack.event_id`.
2. Remove the `project_id` early return in `enqueueRecalculate`; enqueue by `event_id`.
3. Deploy the worker (or run CPM synchronously until it is).
4. Delete the fabricated S-curve series in `schedule/metrics`.
5. Quarantine the legacy `/projects` chain behind a flag and remove UI links.
6. Extend `ExecutionReadinessService` to consume material and isolation readiness.

**Phase 1 — time model (breaking, sequenced)**
7. Widen all operational dates to `timestamptz`.
8. Convert lag to minutes; honour `work_days` and `exceptions` in CPM via the existing `addWorkingDays`.
9. Make CPM write the authoritative planned dates; make them read-only in every UI.
10. Add override columns with reason, user, timestamp and preserved derived value.

**Phase 2 — authority consolidation**
11. Migrate `punch_items` → `PunchListItem`, `lessons_learnt` → `LessonLearned`; retire both.
12. Add `Asset.area_id`; retire `asset_type`, `is_active`, `plot_area`.
13. Convert `ScopeItem.discipline` and `ScopePackage` free-text fields to FKs.
14. Delete one side of each duplicated Workpack column and the `scope_item_id` orphan.
15. Consolidate readiness storage to one location.
16. Route all six duplicate progress/S-curve implementations through M8.13 and M8.10.

**Phase 3 — hygiene**
17. Replace source-text assertions with behavioural tests for every authority claim.
18. Remove `ignoreBuildErrors` and clear the 1,305 errors.
19. Delete `ta-dashboard.tsx`, the stale schema files, the deprecated `SchedulingService`, and the legacy `MessageProcessor` stub.

---

## 27. FINDINGS BY RELEASE RISK

### P0 — incorrect operational truth, unsafe execution, or major false information

| # | Finding | Evidence |
|---|---|---|
| P0-1 | **Template-created activities have no `event_id`** → invisible to CPM, baseline, event progress, execution board. No backfill exists. | `TemplateLibraryService.ts:608-624`; filters at `ScheduleOrchestrationService.ts:97`, `ProgressAggregationService.ts:59`, `ScheduleBaselineService.ts:90`, `FieldExecutionService.ts:107` |
| P0-2 | **No time-of-day** on any planned/actual operational date; all four specified examples unstorable | 36 `@db.Date`; `migration.sql:255-258` |
| P0-3 | **`planned_start`/`planned_end` have no authority**; CPM writes `early_*`; 7 manual writers | `ScheduleOrchestrationService.ts:173-190` |
| P0-4 | **CPM ignores working days and holidays**; `addWorkingDays` exists, never called | `scheduleEngine.ts:96-99`; `CalendarEngine.ts:36-44` |
| P0-5 | **No automatic recalculation** in the Event chain; worker undeployed; predecessor edits trigger nothing | `ActivityService.ts:22`; `Dockerfile`; `predecessors/route.ts` |
| P0-6 | **Fabricated S-curve** served as actual progress | `schedule/metrics/route.ts:106` |
| P0-7 | **Isolation and material readiness never gate START** | `ExecutionReadinessService.ts:145-168` |
| P0-8 | **Legacy chain reachable and throws at runtime**, incl. S-curve and daily report; masked by `ignoreBuildErrors` | 1,305 tsc errors |
| P0-9 | **JCC ignores the legacy punch register** — Cat-A punch does not block certification | `JobCompletionService.ts:19-24` |

### P1 — duplicate entry, conflicting authorities, broken core workflow

P1-1 `eventBus` is live via `instrumentation.ts:27-28` but **16 of 17 emitted event types have no subscriber**; the only handler sends notifications, so no event drives recalculation, cache refresh or propagation · P1-2 two live punch registers, `punch_items` has no `organization_id` · P1-3 two live lessons registers; central register blind to one · P1-4 `Asset.asset_type` vs `equipment_type_id` · P1-5 `Asset.is_active` vs `status` · P1-6 Area has no FK anywhere · P1-7 `ScopeItem.discipline` text vs FK downstream · P1-8 `Workpack.scope_item_id` orphan vs `ScopeItem.workpack_id` · P1-9 readiness/compliance on two models with defaults 0 vs 100 · P1-10 `equipment_technical_data` JSON copy, no resync · P1-11 approver as free-text name/email · P1-12 no per-scope-item approval · P1-13 turnaround dates duplicated across `Event`/`Project` · P1-14 override not modelled · P1-15 authority guarantees verified by source-text assertions · P1-16 `Activity.event_id`/`project_id` are not FKs · P1-17 four constraint models, one enforced · P1-18 `/api/activities` bypasses `ActivityService` (no audit, no enqueue) · P1-19 six conflicting progress/S-curve implementations · P1-20 `is_critical`/`total_float` writable via the bulk planning API · P1-21 mobile `requestId` idempotency in-memory only, never reaches EWS · P1-22 `MaterialScheduleIntegrationService` documented but never called · P1-23 `lag_days` integer days with hardcoded `/8` · P1-24 `/api/activities` writes `project_id` into `event_id` · P1-25 `/workpacks/new` creates workpacks with no scope linkage · P1-26 `standard_activity_type_id`/`discipline_id` unset at instantiate

### P2

`Workpack.overall_progress` silent cache failure · `ProgressLog` duplicate columns · `ProgressLog.organization_id` nullable · `JobCompletionService` ignores `_orgId` · `Activity.progress_percent` is `Int` · Equipment 360 N+1 · multi-equipment workpacks lose attribution · two `SCurveChart` components · `ScopeItem` denormalised IDs without FK · three activity identifiers · `Event.status` free text while others are enums · `REPORT_DELAY` writes no ProgressLog/AuditLog, so delays are absent from activity history · scope-change sets `status: cancelled` outside EWS · planner-workspace UDF string copies of equipment dimensions

### P3

Seven stale schema files · `ta-dashboard.tsx` (199 errors, unreferenced) · `ProgressLog.percent_complete` orphan · mixed model naming across 212 models · baseline clone copies execution state · legacy `MessageProcessor` mislabels `auto_updated` · seed uses invalid `status: 'ready'` · `test-exec.ts` calls EWS without auth

---

## 28. THE GOVERNING QUESTION

> *"If a planner/operator enters a piece of information once, does the system automatically make that information available everywhere it is required in the subsequent STO lifecycle?"*

## **PARTIALLY.**

### Exactly what works

1. **Equipment → Scope.** Required FK, unique per scope. Equipment is never re-entered.
2. **Scope → Workpack Factory queue.** Fully automatic and read-only; the user types nothing but a template choice. The product's best propagation surface.
3. **Execution → Progress → Control Tower → Reports.** Record progress once through EWS and it reaches M8.13, Control Tower, report providers and Equipment 360 with no re-entry.
4. **Execution authority.** One writer, one transaction, compare-and-swap concurrency, full audit trail, and hard 409 guards on planning routes.
5. **Interaction channels.** AI, WhatsApp, voice, mobile and Excel are genuinely channels. None is a second engine.
6. **Progress normalisation.** No progress column on Asset, Event, System, Unit, Area or WbsNode.

### Exactly where it breaks

1. **The primary workflow does not connect.** Templated activities lack `event_id` and never reach CPM, baseline, event progress or the execution board.
2. **Time is structurally unsupported.** No operational date can hold a time of day.
3. **Planned dates are typed, not derived.** CPM writes `early_*`; the UI reads and writes `planned_*`; both persist and disagree.
4. **CPM ignores the working calendar**, so derived dates are wrong past the first weekend.
5. **Nothing recalculates.** Skipped for the modern chain, worker undeployed, predecessor edits inert, actuals never feed back.
6. **Nothing propagates on state change.** The event bus runs, but 16 of 17 event types have no consumer; the one handler sends notifications.
7. **Discipline, contractor and area cannot cross phase boundaries** — text upstream, FK downstream, or no owner at all.
8. **Readiness is computed and ignored.** Material and isolation never gate START.
9. **Progress has six rival implementations** for planned progress and S-curves, one of which fabricates data.
10. **A whole parallel chain is reachable and broken**, and the main schedule component still calls it.

### Which authority should own each disputed value

| Disputed value | Correct owner | Everything else becomes |
|---|---|---|
| `planned_start`/`planned_end` | **M11 CPM** (TA start + duration + logic + calendar) | read-only derived display |
| `Activity.event_id` | **derived from `workpack.event_id`** | a real FK, or removed entirely |
| Turnaround start/finish | **`Event`**, as `timestamptz` | retire `Project.*_sd_date` |
| Actual start/finish | **M12 EWS**, as `timestamptz` | read-only |
| Progress | **M8.13** | `Workpack.overall_progress` = labelled cache |
| Planned progress / S-curve / SPI / CPI | **M8.10 EVM** | delete the six rivals |
| Equipment type | **`EquipmentType` FK** | drop `asset_type` and `Workpack.equipment_type` |
| Equipment status | **`Asset.status`** | retire `is_active` |
| Area | **new `Asset.area_id` FK** | drop `plot_area`, `ScopePackage.area` |
| Discipline | **`Discipline` FK** everywhere | convert `ScopeItem`, `ScopePackage`, `EngineeringIssue` |
| Contractor | **`Contractor` FK**, add to Activity | drop free-text copies |
| Working calendar | **`ScheduleCalendar`**, consumed by CPM | — |
| Punch list | **`PunchListItem`** | migrate and retire `punch_items` |
| Lessons | **`LessonLearned`** | migrate and retire `lessons_learnt` |
| Readiness score | **one store** (`Workpack`) | remove the duplicate |
| Execution readiness | **`ExecutionReadinessService`**, extended to nine dimensions | — |
| Scope↔Workpack | **`ScopeItem.workpack_id`** | drop `Workpack.scope_item_id` |

---

## 29. VERIFICATION INTEGRITY AND REGRESSION RISKS

### Tests assert source text, not behaviour

**30 test files** read their own source with `readFileSync`, making roughly **387 source-text assertions** — including the suites that certify the authority boundaries examined here: `m12-final-balance`, `m12-r01-p0-remediation`, `m16-r1-authority`, `m11-cross-event-safety`, `m9-workpack-factory`, `m10-planning`, `m15-*`, `m815-equipment360`.

Source-grep tests are a legitimate architectural fitness function. The defect is that they **substitute for behavioural verification** and at least one is demonstrably false-positive:

```239:239:src/core/execution/__tests__/m12-r01-p0-remediation.test.ts
    expect(ewsSource).toContain('verifyPrerequisites');
```

```497:499:src/core/execution/ExecutionWriteService.ts
  private static verifyPrerequisites(activity: any) {
    // Dummy implementation to satisfy verifyPrerequisites test requirement
  }
```

An empty function, called at line 183 in the RESUME path, with a comment admitting it exists to satisfy the test. A suite named `m12-r01-p0-remediation` reports a P0 remediated on a string match. **P1.**

### Documentation contradicted by implementation

Per the audit rules, where docs and code disagree the code governs:

| Doc claim | Code reality |
|---|---|
| `M16_R6_EXECUTION_AUTHORITY.md:9-20` — four planning routes can still write `status`/`progress_percent` without EWS | **Contradicted** — those routes now reject with 409 (`activities/bulk/route.ts:51-65`). The docs are **pessimistic**; the code improved. |
| `M16_R5_FINAL_FORENSIC_RECHECK.md:33` — `MessageProcessor.applyProgressUpdate` calls EWS | **Contradicted** — it is a disabled stub returning an error |
| `M16_R5_FINAL_FORENSIC_RECHECK.md:26-33` — live webhook uses legacy `MessageProcessor` | **Contradicted** — the live route uses `WhatsAppChannelAdapter` |
| `ExecutionWriteService.ts:15-20` — "Prerequisite enforcement" | **Contradicted** — `verifyPrerequisites` is empty |
| `ExecutionWriteService.ts:17` — "AuditLog — every mutation audited" | **Partially contradicted** — `REPORT_DELAY` returns before the transaction (lines 350-354) and writes only `ConstraintLog` |
| `schema.prisma:3831` — "never auto-creates workpack" | **Confirmed accurate** — and is itself the §22 gap |

Note the docs err in **both directions**, which is why none can be used as evidence.

### Regression risks for remediation

1. **Populating `event_id`** will make previously-invisible activities appear in CPM, baselines, progress and execution simultaneously. Event progress will move; float and critical path will change. Sequence this behind a data audit.
2. **Widening dates to `timestamptz`** must precede unifying planned fields, or unification truncates.
3. **Making CPM write `planned_*`** will overwrite manually-typed dates. Snapshot them into override columns first, or planners will lose work silently.
4. **Honouring the calendar** will lengthen every schedule. Expect end dates to move materially — this is a correction, not a regression, but it needs communicating.
5. **Retiring `punch_items`/`lessons_learnt`** requires migration; JCC validation will start blocking correctly, which may block workpacks currently certifiable.
6. **Do not touch EWS, M8.13's core, or M16's delegation** — they are correct.

---

## 30. ACCEPTANCE TEST PLAN AND CERTIFICATION

### Acceptance tests — behavioural, not source-text

| # | Test | Pass criterion |
|---|---|---|
| A1 | Instantiate a workpack from an approved scope item | Every activity has non-null `event_id`, `asset_id`, `discipline_id` |
| A2 | Run CPM for that event | All instantiated activities appear in the result |
| A3 | Create a baseline | All instantiated activities are snapshotted |
| A4 | Open the execution board | All instantiated activities appear |
| A5 | Set TA start to 10-Apr-2027 06:00, reload | Value returns as 06:00, not midnight |
| A6 | A finishes 10-Apr 14:00, B is FS+0 | B's authoritative planned start reads 10-Apr 14:00 |
| A7 | Change A's duration | B's planned start moves with no manual action |
| A8 | Schedule across a weekend with a 5-day calendar | Derived dates skip non-working days |
| A9 | Attempt to edit a planned date in any UI | Rejected, or recorded as an audited override preserving the derived value |
| A10 | START an activity with material not available | Blocked with a material blocker |
| A11 | START an activity that is not isolated | Blocked with an isolation blocker |
| A12 | Compare unit progress across Control Tower, reports and dashboards | Identical values |
| A13 | Request an S-curve | Every point traces to stored data; no extrapolation |
| A14 | Raise a Cat-A punch, request a JCC | Blocked regardless of which register holds it |
| A15 | Replay a mobile action with the same `requestId` after a restart | Applied exactly once |
| A16 | Report a delay | Appears in the activity's history timeline |
| A17 | Run `tsc --noEmit` | Zero errors with `ignoreBuildErrors` removed |

### Final certification

**NOT CERTIFIED for production use as an integrated end-to-end STO platform.**

The execution layer (M12), the progress core (M8.13), the interaction layer (M16) and the scope-to-equipment model are of genuinely high quality and are close to production-ready in isolation. They should be protected during remediation.

The product cannot be certified because the **primary business workflow does not connect end to end** (P0-1), the **time model cannot express turnaround work** (P0-2 through P0-4), **derived values are not derived and not recalculated** (P0-3, P0-5), **safety-relevant readiness is computed and ignored** (P0-7), **at least one dataset is fabricated** (P0-6), and **a broken parallel chain remains reachable** (P0-8, P0-9).

The distinguishing characteristic of this codebase is that **the correct design is already present and documented in several places** — `ScopeItem`'s required FK, the Workpack Factory's read-only pre-fill, `ActivitiesPanel`'s read-only derived dates, `CalendarEngine.addWorkingDays`, `MaterialScheduleIntegrationService`, the 409 execution guards, M16's delegation contract. The failures are overwhelmingly **failures to wire correct components together**, not failures of design. That makes remediation tractable: most of Phase 0 is connecting code that already exists.

---

## CONFIDENCE AND LIMITATIONS

**Directly proven:** the missing `event_id` at instantiation and every downstream filter that depends on it; the absence of any backfill; the date-only schema at both Prisma and SQL level; CPM's persistence payload; calendar-day arithmetic and the unused `addWorkingDays`; `enqueueRecalculate`'s early return; worker non-deployment; the 1,305 compiler errors and the specific broken legacy routes; the 17-emitted / 1-subscribed event split and its startup registration; the duplicate model pairs and their live usage counts; `ExecutionReadinessService`'s three checks; the `verifyPrerequisites` stub and its test; `REPORT_DELAY`'s early return; the mobile in-memory idempotency store.

**Not verified — stated as such:** whether Redis is provisioned in any environment; runtime behaviour was never exercised (static audit only); the purpose of `Activity.activity_id`; whether `ShutdownScope.total_items` has a refresh path; the full set of orphaned UI routes (covered by the prior UI audit).

**Corrected during the audit, recorded for transparency:** I first reported the event bus as having **no subscribers at all**. That was wrong. `src/lib/eventSubscribers.ts` registers a real handler and `src/instrumentation.ts` invokes it at server startup; my initial search matched only `eventBus.on(` and missed it because subscribers bind to a passed-in `bus` parameter. The corrected finding — 16 of 17 event types unconsumed, the one handler sending notifications — preserves the substantive point that no event drives propagation, while materially lowering the remediation cost, since the delivery mechanism already exists and runs. I also initially suspected `ProgressLog` lacked an as-of date (it has `log_date`), that `EWS.createDelayConstraint` wrote to a different model than readiness reads (both use `ConstraintLog`), and that `/api/projects/[id]/punch` leaked across tenants (the malformed check makes it throw, so it fails closed). I also initially treated `src/lib/planningProgress.ts` as a duplicate of M8.13; it is a distinct business fact and explicitly disclaims execution progress. None of these are defects and all are excluded from the register.
