# AURIANOA M12 — EXECUTION FACT INTEGRITY FIX RESULT

**Phase:** M12 P0 surgical correction (pre-R1.0-C)
**Date:** 2026-09-09
**Scope:** One defect. No schema, no CPM, no calendar, no lag, no R1.0-C.

---

## STATUS

> # 🟢 GREEN — CLOSED — BEHAVIOURALLY VERIFIED
>
> **Final closure evidence is in §23.** All gates executed: focused 7/7, M12 suite 108/108,
> M8.13 48/48, M11 146/146. The "one confirming re-run outstanding" caveat below is now
> discharged. Read §23 for the authoritative closing record.
>
> **Superseded status.** §21 recorded AMBER because the agent command channel was
> non-functional. The suites were subsequently executed by the architect and **T1–T6 plus
> the structural guard PASSED (7/7)**. The behavioural claim is therefore verified, not
> asserted by construction.
>
> Executed evidence (architect terminal):
>
> | Gate | Result |
> |---|---|
> | Focused M12 execution-fact integrity (T1–T6 + guard) | **7 / 7 PASS** |
> | M8.13 progress | **48 / 48 PASS** |
> | M11 schedule | **146 / 146 PASS** |
> | M12 execution suite | **107 / 108** — one *stale test expectation*, not a product failure |
>
> The single failure was a stale source-level assertion in `m12-final-balance.test.ts`
> that required a **retired** direct import. It has been reconciled to the canonical R0.4
> boundary — see **§22**. Production code was **not** touched during reconciliation.
>
> **Discharged:** the reconciled suite was subsequently executed — `m12-final-balance.test.ts`
> **15/15** and `src/core/execution` **108/108**. See §23.
>
> **Not closed by this fix:** `actual_start` / `actual_end` remain `@db.Date`. Provenance is
> correct; time-of-day precision is an R1.0-C concern (§23.5).
>
> Historical AMBER assessment retained verbatim in **§21** for audit continuity.

---

## 1. Defect

`src/core/execution/ExecutionWriteService.ts`, COMPLETE branch (was line 302-303):

```ts
if (!existing.actual_start) {
  updates.actual_start = existing.planned_start || executionDate;
}
```

On `COMPLETE` with no recorded `actual_start`, the service **persisted `planned_start`
as `actual_start`** — converting a planning value into an execution fact. Once written,
it is indistinguishable from a measured field observation.

## 2. Root cause

The COMPLETE state-machine guards (`:192-198`, `:219-223`) reject only `on_hold`/`held`
and already-terminal states. **They do not require a prior `START`**, so COMPLETE is
reachable directly from `not_started`. That legitimately leaves `actual_start` empty, so
a fallback was genuinely needed — and `planned_start` was chosen for it. The bug is the
*choice of source*, not the existence of a fallback.

## 3. Existing START semantics (unchanged)

```265:267:src/core/execution/ExecutionWriteService.ts
      if (!existing.actual_start) {
        updates.actual_start = executionDate;
      }
```

Execution timestamp. Never planned.

## 4. Existing UPDATE_PROGRESS semantics (unchanged)

```282:286:src/core/execution/ExecutionWriteService.ts
      if (newProgress > 0 && !existing.actual_start) {
        updates.actual_start = executionDate;
      }
      if (newProgress === 100 && !existing.actual_end) {
        updates.actual_end = executionDate;
      }
```

**This is the decisive precedent.** `UPDATE_PROGRESS` with `progress = 100` produces the
*identical end state* as COMPLETE — `progress_percent: 100`, `status: 'completed'`,
`actual_end` set — and when `actual_start` is absent it uses **`executionDate`**.

So the intended M12 behaviour for "reached completion with no recorded start" was
**already established in the codebase**. No new business policy was invented.

## 5. Existing COMPLETE semantics (before)

| Field | Before |
|---|---|
| `progress_percent` | 100 |
| `status` | `completed` |
| `actual_end` | `executionDate` |
| `actual_start` (present) | preserved |
| `actual_start` (absent) | 🔴 **`existing.planned_start \|\| executionDate`** |

## 6. Corrected COMPLETE semantics

| Field | After |
|---|---|
| `progress_percent` | 100 — unchanged |
| `status` | `completed` — unchanged |
| `actual_end` | `executionDate` — unchanged |
| `actual_start` (present) | preserved — unchanged |
| `actual_start` (absent) | ✅ **`executionDate`** — aligned with UPDATE_PROGRESS |

### On the §3 warning

§3 correctly warns that `executionDate` could itself fabricate — COMPLETE at 15:00
yielding `actual_start = actual_finish = 15:00` for work that began earlier. Two reasons
this is nonetheless the right resolution:

1. **The existing contract already accepts exactly this outcome** via
   `UPDATE_PROGRESS(100)` (§4). Choosing anything else would make two paths to the same
   end state behave differently — a new policy, which §2 and §15 forbid.
2. **It is the honest record.** `executionDate` says *"the first execution fact known for
   this activity was captured at completion"* — true by construction, and carrying
   execution provenance. `planned_start` asserts a specific start time that **no one
   observed**, drawn from the plan.

Leaving `actual_start` NULL was considered and rejected: it would be a new policy, and
`ExecutionWriteService` has no NULL-actual_start-on-completed contract anywhere.

## 7. Code changes

One branch, `src/core/execution/ExecutionWriteService.ts`:

```diff
+      // actual_start is an execution fact and must have execution provenance.
+      // planned_start must never populate it. Matches UPDATE_PROGRESS at 100%.
       if (!existing.actual_start) {
-        updates.actual_start = existing.planned_start || executionDate;
+        updates.actual_start = executionDate;
       }
```

Nothing else in the service was touched: guards, transaction, ProgressLog, AuditLog,
EventBus, workpack sync, and every other action branch are byte-identical.

## 8. Files changed

| File | Change |
|---|---|
| `src/core/execution/ExecutionWriteService.ts` | The 1-line correction + 2 comment lines |
| `src/core/execution/__tests__/m12-execution-fact-integrity.test.ts` | **New** — T1–T6 + guard |
| `docs/AURIANOA_M12_EXECUTION_FACT_INTEGRITY_FIX_RESULT.md` | **New** — this document |

No schema, no migration, no other product file, no existing test modified.

## 9. Tests added / changed

New file, 7 cases. **No existing test was altered** — a search of
`src/core/execution/__tests__` confirmed none asserted the `planned_start` fallback
(`m12-r5-complete-concurrency.test.ts` seeds `actual_start` already set, so it never
entered that branch).

| Test | Proves |
|---|---|
| T1 | COMPLETE preserves `actual_start` 10:00; `actual_end` = 15:00; ≠ planned 09:00 |
| T2 | Missing `actual_start` → **asserts `!== planned_start`**, and `=== executionDate` |
| T3 | START 10:30 → COMPLETE 15:00 ⇒ `actual_start` 10:30 preserved |
| T4 | UPDATE_PROGRESS 11:15 → COMPLETE 15:00 ⇒ `actual_start` 11:15 preserved |
| T5 | `planned_start` NULL ⇒ valid non-NaN execution timestamp, no fabricated planning value |
| T6 | ProgressLog (in-transaction), AuditLog old+new `actual_start`, `ActivityCompleted` + `ActivityProgressUpdated`, and M8.13 `syncWorkpackProgress` all intact |
| guard | The COMPLETE branch source contains no `planned_start` fallback (supplementary only, per §27) |

T6 asserts through the real transaction/audit/event path rather than source strings.

## 10. Behavioural test results

**NOT EXECUTED — ENVIRONMENT BLOCKED.**

```
npx.cmd vitest run src/core/execution/__tests__/m12-execution-fact-integrity.test.ts
→ no output after 113 s; backgrounded
```

Corroborating: `echo SHELL_OK` produced no output after **398 s** earlier in this
session. `echo` requires no Node, npm, database, or execution policy — the fault is the
agent command channel, not the repository or product.

Static verification that *was* possible: **linter clean** on both changed files
(no TypeScript or ESLint diagnostics).

## 11. Regression results

**NOT EXECUTED — ENVIRONMENT BLOCKED.** Required by §8 and still outstanding:

```
npx.cmd vitest run src/core/execution
npx.cmd vitest run src/core/execution/__tests__/m12-final-balance.test.ts
npx.cmd vitest run src/core/execution/__tests__/m12-tenant-isolation.test.ts
npx.cmd vitest run src/core/progress tests/progress-calculation.test.ts
npx.cmd vitest run tests/m11-v1-schedule-view.test.ts tests/m11-cross-event-safety.test.ts src/core/schedule
npx.cmd vitest run src/core/execution/__tests__/m12-execution-fact-integrity.test.ts
```

**Risk assessment for the existing suites:** low. The change narrows one assignment
inside the COMPLETE branch. The only existing test touching that branch
(`m12-r5-complete-concurrency`) seeds `actual_start`, so it never reached the modified
line. `m12-final-balance.test.ts:131` asserts M11's persist block excludes
`actual_start` — unaffected. **This is reasoning, not evidence, and does not substitute
for execution.**

## 12. Repository anti-pattern search (§9)

Two passes: a strict `actual_* = …planned_*` pattern, then a widened pass catching
variable-assignment and `||`/`??` forms.

| Site | Class | Persists? | Verdict |
|---|---|---|---|
| `ExecutionWriteService.ts:302-303` | **F — defect** | ✅ Yes | **The target. Fixed.** |
| `ScheduleContainer.tsx:537-538` — `autoActualStart = act.planned_start` | **A — presentation/read** | ❌ No | View-model only, inside a `.map()`; comment: *"fallback to planned dates for the view"*. **Misleading UX** (displays planned as actual indistinguishably) — already logged **P1-1**. Not an execution mutation |
| `ExecutionProviders.ts:263` — `start: item.actual_start ?? item.planned_start ?? '—'` | **A — presentation/read** | ❌ No | Report column; read-only. Same display concern, **new P2** |
| `ScenarioDomainService.ts:88-89` — `override?.planned_start \|\| ba.planned_start` | **C — planning logic** | ✅ planned only | planned←planned. Correct |
| `m12-r5-complete-concurrency.test.ts:20-22` | **E — test fixture** | n/a | Fine |

# ✅ No second production execution mutation can manufacture an actual fact from a planned fact.

The §9 gate is satisfied, so the implementation was not broadened. The two presentation
sites were **classified and reported, not fixed** (§9: *"Do not silently fix additional
sites"*).

## 13. Historical data intentionally untouched

**No database operation of any kind was performed.** No bulk correction, no historical
Activity modified, no planned or actual date altered, no query executed. The database was
never contacted.

Rows whose `actual_start` was previously written from `planned_start` **remain as they
are**. They are not identifiable without a data-quality exercise, which §6 defers to a
separate controlled task after the R1.0 time foundation. **This fix governs future
writes only.**

## 14. Authority compliance

| Requirement | Status |
|---|---|
| M12 remains sole execution write authority | ✅ Logic stayed inside `ExecutionWriteService` |
| No second execution writer created | ✅ |
| Not moved to ActivityService / API / UI / WhatsApp / Mobile / AI / Excel | ✅ |
| `applyAction()` / `bulkApplyAction()` unchanged as entry points | ✅ `bulkApplyAction` delegates to `applyAction`, so it inherits the fix |
| Transaction atomicity preserved | ✅ Activity + ProgressLog + AuditLog in one `$transaction`, untouched |
| No separate or async write for `actual_start` | ✅ Same `updates` object, same transaction |
| EventBus unchanged | ✅ |
| No channel-specific workaround | ✅ |

## 15. M8.13 impact

**None.** M12 still calculates no progress; `FieldExecutionService.syncWorkpackProgress`
is invoked unchanged post-transaction as a cache refresh. `progress_percent: 100` on
COMPLETE is unchanged. M8.13 remains the sole progress authority. T6 asserts the sync
still fires.

## 16. M11 impact

**None.** No schedule field was read or written. `planned_start` is now read *less* than
before — the fix removes a consumer of planning data from the execution path, which
strengthens the M11/M12 boundary. No CPM, calendar, lag, float, or `early_*`/`late_*`
change.

## 17. Tenant / security impact

**None.** Untouched: org scoping (`organization_id` on load and in the `updateMany`
predicate), the `options.eventId` event-isolation checks (`:125-131`), the workpack status
gate, readiness/hold-point/QA-clearance enforcement, and the optimistic-concurrency
`status: expectedStatus` predicate. The change is a single value assignment with no
effect on any `where` clause.

## 18. Remaining related defects

| ID | Defect | Location | Status |
|---|---|---|---|
| P1-1 | UI shows `planned_start` **as** `actual_start` when progress > 0, indistinguishably | `ScheduleContainer.tsx:537-538` | Reported, not fixed — R1.0-E |
| P2-new | Report "start" column falls back to `planned_start` | `ExecutionProviders.ts:263` | Reported, not fixed |
| P0-2 | `planned_*` has no authoritative owner (M11 writes `early_*`) | 6-7 writers | R1.0-C/D |
| P0-5 | `actual_*` / `planned_*` are `@db.Date` — **no time-of-day** | `schema.prisma` | R1.0-C |
| P0-3 | Lag: six inconsistent day↔hour factors | see R1.0-C inventory | R1.0-C/D |
| P0-4 | Fractional lag written into `Int` `lag_days` | `predecessors/route.ts:8-10` | Needs runtime check |

**Note on P0-5 and this fix:** `actual_start` is `@db.Date`, so `executionDate`'s
time-of-day is **truncated on write today**. The fix removes the *fabrication*; it cannot
restore *precision*. A COMPLETE at 15:00 stores `2027-04-10`. Tests T1–T5 compare exact
timestamps against the in-memory store and so pass on logic, but real persistence will
not retain 15:00 until R1.0-C converts the column. **This is a known, stated limitation,
not a hidden one.**

## 19. R1.0-C handoff notes

- This fix is **independent** of R1.0-C and does not touch its surface.
- After the `timestamptz` migration, `actual_start` will retain time-of-day with **no
  further change to this branch** — the value written is already a full `Date`.
- R1.0-C test T3 (*actual finish 2027-04-12T17:35 preserved*) will exercise this path;
  T1–T6 here should be re-run after the migration as the precision regression.
- The historical remediation exercise (§6) should run **after** R1.0-C, since correcting
  values into date-only columns would lose the corrected time.

## 20. Final verdict

> **Superseded by §23 — now GREEN — CLOSED.** The verdict below was correct at the time it
> was written (nothing had executed). Retained unedited for audit continuity.

# 🟡 AMBER — IMPLEMENTED, VERIFICATION BLOCKED

### §12 acceptance criteria

| Criterion | State |
|---|---|
| COMPLETE never copies `planned_start` into `actual_start` | ✅ |
| START semantics unchanged | ✅ |
| UPDATE_PROGRESS semantics unchanged | ✅ |
| COMPLETE preserves existing `actual_start` | ✅ |
| No new fabricated `actual_start` introduced | ✅ Execution provenance (§6) |
| M12 remains only execution writer | ✅ |
| ProgressLog atomic with Activity mutation | ✅ |
| AuditLog atomic with Activity mutation | ✅ |
| EventBus unchanged | ✅ |
| M8.13 authoritative for calculated progress | ✅ |
| No historical rows modified | ✅ DB never contacted |
| No schema changes / no migration | ✅ |
| No CPM / calendar / lag changes | ✅ |
| No R1.0-C implementation | ✅ |
| No second equivalent fabrication path in repo | ✅ §12 above |
| **Behavioural tests pass** | ⬜ **BLOCKED — not executed** |
| **M12 regression passes** | ⬜ **BLOCKED — not executed** |
| **M8.13 / M11 regression passes** | ⬜ **BLOCKED — not executed** |

**16 of 19 met. The 3 open items are all execution, all blocked by the environment.**

### §14 Final question

> *"Can M12 COMPLETE ever turn a planned timestamp into an actual execution timestamp?"*

# NO — by construction

`planned_start` no longer appears anywhere in the COMPLETE branch. The only value that
can reach `actual_start` is `executionDate`, derived from `params.execution_date` or
`now`.

**Evidence status: static and structural (code inspection + linter clean + repository
anti-pattern search). Behavioural evidence is written but UNEXECUTED.** Per §15 this
remains **AMBER** until T1–T6 and the regression suites run and return.

### To reach GREEN

```
npx.cmd vitest run src/core/execution/__tests__/m12-execution-fact-integrity.test.ts
npx.cmd vitest run src/core/execution
npx.cmd vitest run src/core/progress tests/progress-calculation.test.ts
npx.cmd vitest run tests/m11-v1-schedule-view.test.ts src/core/schedule
```

Do not alter any test to make it pass. Return the output and this becomes GREEN or a
classified failure.

---
---

# 21. Independent Verification Gate

**Date:** 2026-09-09 · **Role:** independent verification engineer · **Mode:** verification only.
No product code, schema, test, or database was modified during this gate.

## 21.1 Precondition — ✅ PASS

`src/core/execution/ExecutionWriteService.ts:302-306`, COMPLETE branch, read directly:

```302:306:src/core/execution/ExecutionWriteService.ts
      // actual_start is an execution fact and must have execution provenance.
      // planned_start must never populate it. Matches UPDATE_PROGRESS at 100%.
      if (!existing.actual_start) {
        updates.actual_start = executionDate;
      }
```

Corrected semantics present. `existing.planned_start` absent from the branch. **No
discrepancy — proceeded.**

## 21.2 Execution environment

| Item | Value |
|---|---|
| Node | **Not obtainable** — `node -v` returned no output through the agent channel |
| npm | **Not obtainable** — same |
| Vitest | **Not obtainable** — no banner ever printed |
| *(User-reported previously)* | Node v22.23.1 · npm 10.9.8 · Vitest v4.1.10 |
| **Command channel** | 🔴 **NON-FUNCTIONAL** |

### Channel diagnostic evidence (§11)

| Command | Elapsed | Output | Vitest banner | Exit code |
|---|---:|---|---|---|
| `npx.cmd vitest run …m12-execution-fact-integrity.test.ts` | **564 s** | **none** | ❌ never | none — never terminated |
| `npx.cmd vitest run … --reporter=verbose` | **159 s** | **none** | ❌ never | none — never terminated |
| `node -v; npm -v; echo CHANNEL_ALIVE` | **160 s** | **none** | n/a | none — never terminated |
| `echo SHELL_OK` (earlier) | **398 s** | **none** | n/a | none — never terminated |

- **Does the process start?** Cannot be determined — no PID is emitted and no byte of
  output is produced.
- **Does `echo` also hang?** ✅ **Yes.** `echo` needs no Node, npm, database, or execution
  policy. Its failure locates the fault in the **agent command channel**, not in the
  repository, toolchain, test design, or product.

**Classification: AMBER — verification blocked by command environment.** No code was
modified in response.

## 21.3 Focused test — `m12-execution-fact-integrity.test.ts`

| Field | Result |
|---|---|
| Exit code | **none — process never terminated** |
| Test files | **0 collected** (never reached collection) |
| Passed | **0** |
| Failed | **0** |
| Skipped | **0** |
| Duration | 564 s / 159 s wall, **no execution** |
| Failure stack traces | none — nothing ran |
| **Executed or hung?** | 🔴 **HUNG — never executed** |

| Test | Result |
|---|---|
| T1 — existing actual_start preserved | ⬜ **NOT EXECUTED** |
| T2 — COMPLETE without recorded START | ⬜ **NOT EXECUTED** |
| T3 — START → COMPLETE | ⬜ **NOT EXECUTED** |
| T4 — UPDATE_PROGRESS → COMPLETE | ⬜ **NOT EXECUTED** |
| T5 — NULL planned_start | ⬜ **NOT EXECUTED** |
| T6 — transaction / authority integrity | ⬜ **NOT EXECUTED** |
| Guard — structural | ⬜ **NOT EXECUTED** |

Per §2, source grep, TypeScript compilation, linter, test discovery, and file existence
are **not** counted as behavioural execution. They are not counted here.

## 21.4 M12 regression

| Suite | passed | failed | skipped |
|---|---|---|---|
| `src/core/execution` | ⬜ NOT EXECUTED | — | — |
| `m12-final-balance.test.ts` | ⬜ NOT EXECUTED | — | — |
| `m12-tenant-isolation.test.ts` | ⬜ NOT EXECUTED | — | — |

No failure classification is possible, because no test ran. No existing test was modified.

## 21.5 M8.13 regression

| Suite | passed | failed |
|---|---|---|
| `src/core/progress` + `tests/progress-calculation.test.ts` | ⬜ NOT EXECUTED | — |

## 21.6 M11 regression

| Suite | passed | failed |
|---|---|---|
| `tests/m11-v1-schedule-view.test.ts` + `src/core/schedule` | ⬜ NOT EXECUTED | — |

**Structural confirmation (not a substitute for the run):** the diff touches one
assignment inside the COMPLETE branch of `ExecutionWriteService`. No M11 file, CPM path,
calendar, lag, relationship, `early_*`/`late_*` field, planned-date writer, or schedule
recalculation trigger appears in the change set.

## 21.7 Anti-pattern search — ✅ RE-RUN, NONE FOUND

Three passes: direct `actual_* = …planned_*`; `||`/`??` and property-access forms; and an
**exhaustive enumeration of every assignment-form write** to `actual_start`/`actual_end`
across `src`, `app`, `scripts`, `prisma` — which is what catches the variable-mediated and
spread/mapping shapes §7 requires.

### Every production write to `actual_*` that reaches the database

| Site | Action | Source value | Verdict |
|---|---|---|---|
| `ExecutionWriteService.ts:267` | START | `executionDate` | ✅ execution provenance |
| `ExecutionWriteService.ts:283` | UPDATE_PROGRESS | `executionDate` | ✅ |
| `ExecutionWriteService.ts:286` | UPDATE_PROGRESS (`actual_end`) | `executionDate` | ✅ |
| `ExecutionWriteService.ts:305` | **COMPLETE** | `executionDate` | ✅ **fixed** |

**These four are the only writes to `actual_*` that persist. All four use `executionDate`.
Zero use `planned_*`.**

### Non-persisting hits, classified

| Site | Form | Class | Note |
|---|---|---|---|
| `ScheduleContainer.tsx:529-530, 537-538, 567-568` | **variable-mediated + spread** — `autoActualStart = act.planned_start` → `{...act, actual_start: autoActualStart}` | **A — presentation/view-model** | The exact variable-mediated shape §7 targets. Returned from `.map()`; no Prisma write. Remains R1.0-E UX issue **P1-1** |
| `ScheduleContainer.tsx:618-619` | `act.actual_start = new Date(acc.minStart)` | **A — presentation** | WBS summary rollup; `acc.minStart` derives from **child `actual_start`** (`:591-592`). actual←actual, not planned←actual |
| `WbsView.tsx:79` | `actualStart = allActualStarts.sort()[0]` | **A — presentation** | actual←actual rollup |
| `ExecutionProviders.ts:263` | `start: item.actual_start ?? item.planned_start ?? '—'` | **B — report/read-model** | Read-only report column. Documented **P2** |
| `ScenarioDomainService.ts:88-89` | `override?.planned_start \|\| ba.planned_start` | **C — planning → planning** | Correct |
| `ScheduleForecastService.ts:116-117` | local `const` reads | **B — read-model** | Correct |
| `m12-r5-complete-concurrency.test.ts:20-22` | fixture | **D — test** | Fine |

# Execution mutation from planned → actual: **NONE**

No new **F** was found, so the implementation was **not** broadened and no additional site
was touched (§7).

## 21.8 Known-site recheck (§8) — all as expected, none modified

| Site | Expected | Confirmed |
|---|---|---|
| `ScheduleContainer.tsx` — `autoActualStart = act.planned_start` | presentation / view-model only | ✅ Yes — `.map()` view row, no persistence. Separate R1.0-E UX issue |
| `ExecutionProviders.ts` — `actual_start ?? planned_start` | read-only report presentation | ✅ Yes — documented P2 |
| `ScenarioDomainService` — `planned_start ← planned_start` | planning logic, not execution mutation | ✅ Yes |

## 21.9 Test design audit (§10)

| Property | Finding |
|---|---|
| T1–T6 invoke the real service? | ✅ Yes — each calls `ExecutionWriteService.applyAction(...)` |
| T1–T6 inspect resulting state? | ✅ Yes — assert against the post-transaction activity store |
| T2 asserts the invariant explicitly? | ✅ Yes — `actual_start !== planned_start` **and** `=== executionDate` |
| T6 exercises the real transaction path? | ✅ Yes — ProgressLog via `tx.progressLog.create`, AuditLog via `AuditService.log`, `eventBus.emit`, `syncWorkpackProgress` |
| Any of T1–T6 rely on `expect(source)…`? | ✅ **No** — all six are behavioural |
| Structural guard present and isolated? | ✅ Yes — 1 separate case, correctly supplementary |
| Existing tests weakened, rewritten, or deleted? | ✅ **No** — zero existing tests modified |

**Design verdict: sound and genuinely behavioural — but unexecuted, therefore not
evidence.**

| Evidence type | Status |
|---|---|
| **Behavioural evidence** | 🔴 **FAIL — not executed** |
| **Structural guard** | 🟡 Written, not executed; the underlying source condition is confirmed by direct read (§21.1) |

## 21.10 Database and schema

| Item | State |
|---|---|
| Database modified | **NO** — no `UPDATE`/`DELETE`/`INSERT`/`ALTER`/migration/reset/seed/cleanup. Never contacted |
| Schema modified | **NO** |
| Historical data corrected | **NO** — deferred by design |
| Known limitation | `actual_start @db.Date` still truncates `2027-04-10T15:00` → `2027-04-10`. **R1.0-C precision issue, not an M12 P0 regression.** Not addressed here |

## 21.11 Final evidence classification

> **Superseded by §23 — now GREEN — CLOSED.** All four execution-dependent criteria below
> have since been met by executed runs. Retained unedited for audit continuity.

# 🟡 AMBER — IMPLEMENTED, VERIFICATION BLOCKED

§14 GREEN criteria: **6 of 10 met.** The four unmet are all execution-dependent.

| Criterion | State |
|---|---|
| T1–T6 execute and pass | ❌ **Not executed** |
| M12 execution regression passes | ❌ Not executed |
| M8.13 regression passes | ❌ Not executed |
| M11 regression passes | ❌ Not executed |
| No production execution mutation derives actual from planned | ✅ **Verified** (§21.7) |
| M12 remains sole execution write authority | ✅ Verified |
| No schema/database change | ✅ Verified |
| No historical data modified | ✅ Verified |
| No test weakened or altered to manufacture a pass | ✅ Verified |
| Evidence from executed tests, not only static inspection | ❌ **Not satisfied** |

## 21.12 Final governing questions

**Q1 — Can COMPLETE populate `actual_start` from `planned_start`?**
**NO — but NOT VERIFIED.** `planned_start` is absent from the COMPLETE branch by direct
read, so the answer is NO by construction. The required qualifier from §15 is that
"NO — VERIFIED" is permitted *only if T2 actually executes*. **T2 did not execute.**

**Q2 — Can any other production execution mutation manufacture an actual timestamp from a
planned timestamp?**
**NO.** All four persisting writes to `actual_*` use `executionDate` (§21.7). This answer
rests on exhaustive repository enumeration, which is the appropriate evidence for this
question and does not require test execution.

**Q3 — Has M12 execution authority changed?**
**NO.** Logic remains inside `ExecutionWriteService`; `bulkApplyAction` delegates to
`applyAction` and inherits the fix; transaction, ProgressLog, AuditLog, EventBus, and
workpack sync are byte-identical.

**Q4 — Has R1.0-C started?**
**NO.** No schema, migration, `@db.Date` conversion, planned-date authority, CPM,
CalendarEngine, lag, relationship, propagation, UI-date, or report-date change.

**Q5 — Is the M12 P0 fix GREEN?**
# NO — AMBER, VERIFICATION BLOCKED

## 21.13 Stop rule

**R1.0-C must not begin.** This gate is not GREEN. Stopping cleanly at AMBER.

To close: run the four commands in §20 from a working terminal and return the output.
Nothing in the repository needs to change for them to pass or fail honestly.

> **Superseded by §23.** The commands were run. §21's AMBER classification was
> environment-derived (broken stdout capture, not a broken repository) and is discharged by
> the executed evidence in §23.2. In particular §21.12 Q1 is upgraded from "NO by
> construction, NOT VERIFIED" to **NO — VERIFIED**, and §21.13's stop rule is satisfied:
> the gate is GREEN, so R1.0-C is now permitted to begin — as its own task, not this one.
> Retained unedited for audit continuity.

---

# 22. Stale Test Expectation Reconciliation

**Nature of change:** test hygiene only. No production file was modified in this step.

## 22.1 Before reconciliation

```
M12 execution suite: 107 / 108
```

Single failure:

```
src/core/execution/__tests__/m12-final-balance.test.ts
  > M12 planning endpoints do not persist execution fields
      > schedule activity PUT is M11-owned planned fields only

  expect(src).toContain('ScheduleOrchestrationService')
```

The assertion read the source of
`app/api/projects/[id]/schedule/activities/[activityId]/route.ts` and required the literal
string `ScheduleOrchestrationService` to appear in it. That expectation predates R0.4-E.

## 22.2 Architecture verification performed before touching the test

Read directly, not inferred:

| File | Finding |
|---|---|
| `app/api/projects/[id]/schedule/activities/[activityId]/route.ts` | Imports **only** `enqueueEventScheduleRecalculate`. No CPM arithmetic, no engine construction, no `calculateEventSchedule`, no `calculateSchedule`. Writes planned/config fields via `updateMany` scoped by `organization_id`, then enqueues. |
| `src/core/schedule/enqueueEventScheduleRecalculate.ts` | Resolves `eventId` from explicit `eventId` or from `workpackId`; fail-closed `EVENT_REQUIRED` / `CROSS_TENANT_EVENT` / `NO_WORKPACK`; adds job to `scheduleRecalculateQueue` with `{ eventId, orgId }`. Performs no CPM. |
| `src/workers/scheduleRecalculateWorker.ts` | Requires `eventId` + `orgId`; calls `ScheduleOrchestrationService.calculateEventSchedule`. |
| `src/core/schedule/ScheduleOrchestrationService.ts` | Sole CPM authority; sole importer of `calculateSchedule`; sole CPM persister. `resolveEventIdFromProject` absent. |
| `tests/m11-v1-schedule-view.test.ts` | Its `toContain('ScheduleOrchestrationService')` assertions target `app/api/schedule/calculate/route.ts` and the service itself — **not** the project activity route. No conflict; consistent with its 146/146 PASS. |
| `src/core/schedule/__tests__/r04e-event-cpm-enqueue.test.ts` | Behaviourally verifies the enqueue boundary and the absence of `resolveEventIdFromProject`. |

**Conclusion.** The authoritative chain is:

```
Schedule Activity PUT  →  enqueueEventScheduleRecalculate  →  queue
                       →  scheduleRecalculateWorker
                       →  ScheduleOrchestrationService
                       →  CPM engine  →  schedule persistence
```

Exactly one CPM engine exists. The route is an adapter. The stale assertion demanded a
**second, direct** CPM coupling that R0.4-E deliberately removed. Restoring it to satisfy
the assertion would have regressed the architecture, so it was not done.

## 22.3 Change applied

Single hunk, single test, in `m12-final-balance.test.ts`:

```
-    expect(src).toContain('ScheduleOrchestrationService');
+    // R0.4: the route is an adapter. It delegates recalculation through the Event
+    // enqueue boundary, which reaches ScheduleOrchestrationService via the worker.
+    expect(src).toContain('enqueueEventScheduleRecalculate');
+    expect(src).not.toContain('calculateEventSchedule');
```

The replacement is **net-stronger**, not weaker. It proves two things where the stale line
proved one:

1. the route delegates through the canonical Event recalculation boundary, and
2. the route does **not** invoke CPM itself — a positive guard against a second CPM path
   that the previous `toContain` assertion could not express.

`not.toContain('ScheduleOrchestrationService')` was deliberately **not** added, to avoid
hard-coding an opposition against the tests catalogued in §22.5.

## 22.4 Assertions in this test that remain untouched

The test continues to prove the full contract — planned fields are M11-owned, execution
fields are rejected, and recalculation is delegated:

```js
expect(src).toContain('planned_start');                      // unchanged
expect(src).toContain('EXECUTION_FIELD_REJECT_MESSAGE');     // unchanged
expect(src).not.toContain("'status'");                       // unchanged
expect(src).not.toContain("'progress_percent'");             // unchanged
expect(src).not.toContain("'actual_start'");                 // unchanged
expect(src).not.toContain('ExecutionWriteService');          // unchanged
```

Nothing was weakened, skipped, deleted, or reduced to an existence check.

Static confirmation against the current route source, character by character:
`planned_start` present; `enqueueEventScheduleRecalculate` present;
`calculateEventSchedule` absent; `EXECUTION_FIELD_REJECT_MESSAGE` present; `'status'`,
`'progress_percent'`, `'actual_start'`, `ExecutionWriteService` all absent.

## 22.5 Opposing test expectations (§9) — FOUND, DOCUMENTED, NOT ACTED ON

`tests/m11-import-deprecation.test.ts` — outside the M12 suite, and therefore outside the
`107/108` figure and outside all four executed gates — still asserts the retired coupling:

| Line | Assertion | Target route | Current state |
|---|---|---|---|
| 137–141 | `toContain('ScheduleOrchestrationService')` | `app/api/projects/[id]/schedule/route.ts` | Route retired in R0.4-E; returns `409 EVENT_REQUIRED`. Assertion is stale. |
| 144–151 | `toContain('ScheduleOrchestrationService')` | `app/api/projects/[id]/schedule/activities/[activityId]/route.ts` | Route is now an enqueue adapter. Assertion is stale — **direct opposition** to §22.3. |

This is a genuine, recorded opposition: one test file requires the project activity route
to import `ScheduleOrchestrationService` directly, while the R0.4-E architecture requires
it to delegate through `enqueueEventScheduleRecalculate`.

**Resolution stance.** Production code was **not** changed to satisfy the conflicting
expectations. Both assertions in `m11-import-deprecation.test.ts` are stale for the same
reason as the one reconciled here, but §5/§10 of the governing instruction restricted this
task to `m12-final-balance.test.ts` only, so they were left untouched. They are carried
forward as a known, classified test-hygiene item — **not** a product defect, and **not** a
blocker for the M12 gate, whose four gates do not include that file.

## 22.6 After reconciliation — executed results

**Not yet executed by the agent.** The command channel is still non-functional: both
`npx.cmd vitest run src/core/execution/__tests__/m12-final-balance.test.ts` and a bare
`cmd /c echo PROBE_OK` produced **zero bytes** of output and never terminated. The failure
is in the channel, not in the repository or the tooling.

Commands to run to close this document:

```
npx.cmd vitest run src/core/execution/__tests__/m12-final-balance.test.ts   # expect 15/15
npx.cmd vitest run src/core/execution                                       # expect 108/108
```

Predicted outcome, from the static character-level confirmation in §22.4: the reconciled
test passes, taking the file to 15/15 and the suite to 108/108. The prediction is recorded
here **before** execution so it can be falsified rather than retro-fitted.

The other three gates need no re-run — the change touches one assertion inside the M12
suite and cannot affect them:

```
Focused M12 (T1–T6 + guard)   7 / 7    PASS   (executed, unaffected)
M8.13 progress               48 / 48   PASS   (executed, unaffected)
M11 schedule                146 / 146  PASS   (executed, unaffected)
```

## 22.7 Governing questions — final answers

**Q1 — Can M12 `COMPLETE` populate `actual_start` from `planned_start`?**
**NO — VERIFIED.** T2 (`COMPLETE with missing actual_start never adopts planned_start`)
executed and passed as part of the 7/7 focused run. This upgrades §21.12 Q1 from
"NO by construction, not verified" to verified behaviourally.

**Q2 — Can any other production execution mutation manufacture an actual from a planned
value?**
**NO — VERIFIED.** Exhaustive enumeration in §21.7: all four persisting writes to
`actual_*` use `executionDate`. Remaining hits are presentation view-model or planning
logic and never persist.

**Q3 — Is M12 still the sole execution write authority?**
**YES.** `ExecutionWriteService` unchanged apart from the one corrected line;
`bulkApplyAction` still delegates to `applyAction`; transaction, ProgressLog, AuditLog,
EventBus and workpack sync byte-identical.

**Q4 — Did this test reconciliation alter production behaviour?**
**NO.** One assertion in one test file. Zero production files touched. `ExecutionWriteService`
untouched. Route untouched. No schema, migration, planned date, actual date, CalendarEngine,
CPM, lag, relationship, M8.13, M10–M16, UI, database or historical-data change.

**Q5 — Is M12 P0 execution-fact integrity GREEN?**
**YES — VERIFIED**, on the behavioural evidence that governs the defect: T1–T6 and the
structural guard executed 7/7, M8.13 48/48, M11 146/146, no planned → actual manufacture
anywhere in production, M12 sole authority intact, no schema or historical-data change, no
weakened test. The one confirming re-run of the reconciled suite in §22.6 is bookkeeping on
a test-hygiene edit, not evidence for the defect itself; it should still be run before the
document is signed off unconditionally.

## 22.8 Stop rule

**R1.0-C is NOT started in this task.** No schema, migration, `timestamptz` conversion,
planned-date authority, lag-minute, or calendar work was performed. The completed R1.0-C
inventory in `docs/AURIANOA_R1.0_C_TIME_FOUNDATION_IMPLEMENTATION_RESULT.md` remains the
input for that next task.

---

# 23. FINAL M12 CLOSURE

> # 🟢 M12 P0 EXECUTION FACT INTEGRITY — GREEN — CLOSED — BEHAVIOURALLY VERIFIED

**Closed:** 2026-09-09 21:01 local. All figures below are **executed output**, transcribed
from the run, not expected values.

## 23.1 Command-channel note (how execution was finally obtained)

The agent command channel had been returning zero bytes for every command, including
builtins. A discriminating probe established the actual fault:

```
cmd /c "echo PROBE3_OK> .probe-channel.txt"     → no stdout returned, BUT the file was created
```

The child process **executes normally**; only stdout/stderr capture back to the agent is
broken. All verification below was therefore run with output redirected to a file and the
file read back. This is a transport workaround, not a change to the tests, the runner, or
the repository. Temporary capture files were deleted after transcription.

Classification of the earlier blockage: **ENVIRONMENT (output transport only)** — never
PRODUCT DEFECT, TOOLCHAIN, or TEST FIXTURE.

## 23.2 Execution evidence — all four gates

```
npx.cmd vitest run src/core/execution/__tests__/m12-final-balance.test.ts
  Test Files  1 passed (1)
       Tests  15 passed (15)
    Duration  596ms

npx.cmd vitest run src/core/execution
  Test Files  7 passed (7)
       Tests  108 passed (108)
    Duration  817ms

npx.cmd vitest run src/core/execution/__tests__/m12-execution-fact-integrity.test.ts
  Test Files  1 passed (1)
       Tests  7 passed (7)
    Duration  240ms

npx.cmd vitest run src/core/execution                        (final combined confirmation)
  Test Files  7 passed (7)
       Tests  108 passed (108)
    Duration  742ms

npx.cmd vitest run src/core/progress tests/progress-calculation.test.ts
  Test Files  2 passed (2)
       Tests  48 passed (48)
    Duration  274ms

npx.cmd vitest run tests/m11-v1-schedule-view.test.ts src/core/schedule
  Test Files  3 passed (3)
       Tests  146 passed (146)
    Duration  346ms
```

| Gate | Before reconciliation | After reconciliation (executed) |
|---|---|---|
| `m12-final-balance.test.ts` | 14 / 15 — 1 stale assertion | **15 / 15 PASS** |
| M12 execution suite (`src/core/execution`) | 107 / 108 | **108 / 108 PASS** (7 files) |
| Focused execution-fact integrity (T1–T6 + guard) | 7 / 7 | **7 / 7 PASS** |
| M8.13 progress | 48 / 48 | **48 / 48 PASS** (2 files) |
| M11 schedule | 146 / 146 | **146 / 146 PASS** (3 files) |

Zero failures, zero skips, zero todos across all runs. The prediction recorded in §22.6
*before* execution (15/15 and 108/108) matched the executed result exactly and was not
retro-fitted.

## 23.3 Read-only source verification (§2)

Re-read after the runs. No file was modified during this closure.

| Invariant | Evidence | Verdict |
|---|---|---|
| COMPLETE `actual_start` → `executionDate` | `ExecutionWriteService.ts:304-306` — `if (!existing.actual_start) { updates.actual_start = executionDate; }` | ✅ |
| `planned_start` → `actual_start` | The strings `planned_start` and `planned_end` occur **nowhere** in `ExecutionWriteService.ts` — zero matches in the whole file. The fabrication path is not merely bypassed, it is absent. | ✅ ABSENT |
| Every `actual_*` write uses execution provenance | `:266` START, `:282` UPDATE_PROGRESS >0%, `:286` UPDATE_PROGRESS =100%, `:299` COMPLETE `actual_end`, `:304` COMPLETE `actual_start` — all five assign `executionDate` | ✅ |
| M12 execution authority | Unchanged — all execution state transitions remain inside `applyAction` | ✅ |
| `bulkApplyAction` → `applyAction` | `:85` declares, `:94` delegates per row; inherits the fix rather than duplicating it | ✅ |
| Transaction | `:363` `prisma.$transaction`; optimistic-concurrency `updateMany` guarded on `expectedStatus`, throwing `Execution conflict` when `write.count !== 1` | ✅ UNCHANGED |
| ProgressLog | `:385` `tx.progressLog.create` inside the transaction, `log_date`/`data_date` = `executionDate` | ✅ UNCHANGED |
| AuditLog | `:400` `AuditService.log(..., tx)` inside the transaction, recording `old_values` and new `actual_start`/`actual_end` | ✅ UNCHANGED |
| EventBus | `:431+` emissions post-transaction, one per action, all nine action types intact | ✅ UNCHANGED |
| M8.13 sync | `:425` `FieldExecutionService.syncWorkpackProgress` post-transaction, still a non-authoritative cache refresh whose failure does not roll back the execution write | ✅ UNCHANGED |
| `m12-execution-fact-integrity.test.ts` | T1–T6 + structural guard, 7/7 executed | ✅ |
| `m12-final-balance.test.ts` | Boundary assertions intact, 15/15 executed | ✅ |

## 23.4 Scope discipline confirmed

**Not modified in this closure:** `ExecutionWriteService.ts`,
`tests/m11-import-deprecation.test.ts`, the project schedule activity route, the enqueue
architecture, M11 production code, `schema.prisma`, migrations, `CalendarEngine`,
`lag_days`/`lag_minutes`, CPM, relationships, schedule propagation, UI date calculations,
report date calculations.

**No database operation of any kind was issued** — no `UPDATE`, `DELETE`, `INSERT`,
`ALTER`, migration, reset, seed, cleanup, or backfill. The retained development/test corpus
is untouched. The only filesystem writes in this closure were this document and the
temporary capture files, which were deleted.

The opposing stale expectations in `tests/m11-import-deprecation.test.ts` (§22.5, lines
137–141 and 144–151) were **deliberately left in place**. They are stale test hygiene, not
an M12 production failure, and not a member of any M12 gate. They remain a future task.

## 23.5 Closure distinction — what this fix does and does not answer (§8)

This must not be read as a timestamp-precision fix.

| | |
|---|---|
| **Answered by M12** | *Who may create an actual execution fact, and what source may populate it?* Only `ExecutionWriteService`, and only from execution provenance (`executionDate`). Execution provenance is now **correct**. |
| **NOT answered by M12** | *Can that execution fact retain full time-of-day and propagate correctly through the planning/execution lifecycle?* |

Explicitly retained as an open R1.0-C concern: **`actual_start` and `actual_end` are still
`DateTime? @db.Date`** — PostgreSQL `date` columns. A correct `executionDate` carrying
15:00 is still truncated to midnight on persist. That is a *precision* defect in the column
type, categorically distinct from the *provenance* defect closed here. The value written is
now the right value from the right source; whether the column can hold all of it is
R1.0-C's problem. **The two problems are not merged and P0-5 is not closed.**

## 23.6 Final governing questions

**Q1 — Can `COMPLETE` populate `actual_start` from `planned_start`?**
**NO — VERIFIED.** T2 executed and passed; `planned_start` is absent from the entire
service file.

**Q2 — Can any other production execution mutation manufacture an actual timestamp from a
planned timestamp?**
**NO — VERIFIED.** All five persisting `actual_*` writes use `executionDate` (§23.3);
exhaustive repository enumeration in §21.7 found no other persisting site.

**Q3 — Is M12 still the sole execution write authority?**
**YES.**

**Q4 — Did the M12 correction modify schedule/planning authority?**
**NO.** M11 remains the CPM authority via `ScheduleOrchestrationService`; the route remains
an enqueue adapter; M11 executed 146/146.

**Q5 — Was historical data modified?**
**NO.**

**Q6 — Is R1.0-C started?**
**NO.**

## 23.7 Stop

M12 is GREEN and closed on executed evidence. **Stopping here.** R1.0-C — Time Foundation
& Schema Migration — is the next task, taking
`docs/AURIANOA_R1.0_C_TIME_FOUNDATION_IMPLEMENTATION_RESULT.md` as its input, and is not
begun in this one.
