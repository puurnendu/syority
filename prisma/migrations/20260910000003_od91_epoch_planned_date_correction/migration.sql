-- OD9.1 / Phase 10 — clear three epoch planned dates on Activity.
--
-- Three activities carry planned_start = planned_end = 1970-01-01, stored as
-- 1969-12-31T18:30:00Z, i.e. Unix epoch midnight read in Asia/Kolkata. That is the
-- signature of `new Date(0)`, not a plan: all three are M8.9-P4 scenario test fixtures
-- ("Test Activity 1", activity_number NULL, created 2026-09-01), with zero relationships
-- and zero progress logs.
--
-- Evidence reviewed before choosing the remedy:
--   * BaselineActivity (1 per activity, is_current) holds real dates —
--     2026-09-01 10:00 to 20:00 IST, duration 10. These are independent historical
--     snapshots and are NOT touched. Copying them onto Activity would invert the
--     authority direction (M11 owns planned dates; a baseline is downstream of them)
--     and would manufacture a plan that never existed.
--   * ScenarioActivityOverride (2 per activity) override duration_hours only —
--     planned_start and planned_end are NULL on all six rows, and
--     early_start_constraint is NULL. They carry no date facts to preserve or
--     contradict, and are NOT touched.
--
-- Therefore the correction is to NULL the two Activity columns: both are already
-- nullable, so NULL is a representable state meaning "no planned date", which is the
-- truth. This replaces a false assertion with an honest absence and destroys no
-- information. Left in place, these values would convert to 1970-01-01T00:00+05:30
-- during the R1.0-C2 timestamptz migration and carry the defect forward.
--
-- Scoped by explicit primary key only. No date predicate is used, so the statement
-- cannot widen to other rows even if more epoch dates appear later. Exactly 3 rows are
-- expected; the post-condition (no pre-1980 planned date survives anywhere in Activity)
-- is asserted by the OD9.1 verification step and by behavioural test T15, not by a
-- procedural block here.
UPDATE "Activity"
SET "planned_start" = NULL,
    "planned_end"   = NULL
WHERE "id" IN (
  '1ac78091-0ad0-4c2b-aca4-f92b821dc113',
  'ccc8de63-3dbe-4c24-b946-98c282b953d2',
  'e5303f4d-941c-4ebb-9492-7ef8f42a8af8'
);
