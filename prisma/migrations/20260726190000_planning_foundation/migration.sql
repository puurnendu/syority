-- M6.1–M6.2 Planning Foundation: Event refinement + Enterprise Workpack Templates

-- Event refinements
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "parent_event_id" UUID;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "calendar_id" UUID;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "discipline_id" UUID;

CREATE INDEX IF NOT EXISTS "events_parent_event_id_idx" ON "events"("parent_event_id");

DO $$ BEGIN
  ALTER TABLE "events"
    ADD CONSTRAINT "events_parent_event_id_fkey"
    FOREIGN KEY ("parent_event_id") REFERENCES "events"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "events"
    ADD CONSTRAINT "events_calendar_id_fkey"
    FOREIGN KEY ("calendar_id") REFERENCES "ScheduleCalendar"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "events"
    ADD CONSTRAINT "events_discipline_id_fkey"
    FOREIGN KEY ("discipline_id") REFERENCES "Discipline"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Event milestones
CREATE TABLE IF NOT EXISTS "event_milestones" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "event_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "milestone_type" TEXT NOT NULL DEFAULT 'planning',
  "planned_date" DATE,
  "actual_date" DATE,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "created_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "event_milestones_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "event_milestones_event_id_sort_order_idx"
  ON "event_milestones"("event_id", "sort_order");

DO $$ BEGIN
  ALTER TABLE "event_milestones"
    ADD CONSTRAINT "event_milestones_event_id_fkey"
    FOREIGN KEY ("event_id") REFERENCES "events"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Template enums
DO $$ BEGIN
  CREATE TYPE "TemplateLibraryScope" AS ENUM ('PLATFORM', 'TENANT', 'KNOWLEDGE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TemplateLifecycleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'DEPRECATED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Drop old unique that blocks versioning
ALTER TABLE "workpack_templates"
  DROP CONSTRAINT IF EXISTS "workpack_templates_organization_id_equipment_type_job_type_key";

ALTER TABLE "workpack_templates" ADD COLUMN IF NOT EXISTS "template_family_id" UUID;
ALTER TABLE "workpack_templates" ADD COLUMN IF NOT EXISTS "revision" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "workpack_templates" ADD COLUMN IF NOT EXISTS "version_label" TEXT;
ALTER TABLE "workpack_templates" ADD COLUMN IF NOT EXISTS "library_scope" "TemplateLibraryScope" NOT NULL DEFAULT 'TENANT';
ALTER TABLE "workpack_templates" ADD COLUMN IF NOT EXISTS "lifecycle_status" "TemplateLifecycleStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "workpack_templates" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "workpack_templates" ADD COLUMN IF NOT EXISTS "equipment_class" TEXT;
ALTER TABLE "workpack_templates" ADD COLUMN IF NOT EXISTS "discipline_id" UUID;
ALTER TABLE "workpack_templates" ADD COLUMN IF NOT EXISTS "planning_json" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "workpack_templates" ADD COLUMN IF NOT EXISTS "resources_json" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "workpack_templates" ADD COLUMN IF NOT EXISTS "materials_json" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "workpack_templates" ADD COLUMN IF NOT EXISTS "safety_json" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "workpack_templates" ADD COLUMN IF NOT EXISTS "qaqc_json" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "workpack_templates" ADD COLUMN IF NOT EXISTS "references_json" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "workpack_templates" ADD COLUMN IF NOT EXISTS "ai_metadata_json" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "workpack_templates" ADD COLUMN IF NOT EXISTS "updated_by" UUID;
ALTER TABLE "workpack_templates" ADD COLUMN IF NOT EXISTS "published_at" TIMESTAMP(3);
ALTER TABLE "workpack_templates" ADD COLUMN IF NOT EXISTS "deprecated_at" TIMESTAMP(3);
ALTER TABLE "workpack_templates" ADD COLUMN IF NOT EXISTS "cloned_from_id" UUID;
ALTER TABLE "workpack_templates" ADD COLUMN IF NOT EXISTS "knowledge_asset_id" UUID;

-- Backfill family id + publish existing system/active templates
UPDATE "workpack_templates"
SET "template_family_id" = "id"
WHERE "template_family_id" IS NULL;

UPDATE "workpack_templates"
SET
  "lifecycle_status" = CASE WHEN "is_active" THEN 'PUBLISHED'::"TemplateLifecycleStatus" ELSE 'DEPRECATED'::"TemplateLifecycleStatus" END,
  "library_scope" = CASE WHEN "is_system" OR "organization_id" IS NULL THEN 'PLATFORM'::"TemplateLibraryScope" ELSE "library_scope" END,
  "published_at" = COALESCE("published_at", "created_at")
WHERE "template_family_id" IS NOT NULL;

ALTER TABLE "workpack_templates" ALTER COLUMN "template_family_id" SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE "workpack_templates"
    ADD CONSTRAINT "workpack_templates_template_family_id_revision_key"
    UNIQUE ("template_family_id", "revision");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "workpack_templates_library_scope_lifecycle_status_idx"
  ON "workpack_templates"("library_scope", "lifecycle_status");
CREATE INDEX IF NOT EXISTS "workpack_templates_organization_id_name_idx"
  ON "workpack_templates"("organization_id", "name");

-- Logic links
CREATE TABLE IF NOT EXISTS "workpack_template_logic_links" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "template_id" UUID NOT NULL,
  "predecessor_seq" INTEGER NOT NULL,
  "successor_seq" INTEGER NOT NULL,
  "link_type" TEXT NOT NULL DEFAULT 'FS',
  "lag_hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workpack_template_logic_links_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "workpack_template_logic_links_template_id_idx"
  ON "workpack_template_logic_links"("template_id");
