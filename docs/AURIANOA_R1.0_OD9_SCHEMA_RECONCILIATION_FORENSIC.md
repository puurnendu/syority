# AURIANOA R1.0 — OD9
# DATABASE / PRISMA SCHEMA RECONCILIATION FORENSIC AUDIT
## Migration Safety Gate Before R1.0-C2

**Status:** COMPLETE · READ-ONLY FORENSIC + MIGRATION DESIGN
**Date:** 2026-09-10
**Database:** `syority` @ localhost:5432 · **PostgreSQL 17.10** · session `TimeZone = Asia/Calcutta`
**Prisma:** 7.5.0 client / 7.4.1 CLI · authoritative schema `prisma/schema.prisma`

### Governing inputs (read in full)

| Document | Role |
|---|---|
| `docs/AURIANOA_R1.0_C1_TIME_AUTHORITY_CONTRACT.md` | **FROZEN.** The semantic contract C2 must implement |
| `docs/AURIANOA_R1.0_OD1_OD6_PRODUCT_DECISION_GATE.md` | OD1/OD6 GREEN |
| `docs/AURIANOA_R1.0_D8_D9_D10_TIME_SEMANTIC_DECISION.md` | D8/D9/D10 GREEN |
| `docs/AURIANOA_R1.0_C_TIME_FOUNDATION_IMPLEMENTATION_RESULT.md` | Superseded by C0; retained for audit |

### Closed decisions — NOT reopened by this document

OD1 = GREEN · OD6 = GREEN · D8 = GREEN · D9 = GREEN · D10 = GREEN · C1 = FROZEN ·
R0.4 Event Authority = CLOSED · M11 / M12 / M8.13 authority = unchanged.

---

## 1. Executive Summary

**OD9 is RED. The database and the Prisma schema have drifted in both directions, and the migration
history is not merely damaged — it never described this database in the first place.**

### 1.1 The single most important finding

> **The baseline migration was never executed against this database.**

Proven by contradiction between the migration file and the live catalogue [EXECUTED]:

| Object | `20260226000000_baseline/migration.sql` says | Live database has |
|---|---|---|
| `Activity_event_id_fkey` | `:3213` creates it | ❌ **does not exist** |
| `Activity_activity_library_id_fkey` | `:3216` creates it | ❌ **does not exist** |
| `Activity_created_by_fkey` / `_updated_by_fkey` | `:3222`, `:3225` create them | ❌ **do not exist** |
| `Activity_workpack_id_fkey` | `:3210` — `ON DELETE CASCADE` | ✅ exists but **`ON DELETE SET NULL`** |

A migration that had run would have produced those constraints. They are absent, and one that *is*
present has the wrong delete rule. Meanwhile `_prisma_migrations` records the baseline as applied
**with `applied_steps_count = 0`** — the signature of `prisma migrate resolve --applied`, which
writes a success row **without executing any SQL**.

**Conclusion [INFERENCE — strong, from executed catalogue evidence]:** the schema was materialised by
a `prisma db push`-equivalent operation from a schema snapshot, and the migration history was then
back-filled as bookkeeping. **31 of 32 history rows record zero applied steps.** Exactly one
migration in the entire history ever executed a step.

### 1.2 The drift is bidirectional and now exactly quantified

| Direction | Count | Evidence |
|---|---|---|
| **Prisma declares, DB lacks** | **2 models**, **2 columns**, **3 enum values**, 3 indexes, ~10 columns | [EXECUTED] model/table set difference + `migrate diff` |
| **DB holds, Prisma lacks** | **8 tables** (3 populated: 30 + 6 + 2 rows), **~16 columns** (6 populated) | [EXECUTED] |
| **Code references, neither has** | **2 concepts across 8 consuming files** — `EventPhase` (5 files, incl. a live nav link and **a second broken feature: WBS generation**), `Activity.is_milestone` (3 sites, incl. Primavera export) | [SOURCE] |

**213 Prisma models · 219 application tables · 38 enums on both sides.** The set difference is
exactly `213 + 8 = 219 + 2 = 221`, so the census is closed and complete — there are no unexplained
objects.

### 1.3 The destructive diff is worse than B2 recorded

B2 recorded 8 tables dropped, 3 populated. **That is correct but incomplete.** The same diff also
issues `DROP COLUMN` against **six populated columns**, and two of them carry **irreplaceable
provenance timestamps** [EXECUTED]:

| Column | Rows with data | Reconstructible? |
|---|---|---|
| `ActivityLibrary.library_scope` | **250 / 250** (all `'TENANT'`) | Yes — uniform value |
| `Organization.lifecycle_status` | **372 / 372** (all `'active'`) | Yes — uniform value |
| `ActivityUdfDefinition.is_exportable` | **55 / 55** | Probably — boolean |
| `ActivityUdfDefinition.is_progress_driving` | **55 / 55** | Probably — boolean |
| **`asset_attribute_history.created_at`** | **16 / 16** | ❌ **NO — per-row timestamps** |
| **`asset_attribute_values.entered_at`** | **6 / 6** | ❌ **NO — per-row timestamps** |

> **Running the current diff would delete 38 rows of table data AND 22 provenance timestamps that
> cannot be recovered from anything else in the system.**

### 1.4 The timezone conversion is now PROVEN, and it must not rely on the session default

Executed on the live database [EXECUTED]:

```
src date                                    2026-08-29   (stored as `date`)
'2026-08-29'::date::timestamptz             2026-08-29 00:00:00 IST   ← session = Asia/Calcutta
  ... same instant in UTC                   2026-08-28 18:30:00
timezone('UTC',  '2026-08-29'::timestamp)   2026-08-29 05:30:00 IST   ← WRONG by +05:30
timezone('Asia/Kolkata', ...::timestamp)    2026-08-29 00:00:00 IST   ← CORRECT
```

A bare `ALTER COLUMN ... TYPE timestamptz` uses **the session `TimeZone` at the moment the migration
runs**. Under this server's default (`Asia/Calcutta`) it produces exactly the intent frozen in C1
§17 — midnight in Asia/Kolkata. **Under a UTC session it silently produces 05:30 IST on every
historical date.** The migration must therefore carry an **explicit `USING ... AT TIME ZONE
'Asia/Kolkata'`** clause and must not depend on the ambient session (§18).

### 1.5 Good news that materially de-risks C2

Four findings reduce the work rather than adding to it:

1. **All 6 unapplied migrations are fully idempotent** (`ADD COLUMN IF NOT EXISTS`,
   `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`) [SOURCE]. Applying them is safe and
   **removes 2 `CREATE TABLE`, 2 `CREATE INDEX` and 7 `ADD COLUMN` from the destructive diff.**
2. **The enum fix is purely additive** — `ALTER TYPE "ActivityStatus" ADD VALUE` × 3. `ActivityStatus`
   is the **only** value-level enum drift in all 38 enums [EXECUTED].
3. **The authoritative DDL for the three B7 resource models already exists** in
   `prisma/migrations/20260829000000_add_resource_planning/migration.sql:111-146`. Re-declaration is
   transcription, not design.
4. **The database is 22 MB with 2 994 live tuples across 48 non-empty tables** [EXECUTED]. A verified
   `pg_dump` + test restore is minutes of work, not a project.
5. **Two of the code-side defects need no schema change at all.** `EvmCalculationService.ts:106-112`
   already derives milestone-ness from `work_category`/zero duration, so the three `is_milestone`
   queries can adopt it; and deleting two lines from `wbs/generate/route.ts` **repairs WBS
   generation, which is currently broken for every event** (§25.2).

### 1.6 `Activity.project_id` has no data to preserve anywhere

| Carrier | Rows | Populated |
|---|---|---|
| `Activity.project_id` | — | **column does not exist** |
| `Workpack.project_id` | 199 | **0** |
| `Permit.project_id` | 0 | 0 |
| `ScheduleBaseline.project_id` | 10 | **1** |
| **`Project` table** | **0 rows** | — |

`Project` is empty, and no migration in the repository has ever created `project_id` or
`schedule_source` on `Activity`. They are **stale declarations**, not a missing migration (§7).

### 1.7 Required declarations

| Question | Answer |
|---|---|
| **OD9** | 🔴 **RED** |
| **Database/Prisma reconciliation** | ⛔ **NOT SAFE** (today) — but **safely achievable**; sequence in §23 |
| **Migration baseline** | ⛔ **NOT TRUSTWORTHY** |
| **Destructive diff** | ⛔ **STILL PRESENT** |
| **B7** | ✅ **RESOLVED BY DESIGN** (§8) |
| **EventPhase** | ✅ **RETIRE CALLER** (§9) |
| **Timezone conversion** | ✅ **PROVEN** (§18) |
| **C2** | ⛔ **BLOCKED** |
| **Next permitted phase** | **OD9 FOLLOW-UP** — execute §23 Phases 1–10 |

---

## 2. Scope / Non-Scope

### In scope

Establishing the real physical schema; the authoritative declared schema; how and when they
diverged; which data-bearing structures must be preserved; the exact non-destructive sequence to a
trustworthy migration baseline; and the proven semantics of the `date`/`timestamp` → `timestamptz`
conversion that C2 will perform.

### Out of scope, and verified untouched (§31)

Application source · Prisma schema · migration creation or application · `db push` ·
`migrate reset` · destructive `migrate diff` execution · table/column drops · renames · data
deletion · backfill · seeds · tests · UI · code repair · migration-file deletion · history rewriting.

**Nothing found during this task was fixed.** Every finding is recorded and left in place.

### Explicitly NOT re-decided

This document does **not** revisit what a date *means*. C1 froze that. OD9 answers only whether the
database can be changed safely. The two are different problems and are deliberately kept apart.

---

## 3. Evidence Method

### 3.1 What was executed

All database evidence was gathered through the `pg` driver already vendored in the repository, over a
session pinned read-only before any query ran:

```sql
SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;
SET default_transaction_read_only = on;
```

`current_setting('default_transaction_read_only')` returned **`on`** [EXECUTED], so no statement in
this audit could have mutated anything even by accident. Every statement was a `SELECT`.

Two non-mutating CLI commands were used:

| Command | Why it is safe |
|---|---|
| `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` | Introspects and prints SQL to stdout. Applies nothing |
| `prisma migrate diff --from-migrations ... --to-schema ...` | **Refused to run** — requires a shadow database (§14.6) |

### 3.2 What could NOT be verified, and why

| Verification | Status | Reason |
|---|---|---|
| Migrations → schema diff | ⛔ **BLOCKED** | Prisma requires `datasource.shadowDatabaseUrl`; none is configured. Creating a shadow database would alter server state, which §1 forbids. **Substituted with static analysis of the migration SQL** (§14) |
| Clean-clone reproduction | ⛔ **NOT ATTEMPTED** | Requires creating and dropping a database. Analysed statically (§21) |
| Behavioural proof that the 3 missing enum values break M12 at runtime | ⚠️ **[INFERENCE]** | The enum values are provably absent and the writes provably exist; no write was executed |

**This is stated plainly rather than papered over.** Where a claim rests on static evidence it is
labelled `[SOURCE]`; where it rests on executed database evidence, `[EXECUTED]`.

### 3.3 Temporary artefacts

Three query scripts and their captured output were written **outside the repository**, under
`%TEMP%\od9\`, and deleted after use (§31). No file inside `C:\DEV\STO` was created or modified
except this document.

---

## 4. Database Census

### 4.1 Server and instance [EXECUTED]

| Property | Value |
|---|---|
| Database | `syority` |
| Version | **PostgreSQL 17.10** on x86_64-windows (`server_version_num = 170010`) |
| User | `postgres` |
| **Session `TimeZone`** | **`Asia/Calcutta`** (+05:30, `is_dst = false`) |
| `Asia/Calcutta` vs `Asia/Kolkata` | Both resolve to **+05:30** — confirmed aliases, not distinct zones |
| Schemas | **`public` only** |
| Total size | **22 MB** |

### 4.2 Object inventory [EXECUTED]

| Object class | Count | Note |
|---|---|---|
| Tables (`relkind r`) | **220** | 219 application + `_prisma_migrations` |
| **Views** | **0** | Proven absence |
| **Materialised views** | **0** | Proven absence |
| **Sequences** | **0** | All primary keys are UUID — no identity/serial anywhere |
| **Triggers** | **0** | No `updated_at` triggers; the application maintains it |
| Enum types | **38** | |
| Foreign keys | **296** | |
| Non-empty tables | **48** | |
| Live tuples (all tables) | **2 994** | |

> **The absence of views, sequences and triggers is a significant simplification for C2:** the
> `timestamptz` conversion cannot break a view definition, a trigger body or a default expression,
> because none exists. This narrows the conversion's blast radius to columns and application code.

### 4.3 Data-bearing status of every R1.0-relevant table [EXECUTED]

| Table | Status | Rows |
|---|---|---|
| `Activity` | **DATA_PRESENT** | **73** (72 live, 1 soft-deleted) |
| `Workpack` | **DATA_PRESENT** | **199** |
| `events` | **DATA_PRESENT** | **51** |
| `ActivityRelationship` | **DATA_PRESENT** | **20** |
| `ScheduleBaseline` | **DATA_PRESENT** | **10** |
| `BaselineActivity` | **DATA_PRESENT** | **28** |
| `schedule_scenarios` | **DATA_PRESENT** | **11** |
| `ScenarioActivityOverride` | **DATA_PRESENT** | **11** |
| `schedule_change_requests` | **DATA_PRESENT** | **7** |
| `ProgressLog` | **DATA_PRESENT** | **60** |
| `ResourceCapacity` | **DATA_PRESENT** | **30** ⚠️ drop candidate |
| `ShiftDefinition` | **DATA_PRESENT** | **6** ⚠️ drop candidate |
| `workpack_asset_snapshots` | **DATA_PRESENT** | **2** ⚠️ drop candidate |
| `schedule_scope_changes` / `_items` | **DATA_PRESENT** | 3 / 11 |
| `discovery_work` | **DATA_PRESENT** | 5 |
| `material_supply_records` | **DATA_PRESENT** | 9 |
| `EvmSnapshot` | **DATA_PRESENT** | 1 |
| **`ScheduleCalendar`** | **EMPTY** | **0** — the calendar authority holds nothing (C1 D-15) |
| **`event_milestones`** | **EMPTY** | **0** |
| **`Permit`** | **EMPTY** | **0** |
| **`Project`** | **EMPTY** | **0** — the retired entity carries no data |
| `material_constraints` | **EMPTY** | 0 |
| `EventPhase` / `event_phases` | **DB_ABSENT** | — |
| `m15_management_decisions` / `m16_interaction_logs` | **DB_ABSENT** | — |

### 4.4 Referential integrity spot-checks [EXECUTED]

| Check | Result |
|---|---|
| `Activity.event_id` pointing at a non-existent event | **0** — integrity holds |
| `BaselineActivity.activity_id` pointing at a missing activity | **0** |
| `Activity.event_id IS NULL` | **4** — all named "Test Act 1/2", all in one workpack `cb290c59…` |
| `Activity.workpack_id IS NULL` | **3** |
| **`Workpack.event_id IS NULL`** | **181 of 199** — `under_review` 88, `draft` 46, `approved` 44, `issued` 3 |

> **181 of 199 workpacks are attached to no Event.** Under the R0.4 Event-only architecture these
> workpacks are outside every campaign container, so they are invisible to CPM, to the workpack span
> (C1 §7) and to readiness. This is **not** an OD9 blocker — it changes no schema — but it is
> recorded because C2's span rollout will appear to "do nothing" for 91 % of workpacks
> (**OD9-017**).

---

## 5. Prisma Census

### 5.1 The authoritative schema is unambiguous [SOURCE]

`prisma.config.ts` pins it explicitly:

```
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: { url: process.env["DATABASE_URL"] },
});
```

| Property | Value |
|---|---|
| Authoritative schema | **`prisma/schema.prisma`** — 262.6 KB, **213 models, 38 enums** |
| `datasource db` | `provider = "postgresql"` only — **no `url`** in the schema (Prisma 7 style) |
| **`shadowDatabaseUrl`** | ❌ **NOT CONFIGURED** — this is what blocks `migrate diff --from-migrations` and `migrate dev` (§14.6) |
| `generator client` | `prisma-client-js`, **no `output`** → single client at `node_modules/.prisma/client` |
| Generated clients on disk | **one** (`node_modules/.prisma/client`) |

**There is no ambiguity about which schema is authoritative**, and therefore the stale copies cannot
be silently driving migration generation.

### 5.2 Duplicate / stale schema copies [SOURCE]

`prisma/` contains **nine** additional schema-like files beside the authoritative one, all dated
**28-Mar-2026** — five and a half months older than `schema.prisma` (09-Sep-2026):

| File | Size (bytes) | `datasource`? | `generator`? | Models |
|---|---|---|---|---|
| **`schema.prisma`** (authoritative) | **268,951** | ✅ (no inline `url`) | ✅ (no `output`) | **213** |
| `schema.prisma.clean` | 108,520 | ✅ (`env("DATABASE_URL")`) | ✅ | 111 |
| `schema_clean_download.prisma` | **105,217** | ✅ | ✅ | 110 |
| `schema_server_105kb.prisma` | **105,217** — byte-identical to the above | ✅ | ✅ | 110 |
| `schema_part1.prisma` | 10,206 | ✅ | ✅ | 4 |
| `schema_part2.prisma` … `schema_part5.prisma` | 9,691 / 10,584 / 10,859 / 19,298 | ❌ fragments | ❌ | 9 / 7 / 11 / 14 |
| `test.prisma` | 237 | ✅ **hardcoded localhost URL** | ✅ | 1 |

**None is referenced by any tooling** [PROVEN ABSENCE — searched `package.json`, `prisma.config.ts`,
`.github/workflows/**`, `Dockerfile*`, `docker-compose*`, `*.sh`, `*.ps1`, `*.bat`, `*.cmd`,
`tsconfig.json`, `next.config.*`, and every `--schema=` flag in the repository]. The only mentions are
in documentation. They are **stale**, not active.

**Two findings from the copies that pin down the drift:**

1. **`schema_clean_download.prisma:986-1038` declares `Activity` WITHOUT `project_id` or
   `schedule_source`** [SOURCE]. Since that snapshot is dated 28-Mar-2026, the two phantom fields
   **entered `schema.prisma` after 2026-03-28** — which dates the B1 drift and confirms it was a later
   hand-edit, not an original condition.
2. **No copy declares any of the 8 missing models** [PROVEN ABSENCE — searched all ten `.prisma` files
   for `ShiftDefinition`, `ResourceCapacity`, `WorkpackAssetSnapshot`, `workpack_asset_snapshots`,
   `EventPhase`]. **The lost declarations cannot be recovered from the stale copies** — they must be
   transcribed from the live catalogue, exactly as §8.4 specifies.

**But their existence is the most likely explanation of the drift mechanism [INFERENCE].** A set of
files named *clean*, *download*, *server_105kb* and *part1…part5* is the residue of a manual schema
reassembly. A reassembly that both **lost** declarations the database already had (`library_scope`,
`lifecycle_status`, `is_exportable`, the 8 models) and **introduced** declarations the database never
had (`project_id`, `schedule_source`, three enum values) is exactly the fingerprint observed. They
are retained as evidence and must not be deleted before the reconciliation is complete
(**OD9-014**).

### 5.3 A second, conflicting Prisma configuration surface [SOURCE]

`package.json` also carries a legacy `"prisma": { "seed": "tsx prisma/seed.ts" }` block while
`prisma.config.ts` declares `migrations.seed` with the same value. Prisma 7 honours the config file
and deprecates the `package.json` key. Harmless today because the values agree — but **two config
surfaces that could disagree is a latent hazard** (**OD9-018**, P3).

### 5.4 The drift pattern is documented in the seed script itself [SOURCE]

`prisma/seed.ts` works around a column the client did not know about:

```
await prisma.$executeRaw`UPDATE "User" SET "must_change_password" = TRUE WHERE id = ${adminUser.id}::uuid`;
// must_change_password: true, // Prisma Client doesn't know about this yet
```

`User` shows **no drift in the current diff**, so the comment is now stale — but it records the
established habit: *when Prisma and the database disagree, reach past Prisma with raw SQL.* That habit
is the proximate cause of OD9 (**OD9-019**, P3).

### 5.5 Deployment scripts run `migrate deploy` [SOURCE]

```
"db:sync":    "npx prisma migrate deploy && npx prisma generate",
"deploy":     "prisma migrate deploy && npx prisma db seed && next start",
"deploy:dev": "prisma migrate dev && npx prisma db seed",
```

**`npm run deploy` against this database would attempt the 6 unrecorded migrations.** They are all
idempotent (§14.5), so this is safe *today* — but it is safe by luck, not by design, and
`deploy:dev` invokes `migrate dev`, which **requires the shadow database that is not configured** and
which may offer to reset the database. That is a live foot-gun (**OD9-020**, P1).

---

## 6. Three-Way Schema Matrix

### 6.A Prisma → DB (declared, physically absent) [EXECUTED]

| Object | Kind | Classification | Evidence |
|---|---|---|---|
| `m16_interaction_logs` | model `schema.prisma:2750` | **2 — migration not applied** | migration `20260908_m16_r6_interaction_logs` exists on disk, unrecorded |
| `m15_management_decisions` | model `schema.prisma:2779` | **2 — migration not applied** | migration `20260908_m15_r4_management_decisions` exists, unrecorded |
| `Activity.project_id` | column `:54` (`String?` → TEXT) | **3 — STALE DECLARATION** | **no migration anywhere creates it**; `Project` has 0 rows |
| `Activity.schedule_source` | column `:56` | **3 — STALE DECLARATION** | no migration creates it |
| `ActivityStatus.released` / `.verified` / `.closed` | enum values `:3026-3035` | **1 — INTENDED LIVE OBJECT** | `ExecutionWriteService` writes all three; baseline created only 5 values |
| `Activity_org_event_deleted_idx` | index `:82` | **2 — migration not applied** | `20260908_r01_activity_event_index` on disk, unrecorded |
| `Permit_organization_id_status_idx` | index | **2 — migration not applied** | created by `20260906_m12r01_permit_org_id` |
| `whatsapp_sessions_organization_id_idx` | index | **2 — migration not applied** | |
| `ActivityUdfDefinition` × 7 columns | columns | **2 — migration not applied** | created by `20260906_m12v1_udf_dimension_metadata` |
| `report_generations.dataset_hash` / `dataset_path` / `filters_applied` | columns | **5 — unknown** | no migration located; declared only |
| `whatsapp_sessions.event_id`, `whatsapp_updates.event_id` | columns | **5 — unknown** | declared only |

**Total: 2 models · 2 stale columns · 3 enum values · 3 indexes · ~12 columns.**

### 6.B DB → Prisma (physically present, undeclared) [EXECUTED]

**The set difference is exact and closed: 8 tables.**

| Table | Rows | Classification | Live code consumers |
|---|---|---|---|
| **`ResourceCapacity`** | **30** | **4 — MISSING PRISMA DECLARATION** | `ResourcePlanningService` (15 call sites) |
| **`ShiftDefinition`** | **6** | **4 — MISSING PRISMA DECLARATION** | `ResourcePlanningService` (15 call sites) |
| **`workpack_asset_snapshots`** | **2** | **4 — MISSING PRISMA DECLARATION** | asset-register snapshot path |
| `provisioning_jobs` | 0 | **4 — MISSING PRISMA DECLARATION** | `src/core/Platform/ProvisioningJobService.ts`, `app/platform/provisioning-jobs/` |
| `provisioning_templates` | 0 | **4 — MISSING PRISMA DECLARATION** | `ProvisioningTemplateService.ts`, `app/api/admin/provisioning-templates/` |
| `provisioning_job_logs` | 0 | **4 — MISSING PRISMA DECLARATION** | `ProvisioningWorker.ts` |
| `asset_relationships` | 0 | **4 — MISSING PRISMA DECLARATION** | `src/core/asset-register/` |
| `onboarding_requests` | 0 | **4 — MISSING PRISMA DECLARATION** | `app/platform/onboarding/` |

> **B7 is therefore FOUR TIMES WIDER than recorded.** The previous audit named three models. The
> executed set difference names **eight**, and **five of the eight have live application code and
> routes**. Not one is classifiable as "historical" or "obsolete".

**Undeclared columns (the diff's `DROP COLUMN` list), with data presence [EXECUTED]:**

| Table.column | Rows populated | Classification |
|---|---|---|
| `ActivityLibrary.library_scope` | **250 / 250** = `'TENANT'` | **4 — MISSING DECLARATION** |
| `Organization.lifecycle_status` | **372 / 372** = `'active'` | **4 — MISSING DECLARATION** |
| `ActivityUdfDefinition.is_exportable` | **55 / 55** | **4 — MISSING DECLARATION** |
| `ActivityUdfDefinition.is_progress_driving` | **55 / 55** | **4 — MISSING DECLARATION** |
| **`asset_attribute_history.created_at`** | **16 / 16** | **4 — MISSING DECLARATION, IRREPLACEABLE** |
| **`asset_attribute_values.entered_at`** | **6 / 6** | **4 — MISSING DECLARATION, IRREPLACEABLE** |
| `ActivityUdfDefinition.unit` | 0 | 3 — stale |
| `Asset.area_id` / `corrosion_loop_id` / `design_code` / `parent_asset_id` | 0 each | 3 — stale |
| `ProgressLog.quantity_actual` / `quantity_unit` / `udf_definition_id` | 0 each | 3 — stale |
| `Organization.lifecycle_changed_at` / `lifecycle_changed_by` | 0 | 3 — stale |
| `Permit.site_id` | 0 (table empty) | 3 — stale |
| `workpack_template_activities.condition_expression` / `conditionality` | table empty | 3 — stale |

### 6.C CODE → BOTH (referenced, in neither) [SOURCE]

Both are confirmed absent from the database [EXECUTED: `to_regclass` = NULL for `EventPhase`;
`is_milestone` absent from `Activity`'s 48 columns] **and** from `prisma/schema.prisma`
[SOURCE — the 213-model inventory contains no `EventPhase`; the `Activity` model has no
`is_milestone` field and no `event_phases` relation].

**`EventPhase` — 5 consuming files, not one:**

| Reference | Location | Effect |
|---|---|---|
| `prisma.eventPhase.create` | `app/api/events/[eventId]/phases/route.ts:22` | Accessor does not exist on the client |
| **`include: { event_phases: ... }`** | `app/(dashboard)/events/[eventId]/phases/page.tsx:15-18` | **Prisma validation error** — unknown relation |
| **`include: { event_phases: true }`** | **`app/api/events/[eventId]/wbs/generate/route.ts:14-17, 46`** | **Breaks WBS generation — a different feature** |
| Live navigation link "⏱️ Phases" | `app/(dashboard)/events/[eventId]/page.tsx:94-98` | **User-reachable** from the event detail page |
| `fetch(.../phases, POST)` | `app/(dashboard)/events/[eventId]/phases/PhasesClient.tsx:24` | The client caller |

**`Activity.is_milestone` — 2 report providers plus the export path:**

| Reference | Location | Classification |
|---|---|---|
| `MilestoneTrackerProvider` — `where: { is_milestone: true }` | `PlanningIntelligenceProviders.ts:231` | **1 — ACTIVE BROKEN FEATURE** |
| `UpcomingMilestonesProvider` — `where: { is_milestone: true }` | `PlanningIntelligenceProviders.ts:433` | **1 — ACTIVE BROKEN FEATURE** |
| **Primavera export selects `is_milestone`** | **`app/api/workpacks/[id]/export/primavera/route.ts:52`** | **1 — ACTIVE BROKEN FEATURE + integration impact (§22.3)** |
| `PrimaveraXmlFormatter.ts:24, 78` | formatter input contract | consumes the phantom field |
| `MsProjectXmlParser.ts:23, 212` · `P6XmlParser.ts:19, 139` · `P6XerParser.ts:19, 99` | import parsers | Set `ParsedActivity.is_milestone` **in memory only — never persisted** |

Both providers are registered at import time in
`src/core/report-engine/providers/index.ts:47-62`, so they are reachable through
`ProviderRegistry.fetch` from the OIS widget route, the report-builder generate/preview routes and
the BRE KPI engine. **They are not dead code.**

---

## 7. B1 — `Activity.project_id`

### 7.1 The exact mismatch [EXECUTED + SOURCE]

`Activity` has **48 physical columns**. Neither `project_id` nor `schedule_source` is among them.
Prisma declares both:

```54:56:prisma/schema.prisma
  /// Legacy project association (used by old P6/MPP import path; prefer event_id)
  project_id                 String?
  /// Provenance: 'workpack' (native) | 'imported' (legacy P6/MPP) | null
  schedule_source            String?
```

`String?` without `@db.Uuid` → the diff proposes `ADD COLUMN "project_id" TEXT`, i.e. **TEXT, not
UUID** — so it would not even have matched `Project.id`'s type had it existed.

### 7.2 No migration has ever created them [SOURCE — proven absence]

Every `.sql` file under `prisma/migrations/**` was searched.

| Question | Answer |
|---|---|
| Does the baseline's `CREATE TABLE "Activity"` include them? | ❌ **No.** `20260226000000_baseline/migration.sql:883-934` declares 47 columns; neither appears |
| Does any migration `ADD COLUMN` them? | ❌ **No.** The only `ALTER TABLE "Activity"` statements in the entire migration set are: `m8_13_standard_activity_types.sql:25-27` (`standard_activity_type_id`), `20260303140000_add_whatsapp_integration:24` (`responsible`), `add_activity_window.sql:1` (`window`), `phase1_expansion.sql:84-87` (`early_*`/`late_*`) |
| Does any migration `DROP` them? | ❌ **No** |

> **They were never in the database and never removed from it. They were added to the schema file
> directly.** This is a *stale declaration*, not an unapplied migration — the opposite classification
> from the m15/m16 models.

### 7.3 There is no data to preserve [EXECUTED]

`Project` = **0 rows**. `Workpack.project_id` = **0 of 199** populated. `Permit` = 0 rows.
`ScheduleBaseline.project_id` = **1 of 10** populated (against `event_id` = 9 of 10).

### 7.3a But there is a substantial live code surface [SOURCE]

The columns carry no data — yet production code reads and writes them at **12 sites**. This is what
makes B1 a runtime failure rather than a dormant declaration.

**Writes:**

| Site | Field | Value |
|---|---|---|
| **`src/core/activity/ActivityCreationCommand.ts:486`** | **`schedule_source`** | **`workpack ? 'workpack' : legacyProjectId ? 'imported' : null` — set on EVERY activity creation** |
| `src/core/activity/ActivityCreationCommand.ts:488` | `project_id` | `legacyProjectId`, when supplied |
| `src/lib/services/ProjectBranchingService.ts:47-50` | `project_id` | `baseline.id` — a direct `tx.activity.create` that bypasses the command |

> **`ActivityCreationCommand` is the single authoritative Activity creation path, and it writes
> `schedule_source` unconditionally.** Every creation route in the system funnels through it —
> the generic activities API, the workpack activities API, bulk create, template instantiation,
> workpack clone, scope-change, AI generate. **All of them therefore emit an `INSERT` naming a column
> that does not exist.** B1 is not "some reads fail"; it is *the* creation path.

**Reads and filters:**

| Site | Field |
|---|---|
| `src/modules/Scheduling/Services/SchedulingService.ts:56, 195, 231, 307` | `project_id` (4 sites, `OR` with `workpack.project_id`) |
| `app/api/projects/[id]/schedule/route.ts:55, 74-75` | `project_id` |
| `app/api/projects/[id]/schedule/route.ts:23-25, 60-62` | `schedule_source` (`'workpack'` / `null` / `'imported'`) |
| `app/api/projects/[id]/imported-schedule/route.ts:16, 18, 31-32` | both |
| `app/api/projects/[id]/schedule/export/xer/route.ts:21` | `project_id` |
| `src/core/activity/ActivityIdentityBackfillService.ts:47` | `schedule_source === 'imported'` |

**Two workarounds already exist in the codebase, and one of them fails silently:**

| Workaround | Consequence |
|---|---|
| `src/core/activity/identityBackfillPrismaStore.ts:49-56` **explicitly omits `project_id`** from its raw `SELECT` on `"Activity"` | Deliberate evidence that someone already hit this defect and routed around it |
| …but the same store also omits **`schedule_source`**, while `ActivityIdentityBackfillService.ts:47` tests `row.schedule_source === 'imported'` | **The test is always `undefined === 'imported'` → always false. The backfill's legacy-activity detection silently never fires** (**OD9-030**, P1) |
| `src/components/Schedule/ScheduleContainer.tsx:968-974` PUTs `{ project_id }` to `/api/activities/[id]` | Dead: the route's allow-list at `app/api/activities/[id]/route.ts:27-31` strips it |

### 7.4 Migration recommendation — NOT executed

> **RECOMMENDATION: REMOVE both fields from `prisma/schema.prisma`. Do NOT add the columns to the
> database.**

| Reason | Evidence |
|---|---|
| R0.4 is CLOSED — `Project` is not operational STO authority | Governing decision |
| `Project` holds **zero rows**; nothing can be orphaned | [EXECUTED] |
| No migration ever created the columns — adding them would be inventing schema, not restoring it | [SOURCE] |
| `Activity.event_id` already carries the Event association, and 69 of 73 activities populate it | [EXECUTED] |
| C1 §19 needs provenance, but the schema's own comment routes it through `schedule_source`, which likewise never existed | [SOURCE] |

**One dependency must be settled first, and it is a C1 matter, not an OD9 one:** C1 §19.2 relies on
`Activity.schedule_source` as the existing import-provenance carrier. **That reliance is void — the
column does not exist and never did.** C2 must therefore either create `schedule_source` as a *new*
column with an explicit migration, or specify a different provenance carrier. Recorded as
**OD9-021** and flagged back to C1 §19 as a correction, not resolved here.

### 7.5 The recommendation is correct in direction but not cheap in code [SOURCE]

Removing the two fields from Prisma is a one-line schema edit **and a non-trivial code change**,
because 12 call sites reference them and `Project` still has a large live surface:

| Surface | Extent |
|---|---|
| `app/api/projects/**` route files | **28** |
| `app/(dashboard)/projects/**` page files | **14** |
| Project routes that touch `Activity` | **11** |
| Project routes that filter **`Activity.project_id` directly** | **3** — `schedule/route.ts`, `imported-schedule/route.ts`, `export/xer/route.ts` |

**Therefore the two fields are separable and must be decided separately:**

| Field | Recommendation | Rationale |
|---|---|---|
| **`Activity.project_id`** | **REMOVE from Prisma**, and retire or re-point the 3 filtering routes to `event_id` | R0.4 is closed, `Project` has 0 rows, no migration ever created it, and its only writer is the legacy import path |
| **`Activity.schedule_source`** | **CREATE it explicitly with a migration** — do **not** remove | `ActivityCreationCommand:486` writes it on every creation, C1 §19 depends on it for provenance, and removal would delete the only provenance signal the design asks for. This is the one place where "add the column" is the right answer |

> **This splits OD9-001 into two different remedies.** The earlier framing treated both fields as one
> stale-declaration defect. They are not: one should disappear, the other should become real.

**Nothing was removed and nothing was created.** Both fields remain exactly as found.

---

## 8. B7 — Missing Prisma Models

### 8.1 The three named objects, in full [EXECUTED]

#### `ShiftDefinition` — 6 rows

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `id` | `uuid` | NO | — |
| 2 | `organization_id` | `uuid` | NO | — |
| 3 | `event_id` | `uuid` | NO | — |
| 4 | `shift_name` | `text` | NO | — |
| 5 | **`start_time`** | **`text`** | NO | — |
| 6 | **`end_time`** | **`text`** | NO | — |
| 7 | `is_active` | `boolean` | YES | `true` |
| 8–9 | `created_by`, `updated_by` | `uuid` | YES | — |
| 10–12 | `created_at`, `updated_at`, `deleted_at` | `timestamp(3)` | NO/NO/YES | `CURRENT_TIMESTAMP` |

FKs: `event_id → events.id` RESTRICT · `organization_id → Organization.id` RESTRICT.
Indexes: PK · **UNIQUE `(event_id, shift_name)`** · `(event_id)` · `(organization_id)`.

#### `ResourceCapacity` — 30 rows

| # | Column | Type | Null |
|---|---|---|---|
| 1–3 | `id`, `organization_id`, `event_id` | `uuid` | NO |
| 4 | `resource_type_id` | `uuid` | NO |
| 5 | `contractor_id` | `uuid` | YES |
| 6 | `shift_id` | `uuid` | YES |
| 7 | **`target_date`** | **`date`** (precision 0) | NO |
| 8 | `capacity_limit` | `numeric(10)` | NO |
| 9 | `notes` | `text` | YES |
| 10–14 | `created_by`, `updated_by`, `created_at`, `updated_at`, `deleted_at` | | |

FKs: `event_id → events` RESTRICT · `organization_id → Organization` RESTRICT ·
`resource_type_id → ResourceType` RESTRICT · `contractor_id → Contractor` SET NULL ·
**`shift_id → ShiftDefinition` SET NULL**.
Indexes: PK · **UNIQUE `(event_id, resource_type_id, contractor_id, shift_id, target_date)`** ·
`(event_id)` · `(organization_id)` · `(resource_type_id)`.

#### `workpack_asset_snapshots` — 2 rows

| # | Column | Type | Null |
|---|---|---|---|
| 1–3 | `id`, `workpack_id`, `asset_id` | `uuid` | NO |
| 4 | `snapshot_revision` | `text` | NO |
| 5–6 | `asset_data_json`, `attributes_json` | `jsonb` | NO |
| 7–9 | `nozzles_json`, `lines_json`, `documents_json` | `jsonb` | YES |
| 10 | `snapshotted_by` | `uuid` | NO |
| 11 | `snapshotted_at` | `timestamp(3)` | NO |

FKs: `workpack_id → Workpack` RESTRICT · `asset_id → Asset` RESTRICT.
Indexes: PK · **UNIQUE `(workpack_id, snapshot_revision)`** · `(workpack_id)`.

### 8.2 Provenance — the mechanism of the loss is established [SOURCE]

The authoritative DDL for `ShiftDefinition` and `ResourceCapacity` is still in the repository at
`prisma/migrations/20260829000000_add_resource_planning/migration.sql:111-146`. That same migration
also contains `ALTER TYPE "WorkpackStatus" ADD VALUE 'in_execution'` and `'completed'` at `:9-10` —
**and the live database has all 9 `WorkpackStatus` values** [EXECUTED].

> **So this migration's SQL demonstrably reached the database, yet `_prisma_migrations` records it
> with `applied_steps_count = 0`.** The effects are present; the history denies them. The models were
> not "forgotten" — they were **dropped from `schema.prisma` after the DDL had already run**.

The application compensated instead of fixing it: `src/components/planner-workspace/resources/types.ts:1-10`
declares **hand-written TypeScript interfaces** for these entities rather than using generated Prisma
types, which is why the loss type-checked cleanly while failing at runtime.

### 8.3 Operational meaning and disposition

| Object | Meaning | Safe to preserve? | Faithfully representable in Prisma? | Category |
|---|---|---|---|---|
| `ShiftDefinition` | **The plant's real working time** — Day 06:00→18:00, Night 18:00→06:00 across 3 events. The input C1 §10.9/§11 needs and C4 depends on | ✅ Yes | ✅ Yes | **RESOURCE** |
| `ResourceCapacity` | Per-date, per-type, per-shift capacity ceilings. Constrains **levelling**, not CPM dates (C1 §4.3b) | ✅ Yes | ✅ Yes | **RESOURCE** |
| `workpack_asset_snapshots` | Immutable point-in-time asset payloads per workpack revision — an **audit artefact** | ✅ Yes | ✅ Yes (jsonb) | **SNAPSHOT** |
| `provisioning_jobs` / `_templates` / `_job_logs` | Tenant provisioning pipeline with live services and platform routes | ✅ Yes (empty) | ✅ Yes | **CORE (platform)** |
| `asset_relationships` | Asset hierarchy/relationship graph | ✅ Yes (empty) | ✅ Yes | **CORE** |
| `onboarding_requests` | Onboarding intake with a live platform page | ✅ Yes (empty) | ✅ Yes | **CORE (platform)** |

**None is `LEGACY`. None is `RETIRE`.** All eight require re-declaration.

### 8.4 Re-declaration design — NOT implemented

> **No Prisma model is created by this document.** The following is the design C2 must transcribe.

**Method (safest available):** introspect into a *scratch* schema file, then hand-merge the eight
models into `prisma/schema.prisma`, preserving:

| Rule | Why |
|---|---|
| `start_time` / `end_time` remain **`String`** (text) | A shift boundary is a **time-of-day**, not an instant. It must **not** be swept into the `timestamptz` conversion (C1 D-38) |
| `target_date` remains **`@db.Date`** | It is a capacity *bucket* (a calendar day), not a scheduled instant. C1 §17 does not convert it |
| `snapshotted_at` remains `timestamp(3)` | Audit provenance |
| All composite uniques reproduced exactly | They are load-bearing upserts |
| All FK delete rules reproduced exactly (`SET NULL` for `shift_id`/`contractor_id`, `RESTRICT` elsewhere) | Prisma's default would differ |
| No column added, renamed or retyped during re-declaration | Re-declaration must produce an **empty** diff, nothing more |

**Acceptance:** after re-declaration, `prisma migrate diff --from-config-datasource --to-schema` must
contain **zero `DROP TABLE`** statements.

---

## 9. EventPhase Investigation

### 9.1 What the route attempts [SOURCE]

```22:30:app/api/events/[eventId]/phases/route.ts
    const phase = await prisma.eventPhase.create({
      data: {
        organization_id: orgId,
        event_id: eventId,
        name,
        planned_start: planned_start ? new Date(planned_start) : null,
        planned_end: planned_end ? new Date(planned_end) : null,
      }
    });
```

A `POST` handler that authenticates, verifies the Event, then calls **`prisma.eventPhase.create`** with
`organization_id`, `event_id`, `name`, `planned_start`, `planned_end`.

### 9.2 It exists nowhere [EXECUTED + SOURCE]

| Location | Result |
|---|---|
| Live database — `to_regclass('public."EventPhase"')` | **NULL** [EXECUTED] |
| Live database — `to_regclass('public.event_phases')` | **NULL** [EXECUTED] |
| `prisma/schema.prisma` model inventory (213 models parsed) | **absent** [SOURCE] |
| Any migration `.sql` creating a phase table | **none** [SOURCE — proven absence] |

`prisma.eventPhase` is therefore **not a property of the generated client**, so the route throws
`TypeError: Cannot read properties of undefined` on its first line of real work — caught by its own
`try/catch` and returned as a generic `500`. **The failure is invisible to monitoring.**

### 9.2a It is not one orphan route — it is five files, and it breaks a second feature

The `EventPhase` concept has a **complete front-end and a live entry point**, and the phantom
`event_phases` relation has leaked into an unrelated feature [SOURCE]:

| File | Line | What it does | Effect |
|---|---|---|---|
| `app/(dashboard)/events/[eventId]/page.tsx` | 94-98 | `<Link href={/events/${eventId}/phases}>` labelled **"⏱️ Phases"** | **A user-reachable link on the event detail page** |
| `app/(dashboard)/events/[eventId]/phases/page.tsx` | 15-18 | `prisma.event.findFirst({ include: { event_phases: { orderBy: { planned_start: 'asc' } } } })` | **Prisma validation error** — unknown relation on `Event` |
| `app/(dashboard)/events/[eventId]/phases/PhasesClient.tsx` | 24, 72-74 | POSTs to the route; renders `phase.status` | Renders a field the POST never sets |
| **`app/api/events/[eventId]/wbs/generate/route.ts`** | **14-17, 46** | **`include: { event_phases: true }`, then reads `event.event_phases.length`** | **Breaks WBS generation — an entirely different feature** |
| `app/(dashboard)/events/[eventId]/wbs/EventWbsManagerClient.tsx` | 52 | `fetch(.../wbs/generate, POST)` | The user-facing trigger for the broken route |

> **The most consequential discovery here is the WBS generate route.** It is not part of the phase
> feature at all — it merely *reads* the phantom relation to decide its WBS structure. Because Prisma
> rejects the unknown `include` before the handler body runs, **WBS generation fails for every event**,
> and its own carefully written fallback — hardcoded `[Pre-TA, Execution, Post-TA]` at
> `wbs/generate/route.ts:46-50` — **is unreachable**. The fallback was written for the case where
> `event_phases` is *empty*, not for the case where the relation does not exist.

**This changes the disposition of the phantom relation but not of `EventPhase` itself.** Retiring the
route alone would leave WBS generation broken. **The `include: { event_phases: … }` at
`wbs/generate/route.ts:14-17` must be removed and its fallback made the primary path** — a small
change that repairs a real feature (**OD9-007**, upgraded).

Corroborating compile evidence: `docs/M8.5_TS_ERRORS_FULL.txt:10-11, 118` records TypeScript errors
for both `event_phases` and `eventPhase` — **the breakage was observed and recorded at build time and
then left in place** [SOURCE].

### 9.3 Decision: RETIRE THE CALLER

The decision rule in the instruction resolves cleanly: neither table nor data exists, and no
completed feature exists.

> **RETIRE the route. Do NOT create `EventPhase`.**

**And there is a second, stronger reason than absence.** The route authors a **`planned_start` /
`planned_end` pair on a phase entity** — a third authored planned window, after the Event window and
the retired Workpack window. C1 §6.1 freezes the Event as the sole owner of the campaign commitment
window and §7.1 retires the Workpack window precisely to eliminate a second authority.

> **Reviving `EventPhase` as written would re-introduce the exact defect OD1 was opened to remove.**
> Retirement is not merely cleanup — it is required for consistency with the frozen contract.

Phase-like intent, where it is genuinely needed, already has a carrier: **`event_milestones`**
(`planned_date` / `actual_date`, `milestone_type`, `sort_order`) — 0 rows today, owned by the Event,
and already inside C1's fact catalogue as fact **N**. Any future phase requirement must be satisfied
there or through an explicit new C1 amendment, **not** by resurrecting this route.

### 9.4 `Activity.is_milestone` — the mirror case, and it is LIVE

The column is absent from all 48 physical `Activity` columns [EXECUTED], absent from
`prisma/schema.prisma` [SOURCE], and created by no migration [SOURCE — proven absence across all
`prisma/migrations/**/*.sql`; the baseline's `CREATE TABLE "Activity"` at `:884-934` has no such
column].

**Three production sites query it, not one** [SOURCE]:

| Site | Query |
|---|---|
| `PlanningIntelligenceProviders.ts:231` | `MilestoneTrackerProvider` — `where: { organization_id, is_milestone: true, …eventScope }` |
| `PlanningIntelligenceProviders.ts:433` | `UpcomingMilestonesProvider` — `where: { …, is_milestone: true, actual_end: null, early_finish: { gte: now, lte: in14d } }` |
| **`app/api/workpacks/[id]/export/primavera/route.ts:52`** | **Primavera export selects `is_milestone`** — see §22.3 |

Both providers are registered at import time (`providers/index.ts:47-62`) and reachable through
`ProviderRegistry.fetch` from the OIS widget data route, the report-builder generate and preview
routes, and the BRE KPI and formula engines. **Classification 1 — active broken feature**, not a dead
caller.

**Disposition: fix the query. Do NOT add an `is_milestone` column.** Adding it would create a second
milestone carrier alongside `event_milestones` and violate C1's store-once rule.

**And the correct pattern already exists in the codebase** [SOURCE]:

```106:112:src/core/evm/EvmCalculationService.ts
    // isMilestone derived, not stored: work_category === 'MILESTONE' OR zero duration
```

`EvmCalculationService` **derives** milestone-ness from `work_category === 'MILESTONE'` or
`duration_hours` being `0`/null, rather than reading a stored flag. That is the pattern the two report
providers should adopt — and it needs no schema change at all.

> **This is the cheapest fix in the entire OD9 register: replace `is_milestone: true` with the
> existing derivation, in three places.** It requires no migration, no new column and no decision
> about milestone authority (**OD9-008**).

**One further finding on the import path:** the P6, XER and MS Project parsers all populate
`ParsedActivity.is_milestone` in memory (`P6XmlParser.ts:19,139` · `P6XerParser.ts:19,99` ·
`MsProjectXmlParser.ts:23,212`) and **no import service ever persists it** [PROVEN ABSENCE].
Milestone information arriving from a client's P6 schedule is parsed and then discarded
(**OD9-031**, P2 — information loss on import, not a schema defect).

---

## 10. Enum Reconciliation

### 10.1 The complete comparison [EXECUTED]

**38 Prisma enums · 38 PostgreSQL enum types · every name matches.** No enum is missing from either
side.

Per-value comparison across all 38 enums yields **exactly one drift**:

```
DRIFT ActivityStatus | only_in_prisma=[released,verified,closed] | only_in_db=[]
```

| Source | Values | n |
|---|---|---|
| `prisma/schema.prisma:3026-3035` | `not_started, released, in_progress, completed, on_hold, verified, closed, cancelled` | **8** |
| `20260226000000_baseline/migration.sql:11` | `not_started, in_progress, completed, on_hold, cancelled` | **5** |
| **Live PostgreSQL** | `not_started, in_progress, completed, on_hold, cancelled` | **5** |

**No migration anywhere adds the three values** [SOURCE — proven absence: the only `ALTER TYPE …
ADD VALUE` statements in the entire migration set are `WorkpackStatus` `'in_execution'` and
`'completed'` at `20260829000000_add_resource_planning:9-10`].

### 10.2 Values used by code but absent from the database [SOURCE]

| M12 action | Writes | Location |
|---|---|---|
| `RELEASE` | `'released'` | `ExecutionWriteService.ts:255` |
| `VERIFY` | `'verified'` | `:312` |
| `CLOSE` | `'closed'` | `:320` |

> **Three M12 execution actions cannot persist against this database.** [EXECUTED absence +
> SOURCE writers; the runtime failure itself is **[INFERENCE]** — strong, from an unstorable value,
> not observed]

**This does not reopen M12.** M12's authority decision is GREEN and untouched. This is schema drift
breaking M12's *writes*, structurally identical to B1 breaking activity creation.

One further value is used by code and exists in **no** enum: `prisma/seeds/validation-plant-seed.ts:413`
sets `status: 'ready'` (**OD9-022**, P3).

### 10.3 Safe vs dangerous changes

| Change | Safety |
|---|---|
| `ALTER TYPE "ActivityStatus" ADD VALUE 'released' / 'verified' / 'closed'` | ✅ **SAFE — purely additive.** No existing row changes; no rewrite; no lock beyond a brief catalogue update |
| Removing the three from Prisma instead | ⛔ **DANGEROUS** — breaks three shipped M12 actions |
| Any `DROP VALUE` | ⛔ **IMPOSSIBLE** — PostgreSQL does not support removing an enum value |
| Reordering values | ⛔ **DANGEROUS** — `enumsortorder` affects `ORDER BY` on the enum |

**Two execution notes for C2 [SOURCE — Prisma's own generated comment]:** the diff warns that
PostgreSQL ≤ 11 cannot add multiple values in one migration. **This server is 17.10, so a single
migration is fine.** However `ALTER TYPE … ADD VALUE` must not be followed by *use* of the new value
inside the same transaction. C2 must therefore add the values in their **own migration**, separate
from any migration that writes them.

> **RECOMMENDATION: add the three values. Additive, reversible in effect, and it repairs M12.**
> Nothing was altered by this document.

---

## 11. Column Reconciliation

`ADD` = Prisma declares, DB lacks · `REMOVE` = DB has, Prisma lacks · `LEGACY` = stale on both sides.

| Table | Column | Prisma | DB | Code uses | Data | Action |
|---|---|---|---|---|---|---|
| **Activity** | `planned_start` / `planned_end` | `DateTime? @db.Date` | `date` (0) | M11 writes, all modules read | 49 / 26 | **TYPE CHANGE → `timestamptz`** (C2) |
| Activity | `actual_start` / `actual_end` | `DateTime? @db.Date` | `date` (0) | M12 sole writer | 14 / 7 | **TYPE CHANGE → `timestamptz`** (C2) |
| Activity | `early_*` / `late_*` | `DateTime?` | `timestamp(3)` | CPM writes | present | **TYPE CHANGE → `timestamptz`** (alignment) |
| **Activity** | **`project_id`** | `String?` `:54` | ❌ **absent** | none | **none anywhere** | **REMOVE FROM PRISMA** (§7) |
| **Activity** | **`schedule_source`** | `String?` `:56` | ❌ **absent** | C1 §19 assumes it | **none** | **REMOVE or CREATE explicitly** (OD9-021) |
| **Activity** | **`is_milestone`** | ❌ absent | ❌ absent | `PlanningIntelligenceProviders:231` | — | **FIX THE QUERY** (§9.4) |
| Activity | `constraint_type` / `constraint_date` | ❌ absent | ❌ absent | — | — | **ADD in C2** (C1 §8) — new, not drift |
| Activity | `status` | `ActivityStatus?` 8 values | 5 values | M12 writes 3 missing | 4 distinct | **ENUM ADD** (§10) |
| Activity | `duration_hours` | `Decimal? @db.Decimal(8,2)` | `numeric` | authored input | present | aligned |
| Activity | `total_float` | `Decimal? @db.Decimal(12,2)` | `numeric` | CPM writes | present | aligned |
| **Workpack** | `planned_start_date` / `planned_end_date` | `@db.Date` | `date` (0) | retired by OD1 | **0 / 199** | **RETIRE** (C1 §7.1) — safe: no data |
| Workpack | `project_id` | declared | `text` + FK → `Project` | — | **0 / 199** | **LEGACY** — retire with `Project` |
| Workpack | `schedule_start` / `schedule_finish` | ❌ absent | ❌ absent | — | — | **ADD in C2** (C1 §7) — new |
| **events** | `planned_start` / `planned_end` | `@db.Date` | `date` (0) | commitment window | **49 / 51** | **TYPE CHANGE → `timestamptz`** |
| **events** | `actual_start` / `actual_end` | `@db.Date` | `date` (0) | — | **0 / 51** | **TYPE CHANGE** — no data at risk |
| events | `calendar_id` | `String? @db.Uuid` | `uuid` + FK | 3-tier fallback | present | aligned |
| **ActivityRelationship** | **`lag_days`** | `Int?` | `integer` | CPM | 20 rows | **RENAME/CONVERT → `lag_minutes`** (D9, C3 — **not this task**) |
| ActivityRelationship | `relationship_type` | `RelationshipType?` | enum, 4 values | CPM | all `FS` | aligned |
| **ScheduleCalendar** | `work_days` | `Int[]` | `_int4` | `CalendarEngine` | **0 rows** | aligned |
| ScheduleCalendar | `hours_per_day` | `Float @default(10)` | `float8` default 10 | CPM fallback | **0 rows** | aligned |
| ScheduleCalendar | `exceptions` | `Json @default("[]")` | `jsonb` | `CalendarEngine` | **0 rows** | aligned |
| **BaselineActivity** | `planned_start` / `planned_finish` | `DateTime` **required** | `timestamp(3)` **NOT NULL** | baseline reads | 28 rows | **TYPE CHANGE**; NOT NULL is the cause of C1 D-01 |
| BaselineActivity | `organization_id` | nullable in Prisma | **NOT NULL** in DB | — | 28 rows | **NULLABILITY CHANGE** — diff would relax it |
| **BaselineActivity** | **`workpack_id`** | ❌ absent | ❌ absent | C1 §14.2 needs it | — | **ADD in C2** (C1 D-37) |
| **ScenarioActivityOverride** | `planned_start` / `planned_end` | `@db.Date` | `date` (0) | scenario CPM | 11 rows | **TYPE CHANGE → `timestamptz`** |
| ScenarioActivityOverride | **`early_start_constraint`** | declared | **`timestamp(3)` present** | levelling | 11 rows | ⚠️ **an existing constraint carrier already exists** — see §11.1 |
| ProgressLog | `log_date`, `data_date`, `recorded_at` | `DateTime` | `timestamp(3)` | M8.13 | 60 rows | **TYPE CHANGE** (alignment) |
| ProgressLog | `quantity_actual` / `quantity_unit` / `udf_definition_id` | ❌ absent | present | — | **0** | **REMOVE** — safe |
| ProgressLog | `shift` | declared | `text` default `'day'` | M12 writes | 60 rows | aligned |
| Permit | `id`, `project_id`, `workpack_id`, `activity_id` | `String` (TEXT) | **`uuid`** | — | **table empty** | **TYPE CHANGE** — safe, 0 rows |
| Permit | `site_id` | ❌ absent | present | — | 0 | **REMOVE** — safe |
| **ShiftDefinition** | *entire model* | ❌ **absent** | 12 cols, **6 rows** | 15 call sites | **6** | **RE-DECLARE** (§8) |
| **ResourceCapacity** | *entire model* | ❌ **absent** | 14 cols, **30 rows** | 15 call sites | **30** | **RE-DECLARE** (§8) |
| **workpack_asset_snapshots** | *entire model* | ❌ **absent** | 11 cols, **2 rows** | snapshot path | **2** | **RE-DECLARE** (§8) |
| `ActivityLibrary` | `library_scope` | ❌ absent | `text` | — | **250 / 250** | **RE-DECLARE — data loss otherwise** |
| `Organization` | `lifecycle_status` | ❌ absent | `text` | — | **372 / 372** | **RE-DECLARE — data loss otherwise** |
| `ActivityUdfDefinition` | `is_exportable`, `is_progress_driving` | ❌ absent | present | — | **55 / 55** | **RE-DECLARE — data loss otherwise** |
| `asset_attribute_history` | `created_at` | ❌ absent | `timestamp` | — | **16 / 16** | **RE-DECLARE — IRREPLACEABLE** |
| `asset_attribute_values` | `entered_at` | ❌ absent | `timestamp` | — | **6 / 6** | **RE-DECLARE — IRREPLACEABLE** |
| `asset_attribute_*` | `value_date` | `DateTime` | **`date`** | — | **0** | **TYPE CHANGE** — safe, unrelated to R1.0-C |

### 11.1 An existing constraint carrier was found, and C1 must be told

`ScenarioActivityOverride.early_start_constraint` **exists physically as `timestamp(3)`** with 11
rows in the table [EXECUTED]. C1 §8.1 freezes a *new* `Activity.constraint_type` +
`constraint_date` pair as the canonical carrier and records that no constraint carrier exists today.

**That is correct for `Activity` and incomplete for scenarios.** A scenario-scoped
"start no earlier than" carrier already exists. C2 must decide explicitly whether the canonical
`Activity` constraint pair **supersedes** it or **coexists** with it — and coexistence would be a
second constraint authority, which C1 §8 forbids. Recorded as **OD9-023**, referred back to C1 §8 as
an addition, **not** decided here.

---

## 12. Relation / FK Reconciliation

### 12.1 The headline: `Activity.event_id` is a foreign key in name only

| Fact | Evidence |
|---|---|
| `prisma/schema.prisma:14` declares `event_id String? @db.Uuid` | [SOURCE] |
| **There is no `event` relation field on the `Activity` model** | [SOURCE — `:62-78` lists `workpack`, `organization`, `site`, `discipline`, `standard_activity_type` and back-relations; no `event`] |
| `20260226000000_baseline/migration.sql:3213` **does** create `Activity_event_id_fkey` | [SOURCE] |
| The live database has **no such constraint** | [EXECUTED — Activity's 5 FKs are `discipline_id`, `organization_id`, `site_id`, `standard_activity_type_id`, `workpack_id`] |
| Broken references today | **0** [EXECUTED] |

> **`Activity.event_id` is an unconstrained UUID.** Referential integrity between an activity and its
> campaign container — the central relationship of the entire R0.4 Event-only architecture — is
> maintained **by application discipline alone.**

Because Prisma declares no relation, `db push` would never create the FK, and `migrate diff` does not
propose adding one. **The drift is silent in both directions** (**OD9-010**, P1).

### 12.2 Complete FK comparison for the R1.0 tables [EXECUTED]

| Relation | Prisma relation? | DB FK? | `ON DELETE` | Verdict |
|---|---|---|---|---|
| `Activity → Workpack` | ✅ `:62` | ✅ | **`SET NULL`** (baseline said `CASCADE`) | ⚠️ **rule mismatch vs migration** |
| **`Activity → events`** | ❌ **none** | ❌ **none** | — | 🔴 **DECLARED RELATION MISSING ENTIRELY** |
| `Activity → ActivityLibrary` | ❌ none | ❌ none (baseline `:3216` creates it) | — | ⚠️ unconstrained UUID |
| `Activity → User` (`created_by`/`updated_by`) | ❌ none | ❌ none (baseline `:3222`,`:3225`) | — | ⚠️ unconstrained UUID |
| `Activity → Organization` / `Site` / `Discipline` | ✅ | ✅ | RESTRICT / RESTRICT / SET NULL | ✅ aligned |
| `Activity → StandardActivityType` | ✅ `:76` | ✅ | SET NULL | ⚠️ diff drops+re-adds (`ON UPDATE` differs — created by loose SQL) |
| `Workpack → events` | ✅ | ✅ | SET NULL | ✅ aligned |
| `Workpack → Project` | — | ✅ **exists** | SET NULL | **LEGACY** — retire with `Project` |
| `ActivityRelationship → Activity` ×2 | ✅ | ✅ | RESTRICT | ✅ aligned |
| `BaselineActivity → ScheduleBaseline` | ✅ | ✅ | CASCADE | ✅ aligned |
| **`BaselineActivity → Activity`** | ✅ | ❌ **no FK** | — | ⚠️ unconstrained; 0 orphans today |
| `ScenarioActivityOverride → Activity` | ✅ | ✅ | RESTRICT | ✅ aligned |
| `ScenarioActivityOverride → schedule_scenarios` | ✅ | ✅ | CASCADE | ✅ aligned |
| `ShiftDefinition → events` / `Organization` | ❌ **model absent** | ✅ | RESTRICT | **re-declare** |
| `ResourceCapacity → events`/`Organization`/`ResourceType` | ❌ **model absent** | ✅ | RESTRICT | **re-declare** |
| `ResourceCapacity → ShiftDefinition` / `Contractor` | ❌ **model absent** | ✅ | SET NULL | **re-declare** |
| `workpack_asset_snapshots → Workpack` / `Asset` | ❌ **model absent** | ✅ | RESTRICT | **re-declare** |
| `event_milestones → events` | ✅ | ✅ | CASCADE | ✅ aligned |
| `events → ScheduleCalendar` | ✅ | ✅ | SET NULL | ✅ aligned |
| `events → events` (`parent_event_id`) | ✅ | ✅ | SET NULL | ✅ aligned |
| `schedule_change_requests → events` | ✅ | ✅ | — | ⚠️ diff drops it and adds `→ schedule_scenarios` instead |

**296 FKs exist in total.** The diff proposes dropping 24 and re-adding 6 — **a net loss of 18
constraints**, almost all of them belonging to the 8 undeclared tables (dropped as collateral).

### 12.3 Cross-tenant and nullable risks

| Risk | Assessment |
|---|---|
| **Cross-tenant FK** | None found. Every tenant-scoped table carries `organization_id` with a RESTRICT FK to `Organization` |
| **Nullable relation risk** | `Activity.workpack_id` and `.event_id` are both nullable, and **4 activities have no event, 3 no workpack** [EXECUTED]. C1's span and CPM both key on these; the rows are test residue but they are live rows |
| **`ON DELETE SET NULL` on `Activity.workpack_id`** | Deleting a workpack **silently orphans its activities** rather than refusing. The baseline intended `CASCADE`. This is a genuine behavioural divergence from the documented design (**OD9-024**, P2) |
| **Orphan rows** | 0 broken `Activity → events`; 0 orphan `BaselineActivity` [EXECUTED] |

**No FK was added or removed by this document.**

---

## 13. Index Reconciliation

### 13.1 `Activity` has three indexes, and none covers `event_id` [EXECUTED]

```
Activity_pkey                                  UNIQUE (id)
Activity_organization_id_activity_number_key   UNIQUE (organization_id, activity_number)
Activity_workpack_id_sequence_number_idx              (workpack_id, sequence_number)
```

A search for **any** index on `Activity` or `Workpack` whose definition mentions `event_id` returned
**zero rows** [EXECUTED].

### 13.2 The declared-vs-physical comparison

| Index | Prisma | Migration | DB | Class |
|---|---|---|---|---|
| **`Activity_org_event_deleted_idx`** `(organization_id, event_id, deleted_at)` | ✅ **declared** `schema.prisma:82` | ✅ `20260908_r01_activity_event_index/migration.sql:3` | ❌ **ABSENT** | **REQUIRED FOR PERFORMANCE** |
| `Activity(workpack_id, sequence_number)` | ✅ | ✅ baseline | ✅ | aligned |
| `Activity(organization_id, activity_number)` UNIQUE | ✅ `:80` | ✅ | ✅ | **REQUIRED FOR CORRECTNESS** |
| **`Workpack(event_id)`** | ❌ not declared | ❌ | ❌ | **REQUIRED FOR PERFORMANCE** — not declared anywhere |
| `Workpack(organization_id, status)` / `(organization_id, site_id, status)` | ✅ | ✅ | ✅ | aligned |
| `Workpack.workpack_id_code` UNIQUE | ✅ | ✅ | ✅ | **CORRECTNESS** |
| `ActivityRelationship(predecessor_id, successor_id)` UNIQUE | ✅ | ✅ | ✅ | **CORRECTNESS** — prevents duplicate logic |
| `ScheduleCalendar` — **PK only** | | | ✅ PK only | **OPTIONAL** — 0 rows; but no `(organization_id, is_default)` index for the 3-tier fallback lookup |
| `ResourceCapacity(event_id, resource_type_id, contractor_id, shift_id, target_date)` UNIQUE | ❌ model absent | ✅ | ✅ | **CORRECTNESS** — must survive re-declaration |
| `ShiftDefinition(event_id, shift_name)` UNIQUE | ❌ model absent | ✅ | ✅ | **CORRECTNESS** — must survive re-declaration |
| `workpack_asset_snapshots(workpack_id, snapshot_revision)` UNIQUE | ❌ model absent | ✅ | ✅ | **CORRECTNESS** |
| `BaselineActivity(activity_id)` / `(baseline_id)` / `(organization_id)` | ✅ | ✅ | ✅ | PERFORMANCE |
| `Permit_organization_id_status_idx` | ✅ | ✅ `20260906_m12r01_permit_org_id` | ❌ **ABSENT** | PERFORMANCE |
| `whatsapp_sessions_organization_id_idx` | ✅ | — | ❌ **ABSENT** | PERFORMANCE |

### 13.3 Why the missing `event_id` index matters to C2 specifically

C1's frozen model makes the **Event** the campaign container and requires CPM to load an event's
activities on every recalculation (`ScheduleOrchestrationService` filters
`organization_id + event_id + deleted_at IS NULL`). **That is exactly the missing index's column
list**, and it is currently a sequential scan.

At 73 activities this is invisible. The index is nonetheless classified **REQUIRED FOR PERFORMANCE**
rather than OPTIONAL, because C2 introduces the workpack span rollup and the enqueue-on-change
propagation (C1 §7.4, §18.3), which multiply the frequency of exactly this query.

**Correctness vs performance summary:**

| Class | Items |
|---|---|
| **REQUIRED FOR CORRECTNESS** | 5 unique constraints — 2 of which exist only in the DB and would be lost with the undeclared tables |
| **REQUIRED FOR PERFORMANCE** | `Activity_org_event_deleted_idx` (declared, unapplied), `Workpack(event_id)` (undeclared), `Permit_organization_id_status_idx`, `whatsapp_sessions(organization_id)` |
| **OPTIONAL** | `ScheduleCalendar(organization_id, is_default)` — worth adding when the table stops being empty |

**No index was created.**

---

## 14. Migration History Forensics

### 14.1 What is on disk vs what is recorded [EXECUTED + SOURCE]

| Measure | Value |
|---|---|
| Migration **directories** in `prisma/migrations/` | **35** |
| **Loose `.sql` files** in `prisma/migrations/` (no directory → **invisible to Prisma**) | **11** |
| `migration_lock.toml` | present |
| Rows in `_prisma_migrations` | **32** |
| **Distinct** migration names recorded | **29** |
| **Migrations with `applied_steps_count = 0`** | **31 of 32** |
| Migrations that ever executed a step | **1** — `20260909_r04d_workpack_identity_review` |
| Rows with `rolled_back_at` set | **3** |
| Rows with `finished_at IS NULL` | **3** |
| First / last recorded | 2026-08-14 09:49 → 2026-09-09 08:21 |

### 14.2 The 11 loose SQL files Prisma cannot see [SOURCE]

`add_activity_window.sql` · `add_asset_register_m86.sql` · `add_attachments.sql` ·
`add_document_library.sql` · `add_lesson_learned.sql` · `add_material_category.sql` ·
`add_platform_branding.sql` · `add_safety_module.sql` · `enhance_materials.sql` ·
`m8_13_standard_activity_types.sql` · `phase1_expansion.sql`

Prisma only reads `<timestamp>_<name>/migration.sql`, so **none of these is part of migration history
in any sense** — yet their effects are demonstrably in the database:

| File | Effect | Present in DB? |
|---|---|---|
| `m8_13_standard_activity_types.sql:25-27` | `Activity.standard_activity_type_id` + FK | ✅ **yes** [EXECUTED] |
| `add_activity_window.sql:1` | `Activity.window` | ✅ **yes** [EXECUTED] |
| **`add_asset_register_m86.sql:213+`** | **`workpack_asset_snapshots` — the CREATE TABLE for a populated, undeclared table** | ✅ **yes, 2 rows** [EXECUTED] |
| **`phase1_expansion.sql:84-87`** | `Activity.early_start` etc. as **`TIMESTAMPTZ`** | ❌ **no** — live columns are `timestamp(3)` |

> **One of the three data-bearing undeclared tables originates in a loose file.**
> `workpack_asset_snapshots` was created by `add_asset_register_m86.sql`, which is **not a migration
> at all** — Prisma has never seen it and never will. So that table exists in the database, holds 2
> rows, is absent from Prisma, **and has no migration record of any kind.** Its re-declaration must be
> transcribed from the live catalogue (§8.4); there is no migration to copy from, unlike
> `ShiftDefinition` and `ResourceCapacity`.

> **`phase1_expansion.sql` is decisive.** It declares the CPM columns as `TIMESTAMPTZ` while the
> baseline declares them `TIMESTAMP(3)` and the database has `timestamp without time zone`. Two
> conflicting DDL definitions exist for the same columns, and **the timezone-aware one never ran.**
> The intent to store zone-aware timestamps predates R1.0-C and was lost.

### 14.3 The duplicated and rolled-back records [EXECUTED]

| Migration | Pattern |
|---|---|
| `20260227000000_add_workpack_document` | started 2026-08-14 09:49:24 → **rolled back** 09:49:47 → re-recorded 09:49:47, 0 steps |
| `20250821_m86_add_history_refers_fk` | started 2026-08-29 → **rolled back** 2026-09-01 13:35 → re-recorded, 0 steps |
| **`20260226000000_baseline`** | started 2026-09-01 13:35:11 → **rolled back** 13:35:24 → re-recorded 13:35:24, **0 steps** |

**Name/time inversion:** `20250821_m86_add_history_refers_fk` carries a timestamp of **2025**-08-21
while every neighbour is 2026. Prisma orders migrations lexicographically by directory name, so this
migration sorts **before the baseline** while having been applied nearly a year "after" it. Any
replay would attempt it first, against a database with no tables (**OD9-025**, P2).

### 14.4 The six migrations on disk that the database has never heard of

35 directories − 29 distinct recorded = **6**:

| Migration | Creates | In DB? |
|---|---|---|
| `20260906_m12r01_permit_org_id` | `Permit.organization_id`, `Permit_organization_id_status_idx` | column ✅ (as `uuid`), index ❌ |
| `20260906_m12r01_progresslog_shift` | `ProgressLog.shift` | ✅ present |
| `20260906_m12v1_udf_dimension_metadata` | 7 `ActivityUdfDefinition` columns | ❌ **absent** |
| `20260908_m15_r4_management_decisions` | `m15_management_decisions` + 3 indexes | ❌ **absent** |
| `20260908_m16_r6_interaction_logs` | `m16_interaction_logs` + 4 indexes | ❌ **absent** |
| `20260908_r01_activity_event_index` | `Activity_org_event_deleted_idx` | ❌ **absent** |

**And a later migration is recorded as applied:** `20260909_r04d_workpack_identity_review`
(2026-09-09) is the single migration with `applied_steps_count = 1`. **Six earlier migrations are
pending behind an applied later one** — the classic non-linear history that makes `migrate deploy`
behaviour unpredictable.

### 14.5 All six are idempotent — this is the good news [SOURCE]

Every statement in the six pending migrations is guarded:

```
ALTER TABLE "Permit" ADD COLUMN IF NOT EXISTS "organization_id" TEXT;
CREATE INDEX IF NOT EXISTS "Permit_organization_id_status_idx" ON "Permit"("organization_id", "status");
ALTER TABLE "ProgressLog" ADD COLUMN IF NOT EXISTS "shift" TEXT DEFAULT 'day';
ALTER TABLE "ActivityUdfDefinition" ADD COLUMN IF NOT EXISTS "is_filterable" BOOLEAN NOT NULL DEFAULT true, ...
CREATE TABLE IF NOT EXISTS "m15_management_decisions" (...);
CREATE TABLE IF NOT EXISTS "m16_interaction_logs" (...);
CREATE INDEX IF NOT EXISTS "Activity_org_event_deleted_idx" ...
```

> **Applying the six pending migrations is SAFE and REPAIRS a large part of the destructive diff.**
> It creates both missing tables, 2 of the 3 missing indexes and 7 of the missing columns — removing
> them from the diff without a single hand-written statement.

One caveat: `20260906_m12r01_permit_org_id` would add `organization_id` as **TEXT**, but the column
already exists as `uuid`, so `IF NOT EXISTS` makes it a no-op and the type divergence persists.
`Permit` has 0 rows, so this is cosmetic.

### 14.6 The verification that could not be performed

`prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma` **refused
to execute**:

```
Error: You must set `datasource.shadowDatabaseUrl` in your `prisma.config.ts`
if you want to diff a migrations directory.
```

Providing one requires creating a database. **Per §1 this was not done.** The question *"would
replaying all migrations reproduce the current schema?"* is therefore answered by static analysis
(§14.7 and §21) rather than by execution, and that limitation is stated rather than hidden.

**The missing `shadowDatabaseUrl` is itself a defect** (**OD9-026**, P1): it disables `migrate dev`,
disables migrations-directory diffing, and is a precondition for the dry run C2 needs.

### 14.7 The point at which history ceased to be trustworthy

> **It was never trustworthy. The break is at the baseline itself — 2026-09-01 13:35.**

The chain of executed evidence:

1. The baseline migration declares four `Activity` foreign keys. **None exists.** One that does exist
   (`workpack_id`) has `SET NULL` where the baseline says `CASCADE`.
2. The baseline is recorded as applied with **`applied_steps_count = 0`**, immediately after being
   recorded as rolled back — the signature of `migrate resolve --applied`.
3. `20260829000000_add_resource_planning` is likewise recorded with 0 steps, **yet its tables and its
   two `WorkpackStatus` enum values are physically present.** Its SQL ran; the history denies it.
4. Loose `.sql` files outside migration history have physically altered `Activity`.
5. The live FK set for `Activity` matches **exactly** what `prisma db push` would generate from the
   *current* schema (relations declared → FK; scalar-only fields → no FK), not what the baseline
   declares.

**Reconstruction [INFERENCE — strong]:** the database was materialised by a `db push`-style operation
from a schema snapshot, hand-patched with loose SQL, and the migration folder was then reconciled to
it by marking everything resolved. `_prisma_migrations` is a **ledger of intent, not of execution.**

**Consequence:** there is no point in history to "repair back to". Option A in §16 is not available.

---

## 15. Destructive Diff Analysis

### 15.1 The diff, reproduced non-mutatingly

`prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` produced a
**13.4 KB migration script** [EXECUTED — printed to stdout, applied to nothing].

| Statement class | Count |
|---|---|
| `ALTER TYPE … ADD VALUE` | **3** |
| `DROP FOREIGN KEY` | **24** |
| `DROP INDEX` | **10** |
| `ALTER TABLE … ADD/DROP/ALTER COLUMN` | 21 tables |
| **`DROP TABLE`** | **8** |
| `CREATE TABLE` | 2 |
| `CREATE INDEX` | 7 |
| `ADD FOREIGN KEY` | 6 |
| `RENAME FOREIGN KEY` / `RENAME INDEX` | 6 / 7 |

### 15.2 Every proposed `DROP TABLE`, answered [EXECUTED]

| # | Table | Rows | Prisma missing model? | Renamed? | Name mismatch? | Schema mismatch? | History problem? | Stale? | Genuinely obsolete? | **Verdict** |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **`ResourceCapacity`** | **30** | ✅ **YES** | ❌ | ❌ | ❌ | contributory | ❌ | ❌ | **MISSING DECLARATION — PRESERVE** |
| 2 | **`ShiftDefinition`** | **6** | ✅ **YES** | ❌ | ❌ | ❌ | contributory | ❌ | ❌ | **MISSING DECLARATION — PRESERVE** |
| 3 | **`workpack_asset_snapshots`** | **2** | ✅ **YES** | ❌ | ❌ | ❌ | contributory | ❌ | ❌ | **MISSING DECLARATION — PRESERVE** |
| 4 | `provisioning_jobs` | 0 | ✅ **YES** | ❌ | ❌ | ❌ | contributory | ❌ | ❌ | **MISSING DECLARATION — PRESERVE** (live service + route) |
| 5 | `provisioning_templates` | 0 | ✅ **YES** | ❌ | ❌ | ❌ | contributory | ❌ | ❌ | **MISSING DECLARATION — PRESERVE** (live service + route) |
| 6 | `provisioning_job_logs` | 0 | ✅ **YES** | ❌ | ❌ | ❌ | contributory | ❌ | ❌ | **MISSING DECLARATION — PRESERVE** |
| 7 | `asset_relationships` | 0 | ✅ **YES** | ❌ | ❌ | ❌ | contributory | ❌ | ❌ | **MISSING DECLARATION — PRESERVE** |
| 8 | `onboarding_requests` | 0 | ✅ **YES** | ❌ | ❌ | ❌ | contributory | ❌ | ❌ | **MISSING DECLARATION — PRESERVE** (live page) |

> **All eight have exactly one cause: the Prisma schema does not declare them.** Not one is renamed,
> mis-mapped, in another schema, stale or obsolete. **No `DROP` is justified.** Every one is
> eliminated by re-declaration (§8.4) — which is precisely why the instruction's rule *"NO DROP may
> be recommended merely because Prisma doesn't declare it"* is the correct rule here.

### 15.3 The column drops the earlier audit did not capture

Beyond the 8 tables, the diff drops **six populated columns** (§1.3). Two hold per-row provenance
timestamps that exist nowhere else:

| Column | Rows | Why irreplaceable |
|---|---|---|
| `asset_attribute_history.created_at` | **16** | The history table's own record of *when* each attribute change was captured |
| `asset_attribute_values.entered_at` | **6** | When each attribute value was entered |

**Total irrecoverable loss if the diff were applied: 38 table rows + 22 provenance timestamps.**

### 15.4 Changes in the diff unrelated to R1.0-C that must not ride along

The diff also converts two `date` columns to `TIMESTAMP(3)`
(`asset_attribute_values.value_date`, `asset_attribute_history.value_date` — both **0 rows
populated**, so harmless) and retypes five `Permit` columns from `uuid` to TEXT (**table empty**).

> **These are unrelated to the time-foundation work.** C2 must not let a `date → timestamp`
> conversion for asset attributes be mistaken for, or bundled with, the R1.0-C
> `date → timestamptz` conversion. They have different semantics and different owners (**OD9-027**).

### 15.5 What the diff gets right

Three statements in the diff are **exactly** the repairs OD9 recommends, and they arrive for free:

```sql
ALTER TYPE "ActivityStatus" ADD VALUE 'released';
ALTER TYPE "ActivityStatus" ADD VALUE 'verified';
ALTER TYPE "ActivityStatus" ADD VALUE 'closed';
CREATE INDEX "Activity_org_event_deleted_idx" ON "Activity"("organization_id", "event_id", "deleted_at");
```

The goal of the reconciliation sequence is to reach a state where **the diff contains only statements
like these** — additive, intentional and reviewed — and **zero drops.**

---

## 16. Migration Baseline Options

### 16.1 Option A — Repair the existing migration history

> ⛔ **NOT AVAILABLE.**

Not merely difficult — impossible in principle. Repair presupposes a point in history at which the
recorded state matched the physical state. §14.7 proves no such point exists: **the baseline itself
never ran**, 31 of 32 rows record zero executed steps, and 11 loose SQL files altered the schema
outside history entirely. There is nothing to repair back to.

### 16.2 Option B — Establish a new baseline migration

> ✅ **REQUIRED, but not sufficient on its own, and not first.**

A squashed baseline generated from the *reconciled* schema is the only way to obtain a reproducible
history. But generating it **now** would bake in every current drift: it would emit a baseline that
omits the 8 tables and includes the 2 phantom `Activity` columns, permanently encoding the errors.

### 16.3 Option C — Reconcile DB ↔ Prisma through a controlled sequence

> ✅ **REQUIRED, and it must come first.**

### 16.4 Option D — Evidence-based recommendation

> ## **RECOMMENDATION: C then B — reconcile first, then re-baseline.**

| Step | Action | Why this order |
|---|---|---|
| **1** | Verified `pg_dump` + **test restore** | 22 MB. Everything downstream is reversible only if this exists |
| **2** | `prisma migrate deploy` — apply the 6 **idempotent** pending migrations | Removes 2 `CREATE TABLE`, 2 `CREATE INDEX`, 7 `ADD COLUMN` from the diff at zero risk (§14.5) |
| **3** | Re-declare the **8 tables** + **6 populated columns** in Prisma | Removes all 8 `DROP TABLE` and every data-losing `DROP COLUMN` (§8.4) |
| **4** | Retire the `EventPhase` route; fix the `is_milestone` query | Removes both CODE→BOTH breaks (§9) |
| **5** | Decide `Activity.project_id` / `schedule_source` explicitly | The only remaining Prisma→DB column drift (§7.4) |
| **6** | Additive enum migration — 3 `ADD VALUE` in **its own** migration | Repairs M12 (§10.3) |
| **7** | Resolve FK / index drift, incl. the `Activity → events` relation decision | §12, §13 |
| **8** | **Verify the diff is empty**: `migrate diff --from-config-datasource --to-schema --exit-code` returns **0** | The objective, machine-checkable gate |
| **9** | **Only then** generate the squashed baseline (Option B) from the reconciled schema, archive the 35 old directories and the 11 loose files, `migrate resolve --applied` the new baseline | The baseline now describes reality |
| **10** | Configure `shadowDatabaseUrl`; prove clean-clone reproduction on an empty database | §21 |
| **11** | **Then** R1.0-C2 time migration | |

### 16.5 Evaluation against the required criteria

| Criterion | Assessment |
|---|---|
| **Data preservation** | ✅ Nothing is dropped. Steps 2–3 are purely additive to Prisma; step 2's SQL is `IF NOT EXISTS` throughout |
| **Rollback capability** | ✅ Step 1 provides it. Steps 2–7 are individually revertible; step 9 is a metadata operation on a verified-clean database |
| **Production safety** | ✅ High — the destructive diff is eliminated **before** any schema change is applied |
| **Development safety** | ✅ `shadowDatabaseUrl` (step 10) restores `migrate dev`, currently unusable |
| **Reproducibility** | ✅ Step 9 is the only way to get it; step 8 guarantees the baseline is correct before it is frozen |
| **CI/CD** | ✅ `migrate deploy` becomes deterministic. Step 8's `--exit-code` is a **CI gate**: any future drift fails the build |
| **Client / P6 deployment** | ✅ No impact — integration is file-based (§22) |
| **Clean database reproduction** | ✅ Achieved at step 10, verified rather than assumed |

**This is not the easiest path.** The easiest path is `db push` or accepting the diff, and both destroy
data. This path is chosen because it is the only one that preserves every row **and** ends with a
history that describes reality.

---

## 17. Time-Schema Preparation

> **C1 is FROZEN. Nothing here implements the conversion.** These are the exact current types.

### 17.1 The columns C2 will convert [EXECUTED]

| Table | Column | Current type | Precision | Rows populated |
|---|---|---|---|---|
| `Activity` | `planned_start` | **`date`** | 0 | **49 / 73** |
| `Activity` | `planned_end` | **`date`** | 0 | **26 / 73** |
| `Activity` | `actual_start` | **`date`** | 0 | **14 / 73** |
| `Activity` | `actual_end` | **`date`** | 0 | **7 / 73** |
| `Activity` | `early_start` / `early_finish` / `late_start` / `late_finish` | `timestamp without time zone` | 3 | present |
| `Workpack` | `planned_start_date` | **`date`** | 0 | **0 / 199** |
| `Workpack` | `planned_end_date` | **`date`** | 0 | **0 / 199** |
| `events` | `planned_start` | **`date`** | 0 | **49 / 51** |
| `events` | `planned_end` | **`date`** | 0 | **49 / 51** |
| `events` | `actual_start` / `actual_end` | **`date`** | 0 | **0 / 51** |
| `event_milestones` | `planned_date` / `actual_date` | **`date`** | 0 | **0** (table empty) |
| `ScenarioActivityOverride` | `planned_start` / `planned_end` | **`date`** | 0 | 11 rows |
| `ScenarioActivityOverride` | `early_start_constraint` | `timestamp` | 3 | 11 rows |
| `BaselineActivity` | `planned_start` / `planned_finish` | `timestamp` **NOT NULL** | 3 | 28 rows |
| `BaselineActivity` | `early_*` / `late_*` | `timestamp` | 3 | 28 rows |

### 17.2 Whole-database type distribution [EXECUTED]

| Type | Columns |
|---|---|
| `timestamp without time zone` (3) | **574** |
| **`date`** | **39** |
| `timestamp with time zone` (6) | **5** |
| `timestamp without time zone` (6) | **2** |

> **Not one application scheduling column is `timestamptz` today.** The only zone-aware columns in the
> entire database are `_prisma_migrations.started_at` / `finished_at` and
> `standard_activity_types.updated_at`. The conversion is therefore genuinely novel for this schema —
> there is no existing precedent in it to follow.

Of the 39 `date` columns, **18 are time-foundation relevant** (Activity 4, events 4, Workpack 2,
`event_milestones` 2, `ScenarioActivityOverride` 2, `ResourceCapacity.target_date` 1,
`material_constraints.constraint_date` 1, `schedule_scope_change_items` 2). The remaining 21 —
`SafetyLog.log_date`, `PunchListItem.target_close_date`, `plant_documents.issue_date`,
`platform_usage.period_date` and similar — are **out of scope** and must not be swept in.

**`ResourceCapacity.target_date` must stay `date`:** it is a capacity *bucket key*, part of a unique
constraint, and converting it would change the meaning of that constraint (§8.4).

### 17.3 Timezone facts [EXECUTED]

| Fact | Value |
|---|---|
| Server session `TimeZone` | **`Asia/Calcutta`** (+05:30) |
| `Asia/Calcutta` vs `Asia/Kolkata` | Identical offset — confirmed aliases |
| `TZ` in `.env` / compose files | **none** [SOURCE — proven absence] |
| Timezone pin on the connection URL | **none** — `postgresql://…/syority?schema=public` carries no `options=-c TimeZone=` |
| Timezone pin in `prisma.config.ts` | **none** |
| `Organization.timezone` **data** | **`'UTC'` on all 20 sampled rows** — including HMEL, Indian Oil, Panipat, Bathinda, Jamnagar |
| `Site.timezone` **data** | **`'UTC'` on all 20 sampled rows** |

> **This escalates C1 D-39 from a schema-default problem to a data problem.** It is not that the
> *default* says UTC — **every existing tenant and site row physically stores `'UTC'`** while the
> plants are in India. If C2 resolves the operational zone by reading `Organization.timezone`, it will
> read UTC and convert incorrectly. The rows must be corrected, or the resolution path must not
> consult them.

### 17.4 Epoch and boundary values [EXECUTED]

| Measure | Value |
|---|---|
| `Activity.planned_start` range | **1970-01-01** → 2027-01-15 |
| `Activity.planned_end` range | **1970-01-01** → 2026-10-11 |
| `Activity.actual_start` range | 2026-10-01 → 2026-10-06 |
| `events.planned_start` min | 2026-08-29 |
| `events.planned_end` max | 2027-02-28 |
| Epoch rows | **3** (§19) |

### 17.5 A pre-existing anomaly in the CPM columns

Sample of live `early_start` / `early_finish` values [EXECUTED]:

```
2027-03-16 05:30:00 → 2027-03-16 15:30:00   (10 h)
2027-03-17 05:30:00 → 2027-03-17 13:30:00   ( 8 h)
2027-03-15 05:30:00 → 2027-03-15 15:30:00   (10 h)
```

**Every CPM early date begins at 05:30**, not at midnight or at a shift boundary. `05:30` naive is
`00:00 UTC` expressed in +05:30 — the fingerprint of a JavaScript `Date` at UTC midnight written into
a zone-naive column.

**Two consequences C2 must handle deliberately:**

1. **The conversion preserves this faithfully.** `timestamp 05:30 AT TIME ZONE 'Asia/Kolkata'` yields
   the original instant, so no information is lost.
2. **But 05:30 IST is not a meaningful shift start.** The values are arithmetically correct and
   semantically wrong, and the conversion will make that wrongness *explicit and visible* for the
   first time. This is a **pre-existing defect surfaced by the conversion, not caused by it**
   (**OD9-028**, P2). It must be recorded before C2 so it is not mistaken for a conversion bug.

---

## 18. Timestamp / Timezone Conversion Safety

### 18.1 The executed demonstration

All values below were produced by `SELECT` against the live database with
`default_transaction_read_only = on` [EXECUTED]:

| Expression | Result |
|---|---|
| `'2026-08-29'::date` | `2026-08-29` |
| `'2026-08-29'::date::timestamp` | `2026-08-29 00:00:00` |
| **`'2026-08-29'::date::timestamptz`** | **`2026-08-29 00:00:00 IST`** |
| … the same instant in UTC | `2026-08-28 18:30:00` |
| `'2026-08-29 00:00:00'::timestamp::timestamptz` | `2026-08-29 00:00:00 IST` |
| **`timezone('UTC', '2026-08-29'::timestamp)`** | **`2026-08-29 05:30:00 IST`** ⛔ |
| **`timezone('Asia/Kolkata', '2026-08-29'::timestamp)`** | **`2026-08-29 00:00:00 IST`** ✅ |

Against a real row [EXECUTED]:

| | Value |
|---|---|
| stored `Activity.planned_start` | `1970-01-01` |
| `::timestamptz` under session | `1970-01-01 00:00:00 IST` |
| the same instant in UTC | `1969-12-31 18:30:00` |

### 18.2 The rule this establishes

> **`DATE → timestamptz` and `timestamp → timestamptz` both interpret the source value as
> wall-clock time in the SESSION timezone at the moment the migration runs.**

- Session `Asia/Calcutta`/`Asia/Kolkata` → **midnight IST** → exactly the intent frozen in C1 §17.2
- Session `UTC` → **05:30 IST** → **every historical date wrong by +05:30**

The current server default happens to be correct. **Depending on it would be depending on an
unpinned, undocumented, environment-specific setting** — and §17.3 proves nothing in the repository
pins it.

### 18.3 How C2 must perform the conversion — REQUIRED FORM

> **C2 MUST use an explicit `USING … AT TIME ZONE 'Asia/Kolkata'` clause and MUST NOT rely on the
> ambient session timezone.**

```sql
-- REQUIRED FORM (illustrative — NOT executed by this task)
ALTER TABLE "Activity"
  ALTER COLUMN "planned_start" TYPE timestamptz
    USING ("planned_start"::timestamp AT TIME ZONE 'Asia/Kolkata');
```

| Requirement | Reason |
|---|---|
| **Explicit `AT TIME ZONE 'Asia/Kolkata'`** | Deterministic regardless of session, server config, container `TZ` or CI runner locale |
| **`'Asia/Kolkata'`, never `'Asia/Calcutta'`** | Standardise the alias (C1 D-20) |
| **Never a bare `ALTER … TYPE timestamptz`** | Silently session-dependent; the failure mode is a 5½-hour skew with no error |
| **Same clause for `date` and for `timestamp` sources** | `date::timestamp` yields midnight, so one form covers both |
| **Provenance recorded** | C1 §17.2: a converted `actual_start` asserts *the date is known, the time is not.* The migration must record that the time-of-day was **NOT CAPTURED** |
| **Executed on a restored copy first, and compared row-by-row** | Gate G11 |
| **Run the 18 in-scope columns only** | The other 21 `date` columns are out of scope (§17.2) |

### 18.4 Serialization layers that must be re-verified after conversion

The database is only the first layer. Each of these currently sees a `date` and will begin seeing a
zone-aware instant:

| Layer | Current behaviour | Risk after conversion |
|---|---|---|
| **`pg` / Prisma driver** | A `date` column arrives in Node as `1970-01-01T00:00:00+05:30` = `1969-12-31T18:30:00Z` — visible throughout this audit's own output | Values will carry a real offset; any code assuming "midnight UTC" changes meaning |
| **Prisma `DateTime`** | maps `@db.Date` → JS `Date` | Must drop `@db.Date` in the same change or Prisma will re-truncate |
| **API/JSON** | `.toISOString()` and `.slice(0,10)` at ~12 sites (C1 D-10) | `.slice(0,10)` on a +05:30 instant yields the **previous day** for anything before 05:30 |
| **Export** | `MsProjectXmlFormatter.ts:185,188` strips the zone marker (C1 D-53) | Must be fixed **with** the conversion, not after |
| **UI** | Browser-local rendering (C1 §17.3) | Display shifts unless the display zone is pinned |

> **The `.slice(0, 10)` sites are the sharpest application-layer hazard.** Truncating a
> `timestamptz` to 10 characters is safe only while the value is midnight-or-later in the display
> zone. C1 already prohibits the pattern (D-10); OD9 records that the conversion makes the
> prohibition **load-bearing rather than stylistic**.

### 18.5 Verdict

> **Timezone conversion: ✅ PROVEN.**

The semantics are demonstrated by execution, the correct statement form is specified, and the failure
mode of the incorrect form is quantified. **This satisfies gate G11 at the design level.** Executing
the conversion on a restored copy remains a C2 activity.

---

## 19. Epoch Data

### 19.1 The three rows, confirmed present, with exact identifiers [EXECUTED]

| # | `Activity.id` | `workpack_id` | `event_id` | `organization_id` | Created |
|---|---|---|---|---|---|
| 1 | **`1ac78091-0ad0-4c2b-aca4-f92b821dc113`** | `7b3b29a3-88e7-40e8-a64f-d535c85f3450` | `f1757ca1-121c-422f-bdc4-0cf7022f7b63` | `c93a2525-1c3b-4d9e-8178-49d0e16ec66c` | 2026-09-01 05:56:46 |
| 2 | **`ccc8de63-3dbe-4c24-b946-98c282b953d2`** | `8c4d638a-9e57-4ca2-b806-45fbd50500d2` | `b223f503-66ad-4401-909a-92daae75567c` | `2add546d-f95c-46e8-b80b-262ceaf01003` | 2026-09-01 05:46:16 |
| 3 | **`e5303f4d-941c-4ebb-9492-7ef8f42a8af8`** | `39773ed9-aac7-4894-bf61-d224792efd6f` | `cdaadd7f-89db-409e-a3d4-37ee020a8390` | `04a22b57-ced5-4d8a-9549-c0f7697ca447` | 2026-09-01 05:28:27 |

All three share: `description = 'Test Activity 1'` · `activity_number = NULL` ·
`duration_hours = 20.00` · `status = not_started` · `deleted_at = NULL` ·
`planned_start = planned_end = 1970-01-01` · `actual_start = actual_end = NULL`.

Created within **28 minutes** of one another on 2026-09-01, in **three different organizations**.
[INFERENCE — strong] automated test residue, not planner data.

### 19.2 Dependency map [EXECUTED]

| Referencing object | Count | Consequence for correction |
|---|---|---|
| `ActivityRelationship` (as predecessor or successor) | **0** | ✅ No CPM logic depends on them |
| `ProgressLog` | **0** | ✅ No execution history |
| **`BaselineActivity`** | **3** | ⚠️ See §19.3 |
| **`ScenarioActivityOverride`** | **6** | ⚠️ Six scenario overrides reference these three activities |

### 19.3 An inconsistency that changes the correction plan

**`BaselineActivity.planned_start < 1980` returns 0 rows** [EXECUTED] — yet 3 `BaselineActivity` rows
reference the epoch activities.

> **The baselines hold non-epoch dates for activities whose current `planned_start` is 1970-01-01.**

So correcting the `Activity` rows will **not** align the baseline, and the two will continue to
disagree. Whatever C2 does to the activities must be decided **together with** what it does to the 3
baseline rows and the 6 scenario overrides, or the correction will simply relocate the inconsistency
(**OD9-013**).

### 19.4 No other epoch data exists anywhere [EXECUTED — proven absence]

| Carrier | Rows < 1980-01-01 |
|---|---|
| `Workpack.planned_start_date` | **0** |
| `events.planned_start` | **0** |
| `events.actual_start` | **0** |
| `BaselineActivity.planned_start` | **0** |
| `ScenarioActivityOverride.planned_start` | **0** |
| `event_milestones.planned_date` | **0** |

**The epoch problem is exactly three `Activity` rows and nothing else.**

### 19.5 The correction policy remains safe — confirmed, with one addition

| Policy element | Assessment |
|---|---|
| Correct by **explicit Activity IDs** | ✅ **CONFIRMED SAFE.** The three UUIDs are stable and now recorded verbatim |
| **Never** a broad date predicate | ✅ **CONFIRMED ESSENTIAL.** `WHERE planned_start < '1980-01-01'` would work today, but the same predicate over `timestamptz` after conversion is exactly the class of statement that produces silent mass updates. ID-based correction is immune |
| Inside a **controlled migration** | ✅ CONFIRMED |
| **Only after restore verification** | ✅ CONFIRMED |
| **NEW: the 3 baseline + 6 scenario references must be decided in the same change** | ⚠️ **ADDITION** — §19.3 |
| **NEW: correct BEFORE the `timestamptz` conversion** | ⚠️ **ADDITION** — 1970-01-01 converts to `1969-12-31 18:30:00 UTC`, an even less obvious sentinel. Correct while the value is still legible |

**Nothing was nulled, changed or deleted.**

---

## 20. Data Preservation Strategy

> **None of this was executed.**

### 20.1 Scope [EXECUTED]

| Measure | Value |
|---|---|
| Database size | **22 MB** |
| Non-empty tables | **48** of 220 |
| Live tuples | **2 994** |
| Largest table | `AuditLog` — 288 kB |

**A full logical dump is seconds of work.** There is no argument from cost for skipping it.

### 20.2 Per-object plan for everything C2 may touch

| Object | Rows | Snapshot | Count check | Checksum strategy | Pre-migration validation | Post-migration validation | Rollback | Acceptance |
|---|---|---|---|---|---|---|---|---|
| `Activity` (4 date cols) | 73 | Full dump + `CSV` of `(id, planned_start, planned_end, actual_start, actual_end)` | 73 / 72 live | `md5(string_agg(id‖dates ORDER BY id))` | Capture all 4 columns as text | **Every non-null value equals `<orig date> 00:00:00+05:30`**; null count unchanged (49/26/14/7) | Restore | 100 % row match, 0 nulls introduced |
| `events` (4 date cols) | 51 | as above | 51 | as above | 49 planned_start, 49 planned_end, 0 actuals | Same instants; **0 actuals must remain 0** | Restore | exact |
| `Workpack` (2 date cols) | 199 | as above | 199 | trivial — all null | **0 populated** | still 0 populated | Restore | exact |
| `BaselineActivity` | 28 | dump | 28 | md5 over `(id, planned_start, planned_finish)` | **NOT NULL** on both | NOT NULL preserved; instants preserved | Restore | exact |
| `ScenarioActivityOverride` | 11 | dump | 11 | md5 | 11 rows, `early_start_constraint` populated | preserved | Restore | exact |
| `event_milestones` | **0** | dump | 0 | n/a | empty | still empty | Restore | trivial |
| **`ShiftDefinition`** | **6** | **dump + CSV before ANY schema work** | **6** | md5 over all columns | `start_time`/`end_time` are **text** | **still text, 6 rows, unique `(event_id, shift_name)` intact** | Restore | **6 = 6, byte-identical** |
| **`ResourceCapacity`** | **30** | **dump + CSV** | **30** | md5 | `target_date` is **`date`** | **still `date`, 30 rows, 5-col unique intact** | Restore | **30 = 30** |
| **`workpack_asset_snapshots`** | **2** | **dump + CSV incl. jsonb** | **2** | md5 over jsonb text | 2 rows | 2 rows, jsonb equal | Restore | **2 = 2** |
| `ActivityLibrary.library_scope` | **250** | column CSV | 250 | distinct-value check | all `'TENANT'` | 250 non-null | Restore | exact |
| `Organization.lifecycle_status` | **372** | column CSV | 372 | distinct-value check | all `'active'` | 372 non-null | Restore | exact |
| `ActivityUdfDefinition` 2 cols | **55** | column CSV | 55 | md5 | 55 non-null each | 55 non-null each | Restore | exact |
| **`asset_attribute_history.created_at`** | **16** | **column CSV — IRREPLACEABLE** | 16 | md5 over timestamps | 16 non-null | **16 identical timestamps** | Restore | **byte-identical** |
| **`asset_attribute_values.entered_at`** | **6** | **column CSV — IRREPLACEABLE** | 6 | md5 | 6 non-null | **6 identical timestamps** | Restore | **byte-identical** |
| **3 epoch activities** | 3 | **row-level JSON before + after** | 3 | per-ID | 3 IDs, `1970-01-01` | **exactly those 3 IDs changed; 70 other rows untouched** | Restore | **3 changed, 70 unchanged** |
| `ActivityRelationship.lag_days` | 20 | dump | 20 | md5 | `0`×14, `5`×3, `13`×3 | **unchanged — C3, not C2** | Restore | untouched |
| `_prisma_migrations` | 32 | **dump before re-baselining** | 32 | full table CSV | 32 rows | new baseline row present, history archived | Restore | audit trail retained |

### 20.3 The global invariants

| Invariant | Check |
|---|---|
| **No table loses rows** | `pg_stat_user_tables.n_live_tup` per table, before vs after — **48 non-empty tables must still be 48** |
| **Total tuple count** | 2 994 before; after ≥ 2 994 (additive migrations only) |
| **Table count** | **220 before, 220 after** for reconciliation steps; only step 2 of §16.4 adds 2 |
| **FK count** | **296 before; must not decrease** |
| **Enum count** | 38 before / after; `ActivityStatus` **5 → 8** |
| **No `DROP TABLE` / `DROP COLUMN` executed at any point** | Review every generated migration by hand before applying |

### 20.4 The non-negotiable rule

> **Every step in §16.4 must be preceded by a `pg_dump` whose restore has been tested, not merely
> taken.** An untested dump is not a backup; it is a file. Gate G2 requires a *restore*, not a dump.

---

## 21. Clean-Clone Reproducibility

### 21.1 The question

Can `clean clone → install → prisma generate → migrate → seed → startup` reproduce the current
database?

> ## **NO.** [INFERENCE — strong, from executed catalogue evidence; not attempted, per §1]

### 21.2 The exact blockers

| # | Blocker | Evidence | Severity |
|---|---|---|---|
| **1** | **`migrate deploy` would not reproduce this schema.** The baseline declares 4 `Activity` FKs the live DB lacks and `ON DELETE CASCADE` where the live DB has `SET NULL`. A replay produces a *different* database from the one in use | [SOURCE + EXECUTED] §14.7 | 🔴 **P0** |
| **2** | **`prisma generate` would produce no accessors for the 8 undeclared tables.** Migrations *would* create the tables, but the client would not expose them — so `ResourcePlanningService`'s 15 call sites break on a freshly built database exactly as they do now | §8 | 🔴 **P0** |
| **3** | **The 3 `ActivityStatus` values would not exist.** No migration adds them, so a clean database has 5 values and M12's RELEASE/VERIFY/CLOSE fail | §10.1 | 🔴 **P0** |
| **4** | **The 11 loose `.sql` files would never run.** `Activity.standard_activity_type_id` and `Activity.window` would be absent, breaking M8.13 classification and the window field | §14.2 | 🔴 **P0** |
| **5** | **`Activity.project_id` / `schedule_source` would still be absent**, so activity creation fails identically | §7 | 🔴 **P0** |
| **6** | **`shadowDatabaseUrl` is not configured**, so `migrate dev` cannot run at all and `migrate diff --from-migrations` refuses | §14.6 | 🟠 **P1** |
| **7** | **Non-linear history** — `20250821_…` sorts before the baseline; 6 migrations pend behind an applied later one | §14.3, §14.4 | 🟠 **P1** |
| **8** | Seed coverage is unverified — `prisma/seed.ts` creates one org, site, role and admin user. The 48 non-empty tables are **not** reproducible from seeds | [SOURCE] | 🟡 **P2** |

### 21.3 What "reproducible" must mean after §16.4

| Requirement | Achieved by |
|---|---|
| One squashed baseline that **is** the schema | §16.4 step 9 |
| `migrate deploy` on an empty DB → schema identical to production | verified at step 10 |
| `migrate diff --from-config-datasource --to-schema --exit-code` → **0** | step 8, then enforced in CI |
| The 11 loose SQL files **folded in or formally archived** | step 9 |
| `shadowDatabaseUrl` configured | step 10 |
| Seeds sufficient for a working dev environment | tracked separately — does not block C2 |

### 21.4 Why CI did not catch any of this [SOURCE]

`.github/workflows/ci.yml:25, 48, 69, 100` runs `npx prisma generate` and `npx prisma validate`, and
the deploy workflows run `prisma generate`.

> **`prisma validate` checks that the schema is internally well-formed. It never contacts a database.**

So the pipeline passes cleanly on a schema that declares two columns the database lacks, three enum
values it lacks, and omits eight tables it holds. **Every one of the 32 OD9 defects survived CI, and
would survive it again.**

This is why §16.4 step 8 matters beyond the immediate remediation. Adding

```
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
```

to CI turns schema drift from an invisible condition into a **build failure** — the single change that
prevents OD9 from recurring (**OD9-032**).

**Nothing was repaired.**

---

## 22. Integration Boundary

### 22.1 The three schemas, kept distinct

| | Schema | Owner | Affected by OD9? |
|---|---|---|---|
| **A** | **AURIANOA application database** — PostgreSQL 17.10 `syority`, 220 tables | AURIANOA | ✅ **YES — entirely** |
| **B** | **P6 / MS Project interchange contract** — XER, P6 XML, MS Project XML, MPP | Interchange format | ⚠️ **Indirectly** — see §22.3 |
| **C** | **External client SQL Server source systems** | Client | ❌ **NO** |

### 22.2 There is no live SQL Server connection [SOURCE — proven absence]

`package.json` declares **no** `mssql`, `tedious`, `sequelize`, `odbc`, `sqlserver` or `oracledb`
dependency. The only database clients are `pg`, `@prisma/adapter-pg` and `@prisma/client`.

> **Integration is entirely file-based** — import and export of XER / XML / MPP documents. AURIANOA
> never connects to a client SQL Server, so **no client-side schema can be affected by any OD9
> remediation.** Schema C is out of scope, conclusively.

### 22.3 Where OD9 does touch the interchange contract

One narrow but real overlap:

| Item | Effect |
|---|---|
| `MsProjectXmlFormatter.ts:185, 188` emits `.toISOString().replace('.000Z','')` | Today the source is a zone-naive `date`. After the `timestamptz` conversion the same expression emits a **UTC instant with its zone marker stripped**, so a receiving P6/MS Project instance reads a +05:30 value as local — a **5½-hour error in an exported schedule** (C1 D-53) |
| **`app/api/workpacks/[id]/export/primavera/route.ts:52` selects `Activity.is_milestone`** | **The column does not exist, so Primavera export fails outright** — a broken integration path, not merely a wrong value (§9.4) |
| `PrimaveraXmlFormatter.ts:24, 78` consumes `is_milestone` | Downstream of the same phantom field |
| P6/XER/MPP parsers set `ParsedActivity.is_milestone` in memory | **Never persisted** — milestone flags arriving from a client's P6 schedule are parsed and discarded (OD9-031) |
| The XER lag conversions (÷8, ÷10) | Untouched by OD9. They belong to D9/C3 |

> **Two distinct integration impacts, and they are different in kind.** The formatter problem is a
> *silent wrong value* that the `timestamptz` conversion will introduce. The export route's
> `is_milestone` selection is an *existing hard failure*. The second is arguably the safer of the two —
> an export that fails is visible; an export that is quietly 5½ hours out is not.

> **The formatter must be fixed in the same change as the conversion, not afterwards.** An exported
> schedule that is silently 5½ hours wrong is worse than one that refuses to export.

**No integration was redesigned.**

---

## 23. Target Reconciliation Sequence

> **Design only. Nothing below was executed.**

| Phase | Action | Blocking? | Verification |
|---|---|---|---|
| **1** | **Snapshot + forensic checksum.** `pg_dump` (22 MB) → **test restore to a scratch database** → record per-table row counts (48 non-empty), FK count (296), enum inventory (38), and md5 checksums for the 15 objects in §20.2 | 🔴 **YES** | Restore completes; all counts match |
| **2** | **Schema inventory freeze.** Commit this document's censuses as the reference state. Freeze `prisma/schema.prisma` against unrelated edits for the duration | 🔴 **YES** | Reference state recorded |
| **3** | **Apply the 6 pending idempotent migrations** — `prisma migrate deploy`. Removes 2 `CREATE TABLE`, 2 `CREATE INDEX`, 7 `ADD COLUMN` from the diff | 🔴 **YES** | Diff shrinks; 0 rows lost; table count 220 → 222 |
| **4** | **Restore missing Prisma declarations for data-bearing DB objects** — the **8 models** (§8.4) and the **6 populated columns** (§6.B), transcribed from the physical catalogue. No column added, renamed or retyped | 🔴 **YES** | **`migrate diff` contains ZERO `DROP TABLE` and ZERO `DROP COLUMN` against populated columns** |
| **5** | **Retire truly orphan callers.** (a) Delete the `EventPhase` route, page, client and the nav link at `events/[eventId]/page.tsx:94-98`. (b) **Remove `include: { event_phases: true }` from `wbs/generate/route.ts:14-17` and promote its existing fallback — this repairs WBS generation, which is broken for every event today.** (c) Replace `is_milestone: true` at `PlanningIntelligenceProviders.ts:231` and `:433` and in `export/primavera/route.ts:52` with the derivation already used by `EvmCalculationService.ts:106-112` | 🔴 **YES** | No `prisma.<model>` accessor and no `include` key in the codebase lacks a declaration; WBS generation succeeds |
| **6** | **Resolve remaining column drift** — decide `Activity.project_id` / `schedule_source` (§7.4, recommendation: remove from Prisma); accept the genuinely stale `DROP COLUMN`s only after confirming 0 rows individually | 🔴 **YES** | Every remaining `DROP COLUMN` proven 0-row |
| **7** | **Resolve enum drift** — additive migration, 3 × `ALTER TYPE ADD VALUE`, **in its own migration**, no value used in the same transaction | 🔴 **YES** | `ActivityStatus` = 8 values; M12 RELEASE/VERIFY/CLOSE succeed |
| **8** | **Resolve FK / index drift** — decide the `Activity → events` relation (add the Prisma relation + FK, or record the unconstrained UUID as accepted); add `Activity_org_event_deleted_idx` (arrives free at Phase 3); consider `Workpack(event_id)`; reconcile `Activity.workpack_id` `SET NULL` vs `CASCADE` | 🟠 Partly | FK count ≥ 296; correctness uniques all present |
| **9** | **Correct the 3 epoch activities by explicit ID**, together with their 3 baseline and 6 scenario references — **before** any type conversion | 🔴 **YES** | Exactly 3 activities changed, 70 untouched |
| **10** | **Repair the migration baseline** — with the diff empty, generate a squashed baseline from the reconciled schema; archive the 35 directories and 11 loose `.sql` files to `prisma/migrations/_archive/`; `migrate resolve --applied` the new baseline; configure `shadowDatabaseUrl` | 🔴 **YES** | History has 1 trustworthy baseline |
| **11** | **Non-destructive dry run** — on a **restored copy**, run `migrate deploy` from empty and diff the result against production | 🔴 **YES** | Diff empty |
| **12** | **Validate the resulting diff** — `migrate diff --from-config-datasource --to-schema --exit-code` returns **0**. Wire this into CI as a permanent drift gate | 🔴 **YES** | Exit code 0 |
| **13** | **Only then: R1.0-C2 time migration** — using the §18.3 required form, on a restored copy first | — | C2 acceptance |

### 23.1 The ordering constraints that matter

| Constraint | Why |
|---|---|
| **1 before everything** | Nothing else is reversible without it |
| **3 before 4** | Phase 3 removes work from Phase 4 for free |
| **4 before 10** | Re-baselining before re-declaring would permanently encode the loss of 8 tables |
| **9 before 13** | `1970-01-01` is legible; `1969-12-31 18:30:00+00` is not |
| **12 before 13** | An empty diff is the only objective evidence that the schema is reconciled |
| **7 independent** | The enum fix repairs M12 and can proceed in parallel after Phase 1 |

### 23.2 What is NOT in this sequence

- **The lag conversion** (`lag_days` → `lag_minutes`). D9-governed, belongs to **C3**.
- **The constraint carrier** (`Activity.constraint_type` / `constraint_date`). C1 §8, belongs to **C2**.
- **The workpack span columns.** C1 §7, belongs to **C2**.
- **The 181 event-less workpacks.** Data, not schema — **OD9-017**, does not block C2.

---

## 24. DO NOT DO List

> Every item below was honoured by this task and is binding on the remediation.

| # | Prohibition | Why, in this system specifically |
|---|---|---|
| 1 | **DO NOT `prisma db push`** | It is how this situation was created (§14.7). It writes schema without history and would silently drop the 8 undeclared tables |
| 2 | **DO NOT `prisma migrate reset`** | Destroys all 2 994 rows across 48 tables |
| 3 | **DO NOT drop populated tables** | `ResourceCapacity` (30), `ShiftDefinition` (6), `workpack_asset_snapshots` (2) |
| 4 | **DO NOT drop populated columns** | `library_scope` (250), `lifecycle_status` (372), `is_exportable`/`is_progress_driving` (55 each), and the **22 irreplaceable timestamps** in `asset_attribute_history.created_at` / `asset_attribute_values.entered_at` |
| 5 | **DO NOT delete migration history** | Archive it. `_prisma_migrations` is the only record of what was *believed* to have happened |
| 6 | **DO NOT delete the 7 stale schema copies yet** | They are the evidence of the drift mechanism (§5.2) |
| 7 | **DO NOT fabricate missing data** | No `?? new Date()`, no invented time-of-day (C1 §17.2, D-01) |
| 8 | **DO NOT auto-assign an Event** to the 181 event-less workpacks or the 4 event-less activities | Inventing a campaign association is worse than an absent one |
| 9 | **DO NOT infer `Project → Event`** | R0.4 is CLOSED and `Project` has **0 rows** — there is nothing to map from |
| 10 | **DO NOT recreate `EventPhase`** | No table, no data, no completed feature — and it would create a third authored planned window, breaking C1 §6/§7 |
| 11 | **DO NOT delete `ShiftDefinition`** | 6 rows; the plant's only real working-time record; C4 depends on it |
| 12 | **DO NOT delete `ResourceCapacity`** | 30 rows; the levelling capacity ceiling |
| 13 | **DO NOT delete `workpack_asset_snapshots`** | 2 rows of immutable audit payload |
| 14 | **DO NOT blindly make Prisma match the DB** | It would import 5 stale column groups and encode the missing FKs as intended |
| 15 | **DO NOT blindly make the DB match Prisma** | That is the destructive diff — 38 rows and 22 timestamps destroyed |
| 16 | **DO NOT convert timestamps before timezone semantics are tested** | Gate G11. Proven in principle (§18); must still be executed on a restored copy |
| 17 | **DO NOT convert lag in this task or in C2** | D9/C3 owns it. `lag_days` stays untouched: `0`×14, `5`×3, `13`×3 |
| 18 | **DO NOT change M11** | Frozen pending OD10 |
| 19 | **DO NOT change M12** | GREEN/CLOSED. Adding the 3 enum values **repairs** M12's writes; it does not reopen M12 |
| 20 | **DO NOT change M8.13** | GREEN |
| 21 | **DO NOT run a bare `ALTER … TYPE timestamptz`** | Session-dependent; fails silently by +05:30 (§18.2) |
| 22 | **DO NOT correct epoch rows by date predicate** | Explicit IDs only (§19.5) |
| 23 | **DO NOT run `migrate dev` / `npm run deploy:dev`** until `shadowDatabaseUrl` is configured | It may offer to reset the database (§5.5) |
| 24 | **DO NOT bundle the asset-attribute `date → timestamp` change with the R1.0-C conversion** | Different semantics, different owner (§15.4) |

---

## 25. OD9 Defect Register

**P0** = blocks C2 or destroys data · **P1** = wrong result or lost information ·
**P2** = correctness/consistency risk · **P3** = hygiene.

| ID | Defect | Evidence | Sev | C2 impact |
|---|---|---|---|---|
| **OD9-001** | **`Activity.project_id` + `schedule_source` declared in Prisma, absent from DB.** **`ActivityCreationCommand:486` writes `schedule_source` on EVERY creation**, so the single authoritative Activity creation path emits an INSERT naming a non-existent column. 12 call sites total. **No migration ever created them.** The two fields need *different* remedies (§7.5): remove `project_id`, **create** `schedule_source` | §7, §7.3a, §7.5 | **P0** | **BLOCKS C2** |
| **OD9-002** | **Destructive diff proposes 8 `DROP TABLE` (3 populated: 30 + 6 + 2 rows) AND 6 populated `DROP COLUMN`, including 22 irreplaceable provenance timestamps** | §15 | **P0** | **BLOCKS C2** |
| **OD9-003** | **Migration history is not reproducible and never described this database.** The baseline declares 4 `Activity` FKs that do not exist and `CASCADE` where the DB has `SET NULL`; 31 of 32 rows have `applied_steps_count = 0`; 3 rolled back; 6 on disk unrecorded; 11 loose `.sql` files outside history entirely | §14 | **P0** | **BLOCKS C2** |
| **OD9-004** | `ShiftDefinition` missing Prisma model — **6 rows**, 15 call sites, holds the plant's real working time | §8.1 | **P0** | **BLOCKS C2** |
| **OD9-005** | `ResourceCapacity` missing Prisma model — **30 rows**, 15 call sites | §8.1 | **P0** | **BLOCKS C2** |
| **OD9-006** | `workpack_asset_snapshots` missing Prisma model — **2 rows** of audit payload | §8.1 | **P0** | **BLOCKS C2** |
| **OD9-007** | **`EventPhase` phantom entity across 5 files, and it breaks a SECOND feature.** `prisma.eventPhase.create` (`phases/route.ts:22`); `include: { event_phases }` in the phases page (`:15-18`) **and in `wbs/generate/route.ts:14-17`** — so **WBS generation fails for every event** and its hardcoded fallback (`:46-50`) is unreachable. A **live nav link** exists at `events/[eventId]/page.tsx:94-98`. Build-time errors were recorded in `docs/M8.5_TS_ERRORS_FULL.txt:10-11,118` and left | §9.2a, §9.3 | **P0** ⬆ | **BLOCKS C2** (Phase 5) |
| **OD9-008** | **`Activity.is_milestone` queried at 3 production sites**, not one — `PlanningIntelligenceProviders.ts:231` and `:433` (both registered providers, reachable via OIS/report-builder/BRE) plus **`export/primavera/route.ts:52`**. **The fix needs no schema change**: `EvmCalculationService.ts:106-112` already derives milestone-ness from `work_category`/zero duration | §9.4 | **P1** | **BLOCKS C2** (Phase 5) |
| **OD9-009** | **Enum drift** — `ActivityStatus` declares 8, DB has 5. `ExecutionWriteService` writes `'released'` `:255`, `'verified'` `:312`, `'closed'` `:320`. **Three M12 actions cannot persist.** The only value-level drift in all 38 enums | §10 | **P0** | **BLOCKS C2** |
| **OD9-010** | **`Activity → events` relation/FK drift CONFIRMED** — Prisma declares no `event` relation; the DB has no FK; the baseline migration declares one. The central R0.4 relationship is an **unconstrained UUID** | §12.1 | **P1** | **DOES NOT BLOCK** — decide in Phase 8 |
| **OD9-011** | **Index drift CONFIRMED** — `Activity_org_event_deleted_idx` declared at `schema.prisma:82` and created by migration `20260908_r01_activity_event_index`, **absent from the DB**. No index on `Workpack(event_id)` at all | §13 | **P2** | **DOES NOT BLOCK** — fixed free at Phase 3 |
| **OD9-012** | **Timestamp/timezone conversion risk** — bare `ALTER … TYPE timestamptz` is session-dependent; a UTC session skews every historical date by **+05:30** | §18 | **P0** | **BLOCKS C2** — mitigated by the §18.3 required form |
| **OD9-013** | **Epoch normalisation prerequisite** — 3 activities at `1970-01-01`, referenced by **3 `BaselineActivity`** and **6 `ScenarioActivityOverride`** rows whose own dates are **not** epoch. Correcting the activities alone relocates the inconsistency | §19 | **P1** | **BLOCKS C2** (Phase 9) |
| **OD9-014** | **7 stale/duplicate Prisma schema copies** dated 28-Mar-2026. Not referenced by tooling (`prisma.config.ts` pins the authoritative path) but the likely mechanism of the bidirectional drift | §5.2 | **P2** | **DOES NOT BLOCK** — archive at Phase 10 |
| **OD9-015** | **Clean-clone reproducibility failure** — 8 distinct blockers; 5 of them P0 | §21 | **P1** | **DOES NOT BLOCK C2** directly; blocks CI/CD trust |
| **OD9-016** | **5 further tables missing Prisma models** — `provisioning_jobs`, `provisioning_templates`, `provisioning_job_logs`, `asset_relationships`, `onboarding_requests`. Empty, but with live services and platform routes. **B7 is 8 tables, not 3** | §6.B | **P1** | **BLOCKS C2** (same Phase 4 work) |
| **OD9-017** | **181 of 199 workpacks have `event_id IS NULL`** — outside every campaign container; invisible to CPM, span and readiness | §4.4 | **P2** | **DOES NOT BLOCK** — data, not schema |
| **OD9-018** | Two Prisma configuration surfaces — `prisma.config.ts` and a legacy `package.json` `"prisma"` key. Values agree today | §5.3 | **P3** | POST-C2 |
| **OD9-019** | The drift habit is codified — `prisma/seed.ts` uses `$executeRaw` to write a column "Prisma Client doesn't know about" | §5.4 | **P3** | POST-C2 |
| **OD9-020** | **`npm run deploy` runs `migrate deploy`** and would attempt the 6 unrecorded migrations; `deploy:dev` runs `migrate dev`, which needs the missing shadow database | §5.5 | **P1** | **BLOCKS C2** — operational foot-gun |
| **OD9-021** | **C1 §19 relies on `Activity.schedule_source` as an existing provenance carrier. It does not exist and never did.** C2 must create it explicitly or name another carrier | §7.4 | **P1** | **BLOCKS C2** — C1 correction |
| **OD9-022** | `prisma/seeds/validation-plant-seed.ts:413` writes `status: 'ready'` — a value in no enum, Prisma or DB | §10.2 | **P3** | POST-C2 |
| **OD9-023** | **A scenario-scoped constraint carrier already exists** — `ScenarioActivityOverride.early_start_constraint`, `timestamp(3)`, 11 rows. C1 §8 records no existing carrier. C2 must decide supersede vs coexist; coexistence would be a second constraint authority | §11.1 | **P1** | **BLOCKS C2** — C1 addition |
| **OD9-024** | `Activity.workpack_id` FK is `ON DELETE SET NULL`; the baseline migration specifies `CASCADE`. Deleting a workpack **silently orphans** its activities | §12.3 | **P2** | DOES NOT BLOCK |
| **OD9-025** | Migration name/time inversion — `20250821_m86_add_history_refers_fk` sorts **before** the baseline but was applied a year "later" | §14.3 | **P2** | DOES NOT BLOCK — resolved by re-baselining |
| **OD9-026** | **`datasource.shadowDatabaseUrl` is not configured** — disables `migrate dev` and migrations-directory diffing, and blocks the Phase 11 dry run | §14.6 | **P1** | **BLOCKS C2** (Phase 10) |
| **OD9-027** | The diff bundles an unrelated `date → TIMESTAMP(3)` conversion for `asset_attribute_*.value_date` (0 rows) with the R1.0-C work | §15.4 | **P2** | DOES NOT BLOCK — keep separate |
| **OD9-028** | **Every CPM `early_*`/`late_*` value begins at `05:30`** — UTC midnight written into a zone-naive column. Arithmetically correct, semantically wrong; the conversion makes it visible | §17.5 | **P2** | DOES NOT BLOCK — record before C2 so it is not read as a conversion bug |
| **OD9-029** | **`Organization.timezone` and `Site.timezone` physically store `'UTC'` on every sampled row**, including five Indian refineries. Escalates C1 D-39 from a default to a **data** problem | §17.3 | **P0** | **BLOCKS C2** — G11 |
| **OD9-030** | **The identity backfill's legacy detection silently never fires.** `identityBackfillPrismaStore.ts:49-56` omits `schedule_source` from its raw `SELECT`, while `ActivityIdentityBackfillService.ts:47` tests `row.schedule_source === 'imported'` — always `undefined === 'imported'` → always false. A drift workaround that created a second, silent defect | §7.3a | **P1** | **DOES NOT BLOCK C2** |
| **OD9-031** | **Milestone flags from client schedules are parsed and discarded.** `P6XmlParser.ts:19,139`, `P6XerParser.ts:19,99`, `MsProjectXmlParser.ts:23,212` populate `ParsedActivity.is_milestone` in memory; **no import service persists it** | §9.4, §22.3 | **P2** | **DOES NOT BLOCK C2** |
| **OD9-032** | **CI cannot detect this class of defect.** `.github/workflows/ci.yml:25,48,69,100` runs `prisma generate` and `prisma validate`. **`validate` checks the schema's internal consistency, not its agreement with any database**, so it passes cleanly on a schema that declares 2 phantom columns, 3 phantom enum values and omits 8 live tables. Every OD9 defect survived CI | §21.3 | **P1** | **DOES NOT BLOCK C2** — but blocks any guarantee it won't recur |

### 25.1 Totals

| | Count | IDs |
|---|---|---|
| **P0** | **10** | 001, 002, 003, 004, 005, 006, 007, 009, 012, 029 |
| **P1** | **11** | 008, 010, 013, 015, 016, 020, 021, 023, 026, 030, 032 |
| **P2** | **8** | 011, 014, 017, 024, 025, 027, 028, 031 |
| **P3** | **3** | 018, 019, 022 |
| **Total** | **32** | |
| **BLOCKS C2** | **17** | 001–009, 012, 013, 016, 020, 021, 023, 026, 029 |
| **DOES NOT BLOCK C2** | **12** | 010, 011, 014, 015, 017, 024, 025, 027, 028, 030, 031, 032 |
| **POST-C2** | **3** | 018, 019, 022 |

### 25.2 The three defects that cost almost nothing to fix

Worth separating out, because the register's size can obscure how cheap some of it is:

| Defect | Fix | Cost |
|---|---|---|
| **OD9-009** — 3 M12 actions cannot persist | 3 × `ALTER TYPE ADD VALUE` in one migration | **One migration, no data touched** |
| **OD9-008** — `is_milestone` queried at 3 sites | Adopt the derivation already in `EvmCalculationService.ts:106-112` | **No schema change at all** |
| **OD9-007** — WBS generation broken for every event | Delete `include: { event_phases: true }` at `wbs/generate/route.ts:14-17`; promote the existing fallback | **Two lines; repairs a live feature** |

**Not one of the 32 is a question about what a date means.** Every one is physical schema state,
migration state, declaration state or timezone state — which is exactly why C1 could freeze while
OD9 is RED.

---

## 26. C2 Preconditions

| Gate | Requirement | Evidence | Status |
|---|---|---|---|
| **G1** | **C1 frozen** | `AURIANOA_R1.0_C1_TIME_AUTHORITY_CONTRACT.md` — FROZEN, with the OD9-021 and OD9-023 corrections folded back | ✅ **GREEN** |
| **G2** | **Database snapshot strategy** — `pg_dump` **plus a tested restore**, with per-object checksums | Strategy defined §20; **not executed**. 22 MB / 48 tables / 2 994 tuples makes it cheap | ⛔ **RED** |
| **G3** | **DB / Prisma census complete** | ✅ **Executed and closed**: 213 models · 219 tables · 38 + 38 enums · `213 + 8 = 219 + 2 = 221` | ✅ **GREEN** |
| **G4** | **B1 resolved by design** | ✅ Design complete (§7.4): remove from Prisma; **no data exists anywhere**; `Project` = 0 rows. Depends on OD9-021 | 🟠 **AMBER** — design done, decision not ratified |
| **G5** | **B2 destructive diff eliminated by design** | ✅ All 8 drops explained as missing declarations; re-declaration design complete (§8.4); populated columns enumerated | 🟠 **AMBER** — design done, not applied |
| **G6** | **B3 migration history reconciled by design** | ✅ Root cause established (§14.7); Option C→B sequence defined (§16.4) | 🟠 **AMBER** — design done, not applied |
| **G7** | **B7 models reconciled** | ✅ **RESOLVED BY DESIGN** — all **8** (not 3) fully specified from the physical catalogue (§8) | ✅ **GREEN (design)** |
| **G8** | **EventPhase classified** | ✅ **RETIRE CALLER** — decided on evidence (§9.3) | ✅ **GREEN** |
| **G9** | **Enum drift classified** | ✅ Exactly one drift; fix is 3 additive `ADD VALUE`; execution note recorded (§10.3) | ✅ **GREEN (design)** |
| **G10** | **FK / index drift classified** | ✅ Complete comparison (§12, §13); `Activity → events` decision deferred to Phase 8 | ✅ **GREEN (design)** |
| **G11** | **Timezone conversion proven** | ✅ **PROVEN BY EXECUTION** (§18.1) and required statement form specified (§18.3). **But OD9-029 — every tenant row stores `'UTC'` — must be resolved first** | 🟠 **AMBER** |
| **G12** | **Epoch correction prepared** | ✅ 3 IDs recorded verbatim; full dependency map; policy confirmed with 2 additions (§19) | ✅ **GREEN (design)** |
| **G13** | **Clean-clone strategy defined** | ✅ 8 blockers enumerated; target defined (§21.3). **Reproduction not demonstrated** | 🟠 **AMBER** |
| **G14** | **Non-destructive dry run defined** | ✅ Defined (§23 Phase 11–12) with a machine-checkable acceptance (`--exit-code` = 0). **Blocked by OD9-026** — no shadow database | ⛔ **RED** |

### 26.1 Gate summary

| Status | Gates |
|---|---|
| ✅ **GREEN** | G1, G3, G7, G8, G9, G10, G12 — **7** |
| 🟠 **AMBER** | G4, G5, G6, G11, G13 — **5** |
| ⛔ **RED** | **G2** (no tested snapshot), **G14** (no shadow database) — **2** |

> **C2 is BLOCKED.** Two gates are RED and five are AMBER. Per the instruction's rule, *C2 may NOT be
> marked READY if any blocking gate is unresolved.*

### 26.2 What is encouraging about this gate profile

**Every GREEN gate is a design or census gate, and all seven are now closed.** The forensic work is
finished: the census is exact and closed, all eight B7 models are specified, the enum drift is a
single additive change, EventPhase is decided, and the timezone semantics are *proven by execution*.

**The two RED gates are the two cheapest actions in the entire programme** — take a verified dump of a
22 MB database, and add one line of configuration for a shadow database. Neither requires a decision.

> **OD9 is RED because of work not yet done, not because of questions not yet answered.**

---

## 27. Acceptance Matrix

| # | Requirement (from the instruction) | Met | Where |
|---|---|---|---|
| 1 | Absolute read-only rule honoured | ✅ | §3.1 — session pinned `default_transaction_read_only = on`, verified |
| 2 | No command that could alter state executed | ✅ | §3.2 — shadow-DB diff **refused and not worked around** |
| 3 | Findings not treated as permission to "make Prisma win" | ✅ | §15.2, §24 items 14–15 |
| 4 | DB census: name, version, schemas, tables, views, enums, indexes, FKs, uniques, checks, sequences, triggers, row counts, sizes | ✅ | §4 — incl. proven **0** views/sequences/triggers |
| 5 | Every relevant table classified DB_PRESENT / ABSENT / EMPTY / DATA_PRESENT | ✅ | §4.3 |
| 6 | Prisma census incl. duplicates, active vs stale, tooling references | ✅ | §5 — `prisma.config.ts` pins the authoritative path |
| 7 | Whether migration generation uses a non-authoritative schema | ✅ | §5.1 — **no**; single generated client |
| 8 | Three-way matrix A / B / C with classifications | ✅ | §6 — set difference **closed**: `213 + 8 = 219 + 2` |
| 9 | B7 deep reconciliation: columns, types, indexes, FKs, rows, consumers, safety, representability, category | ✅ | §8 — and **B7 is 8 objects, not 3** |
| 10 | No Prisma model recreated | ✅ | §8.4 — design only |
| 11 | EventPhase: what it creates, existence, alternatives, callers, UI, tests, completion | ✅ | §9 |
| 12 | EventPhase decision by the stated rule | ✅ | §9.3 — **RETIRE CALLER**, with a second reason from C1 |
| 13 | `EventPhase` not created | ✅ | Not created |
| 14 | B1: when it entered, migrations, code, STO meaning, Event-only obsolescence | ✅ | §7 — **no migration ever created it** |
| 15 | `project_id` not removed; recommendation only | ✅ | §7.4 — schema untouched |
| 16 | Migration forensics incl. zero-step, out-of-sequence, rolled-back, missing dirs, DB-without-migration, migration-without-DB | ✅ | §14 |
| 17 | Timeline with intended change → DB status → dependents → risk | ✅ | §14.4, §14.7 |
| 18 | The point where history ceased to be trustworthy | ✅ | §14.7 — **the baseline itself, proven by FK contradiction** |
| 19 | History not rewritten | ✅ | Untouched |
| 20 | Baseline options A/B/C/D evaluated on all 9 criteria | ✅ | §16 — **A proven unavailable** |
| 21 | Strategy not chosen for being easiest | ✅ | §16.5 — the easiest options destroy data and are rejected |
| 22 | Destructive diff reproduced safely | ✅ | §15.1 — `--script` to stdout, applied to nothing |
| 23 | Every proposed DROP answered against all 8 causes | ✅ | §15.2 |
| 24 | No DROP recommended merely because Prisma lacks a declaration | ✅ | §15.2 — **zero drops recommended** |
| 25 | Enum reconciliation incl. `released` / `verified` / `closed` | ✅ | §10 — one drift in 38 enums |
| 26 | Enums not altered | ✅ | Untouched |
| 27 | Column matrix for all 13 named tables + R1.0 tables | ✅ | §11 |
| 28 | Every mismatch classified ADD/REMOVE/RENAME/TYPE/NULLABILITY/INDEX/FK/LEGACY/UNKNOWN | ✅ | §11 |
| 29 | FK reconciliation for all 10 named relations | ✅ | §12.2 |
| 30 | Declared-without-FK, FK-without-relation, cross-tenant, nullable, ON DELETE, orphans | ✅ | §12.1, §12.3 |
| 31 | No FK added or removed | ✅ | Untouched |
| 32 | Index reconciliation, separated correctness / performance / optional | ✅ | §13 |
| 33 | No index created | ✅ | Untouched |
| 34 | Exact current DB types for the 8 named columns | ✅ | §17.1 |
| 35 | Timezone, session tz, column tz, app assumptions, date-only, epoch, NULL distribution, min/max | ✅ | §17 |
| 36 | The 3 epoch activities confirmed by exact ID | ✅ | §19.1 — all three still present |
| 37 | Epoch rows not modified | ✅ | Untouched |
| 38 | `DATE → timestamp → timestamptz` demonstrated under the real session tz | ✅ | §18.1 — **executed** |
| 39 | Exactly how C2 must perform the conversion | ✅ | §18.3 — explicit `USING … AT TIME ZONE 'Asia/Kolkata'` |
| 40 | No data altered | ✅ | §3.1 |
| 41 | Epoch dependency map incl. baseline and scenario references | ✅ | §19.2–19.3 — **3 baseline + 6 scenario refs**, an inconsistency found |
| 42 | Data-preservation plan: snapshot, counts, checksums, pre/post validation, rollback, acceptance | ✅ | §20 |
| 43 | None of it executed | ✅ | §20 |
| 44 | Clean-clone reproducibility determined with exact blockers | ✅ | §21 — **NO**, 8 blockers |
| 45 | Not repaired | ✅ | Untouched |
| 46 | Integration boundary A/B/C kept distinct | ✅ | §22 — **no SQL Server client exists** |
| 47 | Integrations not redesigned | ✅ | §22.3 — one overlap recorded only |
| 48 | Target reconciliation sequence | ✅ | §23 — 13 phases with ordering constraints |
| 49 | DO NOT DO list, all 15 required items | ✅ | §24 — 24 items |
| 50 | Defect register incl. all 16 required IDs | ✅ | §25 — **32 defects** |
| 51 | P0–P3 and BLOCKS / DOES NOT BLOCK / POST-C2 | ✅ | §25 |
| 52 | C2 precondition matrix G1–G14 | ✅ | §26 |
| 53 | C2 not marked READY with unresolved gates | ✅ | §26.1 — **BLOCKED** |
| 54 | Target schema authority rule stated | ✅ | §28.1 |
| 55 | Only the required document created | ✅ | §28.5 |
| 56 | Evidence labelled throughout | ✅ | Inline `[EXECUTED]` / `[SOURCE]` / `[INFERENCE]` / `[PRODUCT]` / `[OPEN]` |
| 57 | Static inspection not called executed behavioural evidence | ✅ | §3.2 — the M12 runtime failure is explicitly `[INFERENCE]` |
| 58 | Environment limitations stated | ✅ | §3.2, §14.6 |

---

## 28. Final OD9 Decision

### 28.1 The target schema authority rule — stated explicitly, as required

> **`prisma/schema.prisma` is the DECLARATIVE APPLICATION SCHEMA.**
> **PostgreSQL is the EXISTING DATA AND PHYSICAL EVIDENCE.**
> **Neither may silently overwrite the other.**

| Principle | Consequence for this remediation |
|---|---|
| **The database is evidence, not opinion.** It holds 2 994 rows of real work | Every DB-only object is presumed **correct until proven obsolete**. Eight tables and six columns are therefore re-declared, not dropped |
| **The schema is intent, not observation.** It may be wrong about physical reality | `Activity.project_id` is presumed **mistaken until proven meaningful** — and with `Project` empty and no migration behind it, it is not |
| **Convergence must be intentional.** Every difference is decided item by item | This is why §6's matrix classifies each object rather than picking a winning side |
| **Real data is preserved absolutely.** No row is traded for tidiness | §20 |
| **History must become reproducible.** Not restored — rebuilt | §16.4 step 9. The old history is archived as evidence, not deleted |

**`db push` violates the first principle. Accepting the diff violates the first principle. Blindly
introspecting violates the second.** The §23 sequence is the only path that violates neither.

### 28.2 The required declarations (§30)

| Question | Answer |
|---|---|
| **OD9** | 🔴 **RED** |
| **Database / Prisma reconciliation** | ⛔ **NOT SAFE** — today. **Safely achievable** by §23 with no data loss |
| **Migration baseline** | ⛔ **NOT TRUSTWORTHY** — it never described this database (§14.7) |
| **Destructive diff** | ⛔ **STILL PRESENT** — 8 `DROP TABLE` + 6 populated `DROP COLUMN` |
| **B7** | ✅ **RESOLVED BY DESIGN** — and **8 objects, not 3** |
| **EventPhase** | ✅ **RETIRE CALLER** |
| **Timezone conversion** | ✅ **PROVEN** — with the explicit `AT TIME ZONE 'Asia/Kolkata'` form mandatory |
| **C2** | ⛔ **BLOCKED** |
| **Blocking items** | **17** — OD9-001 … -009, -012, -013, -016, -020, -021, -023, -026, -029, gated behind G2 and G14 |
| **Next permitted phase** | **OD9 FOLLOW-UP** — execute §23 Phases 1–12. **C2 must not start.** |

### 28.3 The one governing question for OD9

> *"Can the existing database, schema, migration history and code be reconciled without losing data
> and without inventing schema?"*

# YES — BUT NOT YET, AND NOT IN ONE STEP.

**Every difference is now explained.** The census is closed with no unexplained objects on either
side. Every one of the eight proposed table drops has a single, identical cause — a missing Prisma
declaration — and not one is obsolete. The migration history's failure has a proven root cause rather
than a suspected one. The timezone conversion is demonstrated rather than assumed.

**Nothing found requires inventing schema.** The two resource-planning models' DDL is already in the
repository; the other six tables can be transcribed from the live catalogue; the enum fix is three
additive statements; the epoch correction is three known UUIDs. **The only genuinely new columns C2
needs — the constraint carrier, the workpack span, `BaselineActivity.workpack_id` — come from C1, not
from this drift.**

**What stands between here and C2 is not analysis. It is a tested backup and a shadow database.**

### 28.4 Recommended immediate actions

```
1.  pg_dump + TEST RESTORE                     ← G2. 22 MB. Do this first, today.
2.  Configure datasource.shadowDatabaseUrl     ← G14. One line.
3.  prisma migrate deploy (6 idempotent)       ← removes 11 statements from the diff, free
4.  Re-declare 8 models + 6 populated columns  ← removes every DROP
5.  Retire EventPhase; fix is_milestone
6.  Additive enum migration (repairs M12)
7.  Verify: migrate diff --exit-code == 0
8.  Squash to a new baseline; archive the old
9.  Prove clean-clone on an empty database
10. THEN R1.0-C2, using AT TIME ZONE 'Asia/Kolkata'
```

**Three findings should be referred back to the frozen C1 contract as corrections** — not because C1
was careless, but because OD9 had database access that C1 did not:

| Refer back | Correction |
|---|---|
| **C1 §19 / OD9-021** | `Activity.schedule_source` **does not exist**. C1 records it as an existing provenance carrier. C2 must create it explicitly or name another |
| **C1 §8 / OD9-023** | `ScenarioActivityOverride.early_start_constraint` **already exists** with 11 rows. C1 records no existing constraint carrier |
| **C1 §17.3 / OD9-029** | The `'UTC'` timezone problem is **data**, not just a default — every sampled `Organization` and `Site` row stores `'UTC'`, including five Indian refineries |

### 28.5 §31 Final file-safety check

| Check | Result |
|---|---|
| **Only `docs/AURIANOA_R1.0_OD9_SCHEMA_RECONCILIATION_FORENSIC.md` created** | ✅ Verified by modification time |
| No source files changed | ✅ |
| **No Prisma schema changed** | ✅ `prisma/schema.prisma` untouched (09-Sep-2026 13:34:57) |
| **No migration created or applied** | ✅ No `migrate dev`, `deploy`, `resolve` or `db push` was run. Only `migrate diff --script` (prints SQL) |
| **No database data changed** | ✅ `default_transaction_read_only = on` verified **on** for every query; every statement a `SELECT` |
| No seed changed | ✅ |
| No test changed | ✅ |
| No UI changed | ✅ |
| **No generated artifacts remain** | ✅ Three query scripts and their output were written to `%TEMP%\od9\`, **outside the repository**, and deleted |
| Shadow database created? | ✅ **NO** — and the verification that required it was reported as blocked rather than forced (§14.6) |

**Nothing discovered during this task was fixed.** **Thirty-two** defects are recorded and left in
place, including the three M12 execution actions that cannot persist (OD9-009), the two irreplaceable
provenance columns at risk (OD9-002), and WBS generation being broken for every event (OD9-007).

---

**END — AURIANOA R1.0 OD9 SCHEMA RECONCILIATION FORENSIC AUDIT**
  
