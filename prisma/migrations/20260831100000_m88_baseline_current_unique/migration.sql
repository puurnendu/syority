-- M8.8 — Phase C: Baseline is_current Uniqueness Constraint
-- Generated: 2026-08-31
-- Purpose: Enforce at most ONE is_current baseline per event
--
-- This uses a PostgreSQL partial unique index:
--   Only rows where is_current = true are constrained.
--   Multiple rows with is_current = false for the same event are allowed.
--
-- Safety: Uses IF NOT EXISTS and checks for duplicates before creating.

-- Step 1: Resolve any existing duplicates
-- For each event with multiple is_current = true, keep the most recent one
-- and set the rest to is_current = false
DO $$
DECLARE
  _event_id UUID;
  _count INT;
BEGIN
  FOR _event_id, _count IN
    SELECT event_id, COUNT(*) as cnt
    FROM "ScheduleBaseline"
    WHERE is_current = true AND event_id IS NOT NULL
    GROUP BY event_id
    HAVING COUNT(*) > 1
  LOOP
    RAISE NOTICE 'Event % has % current baselines — resolving', _event_id, _count;
    UPDATE "ScheduleBaseline"
    SET is_current = false, updated_at = NOW()
    WHERE event_id = _event_id
      AND is_current = true
      AND id != (
        SELECT id FROM "ScheduleBaseline"
        WHERE event_id = _event_id AND is_current = true
        ORDER BY created_at DESC
        LIMIT 1
      );
  END LOOP;
END $$;

-- Step 2: Create partial unique index
-- Only ONE baseline per event can have is_current = true
CREATE UNIQUE INDEX IF NOT EXISTS "ScheduleBaseline_event_id_is_current_unique"
  ON "ScheduleBaseline" ("event_id")
  WHERE is_current = true;
