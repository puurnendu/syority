-- M15-R4: append-only management decision journal.
-- Not an execution store. Not BRE. No Activity/Workpack mutation.

CREATE TABLE IF NOT EXISTS "m15_management_decisions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "event_id" UUID NOT NULL,
  "recommendation_id" TEXT NOT NULL,
  "decided_by" UUID NOT NULL,
  "decision" TEXT NOT NULL,
  "rationale" TEXT,
  "source_channel" TEXT NOT NULL,
  "related_scenario_id" UUID,
  "evidence_snapshot" JSONB,
  "status" TEXT NOT NULL DEFAULT 'RECORDED',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "m15_management_decisions_org_event_created_idx"
  ON "m15_management_decisions"("organization_id", "event_id", "created_at");
CREATE INDEX IF NOT EXISTS "m15_management_decisions_recommendation_idx"
  ON "m15_management_decisions"("recommendation_id");
CREATE INDEX IF NOT EXISTS "m15_management_decisions_decided_by_idx"
  ON "m15_management_decisions"("decided_by");
