# AURIANOA R0.2 — IDENTITY BACKFILL RESULT

**Name:** Controlled Existing Activity Identity Backfill  
**Date:** 2026-09-09  
**Status:** AMBER  
**Run ID:** `13040a36-23ac-4d16-9a99-d22254402c00`  
**Source:** `R0.2_IDENTITY_BACKFILL`

---

## 1. Objective

Repair existing Activity identity relationships that can be derived from authoritative existing records without guessing. Enter once, store once, derive once, reuse everywhere.

Automatic update only when the derivation is unique and valid. Everything else is quarantined.

---

## 2. Scope

**In scope**

- Read-only forensic census of every Activity row
- Deterministic `event_id` backfill from same-tenant Workpack
- Deterministic `discipline_id` / `standard_activity_type_id` only when uniquely governed
- Dry-run, separately executable apply, change manifest, AuditLog, rollback
- Downstream newly-connected record counts (M8.13, M11, M12, Equipment 360, Control Tower, reports)

**Out of scope (not started)**

- R0.3 Scope Change security
- R0 UI fixes
- R1 time/date model
- R2 automatic recalculation
- Readiness work
- Master-data consolidation
- `Activity.asset_id`
- M8.13 / M11 / M12 calculation or execution logic
- CPM / progress / planned or actual dates / workpack status

---

## 3. Database / environment

| Item | Value |
|---|---|
| Database | `syority` (local Postgres via `.env` `DATABASE_URL`) |
| Environment | `development` |
| Census timestamp | 2026-09-09 00:21:51 UTC |
| Dry-run timestamp | 2026-09-08 18:52:16 UTC (`13040a36-…`) |
| Apply timestamp | 2026-09-09 ~00:23 UTC |
| Tenant of applied rows | `bfd38393-e98d-489a-a602-e808be2e0f63` — M10-R3 Validation Org |
| Operator | `r0.2` |

**Schema note.** Live `"Activity"` does **not** have `project_id` or `schedule_source`, although Prisma schema declares them. R0.2 therefore uses raw SQL of columns that exist. Prisma `activity.findMany()` would fail against this database if it selected those missing columns.

---

## 4. Snapshot / rollback mechanism

No dedicated snapshot table was added. Recoverability is demonstrated by all of the following:

1. **Preflight snapshot** — `var/r02-identity-backfill/preflight-snapshot.json`  
   Before-hash of all Activity identity columns: `138a40e6252c497a29aa1040fcaf3866`  
   Plus the 16 candidate IDs and proposed Workpack events.
2. **Dry-run manifest** — old values, new values, derivation reason, SHA-256 row hashes.
3. **Optimistic lock** — apply writes only when `event_id` is still null, tenant and workpack still match, and discipline/SAT are still null.
4. **AuditLog** — one `context = R0.2_IDENTITY_BACKFILL` row per applied Activity.
5. **CLI rollback** — `scripts/r02-identity-backfill.ts rollback --run-id <id> --confirm` restores manifest `oldValues`.
6. **Live demonstration** — Activity `9482d55f-43d9-42d2-903f-04c02c15cb91` was rolled back to `event_id = null` and restored to the manifest event. R02-15 also restores from the manifest in-memory.

Apply was refused unless a prior dry-run existed, `--confirm` was present, unexpected relationships were empty, and the candidate set was exactly 16 event-only AUTO_SAFE rows.

---

## 5. Census methodology

Two read-only passes, **no UPDATE**:

1. `scripts/r02-census-readonly.ts` — SQL classification against live `"Activity"` / `"Workpack"` / `"Discipline"` / `standard_activity_types` / `"Asset"`.
2. `ActivityIdentityBackfillService.census()` / `dryRun()` — same derivation predicates used for apply, without writing Activity rows.

Categories A–S from the R0.2 brief:

| Code | Category | Live count (before) |
|---|---|---|
| A | `event_id` missing (live) | 20 |
| B | `event_id` present and agrees with Workpack | 43 |
| C | `event_id` present but disagrees with Workpack | 0 |
| D | Workpack missing | 0 |
| E | Workpack cross-tenant | 0 |
| F | Workpack event missing (activity whose WP.event_id is null) | 11 |
| G | `discipline_id` missing (live) | 72 |
| H | `discipline_id` present and valid | 0 |
| I | `discipline_id` invalid / cross-tenant | 0 |
| J | `standard_activity_type_id` missing (live) | 72 |
| K | `standard_activity_type_id` valid | 0 |
| L | Standard activity uniquely derivable | 0 |
| M | Standard activity ambiguous | 0 |
| N | Standard activity not derivable (live, non-excluded) | 70 |
| O | Equipment / type context missing (WP.asset_id null) | 70 |
| P | Hierarchy inconsistency | 0 |
| Q | Soft-deleted | 1 |
| R | Loose activities (`workpack_id` null, live) | 2 |
| S | Legacy / P6 (`p6_activity_id` / `p6_object_id`) | 0 |

Additional: 16 deterministic event candidates; 4 workpack-backed event-unresolved; 28 `BaselineActivity` snapshot rows (separate table); 0 of those snapshot rows reference the 16 applied Activity IDs.

---

## 6. Before counts

| Metric | Before |
|---|---|
| Activities total | 73 |
| Live / soft-deleted | 72 / 1 |
| Missing `event_id` (live) | 20 |
| Valid `event_id` (live) | 52 |
| Event agrees with Workpack | 43 |
| Event contradiction | 0 |
| Deterministic event candidates | 16 |
| Event unresolved, workpack-backed | 4 |
| Missing discipline (live) | 72 |
| Valid discipline | 0 |
| Missing SAT (live) | 72 |
| Valid SAT | 0 |
| SAT ambiguous | 0 |
| Library-code-not-SAT | 0 |
| Cross-tenant | 0 |
| Loose activities | 2 |
| Legacy / P6 | 0 |

---

## 7. Deterministic derivation rules

Reuse of R0.1 / `ControlledValueResolver` predicates — **not** a second identity engine.

**Event (AUTO_SAFE only if all hold)**

- Activity is live (not soft-deleted)
- Not P6 / imported legacy
- `workpack_id` is set and the Workpack exists
- `Activity.organization_id == Workpack.organization_id`
- Workpack asset, if present, is same tenant
- Hierarchy check (unit/system vs plant) using the same rules as `ControlledValueResolver.validateHierarchy`
- `Activity.event_id IS NULL`
- `Workpack.event_id IS NOT NULL`
- That event exists, is not deleted, and belongs to the same organization

`project_id`, activity number, code, tag, description, dates, WBS, and template name are never used to guess an event.

**Discipline**

Preferred order: existing valid Activity discipline → Workpack discipline → template discipline. Candidate must exist, be same-tenant, and not inactive. Free text is not used. Multiple / dangling / cross-tenant candidates are quarantined.

**SAT**

Backfill only from an existing valid SAT FK, or from `activity_library_id.activity_code` through the same lookup as `ControlledValueResolver.resolveStandardActivity` (equipment type + unique active code). `ACT-*` library codes are `LIBRARY_CODE_NOT_SAT`. No mapping from description or activity number.

**Never written:** `asset_id`, dates, progress, status, workpack status, CPM fields.

---

## 8. Event backfill

Dry-run proposed **16** AUTO_SAFE event writes. Apply executed those 16 and no others.

| Workpack | Event | Count |
|---|---|---|
| WP-A-NR | TA-2027 Validation (`TA2027V`) | 4 |
| WP-B-RDY | TA-2027 Validation (`TA2027V`) | 5 |
| WP-C-SCH | TA-2027 Validation (`TA2027V`) | 4 |
| WP-D-BSL | TA-2027 Event B (`TA2027B`) | 3 |
| **Total** | | **16** |

Derivation reason on every row: `DERIVED_FROM_WORKPACK_EVENT`.

Remaining live null `event_id`: **4**, all on workpack `TEST-WP-PH2C-1788013251870` (`cb290c59-…`) whose `event_id` is null. Classified `EVENT_UNRESOLVED`. Not guessed.

---

## 9. Discipline backfill

**0** AUTO_SAFE discipline writes.

Every live Activity had `discipline_id` null. No Workpack in this dataset had a tenant-valid `discipline_id`. No template discipline was uniquely available. Classified `DISCIPLINE_UNRESOLVED`. Not filled from free text.

---

## 10. SAT backfill

**0** AUTO_SAFE SAT writes.

Every live Activity had `standard_activity_type_id` null. **0** rows had `activity_library_id`. Equipment type context is missing on the workpacks that were repaired (`asset_id` null). Classified `SAT_UNRESOLVED`. Library codes were not mapped to SAT because no library link existed.

---

## 11. Ambiguous records

**0** `DISCIPLINE_AMBIGUOUS`  
**0** `SAT_AMBIGUOUS`  
**0** `LIBRARY_CODE_NOT_SAT`

No ambiguous row was updated.

---

## 12. Contradictory records

**0** `EVENT_CONTRADICTION`.

Apply is hard-blocked if any contradiction exists (`detectUnexpected`). None existed. No Activity event was overwritten.

Seven live activities already have an `event_id` while their Workpack `event_id` is null (workpack `TEST-WP-PH2C-…`). That is not a contradiction (both sides are not populated and different). Those seven were left unchanged.

---

## 13. Cross-tenant records

**0** Activity → Workpack cross-tenant  
**0** Activity → Asset cross-tenant  
**0** writes using another tenant’s controlled value

R02-14 proves tenant A cannot take tenant B discipline. Apply also requires `Activity.organization_id == Workpack.organization_id` on the UPDATE.

---

## 14. Loose records

**2** live loose activities (`workpack_id` null):

- `314688b4-0347-4cb6-835a-11087454c8da` — already has `event_id`
- `819f2f6e-a053-4b9c-95fa-007ea358afd1` — already has `event_id`

They were classified `LOOSE_ACTIVITY`. Event was not inferred from `project_id` (that column does not exist on the live table). They were not deleted and not attached to a workpack.

---

## 15. Legacy / baseline records

| Population | Count | Action |
|---|---|---|
| Soft-deleted Activity | 1 (`6411f1ad-…`, loose, already has event) | Excluded |
| P6 / imported (`p6_*`) | 0 | — |
| `BaselineActivity` snapshot rows | 28 | Separate table; not updated |
| Applied Activity IDs also in `BaselineActivity` | 0 | — |
| `ProjectBranchingService` copies | Identified as a deferred writer (copies detach `workpack_id` and become loose). No live row was reclassified into a normal attached Activity. | Unchanged |

Live `"Activity"` has no `schedule_source` column, so imported-source detection used `p6_activity_id` / `p6_object_id` only.

---

## 16. Dry-run results

Command: `npx tsx scripts/r02-identity-backfill.ts dry-run`  
Wrote activities: **false**  
Unexpected relationships: **[]** (apply gate open)

| Gate metric | Count |
|---|---|
| TOTAL CANDIDATES | 16 |
| SAFE EVENT BACKFILLS | 16 |
| SAFE DISCIPLINE BACKFILLS | 0 |
| SAFE SAT BACKFILLS | 0 |
| AMBIGUOUS | 0 |
| UNRESOLVED (any of event/discipline/SAT) | 70 |
| CONTRADICTORY | 0 |
| CROSS-TENANT | 0 |
| LOOSE | 2 |
| LEGACY | 0 |

No unexpected relationships. Dry-run matched the read-only SQL census (16 deterministic events). Proceeded to a **separate** apply step.

---

## 17. Actual update results

Command: `npx tsx scripts/r02-apply-verified-event-backfill.ts --run-id 13040a36-23ac-4d16-9a99-d22254402c00 --confirm`

This apply path writes **`event_id` only**. It refuses unless the manifest is exactly 16 event-only AUTO_SAFE rows.

| Result | Count |
|---|---|
| Applied | 16 |
| Discipline written | 0 |
| SAT written | 0 |
| Applied-row mismatches vs manifest | 0 |
| Failed optimistic locks | 0 |

The general CLI (`r02:apply`) remains available for future runs that also have safe discipline/SAT candidates. It was not used for this apply.

---

## 18. Change manifest

Persisted at `var/r02-identity-backfill/13040a36-23ac-4d16-9a99-d22254402c00/manifest.json`.

Every applied row:

- `fieldsChanged`: `["event_id"]`
- `oldValues.event_id`: `null`
- `newValues.event_id`: Workpack event (`20e0e358-…` or `0ff10402-…`)
- `discipline_id` / `standard_activity_type_id`: null → null
- `derivationSource`: `DERIVED_FROM_WORKPACK_EVENT`
- `applied`: true

Identity checksum of all Activity rows:

| When | Hash |
|---|---|
| Before (preflight) | `138a40e6252c497a29aa1040fcaf3866` |
| After (live) | `7025216ee53a6f74e86ad397be2838d7` |
| After, reconstructing the 16 events as null | `138a40e6252c497a29aa1040fcaf3866` (matches before) |

That proves **only** those 16 `event_id` values changed. 57 other Activity rows are identity-untouched.

---

## 19. Audit trail

Existing `AuditLog` table. No parallel audit architecture.

| Field | Value |
|---|---|
| `auditable_type` | `Activity` |
| `event` | `updated` |
| `context` | `R0.2_IDENTITY_BACKFILL` |
| `old_values` / `new_values` | identity fields + `source`, `runId`, `operator`, `derivation_reason` |
| Rows for the 16 applied IDs | **16** |

Distinguishable from normal user Activity creation (`source_channel` / ActivityCreationCommand).

---

## 20. Post-update invariants

| Invariant | Result |
|---|---|
| 1. Remaining null `event_id` only for documented cases | **PASS** — 4 live nulls, all `EVENT_UNRESOLVED` on a workpack with null event |
| 2. `Activity.event_id != Workpack.event_id` for repaired workpack-backed rows | **PASS** — contradiction count = 0; event-agrees rose 43 → 59 |
| 3. Cross-tenant Activity → Workpack | **PASS** — 0 |
| 4. Cross-tenant Activity → controlled identity | **PASS** — 0 |
| 5. `standard_activity_type_id` values resolve | **PASS** — still 0 SAT FKs; none invented |
| 6. Unrelated Activities unchanged | **PASS** — reconstructed before-hash matches preflight |

Remaining deterministic event candidates after apply: **0**.

---

## 21. M8.13 impact

M8.13 formulas were **not** changed. `ProgressAggregationService` still loads by `organization_id + event_id` and reads `standard_activity_type_id`.

| SAT visibility | Count |
|---|---|
| Previously invisible to identical-activity grouping (no SAT) | 72 live |
| Newly classified SAT | **0** |
| Still unclassified | **72** live |

Event-scoped M8.13 loaders will now see **16** additional activities (13 on TA-2027 Validation, 3 on TA-2027 Event B). Progress was not recalculated. Those 16 remain `not_started` / `progress_percent = 0`.

---

## 22. M11 impact

M11 remains the sole CPM authority. `ScheduleOrchestrationService` loads activities by `organization_id + event_id`.

**16** repaired activities become visible to event-scoped scheduling queries (13 + 3 as above).

CPM was **not** run. Planned/actual dates and float fields were not written.

---

## 23. M12 impact

M12 remains the execution authority. Event-scoped execution reads (`FieldExecutionService`, Excel adapter) filter `event_id` when an event is supplied.

**16** repaired activities become visible in event-scoped execution workspaces. No activity was released, started, or completed. Status and progress were not modified.

---

## 24. Equipment 360 impact

Equipment 360 loads activities by **workpack_id**, then groups by **Workpack.event_id**. The four repaired workpacks have `asset_id = null`, so they do not appear on an Equipment 360 page.

| Surface | Newly connected |
|---|---|
| Equipment 360 activity list (workpack walk) | 0 (already listed if a 360 page existed; none of these WPs have an asset) |
| Equipment 360 M8.13 event progress | 0 on equipment pages (no asset) |

No Equipment 360 code was changed.

---

## 25. Control Tower / report impact

`ControlTowerQueryService` and report providers that filter `Activity.event_id` will newly include these 16 rows in event-scoped queries.

| Consumer | Newly connected |
|---|---|
| Control Tower (event-scoped Activity) | 16 |
| Report engine providers using `Activity.event_id` | 16 |
| Workspace / planner queries scoped by `event_id` | 16 |

No consumer code was changed. No report was regenerated.

---

## 26. Tests

Behavioural suite: `src/core/activity/__tests__/r02-identity-backfill.test.ts`  
**16/16 passed.** These execute the service; they do not assert source text.

| ID | Result |
|---|---|
| R02-01 null event + workpack event → AUTO_SAFE | PASS |
| R02-02 null event + workpack event null → unresolved, no update | PASS |
| R02-03 matching event unchanged | PASS |
| R02-04 conflict → contradiction, no overwrite | PASS |
| R02-05 cross-tenant workpack rejected | PASS |
| R02-06 unique workpack discipline → candidate | PASS |
| R02-07 ambiguous / dangling discipline → no update | PASS |
| R02-08 unique SAT from library + equipment type → AUTO_SAFE | PASS |
| R02-09 `ACT-*` library code not mapped to SAT | PASS |
| R02-10 ambiguous SAT → no update | PASS |
| R02-11 system-level activity does not invent `asset_id` | PASS |
| R02-12 loose activity does not guess event from `project_id` | PASS |
| R02-13 soft-deleted excluded | PASS |
| R02-14 tenant A cannot use tenant B discipline | PASS |
| R02-15 rollback reproduces previous values | PASS |
| R02-16 post-apply invariants | PASS |

---

## 27. Regression

Unchanged engines re-run after implementation:

| Suite | Result |
|---|---|
| R0.1 `r01-activity-identity-creation.test.ts` | PASS |
| R0.1 `r01-progress-sat-loader.test.ts` | PASS |
| M8.13 `tests/progress-calculation.test.ts` | PASS |
| M11 `tests/m11-cross-event-safety.test.ts` | PASS |
| M12 `m12-final-balance.test.ts` | PASS |

**108 tests passed** across those files plus R0.2 (combined vitest run).

No M8.13 formula, M11 CPM, or M12 execution writer was edited.

---

## 28. Rollback verification

1. **Mechanical (R02-15):** apply then rollback restores `oldValues` from the manifest.
2. **Live (syority):** Activity `9482d55f-…` (`WP-A Act 1`)
   - before demo: `20e0e358-…`
   - after rollback: `null`
   - after restore: `20e0e358-…`
3. **Checksum:** zeroing the 16 applied events reproduces the preflight identity hash.

Full-run rollback remains:  
`npx tsx scripts/r02-identity-backfill.ts rollback --run-id 13040a36-23ac-4d16-9a99-d22254402c00 --confirm`

---

## 29. Remaining orphan counts

| Orphan | Remaining | Why |
|---|---|---|
| Live missing `event_id` | 4 | Workpack `TEST-WP-PH2C-…` has no event. Do not guess. |
| Live missing `discipline_id` | 72 | No authoritative workpack/template discipline. |
| Live missing SAT | 72 | No library SAT code and no equipment-type context. |
| Loose activities | 2 | No workpack; both already have an event. |
| Soft-deleted | 1 | Excluded by rule. |
| Cross-tenant | 0 | — |
| Event contradiction | 0 | — |
| Remaining AUTO_SAFE event candidates | 0 | — |

---

## 30. Remaining R0 defects

| Item | Class | Phase |
|---|---|---|
| Scope-change `activity_id` write / mutate without ownership | P0 | **R0.3** (not started) |
| 4 workpack-backed activities with no event (WP event null) | P1 | Review queue — do not guess |
| 72 activities without discipline / SAT | P1 | Needs governed workpack/library/equipment data, not a guess |
| Factory URL `scope_item_id` ignored by `/workpacks/new` | P1 | later R0 UI |
| `ProjectBranchingService` copies still bypass ActivityCreationCommand | P2 | later / exception |
| Seed activity writers still bypass | P3 | seed |
| Live Activity missing `project_id` / `schedule_source` vs Prisma schema | P2 | schema drift |
| `Workpack.event_id` still unindexed | P2 | later |
| `Activity.event` Prisma relation still undeclared | P2 | later |
| M8.13 still groups equipment type from `workpack.equipment_type` string | P2 | later |

---

## 31. Known limitations

- CLI dry-run/apply cannot import `ControlledValueResolver` directly (`server-only` / `@/lib/prisma`). The store uses the **same where-clause predicates** (equipment type + code, tenant-scoped hierarchy). Documented as CVR-equivalent, not a second engine.
- Hierarchy check is slightly looser than CVR when `unit.plant_id` is null (CVR treats that as mismatch). Live repaired rows had no unit/system/asset, so the difference was not exercised.
- `workpack_event_missing` in the service census object stays 0; the SQL census (11) is the authoritative F count.
- Manifests live under `var/r02-identity-backfill/` (gitignored). They are the operational snapshot, not a Postgres snapshot role.
- Baseline copies cannot be distinguished on live Activity beyond loose/`p6_*` markers. The 28 `BaselineActivity` rows were not modified.
- Event-scoped consumers will see 16 more rows. That is intended identity repair, not a silent progress or CPM change.

---

## 32. Final verdict

**R0.2 STATUS: AMBER**

Deterministic event repairs completed safely. Invariants pass. Ambiguous, contradictory, cross-tenant, loose, legacy, and unresolved rows were not modified. Discipline and SAT could not be derived without guessing, so they were left null.

### Definition of Done

- [x] Complete read-only census performed
- [x] Snapshot / rollback mechanism verified
- [x] Deterministic event relationships identified (16)
- [x] Deterministic discipline relationships identified (0)
- [x] Deterministic SAT relationships identified (0)
- [x] Ambiguous records were not modified
- [x] Contradictory records were not modified
- [x] Cross-tenant records were not modified
- [x] `project_id` was not used as `event_id`
- [x] Library activity codes were not blindly mapped to SAT
- [x] No `Activity.asset_id` introduced
- [x] No M8.13 calculation logic changed
- [x] No M11 CPM logic changed
- [x] No M12 execution logic changed
- [x] All changes have a manifest
- [x] Audit trail exists
- [x] Post-backfill invariants pass
- [x] Behavioural tests pass
- [x] Regression tests pass
- [x] Downstream newly-connected counts documented
- [x] Rollback demonstrated (test + live one-row)

---

## Before / after

| | BEFORE | AFTER | Change |
|---|---:|---:|---|
| Activities total | 73 | 73 | none |
| Missing `event_id` (live) | 20 | 4 | −16 deterministic workpack events |
| Valid `event_id` (live) | 52 | 68 | +16 |
| Event agrees with Workpack | 43 | 59 | +16 |
| Event contradiction | 0 | 0 | none |
| Missing discipline | 72 | 72 | none — not guessable |
| Valid discipline | 0 | 0 | none |
| Missing SAT | 72 | 72 | none — not guessable |
| Valid SAT | 0 | 0 | none |
| SAT ambiguous | 0 | 0 | none |
| Library-code-not-SAT | 0 | 0 | none |
| Cross-tenant | 0 | 0 | none |
| Loose activities | 2 | 2 | none |
| Legacy / P6 | 0 | 0 | none |

Material change: sixteen live activities on WP-A-NR, WP-B-RDY, WP-C-SCH, and WP-D-BSL received `event_id` from their workpack. Nothing else on those rows, and no other Activity identity fields, changed.

---

## Files

**Created**

- `src/core/activity/ActivityIdentityBackfillService.ts`
- `src/core/activity/identityBackfillTypes.ts`
- `src/core/activity/identityBackfillPrismaStore.ts`
- `src/core/activity/__tests__/r02-identity-backfill.test.ts`
- `scripts/r02-census-readonly.ts`
- `scripts/r02-identity-backfill.ts`
- `scripts/r02-preflight-probe.ts`
- `scripts/r02-apply-verified-event-backfill.ts`
- `scripts/r02-post-apply-verify.ts`
- `docs/AURIANOA_R0.2_IDENTITY_BACKFILL_RESULT.md`

**Touched (non-authority)**

- `package.json` — `r02:census` / `r02:dry-run` / `r02:apply` / `r02:rollback`
- `.gitignore` — `/var/`
- `docs/AURIANOA_R0_IDENTITY_PROPAGATION_FORENSIC_AND_IMPLEMENTATION_SCOPE.md` — pointer only

**Intentionally untouched**

- `ActivityCreationCommand.ts` (R0.1 authority)
- `ProgressCalculationService.ts` / M8.13 math
- `ExecutionWriteService.ts` / M12
- CPM / calendar / schedule engine
- `ScopeChangeProposalService.ts` / `ScopeChangeApplicationService.ts` (R0.3)
- `ProjectBranchingService.ts`

---

## Question

**Have existing Activities been safely connected to their authoritative Workpack / Event / Discipline / Standard Activity relationships wherever those relationships can be determined without guessing?**

### PARTIALLY

| Relationship | Deterministic repairs | Still unresolved | Guessed? |
|---|---:|---:|---|
| Event (from Workpack) | **16** of 20 live nulls | **4** (workpack has no event) | No |
| Discipline | **0** of 72 live nulls | **72** | No |
| Standard Activity Type | **0** of 72 live nulls | **72** | No |

The 16 event repairs are the only population that was unique and valid. The rest is quarantined. Integrity is intact: 0 contradictions, 0 cross-tenant writes, 0 invented SAT/discipline/asset, rollback proven.

**Do not start R0.3 from this run.**
