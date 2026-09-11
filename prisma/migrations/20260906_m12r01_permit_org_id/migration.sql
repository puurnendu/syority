-- M12-R0.1: Add organization_id to Permit for tenant isolation
-- Root cause: Permit model had no org_id, PermitService queries by it (silently returns empty),
-- tenantGuard 'permit' case only checks WHERE id=? without org filter
ALTER TABLE "Permit" ADD COLUMN IF NOT EXISTS "organization_id" TEXT;

-- Backfill from related workpack
UPDATE "Permit" p
SET "organization_id" = (
  SELECT w."organization_id" FROM "Workpack" w WHERE w."id" = p."workpack_id" LIMIT 1
)
WHERE p."workpack_id" IS NOT NULL
  AND p."organization_id" IS NULL;

-- Index for tenant-scoped permit queries
CREATE INDEX IF NOT EXISTS "Permit_organization_id_status_idx" ON "Permit"("organization_id", "status");
