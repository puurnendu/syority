-- Sprint 1b — CPM-authoritative planned dates + audited override mechanism
-- (E2E lineage audit §7.3/§7.5, Phase 1 items 9-10; §29 regression risk 3).
--
-- ADDITIVE. Seven new nullable columns on "Activity". No existing column is
-- retyped or dropped.
--
--   planned_start_override / planned_end_override  — planner's deliberate pin
--   planned_derived_start  / planned_derived_end   — CPM's computed value,
--           preserved so an override never destroys the derived truth
--   planned_override_reason / _by / _at            — audit trail
--
-- SNAPSHOT (audit §29 risk 3 — BEFORE any UI flip): every currently
-- planner-typed planned date becomes an active override so CPM authority does
-- not silently erase existing work. The CPM-computed value at snapshot time
-- (early_start/early_finish, may be NULL where CPM never ran) is preserved as
-- the derived value.
-- Census immediately before apply (2026-09-10): 45 live + 1 deleted
-- planned_start (46), 23 live planned_end. Snapshot includes the deleted
-- row so the 1a 46/23 count is preserved exactly.

ALTER TABLE "Activity"
  ADD COLUMN "planned_start_override"  timestamptz(3),
  ADD COLUMN "planned_end_override"    timestamptz(3),
  ADD COLUMN "planned_derived_start"   timestamptz(3),
  ADD COLUMN "planned_derived_end"     timestamptz(3),
  ADD COLUMN "planned_override_reason" text,
  ADD COLUMN "planned_override_by"     uuid,
  ADD COLUMN "planned_override_at"     timestamptz(3);

UPDATE "Activity"
SET
  "planned_start_override"  = "planned_start",
  "planned_end_override"    = "planned_end",
  "planned_derived_start"   = "early_start",
  "planned_derived_end"     = "early_finish",
  "planned_override_reason" = 'pre-1b snapshot: planner-typed value preserved before CPM became authoritative',
  "planned_override_at"     = now()
WHERE "planned_start" IS NOT NULL OR "planned_end" IS NOT NULL;
