-- R0.1 — index the denormalized Activity.event_id used by event-scoped reads.
-- Additive only. Does not backfill or change nullability.
CREATE INDEX IF NOT EXISTS "Activity_org_event_deleted_idx"
ON "Activity" ("organization_id", "event_id", "deleted_at");
