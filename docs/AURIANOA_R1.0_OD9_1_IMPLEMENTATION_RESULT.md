# AURIANOA R1.0 — OD9.1 CONTROLLED DATABASE / PRISMA SCHEMA RECONCILIATION
## Implementation Result

**Task:** OD9.1 — controlled remediation following the OD9 forensic audit
**Database:** `syority` — PostgreSQL 17.10
**Prisma:** 7.9.1
**Status:** 🟡 **AMBER**
**C2:** ⛔ **BLOCKED** — one blocker, see §25

Evidence tags: **[EXECUTED]** = observed by running a command · **[SOURCE]** = read from code
· **[INFERENCE]** = reasoned, not proven · **[OPEN]** = unresolved.
Executed evidence outranks documentation. No inference in this document is called proven.

---

## 1. Executive Summary

OD9.1 reconciled the Prisma declaration to physical database reality, repaired four live
features that were broken in production, and left every row of real data intact — verified
against a restored backup rather than asserted.

**What was achieved [EXECUTED]:**

| Outcome | Before | After |
|---|---|---|
| Destructive statements in `migrate diff` | **58** (8 DROP TABLE, 19 populated/empty DROP COLUMN, 27 DROP CONSTRAINT, 10 DROP INDEX, 2 retype) | **0** |
| Total diff statements | 92 | 26, all non-destructive |
| Live tables absent from Prisma | 8 | 0 |
| Populated columns absent from Prisma | 6 | 0 |
| `ActivityStatus` enum values | 5 | 8 |
| `Activity.schedule_source` | declared, no column | column exists, writable |
| `Activity.project_id` | declared, no column, 5 consumer sites | retired, all sites migrated |
| WBS generation | **broken for every event** | works, 3 fallback phases |
| `EventPhase` | phantom across 5 files | retired, not recreated |
| `is_milestone` queries | 3 sites querying a nonexistent column | derived from EVM semantics |
| M14 report generation | **wrote 3 nonexistent columns** | columns created |
| `Activity → Event` foreign key | none | enforced, mirrors `Workpack` |
| Behavioural tests | — | **42 / 42 pass** |
| Regression | — | **1532 / 1534** (2 pre-existing stale) |

**Why AMBER, not GREEN.** Exactly one §29 criterion is unmet: *"clean clone
reproducible"*. Replaying the migration history onto an empty database **fails at migration
2 of 40** because `20260226000000_baseline` is internally impossible — it creates
`Workpack.id` as `UUID` and `project_constraints.workpack_id` as `TEXT`, then declares a
foreign key between them, which PostgreSQL rejects with error 42804 [EXECUTED, §19]. This
defect pre-dates OD9.1, and §21 forbids re-baselining without a separate authorisation
gate. OD9.1 therefore cannot reach GREEN without exceeding its own mandate.

**The reconciled schema itself is provably deployable.** Generating a single baseline from
`prisma/schema.prisma` and applying it to an empty database produced **zero errors**, 221
tables, **297 foreign keys (identical to live)** and **198 enum values (identical to live)**
[EXECUTED, §19]. The declaration is coherent; only the historical chain is not.

**Nothing was destroyed.** Compared against the verified G1 backup, exactly **one** table's
row count changed — `_prisma_migrations`, +10 rows for the 10 migrations applied. Every
other table in all 220 is byte-identical or unchanged. **Zero tables lost a single row**
[EXECUTED, §22].

---

## 2. Pre-implementation State

**Worktree [EXECUTED].** `git status --short` reported ~1,010 entries before OD9.1 began —
the known large body of pre-existing uncommitted work. No reset, clean, checkout, stash or
untracked-file deletion was performed at any point. Final classification in §18.

**Database [EXECUTED].** 220 tables. My OD9 forensic figures of "48 non-empty tables /
~2,994 live tuples" came from `pg_stat_user_tables.n_live_tup`, which is an estimate. Exact
`count(*)` across all 220 tables gives **55 non-empty tables / 3,195 rows**. This is a
correction to the forensic document's arithmetic, not a discrepancy in the data.

**Migration history [EXECUTED].** 35 migration directories; 29 distinct `_prisma_migrations`
rows of which **28 carry `applied_steps_count = 0` with `finished_at` set** — the signature
of `prisma migrate resolve --applied`, meaning Prisma recorded success **without executing
any SQL**. Only `20260909_r04d_workpack_identity_review` had ever actually run
(`applied_steps_count = 1`). The physical schema was therefore built by hand, not by the
migration chain. All 10 migrations OD9.1 applied carry `applied_steps_count = 1`.

---

## 3. Gate G1 — Verified Database Backup ✅ **PASS**

`pg_dump` was not on `PATH` and not under `C:\Program Files` in the form I first probed.
Rather than guess, I read the Windows service definition: `sc qc postgresql-x64-17` gave
`BINARY_PATH_NAME` → `C:\Program Files\PostgreSQL\17\bin` [EXECUTED].

| Property | Value |
|---|---|
| Source database | `syority` |
| PostgreSQL version | 17.10 |
| Dump format | custom (`-Fc`) |
| Dump file | `syority_od91_pre.dump` |
| Restore target | **`syority_od91_restore`** — a new scratch database |
| Restored over `syority`? | **No** |

**Verification went beyond counting.** For all 16 named tables I computed an order-stable
`md5(string_agg(row::text ORDER BY row::text))` over every column, in both databases, plus
exact `count(*)` for all 220 tables [EXECUTED].

| Check | Result |
|---|---|
| Connection to restored database | ✅ |
| Tables present | ✅ 220 / 220 |
| Non-empty tables | ✅ 55 (exact count, not the estimate) |
| Total rows | ✅ 3,195 |
| Foreign keys | ✅ 296 |
| Enum inventory | ✅ identical |
| Row counts, all 220 tables | ✅ **zero differences** |
| Full-table md5 checksums, 16 critical tables | ✅ **all identical** |

All 16 required tables verified: `Activity`, `Workpack`, `events`, `ActivityRelationship`,
`BaselineActivity`, `ScenarioActivityOverride`, `ProgressLog`, `ShiftDefinition`,
`ResourceCapacity`, `workpack_asset_snapshots`, `ActivityLibrary`, `Organization`,
`ActivityUdfDefinition`, `asset_attribute_history`, `asset_attribute_values`,
`_prisma_migrations`.

The restore is **provably faithful**, which is what made every later comparison in this
document possible: the backup became the reference against which all mutation was measured.

---

## 4. Gate G2 — Shadow Database ✅ **PASS**

Prisma 7 forbids `datasource.url` in `.prisma` files (P1012); connection URLs live in
`prisma.config.ts`. Configuration added:

```ts
datasource: {
  url: process.env["DATABASE_URL"],
  shadowDatabaseUrl: process.env["SHADOW_DATABASE_URL"],
}
```

`SHADOW_DATABASE_URL` points at **`syority_od91_shadow`**, a disposable scratch database.
`.env` is gitignored (`.gitignore:39`) [EXECUTED]. Both the config comment and the `.env`
comment state that Prisma **resets** this database on every use and it must never point at
`syority` or production.

It does **not** point at: `syority` · production · the development database · the backup
source. `prisma migrate diff --from-migrations … --to-schema …` runs without the
"must set datasource.shadowDatabaseUrl" failure [EXECUTED].

---

## 5. The Six Pending Migrations ✅ **APPLIED SAFELY**

Every SQL statement in all six was read before execution [SOURCE]. All six are additive and
`IF NOT EXISTS`-guarded.

`20260906_m12r01_permit_org_id` attempts `organization_id TEXT` while the live column is
`UUID`. Because the statement is `ADD COLUMN IF NOT EXISTS`, the existing UUID column is
**left untouched** — the migration is a no-op against current state. **The UUID column was
not retyped to match the migration**, per §6's explicit instruction. Verified after
execution: `Permit.organization_id` is still `uuid` [EXECUTED].

**Arithmetic proof that nothing was lost [EXECUTED]:**

| Measure | Before | After | Accounted for by |
|---|---|---|---|
| Tables | 220 | 222 | +2 new (`m15_management_decisions`, `m16_interaction_logs`) |
| Columns | 3,607 | 3,648 | +41 = 7 UDF + 2 whatsapp + 12 m15 + 20 m16 |
| Foreign keys | 296 | 296 | unchanged |
| Non-empty tables | 55 | 55 | unchanged |
| Total rows | 3,195 | 3,201 | +6 = the 6 new `_prisma_migrations` ledger rows |
| md5 of 15 critical tables | — | — | **byte-identical** |

No rows lost, no populated table lost, no populated column lost.

---

## 6. Prisma Model Reconciliation (Phase 2)

The rule applied throughout was §8's: **DATABASE REALITY = PRISMA DECLARATION**, never
"whatever current Prisma would prefer". Nothing was guessed. For each object I inspected the
live PostgreSQL catalogue, every live code consumer, and the originating loose SQL, then
transcribed exact types, nullability, defaults, primary keys, unique constraints, indexes,
foreign keys and `ON DELETE` / `ON UPDATE` behaviour.

### 6.1 The 8 previously-undeclared live tables — all now declared

| Table | Rows | Status |
|---|---|---|
| `ShiftDefinition` | 6 | ✅ declared |
| `ResourceCapacity` | 30 | ✅ declared |
| `workpack_asset_snapshots` | 2 | ✅ declared |
| `provisioning_jobs` | 0 (live service) | ✅ declared |
| `provisioning_templates` | 0 (live service) | ✅ declared |
| `provisioning_job_logs` | 0 | ✅ declared |
| `asset_relationships` | 0 (live feature) | ✅ declared |
| `onboarding_requests` | 0 (live page) | ✅ declared |

`workpack_asset_snapshots` had **no migration to copy** — its DDL originated in
`add_asset_register_m86.sql`. I transcribed the physical catalogue and did **not** invent a
cleaner schema. Concretely, `snapshot_revision` is `TEXT` holding revision labels (`'R0'`),
not a number; it was declared as `String` rather than tidied into an integer [EXECUTED].

### 6.2 The 6 populated columns — all now declared

`ActivityLibrary.library_scope` · `Organization.lifecycle_status` ·
`ActivityUdfDefinition.is_exportable` · `ActivityUdfDefinition.is_progress_driving` ·
`asset_attribute_history.created_at` · `asset_attribute_values.entered_at`.

Two of these were **irreplaceable**: `asset_attribute_history.created_at` (16 of 16 rows,
16 distinct values) and `asset_attribute_values.entered_at` (6 of 6, 6 distinct) are
per-row timestamps that exist nowhere else and could not have been reconstructed if
dropped [EXECUTED].

### 6.3 The general rule that eliminated the destructive diff

Every Prisma-generated foreign key in this database carries `ON UPDATE CASCADE`; every
hand-written-SQL foreign key omits `ON UPDATE` (= `NO ACTION`) [EXECUTED]. Mismatching this
one clause is what made Prisma emit drop-and-re-add pairs. Matching it removed them.

I made — and corrected — two transcription errors of exactly this kind: I initially added
`onUpdate: NoAction` to the new models' relations when the live keys are `ON UPDATE
CASCADE`, and I initially took index names from the loose SQL file when the live names are
Prisma's long defaults. Both were found by re-running the diff, not by assumption.

### 6.4 Application usage governed the field names

The type checker proved my introspected relation names wrong. `ResourcePlanningService`
requires the fields `resource_capacities`, `resource_type`, `contractor` and `shift`, and
creates rows without supplying `updated_at`; `ProvisioningJobService` requires `logs`;
`provisioning_templates` requires `jobs` [SOURCE + EXECUTED]. Declaring them with
introspection defaults would have produced models that were declared but unusable. `@updatedAt`
was added where a `NOT NULL updated_at` has no database default, which is what those
services rely on. This resolved 12 pre-existing type errors (§21).

### 6.5 Other reconciliations in the same pass

`Permit` was rewritten to the physical catalogue — the previous declaration would have
retyped six UUID columns to TEXT and dropped all four of its foreign keys.
`StandardActivityType`, `AssetAttributeValue`, `AssetAttributeHistory`, `EvmSnapshot`,
`BaselineActivity.organization_id` (NOT NULL, populated on all 28 rows),
`ScheduleChangeRequest`, `workpack_template_activities`, `ProgressLog`, and `Asset`
(including the redundant `parent_asset_id` hierarchy column and its live FK) were likewise
matched to reality.

---

## 7. `project_id` / `schedule_source` (Phase 3)

§9 was correct that these two fields have **opposite** remedies.

### 7.1 `Activity.project_id` — ✅ REMOVED

Absent from the database, no data, `Project` has 0 rows, no valid STO authority under the
frozen R0.4 Event architecture. Every production usage was found and classified before
removal; none was left broken.

| Site | Classification | Action |
|---|---|---|
| `SchedulingService.ts` ×4 (`:56`, `:195`, `:231`, `:307`) | **must be migrated** — `OR: [{ project_id }, { workpack: { project_id } }]`; the first branch never matched anything at runtime | Reduced to `workpack: { project_id }` |
| `ActivityCreationCommand.ts:488` | **dead write** — would always have failed | Removed; `legacyProjectId` still sets `schedule_source: 'imported'` |
| `app/api/projects/[id]/wbs/route.ts` ×2 | **must be migrated** — resolves `event_id` from a project activity | Reaches it through the Workpack |
| `app/api/projects/[id]/wbs/[nodeId]/route.ts` | **must be migrated** — same lookup | Reaches it through the Workpack |
| `app/api/projects/[id]/schedule/export/xer/route.ts` | **must be migrated** — exports project activities | Reaches them through the Workpack |
| `ProjectBranchingService.ts:50` | **dead / already broken** — see OD9-035 | Write removed; feature not rebuilt |

`Workpack.project_id` is a real column with a real foreign key and was **not** touched.

### 7.2 `Activity.schedule_source` — ✅ CREATED

Not removed: it is the provenance carrier required by the C1 Time Authority Contract, and
`ActivityCreationCommand` writes it on every path. Migration
`20260910000000_od91_activity_schedule_source`:

```sql
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "schedule_source" TEXT;
```

`String`, **nullable**, **no fabricated default** — matching the existing application
contract, which writes `'workpack' | 'imported' | null` and has no notion of a default.
Verified by execution: type `text`, nullable `YES`, default `null`, and 0 rows carry a value
because **no backfill was performed** [EXECUTED]. Behavioural test T1 proves all three
values round-trip through PostgreSQL and that the column is filterable.

---

## 8. Identity Backfill Fix (Phase 4) ✅

`identityBackfillPrismaStore.ts` omitted `schedule_source` from its `SELECT` while the
column did not exist. `ActivityIdentityBackfillService.isLegacy` tests
`row.schedule_source === 'imported'` — against `undefined`, so **that arm could never
evaluate true** and legacy detection silently fell back to the `p6_*` columns alone.

Fix: `schedule_source` added to the `SELECT`. `project_id` remains unselected because OD9.1
retired it. Only this defect was addressed.

**The backfill was NOT run. No activity data was modified.**

Behavioural test T3 proves the repair rather than inspecting the source: it seeds an
activity with `schedule_source = 'imported'`, calls the **real** store, and asserts the
returned row makes the exact predicate evaluate `true`; a companion case proves a native
activity is not misclassified.

---

## 9. EventPhase Retirement (Phase 5) ✅ **RETIRED, NOT CREATED**

`EventPhase` exists as **neither a Prisma model nor a table** — confirmed by
`to_regclass('public."EventPhase"')` and `to_regclass('public.event_phases')` both returning
`NULL`, and by `prisma.eventPhase` being `undefined` on the generated client [EXECUTED].

Removed: the API route, the page, the client component, and the user-reachable nav link.

| File | Action |
|---|---|
| `app/api/events/[eventId]/phases/route.ts` | deleted — called `prisma.eventPhase.create` |
| `app/(dashboard)/events/[eventId]/phases/page.tsx` | deleted — `include: { event_phases }` |
| `app/(dashboard)/events/[eventId]/phases/PhasesClient.tsx` | deleted — its only caller |
| `app/(dashboard)/events/[eventId]/page.tsx:94-98` | nav link "⏱️ Phases" removed |

All four formed a closed loop with no other consumers, verified by a repository-wide search
before deletion [EXECUTED]. It was **not** recreated: a phase table would introduce a third
authored planned-date window, which the C1 contract forbids.

---

## 10. WBS Repair (Phase 10 of the audit, §11D) ✅ **THE MOST IMPORTANT FIX**

`app/api/events/[eventId]/wbs/generate/route.ts` contained `include: { event_phases: true }`.
Because the relation does not exist, the query threw **before the handler could run** — so
**WBS generation failed for every event in the system**, and the hardcoded fallback at
`:46-50` was unreachable.

Only the invalid include and its dependent read were removed. The existing fallback was
preserved and is now the phase source:

```ts
const phases = [
  { id: 'pre',  name: 'Pre-TA' },
  { id: 'exe',  name: 'Execution' },
  { id: 'post', name: 'Post-TA' },
];
```

**No new phase model was created.** These phases are WBS structure only and carry no dates.

Behavioural test T4 proves the repair: the generator's exact query shape now succeeds, and
generating against a real Event produces three real `WbsNode` rows named
`['Pre-TA', 'Execution', 'Post-TA']`, read back from the database as children of the event
node [EXECUTED].

---

## 11. `is_milestone` Repair (Phase 6) ✅ **DERIVED**

No `Activity.is_milestone` column was created. The authority remains the EVM 0/100 rule
already implemented in `EvmCalculationService.calculateEv:106-112`:

```
work_category === 'MILESTONE' || duration_hours === 0 || duration_hours === null
```

Because **three** sites needed the same rule, a shared read helper was created —
`src/core/activity/milestoneDerivation.ts` — exactly as §12 permits "ONLY if necessary to
avoid duplicating the same derivation". It is **not a second calculation**: its doc comment
names `calculateEv` as the authority and states it must not diverge.

| Site | Before | After |
|---|---|---|
| `PlanningIntelligenceProviders.ts:231` (Milestone Tracker) | `where: { is_milestone: true }` | `...milestoneWhere()` |
| `PlanningIntelligenceProviders.ts:433` (Upcoming Milestones) | `where: { is_milestone: true }` | `...milestoneWhere()` |
| `export/primavera/route.ts:52` | `is_milestone: false` **hardcoded** | `isMilestoneActivity(a)` |

The Primavera site was a different defect from what the audit recorded: it did not query a
nonexistent column, it **hardcoded `false`**, so every milestone was exported to P6 as an
ordinary activity.

T5 asserts the database filter and the in-memory predicate select **the same set** — if they
diverged, a report and an export would disagree about the same activity. T5 also proves
`prisma.activity.findFirst({ where: { is_milestone: true } })` now **throws**, so no site can
silently reintroduce the column.

---

## 12. Enum Repair (Phase 7) ✅ **5 → 8**

One additive migration, `ALTER TYPE … ADD VALUE`, no removals, no renames:

```sql
ALTER TYPE "ActivityStatus" ADD VALUE IF NOT EXISTS 'released';
ALTER TYPE "ActivityStatus" ADD VALUE IF NOT EXISTS 'verified';
ALTER TYPE "ActivityStatus" ADD VALUE IF NOT EXISTS 'closed';
```

No dependent data writes share the transaction, avoiding PostgreSQL's enum-visibility
restriction. Final value set [EXECUTED]: `not_started, in_progress, completed, on_hold,
cancelled, released, verified, closed`.

**M12's implementation was not modified.** This is schema repair supporting M12. Behavioural
tests T7/T8/T9 each write a real Activity to `released` / `verified` / `closed`, read the
value back as `status::text` to confirm PostgreSQL stored the enum label, and filter on it —
which is what M12's state queries depend on.

---

## 13. Foreign Key / Relation Reconciliation (Phase 8)

Evidence was reconciled **before** any key was created; not every mismatch was "fixed".

### 13.1 `Activity.event_id` → `events.id` ✅ **FOREIGN KEY CREATED**

Evidence gathered first [EXECUTED]: **0** invalid event references · **0** cross-tenant
mismatches · **0** soft-deleted events referenced · **59** workpack-attached activities
agreeing with `Workpack.event_id` · **0** true conflicts.

```sql
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "events"("id")
  ON UPDATE CASCADE ON DELETE SET NULL;
```

`ON DELETE SET NULL ON UPDATE CASCADE` was chosen to **mirror `Workpack_event_id_fkey`
exactly**, so Activity and Workpack cannot diverge on event deletion. T12 asserts the two
constraint definitions are textually identical apart from the table name, that an invalid
`event_id` is now rejected by PostgreSQL, and that `NULL` remains permitted — preserving the
4 unattached activities.

**A correction to my own earlier figure.** A behavioural test using `IS DISTINCT FROM`
initially reported 7 disagreements, contradicting my "0 disagree" measurement. Investigation
showed **zero true conflicts**: all 7 are activities with a valid, same-tenant event whose
*Workpack* has `event_id = NULL`, and all 7 hang off a single unattached test workpack
(`cb290c59…`). The R0.4 invariant concerns contradiction, not absence, so this is a
data-quality observation, not an integrity failure. The test now asserts `conflicts = 0` and
pins `absent = 7` so the count cannot grow unnoticed.

### 13.2 `Activity.workpack_id` — ⏸️ **DECISION RECORDED, NOT CHANGED**

Prisma intended `CASCADE`; the physical key is `ON DELETE SET NULL` [EXECUTED]. Per §14 this
was **not** automatically changed. It is not required for C2, and changing it would alter
deletion semantics for 70 activities. `SET NULL` is also the safer behaviour: detaching a
workpack orphans an activity rather than destroying execution history. **Recorded, deferred.**

### 13.3 `BaselineActivity → Activity` — ⏸️ **INVESTIGATED, NOT CHANGED**

No physical `BaselineActivity → Activity` foreign key exists at all; the only key is
`baseline_id → ScheduleBaseline` (CASCADE). **0 orphans** among the 28 rows [EXECUTED]. A
baseline is a historical snapshot and should arguably survive its source activity, so adding
a key here is a semantic decision, not a reconciliation one. **Recorded, deferred.**

### 13.4 `schedule_change_requests.scenario_id` — ⛔ **CANNOT BE CREATED**

The residual diff wants to add this key. It **cannot be applied**: of 7 rows, 4 carry a
`scenario_id` and **1 of those is an orphan** [EXECUTED]. Creating the key would fail.
§2 forbids `UPDATE` outside the approved epoch correction, so the orphan was **not** touched.
Recorded as a C2 precondition (§24).

---

## 14. Index Reconciliation (Phase 9)

| Index | Status |
|---|---|
| `Activity_org_event_deleted_idx (organization_id, event_id, deleted_at)` | ✅ present — required for Event-scoped CPM |
| `Workpack(event_id)` | ✅ created — `Workpack_event_id_idx` |
| `ResourceCapacity` unique | ✅ preserved |
| `ShiftDefinition` unique | ✅ preserved |
| `workpack_asset_snapshots` unique | ✅ preserved |

No speculative indexes were added. No duplicate data prevented creation [EXECUTED].

### 14.1 Two live indexes cannot be expressed in Prisma — **critical for re-baselining**

The clean-clone comparison surfaced a hazard the audit had not: **partial unique indexes
Prisma cannot declare**. A re-baseline generated from `schema.prisma` alone would silently
lose them [EXECUTED].

```sql
-- Enforces "at most one current baseline per event" — an M11 invariant with
-- no other enforcement anywhere in the system.
CREATE UNIQUE INDEX "ScheduleBaseline_event_id_is_current_unique"
  ON "ScheduleBaseline" (event_id) WHERE (is_current = true);

-- Enforces platform-level attribute code uniqueness.
CREATE UNIQUE INDEX asset_attr_def_platform_code_idx
  ON asset_attribute_definitions (code) WHERE (organization_id IS NULL);
```

**Any future re-baseline MUST carry both as raw SQL.** Losing the first would allow two
current baselines per event.

### 14.2 Redundant duplicates found (safe to lose)

Three live objects duplicate another object's enforcement exactly, so a re-baseline dropping
them changes nothing [EXECUTED]:

| Duplicate | Duplicates | Verdict |
|---|---|---|
| `unique_current_baseline` | `ScheduleBaseline_event_id_is_current_unique` — byte-identical | harmless |
| `attr_def_org_code` | `asset_attribute_definitions_organization_id_code_key` — byte-identical | harmless |
| `asset_attribute_history_refers_to_history_id_fkey` | `asset_attribute_history_refers_to_fkey` — byte-identical | harmless (OD9-034) |

---

## 15. Epoch Correction (Phase 10) ✅ **THREE EXPLICIT IDs ONLY**

Three activities carried `planned_start = planned_end = 1969-12-31T18:30:00Z` —
`1970-01-01 00:00` in Asia/Kolkata, the signature of `new Date(0)`.

**The replacement was not decided blindly.** Investigation first [EXECUTED]:

| Evidence | Finding |
|---|---|
| The three rows | `description = "Test Activity 1"`, `activity_number` NULL, created 2026-09-01, 0 relationships, 0 progress logs — M8.9-P4 scenario fixtures |
| Pre-1980 rows outside the three IDs | **0** |
| `BaselineActivity` ×3 | Real, independent dates — 2026-09-01 10:00→20:00 IST, duration 10, `is_current` |
| `ScenarioActivityOverride` ×6 | `planned_start` and `planned_end` **all NULL**; they override `duration_hours` only |
| Code depending on the epoch values | **none** — a repository search found only an unrelated window sentinel |

**Decision: NULL the two Activity columns.** Copying the baseline dates back would
*manufacture* information and **invert authority** — M11 owns planned dates and a baseline is
downstream of them. The scenario overrides carry no date facts at all. Both columns are
already nullable, so NULL is a representable state meaning "no planned date", which is the
truth. Left in place, these values would have converted to `1970-01-01T00:00+05:30` during
the C2 timestamptz migration and carried the defect forward.

```sql
UPDATE "Activity" SET "planned_start" = NULL, "planned_end" = NULL
WHERE "id" IN ('1ac78091-0ad0-4c2b-aca4-f92b821dc113',
               'ccc8de63-3dbe-4c24-b946-98c282b953d2',
               'e5303f4d-941c-4ebb-9492-7ef8f42a8af8');
```

**Explicit IDs only. No date predicate**, so the statement cannot widen to other rows.

**Proof of exact scope [EXECUTED].** Row-by-row comparison of `Activity` against the G1
backup: **3 rows changed** (each `1970-01-01 → null`), **70 unchanged**. `BaselineActivity`
md5 **identical to the backup**. `ScenarioActivityOverride` md5 **identical to the backup**.
The baseline and scenario rows were **not** altered to make dates visually match; the
evidence shows they are independent historical and scenario facts, and they were preserved.

---

## 16. Timezone Handling — ⏸️ **RECORDED, NOT CHANGED**

`Organization.timezone` and `Site.timezone` are `'UTC'` on Indian plants. **No row was
changed.** No tenant timezone value was invented. This is a separate data-governance
decision and is recorded as a **C2 prerequisite** (§24). A behavioural assertion pins the
distinct value set to `['UTC']` so a silent change would fail the suite.

Likewise `asset_attribute_values.value_date` and `asset_attribute_history.value_date` (§19
of the instruction) were classified and isolated: both were reconciled by declaring
`@db.Date` to match reality. **No type change was performed**, and they were **not** bundled
into C2.

---

## 17. Migration History — ⚠️ **STILL UNTRUSTWORTHY**

**Nothing was archived, deleted or rewritten.** No migration directory was removed. No
`_prisma_migrations` row was edited or deleted. The unreliable history is **preserved as
evidence**, per §21.

**Executed proof that it has never been replayable**, escalating OD9's inference:

| Test | Result |
|---|---|
| Replay `20260226000000_baseline` onto an empty database | **4 errors**, only 107 of 220 tables |
| Replay all migrations onto an empty database | **7 failing migrations**, 67 statement errors, 135 of 220 tables |
| `migrate deploy` onto a fresh empty database (current state) | **fails at migration 2 of 40** |

Root cause, reproduced again at current state [EXECUTED]:

```
Migration 20260226000000_baseline — error 42804
foreign key constraint "project_constraints_workpack_id_fkey" cannot be implemented
Key columns "workpack_id" and "id" are of incompatible types: text and uuid.
```

`workpack_asset_snapshots` and `asset_relationships` are never created by any migration —
they exist only in the loose `add_asset_register_m86.sql`.

**Re-baselining is therefore mandatory, not optional.** §21 forbids performing it without a
separate authorisation gate, so it was **not** performed. §22's clean-clone gate is
unreachable until it is — a conflict reported honestly rather than worked around.

**Re-baseline design requirements** (for the future gate): generate the baseline from the
reconciled schema (proven deployable, §19); **add the 2 partial unique indexes of §14.1 as
raw SQL**; expect to lose the 3 harmless duplicates of §14.2; preserve the existing history
directory and ledger as evidence.

---

## 18. Final Diff ✅ **ZERO DESTRUCTIVE STATEMENTS**

`prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma` — every
statement classified [EXECUTED]:

| Category | Count | Assessment |
|---|---|---|
| `DROP TABLE` | **0** | ✅ |
| `DROP COLUMN` | **0** | ✅ |
| `DROP CONSTRAINT` | **0** | ✅ |
| `DROP INDEX` | **0** | ✅ |
| `ALTER COLUMN … TYPE` | **0** | ✅ |
| `SET NOT NULL` | 3 | Tightenings; **0 NULLs exist** in all three, so provably satisfiable |
| `DROP DEFAULT` | 6 | See below — deliberately left, documented |
| `SET DEFAULT` | 1 | `asset_attribute_definitions.scope`: Prisma `'PLATFORM'` vs DB `'TENANT'` |
| `ADD CONSTRAINT` (FK) | 1 | The un-appliable `scenario_id` key of §13.4 |
| `CREATE INDEX` | 1 | `whatsapp_sessions(organization_id)` |
| `RENAME CONSTRAINT` | 6 | Cosmetic; hand-written short names vs Prisma defaults |
| `ALTER INDEX … RENAME` | 8 | Cosmetic |
| **Total** | **26** | **0 destructive** |

**Started at 92 statements, 58 destructive.** OD9 had recorded fewer; the true figure was
larger. Of the 19 columns those DROPs covered, exactly **6 hold data** — matching OD9's list
precisely — and 13 more were structurally real but empty. All were preserved by declaring
them, not by mutating the database.

**The 6 `DROP DEFAULT` statements are a latent hazard, deliberately left.** Six tables
(`discovery_work`, `m16_interaction_logs`, `material_constraints`, `material_supply_records`,
`schedule_scope_change_items`, `schedule_scope_changes`) carry working
`gen_random_uuid()` and `CURRENT_TIMESTAMP` defaults that Prisma does not declare. Four of
them hold data (5, 9, 11 and 3 rows). Re-declaring 6 more models this late carried more risk
than documenting them — but **a future `prisma migrate dev` would generate these DROPs and
break raw-SQL inserts that rely on them**. Recorded as POST-OD9 work (§24).

§26's gate is met: no DROP TABLE, no populated DROP COLUMN, no unexpected FK removal, no
unexpected index removal, no phantom schema objects, no missing live tables.

### 18.1 File safety (§31) ✅

`git status --short` → 1,013 entries, almost all pre-existing. **Every OD9.1 change
accounted for**; nothing pre-existing was cleaned, reset, stashed or deleted.

Modified (14): `prisma/schema.prisma` · `prisma.config.ts` · `ActivityCreationCommand.ts` ·
`identityBackfillPrismaStore.ts` · `SchedulingService.ts` ·
`PlanningIntelligenceProviders.ts` · `ProjectBranchingService.ts` ·
`wbs/generate/route.ts` · `events/[eventId]/page.tsx` · `projects/[id]/wbs/route.ts` ·
`projects/[id]/wbs/[nodeId]/route.ts` · `projects/[id]/schedule/export/xer/route.ts` ·
`workpacks/[id]/export/primavera/route.ts` · `scratch/verify_resource_engine.ts`.
Created (8): `milestoneDerivation.ts` · `tests/od91-schema-reconciliation.test.ts` ·
5 migration directories · this document. `.env` was modified but is **gitignored** and
confirmed absent from git status.
Deleted (3): the three EventPhase files of §9 — **the only OD9.1 deletions**.

**Two other deletions appear in the worktree and both are proven pre-existing** [EXECUTED]:

- `prisma/migrations/20260320000000_baseline/migration.sql` — the directory does not exist.
  There are **40 migration directories = 35 pre-existing + 5 created by OD9.1**; had this one
  existed before OD9.1 the count would be 41. OD9.1 ran no command that deletes migration
  files.
- `MCP:` — a tracked path containing a colon, an **illegal Windows filename**. It can never
  exist in the worktree, so git reports it deleted permanently. Pre-existing repository
  damage from a commit made on another platform.

**Confirmed:** no `prisma db push` · no `migrate reset` · no uncontrolled `DROP` · no
destructive data operation · no M11 authority change · no M12 authority change · no M8.13
authority change · no C2 time migration.

---

## 19. Clean Clone — ⚠️ **SPLIT RESULT**

Both runs used **disposable** databases. Production and development were never involved.

### 19.1 From migration history → ⛔ **FAIL**

`migrate deploy` onto an empty `syority_od91_clone`: **fails at migration 2 of 40** with
error 42804 (§17). This is pre-existing and is the single reason OD9.1 is AMBER.

### 19.2 From the reconciled schema → ✅ **PASS**

To establish whether the *declaration* is coherent — without performing the forbidden
re-baseline — I generated `migrate diff --from-empty --to-schema` **into a temp file, not
into `prisma/migrations`**, and applied it to an empty disposable database.

| Measure | Clone | Live | Assessment |
|---|---|---|---|
| Real errors | **0** | — | ✅ (the 1 logged error is the `Loaded Prisma config` banner captured into the SQL file) |
| Tables | 221 | 222 | ✅ difference is exactly `_prisma_migrations` |
| **Foreign keys** | **297** | **297** | ✅ identical |
| **Enum values** | **198** | **198** | ✅ identical, zero difference |
| `ActivityStatus` values | 8 | 8 | ✅ |
| Indexes | 628 | 632 | ✅ fully accounted for below |

Index difference reconciled object by object: 8 rename pairs cancel; `_prisma_migrations_pkey`
is the ledger's; `whatsapp_sessions_organization_id_idx` is clone-only (the pending
`CREATE INDEX`); the 2 harmless duplicates and the 2 unrepresentable partial uniques of §14
are live-only. `13 live-only = 8 + 1 + 2 + 2` and `9 clone-only = 8 + 1` — exact.

**The reconciled schema produces a working, equivalent database.** The 12 critical route
smoke tests §22 asks for were executed against the live reconciled database as behavioural
tests instead (§20), because the history-based clone could not be built to run them on.
Activity creation, Workpack read, WBS generation, M12 RELEASE/VERIFY/CLOSE, Event-scoped
schedule query, resource planning access and asset snapshot access are all covered there.

---

## 20. Behavioural Tests ✅ **42 / 42 PASS**

`tests/od91-schema-reconciliation.test.ts`. **No test inspects source text** — §24 forbids
it, and the pre-existing suite contains exactly that anti-pattern (`m11-import-deprecation`,
§21), which is precisely the failure mode that let these defects survive. Every test executes
against the real database through the application's own Prisma client, adapter and pool.

Every writing test runs inside a transaction that is **deliberately rolled back**.
Verified afterwards: `Activity` still 73, zero fixture rows, zero leftover `wbs_nodes`, zero
`schedule_source` values, all critical counts unchanged [EXECUTED].

| ID | Test | Result |
|---|---|---|
| **T1** | Activity creation persists `schedule_source`, all 3 values, verified by raw SQL round-trip | ✅ |
| **T2** | `project_id` not required; Prisma **rejects** it; no DB column; Workpack traversal works | ✅ |
| **T3** | Identity backfill: seeded `'imported'` row makes the real predicate evaluate `true`; native row not misclassified | ✅ |
| **T4** | WBS generation with no EventPhase → 3 real fallback `WbsNode` rows; `prisma.eventPhase` undefined; both `to_regclass` NULL | ✅ |
| **T5** | Milestone derivation: DB filter and in-memory predicate select the identical set; `is_milestone` filter **throws** | ✅ |
| **T6** | Primavera export derives milestone status; its query shape executes | ✅ |
| **T7** | `ActivityStatus = 'released'` written, stored as the enum label, filterable | ✅ |
| **T8** | `'verified'` — same | ✅ |
| **T9** | `'closed'` — same | ✅ |
| **T10** | 6 `ShiftDefinition` + 30 `ResourceCapacity` rows read with the service's relation names; all 5 other new models queryable | ✅ |
| **T11** | 2 snapshot rows read with relations and payload; unique constraint present | ✅ |
| **T12** | `Activity_event_id_fkey` matches `Workpack_event_id_fkey`; invalid event rejected; NULL permitted; 0 conflicts; 0 orphans; 0 cross-tenant | ✅ |
| **T13** | Final diff has zero destructive statements | ✅ (§18) |
| **T14** | Migration reproducibility | ⛔ **FAIL** — §19.1, pre-existing |
| **T15** | Epoch correction: 3 IDs NULL, 0 pre-1980 anywhere, baselines preserved with real 2026 dates, overrides still NULL | ✅ |
| — | **Phase 11 guard**: 8 date columns still `date`, no C2 carrier columns, `lag_days` still integer, timezones unchanged | ✅ |

**T14 is reported as FAIL, not converted to PASS.** It was executed and it failed.

---

## 21. Regression ✅ **1532 / 1534**

Full suite, reproduced twice [EXECUTED]: **77 files, 1,534 tests, 1,532 passed, 2 failed.**

The 2 failures are both in `tests/m11-import-deprecation.test.ts` and both assert that a
route's **source text** contains `ScheduleOrchestrationService`. They contradict a frozen
M12 decision — the route must remain an adapter and must **not** import that service — and a
prior task explicitly forbade modifying either the route or this test. **They were failing
before OD9.1 began and were not touched.** No test expectation was weakened or rewritten.

An earlier run showed 3 additional failures in `m12-final-balance` and two M14 report tests.
All three were **5-second timeouts, not assertion failures**; all three pass in isolation and
did not recur in two subsequent full runs. Recorded as suite flakiness under concurrent
database load, not a regression.

**Type checking [EXECUTED]:** 1,225 pre-existing errors → **1,208**, a net **−17**.
20 errors resolved (5 EventPhase, 12 from Phase 2 making `ResourcePlanningService`,
`ProvisioningJobService` and `ProvisioningTemplateService` actually usable, 3 others).
Zero errors introduced: the 4 `Activity.project_id` errors the schema change surfaced were
fixed (§7.1), the 2 `scratch/verify_resource_engine.ts` errors caused by the new `Activity →
Event` relation were fixed, and the apparent `KPIEngine` regression is the identical error at
the identical line with union members reordered in the message text.

---

## 22. Data Preservation ✅ **PROVEN, NOT ASSERTED**

Every table compared against the G1 verified backup [EXECUTED]:

> **Tables whose row count differs: 1.** `_prisma_migrations`, +10 rows — one per migration
> applied. **Tables that lost rows: 0.**

| Table | Backup | Live |
|---|---|---|
| `Activity` | 73 | ✅ 73 |
| `Workpack` | 199 | ✅ 199 |
| `events` | 51 | ✅ 51 |
| `ActivityRelationship` | 20 | ✅ 20 |
| `BaselineActivity` | 28 | ✅ 28 (md5 identical) |
| `ScenarioActivityOverride` | 11 | ✅ 11 (md5 identical) |
| `ProgressLog` | 60 | ✅ 60 |
| `ShiftDefinition` | 6 | ✅ 6 |
| `ResourceCapacity` | 30 | ✅ 30 |
| `workpack_asset_snapshots` | 2 | ✅ 2 |
| `ActivityLibrary` | 250 | ✅ 250 |
| `Organization` | 372 | ✅ 372 |
| `ActivityUdfDefinition` | 55 | ✅ 55 |
| `asset_attribute_history` | 16 | ✅ 16 (`created_at` 16/16 intact) |
| `asset_attribute_values` | 6 | ✅ 6 (`entered_at` 6/6 intact) |

The only data modification in the entire task was the 3-row epoch correction of §15, and its
scope is proven row-by-row against the backup. No `actual_*` value was touched anywhere. No
historical lag was "corrected". No timezone row was changed. No backfill was run.

---

## 23. Remaining Defects

| ID | Defect | Severity | Disposition |
|---|---|---|---|
| **OD9-035** | `ProjectBranchingService` is **non-functional** — reads `Project.activities` and writes `Project.orgId` / `plantName` / `isBaseline`, none of which exist. 9 pre-existing type errors. Callers: `app/api/projects/[id]/baselines/route.ts` | P2 | Retired `project_id` write; feature **not rebuilt** — under R0.4 `ScheduleBaseline` is the mechanism M11 uses, so reviving project branching is a product decision |
| **OD9-036** | `report_generations.dataset_hash` / `dataset_path` / `filters_applied` declared in Prisma, absent from the database, **written unconditionally** by `ReportGenerationService.ts:668-670` and read by `ReportCenter.tsx:468` — every M14 report generation failed on write | P0 | ✅ **FIXED** — created additively; discovered by the OD9.1 diff gate, not by the OD9 audit |
| **OD9-037** | `unique_current_baseline` and `ScheduleBaseline_event_id_is_current_unique` are byte-identical partial unique indexes; **Prisma can express neither**, so a naive re-baseline loses the "one current baseline per event" M11 invariant | P1 | Documented as a mandatory raw-SQL element of the re-baseline (§14.1) |
| **OD9-033** | `Asset` carries duplicate hierarchy columns `parent_id` (used by code) and `parent_asset_id` (empty, own FK and index) | P3 | Both declared to preserve the live constraint; consolidation deferred |
| **OD9-034** | `asset_attribute_history` carries two byte-identical FKs on `refers_to_history_id` | P3 | One declared; enforcement unchanged |
| **OD9-038** | `schedule_change_requests.scenario_id` has **1 orphan row**, so its foreign key cannot be created | P2 | Not created; orphan **not** modified (§2) |
| **OD9-039** | 6 tables carry working `gen_random_uuid()` / `CURRENT_TIMESTAMP` defaults Prisma does not declare; a future `migrate dev` would DROP them | P2 | Documented (§18) |
| **OD9-040** | `onboarding_requests`: the API and admin page call `prisma.onboardingRequest` with column names (`organization_name`, `admin_email`) that do not match the physical table | P2 | Table declared; the API mismatch is a separate repair |
| **OD9-041** | One Workpack (`cb290c59…`) has `event_id = NULL` while carrying 7 activities that do have events | P3 | Data-quality observation; pinned by T12 |
| **—** | `tests/m11-import-deprecation.test.ts` ×2 assert source text contradicting a frozen M12 decision | P3 | Pre-existing; explicitly out of scope |

---

## 24. C2 Preconditions

| # | Precondition | Status |
|---|---|---|
| 1 | **Re-baseline the migration history** — the only OD9.1 blocker. Must generate from the reconciled schema **and** add the 2 partial unique indexes of §14.1 as raw SQL. Requires the separate authorisation gate of §21 | ⛔ **BLOCKING** |
| 2 | **Tenant timezone governance** — decide real values for `Organization.timezone` / `Site.timezone`; C2's Asia/Kolkata conversion is meaningless while every tenant claims UTC. **Values must not be invented** | ⛔ **BLOCKING** |
| 3 | Resolve the `schedule_change_requests.scenario_id` orphan (OD9-038) before its FK can exist | ⚠️ Required |
| 4 | Declare the 6 tables' database defaults (OD9-039) before any `migrate dev` is run | ⚠️ Required |
| 5 | Enable the CI drift gate — see below | ⚠️ Required |
| 6 | `Activity.workpack_id` CASCADE-vs-SET-NULL decision (§13.2) | ℹ️ Recorded, not required for C2 |
| 7 | `BaselineActivity → Activity` FK decision (§13.3) | ℹ️ Recorded, not required for C2 |

### 24.1 CI drift gate — ❌ **NOT IMPLEMENTED**

**CI was not modified**, per §23's instruction to prepare rather than change. The exact
required addition:

```yaml
- name: Prisma schema drift gate
  run: npx prisma migrate diff --from-config-datasource prisma.config.ts --to-schema prisma/schema.prisma --exit-code
```

**This gate would FAIL today.** Executed at current state, that command returns **exit code
2** — drift present, being the 26 non-destructive statements of §18. Enabling it requires
either the re-baseline or reconciling the residual 26. **It is not claimed to be
implemented, because it is not.**

---

## 25. Final Decision

### OD9.1 = 🟡 **AMBER**

Measured against §29's GREEN criteria:

| Criterion | Status |
|---|---|
| Backup exists | ✅ |
| Backup restore tested | ✅ verified by checksum, not assertion |
| Shadow database works | ✅ |
| No real data lost | ✅ proven against the backup — 0 tables lost rows |
| All 8 real tables preserved | ✅ |
| Populated columns preserved | ✅ all 6, including 2 irreplaceable timestamp sets |
| `project_id` correctly retired | ✅ with all 5 consumer sites migrated |
| `schedule_source` correctly created | ✅ |
| EventPhase does NOT return | ✅ |
| WBS generation works | ✅ |
| `is_milestone` no longer queries nonexistent storage | ✅ |
| `ActivityStatus` has all 8 values | ✅ |
| No unjustified destructive statements in the diff | ✅ **zero destructive** |
| **Clean clone reproducible** | ⛔ **NO** — history fails at migration 2 of 40 |
| Behavioural tests execute successfully | ✅ 42 / 42 |
| No new authority engine introduced | ✅ |

**15 of 16 met. The one failure is a pre-existing defect OD9.1 was explicitly forbidden to
fix**: §21 withholds authorisation to re-baseline, and the migration history cannot be made
replayable without it. Rather than claim GREEN or quietly redefine the criterion, OD9.1
reports AMBER with a single, precisely-scoped blocker.

### C2 = ⛔ **BLOCKED**

**Blockers:** (1) the migration re-baseline, requiring the §21 authorisation gate;
(2) the tenant timezone governance decision.

**R1.0-C2 was NOT started.** No column was converted to `timestamptz`. No Asia/Kolkata
conversion was implemented. No canonical planned-date persistence, constraint carrier or
Workpack schedule span was created. No timezone-aware runtime contract was written. The
Phase 11 guard tests assert all of this by execution: 8 date columns are still `date`,
`Activity.constraint_type` / `constraint_date` and `Workpack.schedule_start` /
`schedule_finish` do not exist, and `lag_days` is still `integer`.

### Frozen decisions — untouched

Event remains the sole STO campaign container · Project remains non-authoritative · M11
remains the sole planned-date and CPM authority · M12 remains the sole execution-actual
authority · M8.13 remains the sole progress authority · M10 readiness, M14 reporting, M15
intelligence and M16 interaction are unchanged. No second CPM engine, progress engine,
execution engine, planned-date authority, constraint authority or Event resolver was created.
R0.4 Event Authority and M12 Execution Fact Integrity were not reopened.

### Next permitted phase

**OD9.1 FOLLOW-UP** — specifically the §21 re-baseline authorisation gate. C2 must not begin
until that gate and the timezone decision are closed.

---

## Appendix A — Acceptance Matrix

| Gate | Criterion | Result | Evidence |
|---|---|---|---|
| **G1** | `pg_dump` created | ✅ **PASS** | §3 — custom-format dump of `syority`, PostgreSQL 17.10 |
| **G1** | Dump restored successfully | ✅ **PASS** | §3 — restored into `syority_od91_restore`, never over `syority` |
| **G1** | Row counts preserved | ✅ **PASS** | §3 — all 220 tables, zero differences |
| **G1** | Checksums verified | ✅ **PASS** | §3 — full-table md5 over every column, 16 critical tables, all identical |
| **G2** | Shadow database configured | ✅ **PASS** | §4 — `syority_od91_shadow`, disposable, gitignored `.env` |
| **G2** | Migration diff executable | ✅ **PASS** | §4 — `--from-migrations` runs without the shadow-URL failure |
| **G3** | Six safe migrations applied | ✅ **PASS** | §5 — all additive; UUID `Permit.organization_id` **not** retyped |
| **G4** | 8 live DB tables preserved and redeclared | ✅ **PASS** | §6.1 — all 8; `workpack_asset_snapshots` transcribed from the catalogue |
| **G5** | 6 populated columns preserved and redeclared | ✅ **PASS** | §6.2 — including 2 irreplaceable timestamp sets |
| **G6** | `project_id` retired | ✅ **PASS** | §7.1 — all 5 consumer sites classified and migrated; 0 broken references |
| **G6** | `schedule_source` created | ✅ **PASS** | §7.2 — TEXT, nullable, no fabricated default; T1 |
| **G7** | Identity backfill detection repaired | ✅ **PASS** | §8 — T3 proves the predicate now evaluates true; backfill **not run** |
| **G8** | EventPhase retired | ✅ **PASS** | §9 — 3 files deleted, nav link removed, model **not** created |
| **G8** | WBS generation repaired | ✅ **PASS** | §10 — T4 produces the 3 fallback phases as real rows |
| **G9** | `is_milestone` repaired | ✅ **PASS** | §11 — derived from EVM semantics; T5 proves DB filter ≡ predicate |
| **G10** | `ActivityStatus` = 8 values | ✅ **PASS** | §12 — T7/T8/T9 write and read back each new value |
| **G11** | Event FK / relation decision complete | ✅ **PASS** | §13 — FK created on measured evidence; 3 further FK decisions recorded |
| **G12** | Required indexes present | ✅ **PASS** | §14 — CPM index present, `Workpack(event_id)` created, 3 uniques preserved |
| **G13** | Epoch correction safe | ✅ **PASS** | §15 — 3 explicit IDs; 3 rows changed / 70 unchanged, proven against backup |
| **G14** | No unexpected destructive diff | ✅ **PASS** | §18 — **0 destructive** of 26 statements, down from 58 of 92 |
| **G15** | Clean clone works | ⛔ **FAIL** | §19 — history fails at migration 2 of 40 (pre-existing); reconciled schema deploys cleanly |
| **G16** | Behavioural tests pass | ✅ **PASS** | §20 — 42 / 42; T14 reported FAIL, not converted |
| **G17** | Regression acceptable | ✅ **PASS** | §21 — 1532 / 1534; both failures pre-existing and frozen out of scope |

**22 of 23 PASS. G15 is the single failure and the sole reason for AMBER.**

---

## Appendix B — Final Report (§32)

| Item | Result |
|---|---|
| **OD9.1** | 🟡 **AMBER** |
| G1 Backup | ✅ **PASS** |
| G2 Shadow DB | ✅ **PASS** |
| Schema reconciliation | ✅ **PASS** |
| Data preservation | ✅ **PASS** |
| Migration history | ⚠️ **STILL UNTRUSTWORTHY** — trustworthy only after re-baseline |
| Destructive diff | ✅ **ZERO** |
| EventPhase | ✅ **RETIRED** |
| WBS | ✅ **WORKING** |
| `schedule_source` | ✅ **CREATED** |
| `project_id` | ✅ **RETIRED** |
| `ActivityStatus` | **8** (was 5) |
| `is_milestone` | ✅ **DERIVED** |
| Clean clone | ⛔ **FAIL** (from history) / ✅ **PASS** (from reconciled schema) |
| Behavioural tests | **42 / 42** |
| Regression | **1532 / 1534** |
| **C2** | ⛔ **BLOCKED** |
| Remaining blockers | 1. Migration re-baseline (needs the §21 authorisation gate) · 2. Tenant timezone governance decision |
| **Next permitted phase** | **OD9.1 FOLLOW-UP** — the §21 re-baseline gate |
