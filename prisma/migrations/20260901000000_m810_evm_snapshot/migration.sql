-- M8.10: Enterprise EVM & Cost Intelligence
-- Create EvmSnapshot table for time-phased EVM curves and summaries

CREATE TABLE IF NOT EXISTS "EvmSnapshot" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "snapshot_date" TIMESTAMP(3) NOT NULL,
    "snapshot_type" TEXT NOT NULL,
    "curve_data" JSONB NOT NULL,
    "summary" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvmSnapshot_pkey" PRIMARY KEY ("id")
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS "EvmSnapshot_event_id_snapshot_date_idx" ON "EvmSnapshot"("event_id", "snapshot_date");
CREATE INDEX IF NOT EXISTS "EvmSnapshot_organization_id_idx" ON "EvmSnapshot"("organization_id");
