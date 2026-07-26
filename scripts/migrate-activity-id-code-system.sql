-- ── Organisation: add activity_id_increment setting ───────
ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS activity_id_increment INTEGER NOT NULL DEFAULT 3;

-- ── ActivityLibrary: add activity_code column ─────────────
ALTER TABLE "activity_libraries"
  ADD COLUMN IF NOT EXISTS activity_code TEXT;

-- Unique activity_code per org
CREATE UNIQUE INDEX IF NOT EXISTS uq_activity_lib_code_org
  ON "activity_libraries"(organization_id, activity_code)
  WHERE deleted_at IS NULL AND activity_code IS NOT NULL;

-- Backfill activity_code for all existing library entries
-- Format: A0001, A0002... ordered by created_at
WITH numbered AS (
  SELECT
    id,
    organization_id,
    'A' || LPAD(
      ROW_NUMBER() OVER (
        PARTITION BY organization_id
        ORDER BY created_at ASC
      )::TEXT,
      4, '0'
    ) AS new_code
  FROM activity_libraries
  WHERE deleted_at IS NULL
)
UPDATE activity_libraries al
SET activity_code = n.new_code
FROM numbered n
WHERE al.id = n.id AND al.activity_code IS NULL;

-- ── Activities: add activity_id and event_id columns ───────
ALTER TABLE "activities"
  ADD COLUMN IF NOT EXISTS activity_id TEXT,
  ADD COLUMN IF NOT EXISTS event_id UUID;

-- Unique activity_id per STO/event (event_id on activities)
CREATE UNIQUE INDEX IF NOT EXISTS uq_activity_id_per_event
  ON "activities"(activity_id, event_id)
  WHERE deleted_at IS NULL AND activity_id IS NOT NULL AND event_id IS NOT NULL;

-- Backfill event_id from workpack
UPDATE activities a
SET event_id = w.event_id
FROM workpacks w
WHERE a.workpack_id = w.id AND a.event_id IS NULL AND a.deleted_at IS NULL;

-- Backfill activity_id for existing activities using workpack asset tag + serial with gap of 3
WITH workpack_serials AS (
  SELECT
    a.id,
    a.workpack_id,
    e.tag_number AS equipment_tag,
    ROW_NUMBER() OVER (
      PARTITION BY a.workpack_id
      ORDER BY a.created_at ASC
    ) AS rn
  FROM activities a
  JOIN workpacks w ON w.id = a.workpack_id
  JOIN assets e ON e.id = w.asset_id
  WHERE a.deleted_at IS NULL
)
UPDATE activities a
SET activity_id =
  ws.equipment_tag || '-' ||
  LPAD(((ws.rn - 1) * 3 + 1)::TEXT, 3, '0')
FROM workpack_serials ws
WHERE a.id = ws.id AND a.activity_id IS NULL;
