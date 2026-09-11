# AURIANOA R0.4 — SYNTHETIC DATA DISPOSITION

**Phase:** R0.4 Final Gate — Database-Only Forensic Verification
**Date:** 2026-09-09
**Mode:** READ-ONLY. No row was read, written, deleted, or assigned.

---

## STATUS

> # 🟡 AMBER — ONE QUERY FROM CLOSURE
>
> **The "177 → 11 discrepancy" does not exist. It was a measurement-unit error, not a
> data event.** `177` counts *Workpacks*; `11` counts *Activities*. The two numbers
> were never comparable, so there is no 166-row disappearance to explain (§12).
>
> **No Event assignment occurred. No deletion or reset is evidenced.** Independent
> continuity evidence indicates the database is the *same* dataset audited at R0.2 and
> R0.4-C/D (§12.3, §14).
>
> **Remaining gap:** the one query that would settle this — `SELECT COUNT(*) FROM
> "Workpack"` — has **never been run** in any phase. Until it returns, the Workpack
> population is formally UNMEASURED (§2).
>
> **Nothing was mutated. No Event was invented or inferred. No Workpack was assigned.**

### ⚠️ Correction to the prior revision of this document

The previous revision escalated `177 → 11` as a **candidate P0 auto-assignment**. That
escalation was **wrong** and is withdrawn. It compared a Workpack count against an
Activity count. §12 supersedes it. The corrected finding is that **no anomaly is
evidenced at all.**

---

## 1. Database / Environment

| Item | Value |
|---|---|
| Target database | Whatever `DATABASE_URL` in `.env` resolves to (development) |
| `current_database()` | **UNMEASURED** — the census prints this (`scripts/r02-census-readonly.ts:22-24`); never captured |
| Connection owner | `prisma/seed-client.ts` (Pool → PrismaPg → PrismaClient) |
| Environment | Local Windows development, `C:\DEV\STO` |
| Reads performed by this review | **None** |
| Writes performed by this review | **None** |

**Phase 1 could not be executed.** The agent shell channel fails on builtins. `echo
PROBE2` and an earlier `echo SHELL_OK` both produced **zero output**, the latter after
**398 seconds**. `echo` needs no Node, npm, database, or execution policy, so the fault
is in the agent command channel — not the repository, toolchain, or product. The user
terminal (`pid 22544`) shows an idle prompt with no census run.

All findings below derive from **static inspection of the repository and the recorded
forensic history of R0.2 / R0.4-C / R0.4-D**, which is legitimate database evidence:
those documents record executed censuses.

---

## 2. Current Workpack census

**UNMEASURED — and never measured in any phase.**

| Metric | Value |
|---|---|
| `workpacks_total` | **NEVER RUN** |
| `workpacks_live` | **NEVER RUN** |
| `event_linked` | **NEVER RUN** |
| `event_less` | **NEVER RUN** |
| `project_linked` | **NEVER RUN** |

**This is the central gap.** Every "Workpack" figure in circulation (195 / 18 / 177)
comes from the R0.4/R0.4-B/R0.4-C/R0.4-D era. The recent census run was
`scripts/r02-census-readonly.ts`, which is **Activity-centric and queries no Workpack
population at all** (§12.1).

---

## 3. Current Activity census

**Source: user-reported run of `scripts/r02-census-readonly.ts`.** Field names below are
the script's actual output keys.

| Script key | Value | Meaning (verified against source) |
|---|---:|---|
| `total` | 73 | All Activity rows |
| `live` | 72 | `deleted_at IS NULL` |
| `soft_deleted` | 1 | |
| `has_event` | 68 | Activity.event_id NOT NULL |
| `missing_event` | **4** | Activity.event_id IS NULL |
| `has_workpack` | 70 | |
| `workpack_event_missing` | **11** | **Activities whose Workpack has no Event** — *not* a Workpack count |
| `event_contradiction` | **0** | |
| `workpack_cross_tenant` | **0** | |
| `missing_discipline` | 72 | |
| `missing_sat` | 72 | |

Internally consistent: `68 + 4 = 72 = live`, and `73 − 1 = 72`.

---

## 4. Project census

**UNMEASURED.** `SELECT COUNT(*) FROM "Project"` was not run. Last recorded value
(R0.4-C, R0.4-D): **0 Project rows**.

## 5. Project-linked records

**UNMEASURED.** Last recorded: **0** Project-linked Workpacks, **0** Workpacks with
both keys. `Activity.project_id` exists (`schema.prisma:54`, documented *"Legacy project
association … prefer event_id"*) but its live count is unmeasured.

## 6. Event-linked records

Activities: **68** (measured). Workpacks: **UNMEASURED** (last recorded 18).

## 7. Event-less records

Activities: **4** (measured). Workpacks: **UNMEASURED** (last recorded 177).

## 8. Event contradictions

**0 — measured.** Also **0** cross-tenant Workpack joins. These are the two integrity
invariants R0.4 depends on, and both are clean. This matches the R0.4-D post-state
exactly.

---

## 9. Fixture organisation analysis

**Not enumerable without database access.** However, R0.4-C recorded
**name-independent structural evidence** from an executed census, which is far stronger
than any naming heuristic:

| Evidence (R0.4-C) | Count | Why it indicates synthetic origin |
|---|---:|---|
| Workpacks titled *"Test Submit/Approve/Reject/Issue WP"*, in **"isolated test orgs; no FKs"** | **173** | Titles name a **test workflow**, not maintenance scope. No asset/scope/schedule FKs |
| `d695567a-…` *"Phase 2C"* draft, **0 children** | 1 | Development phase label |
| `cb290c59-…` number **`TEST-WP-PH2C-1788013251870`** | 1 | Literal `TEST-WP` prefix + Unix-ms suffix decoding to **late Aug 2026** — machine-generated, not human-entered |
| *"Overhaul Exchanger A"* ×2 — R0.4-C notes **"Organisation name contains 'Test'"** | 2 | Organisation-level test marker |
| | **= 177** | Classified `0+0+0+2+174+0+1 = 177` |

**174 of 177 (98.3 %) were classified NON_STO test fixtures on evidence recorded at
R0.4-C.** That classification was made from FK topology and workflow-named titles — not
from company names.

**Still required:** organisation-level confirmation via §20.1, because a *Workpack-level*
synthetic classification does not by itself prove the *owning organisation* holds no
real data.

---

## 10. Fixture user / email analysis

**Not enumerable without database access.** The seed definition
(`prisma/demo/tenants.ts`) establishes the discriminator:

| Slug | Seeded name | Site | Email domain |
|---|---|---|---|
| `iocl` | Indian Oil Corporation Limited | Panipat Refinery (PNP) | `iocl.test` |
| `hmel` | HMEL | Bathinda Refinery (BTH) | `hmel.test` |
| `lnteh` | L&T Energy Hydrocarbon | LTEH Project Base — Panipat | `lnteh.test` |
| `technip` | Technip Energies | Technip Energies India — Gurgaon | `technip.test` |
| `ril` | Reliance Industries | Jamnagar Refinery (JAM) | `ril.test` |

### ⚠️ SAFETY FINDING — company NAME must never be the discriminator

Fixtures are seeded under **real company names at real refineries**. This cuts both ways:

1. An operator seeing *"Indian Oil Corporation Limited — Panipat Refinery"* could
   reasonably judge it production data and abort a valid cleanup.
2. **Far worse:** a name-keyed cleanup would delete a **genuine** IOCL tenant if one is
   ever onboarded under the same name.

**The valid discriminator is the email domain.** Every seeded user sits on an RFC 2606
reserved `.test` TLD — permanently non-routable and impossible for a real customer.

**Do-not-delete exception:** `PLATFORM_DEMO_USERS` contains **`info@syority.com`** — a
real, routable domain (the platform's own super admin). The other four platform users
are on `syority.test`. `info@syority.com` **must not** be treated as disposable merely
because it sits alongside fixtures.

Note also that R0.4-C located the 177 on the **`syority`** organisation — the vendor's
own org, which is exactly where the non-disposable `info@syority.com` account lives.
**Organisation-level deletion of `syority` is therefore specifically dangerous.**

---

## 11. Audit / history evidence

**Not read.** Both required evidence tables exist and were confirmed in the schema:

| Model | Table | Purpose | Key fields |
|---|---|---|---|
| `WorkpackIdentityReview` | `workpack_identity_reviews` | R0.4-D human review record | `review_state`, `classification`, `confirmed_event_id`, `previous_event_id`, `reviewer_id`, `approver_id`, `conflict_accepted`, `version` (schema:184-204) |
| `AuditLog` | `AuditLog` | Mutation audit trail | `auditable_type`, `auditable_id`, `event`, `old_values`, `new_values`, `changed_fields`, `user_id`, `user_email` (schema:582-606) |

`AuditLog` is indexed on `[auditable_type, auditable_id]`, so a Workpack-scoped audit
query is cheap.

**This is decisive for §13.** R0.4-D's assignment path is atomic and writes **both** a
`workpack_identity_reviews` row (with `confirmed_event_id` + `reviewer_id`/`approver_id`)
**and** an `AuditLog` entry. Therefore:

- 166 authorised assignments ⇒ **166 review rows** with `confirmed_event_id` set.
- Assignments with the review table **empty** ⇒ assignment bypassed human review ⇒ **P0**.

R0.4-D's post-implementation census recorded **`workpack_identity_reviews` = 0** and
**R0.4-D Event assignments = 0**.

---

## 12. Evidence explaining 177 → 11

### 12.1 🔴 ROOT CAUSE — the two numbers measure different things

`workpack_event_missing` is **not** a Workpack count. Verified in source:

```
scripts/r02-census-readonly.ts:47
  COUNT(*) FILTER (WHERE a.deleted_at IS NULL AND w.id IS NOT NULL AND w.event_id IS NULL)
    ::bigint AS workpack_event_missing
scripts/r02-census-readonly.ts:60-61
  FROM "Activity" a
  LEFT JOIN "Workpack" w ON w.id = a.workpack_id
```

The `FROM` clause is **`"Activity" a`**. Every `COUNT(*)` in that block counts
**Activity rows**. So:

| Figure | Actual unit | Population |
|---|---|---|
| **177** (R0.4-C/D) | **Workpacks** | **All** Workpacks with `event_id IS NULL` |
| **11** (current) | **Activities** | Activities whose parent Workpack has `event_id IS NULL` |

Different **unit** *and* different **population**. A Workpack with 7 Activities
contributes **7** to the `11`; a Workpack with **0** Activities contributes **0** and is
**structurally invisible** to this query. **The comparison is a category error.**

### 12.2 Why the invisible majority is expected

R0.4-C recorded that the 174 NON_STO test Workpacks have **"no FKs"**, and
`d695567a-…` explicitly **"0 children"**. Workpacks with no Activities **cannot appear**
in an Activity-derived count. The census was never capable of seeing ~174 of the 177.

**Arithmetic hypothesis — the `11` is fully accounted for by the 3 named Workpacks that
*do* have Activities:**

| Workpack (R0.4-C) | Activities | Source |
|---|---:|---|
| `cb290c59-4bdd-45a5-a153-8bc8ecd43fd8` — Phase 2C, CONFLICTING | **7** | R0.4-C: *"7 Activities + baselines"* |
| `7bec67b4-e2bf-4cf7-92b1-6f0842b87e69` — Overhaul Exchanger A | 2 (inferred) | INSUFFICIENT, asset E-101-A-5087 |
| `a87e5f8f-4fd4-4ef0-92ea-4527c7fbc9ca` — Overhaul Exchanger A | 2 (inferred) | INSUFFICIENT, asset E-101-A-7528 |
| | **= 11** | Matches `workpack_event_missing` exactly |

The `7` is documented; the `2 + 2` is inferred and must be confirmed by §20.3.

### 12.3 Independent continuity evidence — the database was NOT reset

`docs/AURIANOA_R0.2_IDENTITY_BACKFILL_RESULT.md:179` records, from an executed census:

> *"Remaining live null `event_id`: **4**, all on workpack `TEST-WP-PH2C-1788013251870`
> (`cb290c59-…`) … Classified `EVENT_UNRESOLVED`. Not guessed."*

The current census reports **`missing_event` = 4**.

**An exact match on a specific, non-round figure tied to a named Workpack.** A reset or
reseed would have to reproduce exactly 4 Event-less Activities on the same Workpack by
coincidence. Combined with `event_contradiction = 0` and `workpack_cross_tenant = 0`
(matching the R0.4-D post-state), the evidence indicates **one continuous dataset**, not
a replacement.

### 12.4 Classification

Against the Phase 3 options:

| Option | Verdict |
|---|---|
| **A — still present but Event-less** | ✅ **Most probable.** Consistent with all available evidence |
| B — deleted / soft-deleted | ❌ No supporting evidence; contradicted by §12.3 |
| C — assigned an Event | ❌ No supporting evidence (§13) |
| D — reset / reseed | ❌ Contradicted by §12.3 |
| E — synthetic fixtures in identifiable test orgs | ✅ Corroborated for 177/177 at Workpack level (§9) |
| F — combination | Applies as **A + E** |
| G — unknown | ❌ No longer unknown |

**Conclusion: A + E. There was no 177 → 11 transition. The premise was an artefact of
comparing two incompatible metrics.** Formal confirmation requires §20.2 only.

---

## 13. Whether any Event assignment occurred

**No evidence of any Event assignment. Strong evidence against it.**

| Evidence | Finding |
|---|---|
| §12 — no population change requires explaining | No assignment is implied |
| R0.4-D post-census: `workpack_identity_reviews` = **0** | No review rows ⇒ no authorised assignment |
| R0.4-D post-census: R0.4-D Event assignments = **0** | Explicit |
| `event_contradiction` = **0** (current) | No Activity/Workpack Event divergence — an assignment sweep would risk creating some |
| R0.4-E closure: *"writes no Workpack Event assignments"* | No code path introduced |
| `WorkpackIdentityReviewService.ts:346-351` | Assignment requires explicit human confirmation |

**Not certified**, because `workpack_identity_reviews` was not re-counted (§20.4). If
that table is **non-empty**, every row must be checked for `reviewer_id`/`approver_id`
and a matching `AuditLog` entry. Any assignment lacking review evidence is **P0**.

## 14. Whether any deletion or reset occurred

**No evidence of deletion, soft-deletion, reset, or reseed.**

R0.4-C and R0.4-D both recorded **soft-deleted Workpacks = 0**. §12.3 shows Activity-level
continuity with R0.2. The single soft-deleted Activity (`soft_deleted = 1`) is a normal
lifecycle row, not a bulk operation — a 166-row purge cannot present as 1.

**Not certified**, because Workpack `deleted_at` was not counted (§20.2).

## 15. Whether the current data is synthetic

**Highly likely synthetic — corroborated, not yet certified.**

**For:** 174/177 classified NON_STO from FK topology and workflow-named titles (§9); a
machine-generated `TEST-WP-…-1788013251870` identifier; an organisation whose name
contains "Test"; `.test` email domains across all five seeded tenants; 72/72 Activities
missing both Discipline and Standard Activity Type — a pattern typical of generated
fixtures rather than planned maintenance scope.

**Against certification:** no organisation-level query was executed. Workpack-level
synthetic classification does not prove the owning organisation is fixture-only.

## 16. Whether any real client data is present or cannot be excluded

**Cannot be excluded.** No organisation or user row was read.

Two specific hazards are already identified:

1. **`info@syority.com`** — a real, routable account inside the platform organisation,
   which is the same org R0.4-C located the 177 on. **Must be preserved.**
2. **Real company names on fixture tenants** — makes visual classification unsafe in
   both directions (§10).

Until §20.1 returns, **the possibility of real data cannot be ruled out.**

## 17. Exact confidence level

| Question | Confidence | Basis |
|---|---|---|
| `177 → 11` is a measurement artefact, not a data event | **VERY HIGH (~99 %)** | Verified in census source, line 47 vs 60 |
| No unauthorised Event assignment occurred | **HIGH (~95 %)** | Review table = 0; no code path; 0 contradictions |
| No deletion or reset occurred | **HIGH (~90 %)** | R0.2 continuity match on 4 Event-less Activities |
| The 177 Workpacks are still present and Event-less | **MODERATE-HIGH (~85 %)** | Inferred; `COUNT(*)` never run |
| Workpack-level data is synthetic | **HIGH (~90 %)** | R0.4-C structural classification |
| **No real client data exists anywhere in the DB** | **LOW (~40 %)** | **No organisation query executed** |
| Deletion is currently safe | **NOT ESTABLISHED** | Blocked by the row above |

## 18. Cleanup recommendation

# ⛔ DO NOT DELETE ANYTHING

Beyond the Phase 5 prohibition, deletion is **not yet justifiable on the evidence**:

1. **The motivating anomaly does not exist** (§12). The perceived urgency was an
   artefact.
2. **Real client data cannot be excluded** (§16) — confidence ~40 %.
3. **`info@syority.com` is inside the likely target organisation** (§10).
4. **The 177 are the R0.4-D human-review queue's working population.** Deleting them
   discards the queue's subject matter and the evidence base for R0.4-D closure.

When cleanup is separately authorised it must be organisation-scoped and FK-ordered
inside one transaction, must never use a database-wide `DELETE`, must exclude
`info@syority.com`, must not touch shared master data
(`StandardActivityType`, `Discipline`, role catalog, gasket lookups) unless proven
fixture-only, and must not alter schema to facilitate deletion.

## 19. R0.4 gate decision

# 🟡 AMBER — GATE NOT YET SATISFIED

**Materially improved.** The candidate P0 is **withdrawn**: it was a measurement error,
not a data defect (§12). No product defect is evidenced anywhere in this review.

| Gate condition | Status |
|---|---|
| R0.4 architecture GREEN | ✅ Pass (Phase N.2: 1482/1485; 3 failures classified stale) |
| No genuine P0 / P1 | ✅ Pass — **prior candidate P0 withdrawn** |
| `177 → 11` explained | ✅ **Explained** — measurement-unit error (§12) |
| Event assignment audited | 🟡 No evidence of any; review table not re-counted |
| Deletion / reset excluded | 🟡 No evidence of any; Workpack `deleted_at` not counted |
| Data confirmed synthetic | 🟡 Highly likely; not organisation-certified |
| **Real client data excluded** | ❌ **Not established** — the binding blocker |
| Synthetic-data disposition complete | ❌ Not complete |

**Gate fails on one condition only: real client data has not been excluded.** That is
answered by a single query (§20.1).

**R1.0-C remains BLOCKED.**

---

## 20. The five read-only queries that close this gate

`SELECT`-only. No `INSERT`, `UPDATE`, `DELETE`, or DDL. Run in order; **20.1 is the
binding one.**

```sql
-- ════════════════════════════════════════════════════════════════════════════
-- 20.1  BINDING: does any organisation hold non-.test users?   (§16)
-- ════════════════════════════════════════════════════════════════════════════
SELECT o.id, o.slug, o.name, o.created_at,
       COUNT(u.id)                                              AS users,
       COUNT(u.id) FILTER (WHERE u.email NOT LIKE '%.test')      AS real_domain_users,
       ARRAY_AGG(DISTINCT SPLIT_PART(u.email,'@',2))             AS email_domains
FROM "Organization" o
LEFT JOIN "User" u ON u.organization_id = o.id
GROUP BY o.id, o.slug, o.name, o.created_at
ORDER BY o.created_at;
-- Fixture-only ⇔ real_domain_users = 0
-- EXPECTED single exception: the org holding info@syority.com
-- 🔴 STOP if any OTHER org returns real_domain_users > 0 — possible real client data

-- ════════════════════════════════════════════════════════════════════════════
-- 20.2  The query never run in any phase: the real Workpack census   (§2, §14)
-- ════════════════════════════════════════════════════════════════════════════
SELECT COUNT(*)                                                          AS workpacks_total,
       COUNT(*) FILTER (WHERE deleted_at IS NULL)                        AS workpacks_live,
       COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)                    AS soft_deleted,
       COUNT(*) FILTER (WHERE deleted_at IS NULL AND event_id IS NULL)    AS event_less,
       COUNT(*) FILTER (WHERE deleted_at IS NULL AND event_id IS NOT NULL)AS event_linked,
       COUNT(*) FILTER (WHERE deleted_at IS NULL AND project_id IS NOT NULL) AS project_linked,
       MIN(created_at) AS earliest, MAX(created_at) AS latest
FROM "Workpack";
-- event_less ≈ 177, soft_deleted = 0  → §12 CONFIRMED. Nothing happened. Gate clears
-- soft_deleted ≈ 166                  → 🔴 rows were soft-deleted. INVESTIGATE
-- workpacks_total ≈ 11–20             → 🔴 §12.3 contradicted. Reset after all. INVESTIGATE

SELECT COUNT(*) AS project_rows FROM "Project";     -- expect 0

-- ════════════════════════════════════════════════════════════════════════════
-- 20.3  Fingerprint test: do the R0.4-C named rows survive, and is 7+2+2 = 11?
-- ════════════════════════════════════════════════════════════════════════════
SELECT w.id, w.workpack_number, w.title, w.event_id, w.deleted_at, w.created_at,
       o.slug AS org, u.email AS created_by_email,
       (SELECT COUNT(*) FROM "Activity" a
         WHERE a.workpack_id = w.id AND a.deleted_at IS NULL) AS live_activities
FROM "Workpack" w
JOIN "Organization" o ON o.id = w.organization_id
JOIN "User" u ON u.id = w.created_by
WHERE w.id IN ('cb290c59-4bdd-45a5-a153-8bc8ecd43fd8',
               '7bec67b4-e2bf-4cf7-92b1-6f0842b87e69',
               'a87e5f8f-4fd4-4ef0-92ea-4527c7fbc9ca');
-- All 3 present, event_id NULL, activities summing to 11 → §12.2 PROVEN
-- Any row missing                                       → 🔴 deletion occurred

-- ════════════════════════════════════════════════════════════════════════════
-- 20.4  Was any Event assigned, and was it human-reviewed?   (§13)
-- ════════════════════════════════════════════════════════════════════════════
SELECT COUNT(*) AS review_rows,
       COUNT(*) FILTER (WHERE confirmed_event_id IS NOT NULL) AS assignments,
       COUNT(*) FILTER (WHERE confirmed_event_id IS NOT NULL
                          AND reviewer_id IS NULL
                          AND approver_id IS NULL)            AS unreviewed_assignments
FROM workpack_identity_reviews;
-- All 0 → no assignment ever occurred
-- 🔴 unreviewed_assignments > 0 → P0: assignment bypassed human review. STOP

-- ════════════════════════════════════════════════════════════════════════════
-- 20.5  Independent audit trail for Workpack mutations   (§11, §14)
-- ════════════════════════════════════════════════════════════════════════════
SELECT event, COUNT(*) AS occurrences,
       MIN(created_at) AS first_seen, MAX(created_at) AS last_seen
FROM "AuditLog"
WHERE auditable_type ILIKE '%workpack%'
GROUP BY event ORDER BY occurrences DESC;
-- Look for bulk assign/delete events near the census dates.
-- No mass assign/delete event → §13 and §14 confirmed independently
```

**If 20.1 shows only `info@syority.com` as non-`.test`, and 20.2 returns
`event_less ≈ 177` with `soft_deleted = 0`, then: nothing happened, the data is
synthetic, the gate clears, and R1.0-C is unblocked.**

---

## 21. Confirmations

| Assertion | Status |
|---|---|
| Product code modified | ❌ **No** |
| Prisma schema modified | ❌ **No** |
| Migration created | ❌ **No** |
| Tests modified | ❌ **No** |
| Database rows read | ❌ **No** — no connection opened |
| Database rows deleted / updated | ❌ **No** |
| Event assigned or created | ❌ **No** |
| Workpack or Activity updated | ❌ **No** |
| `prisma migrate` / `reset` / `seed` run | ❌ **No** |
| Git clean / reset / checkout | ❌ **No** |
| R1.0-C started | ❌ **No** |
| Forensic documentation deleted | ❌ **No** — all preserved |
| Files changed by this job | **This document only** |
