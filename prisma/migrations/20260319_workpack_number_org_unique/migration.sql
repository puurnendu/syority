-- Manual migration (do NOT run `prisma migrate dev`).
-- Goal: make workpack_number unique per organization, not globally.

ALTER TABLE "Workpack"
DROP CONSTRAINT IF EXISTS "Workpack_workpack_number_key";

DROP INDEX IF EXISTS "Workpack_workpack_number_key";

CREATE UNIQUE INDEX IF NOT EXISTS "workpack_org_number_unique"
ON "Workpack" ("organization_id", "workpack_number")
WHERE "workpack_number" IS NOT NULL;

