-- OD9.3 — Portfolio + Project-owned WBS.
--
-- Live evidence before this migration (syority, 2026-09-10):
--   Project            0 rows
--   wbs_nodes          0 rows
--   events            51 rows
--   Workpack         235 rows (18 event-scoped, 0 project-scoped)
--   ScheduleBaseline  10 rows
--
-- wbs_nodes.event_id is currently NOT NULL. With 0 rows, relaxing it cannot
-- reclassify Event WBS as Project WBS. Existing Event WBS consumers keep
-- writing event_id. A CHECK enforces exactly-one owner so a node cannot be
-- unowned or dual-owned.
--
-- project_id is TEXT to match "Project".id (text). A UUID project_id cannot
-- hold a real FK to Project (OD9-042).
--
-- Workpack.portfolio_id is a leftover UUID column with no Portfolio model
-- and is NOT wired to the new portfolios table.
--
-- Additive except: ALTER wbs_nodes.event_id DROP NOT NULL.
-- Reversible: DROP new objects, then SET event_id NOT NULL (safe while
-- project-owned rows are removed first).

-- 1. Portfolio
CREATE TABLE "portfolios" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "owner_user_id" UUID,
    "category" TEXT,
    "start_date" TIMESTAMP(3),
    "finish_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "portfolios_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "portfolios_organization_id_code_key" ON "portfolios"("organization_id", "code");
CREATE INDEX "portfolios_organization_id_idx" ON "portfolios"("organization_id");

ALTER TABLE "portfolios"
  ADD CONSTRAINT "portfolios_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2. Project.portfolio_id (optional — standalone Project remains possible)
ALTER TABLE "Project" ADD COLUMN "portfolio_id" UUID;
CREATE INDEX "Project_portfolio_id_idx" ON "Project"("portfolio_id");
ALTER TABLE "Project"
  ADD CONSTRAINT "Project_portfolio_id_fkey"
  FOREIGN KEY ("portfolio_id") REFERENCES "portfolios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Project communications foundation
CREATE TABLE "project_communications" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "project_id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'note',
    "subject" TEXT NOT NULL,
    "body" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_communications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "project_communications_organization_id_project_id_idx"
  ON "project_communications"("organization_id", "project_id");

ALTER TABLE "project_communications"
  ADD CONSTRAINT "project_communications_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "project_communications"
  ADD CONSTRAINT "project_communications_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "Project"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. WBS dual ownership
ALTER TABLE "wbs_nodes" ALTER COLUMN "event_id" DROP NOT NULL;

ALTER TABLE "wbs_nodes" ADD COLUMN "project_id" TEXT;

ALTER TABLE "wbs_nodes"
  ADD CONSTRAINT "wbs_nodes_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "Project"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wbs_nodes"
  ADD CONSTRAINT "wbs_nodes_exactly_one_owner"
  CHECK (
    ("event_id" IS NOT NULL AND "project_id" IS NULL)
    OR
    ("event_id" IS NULL AND "project_id" IS NOT NULL)
  );

CREATE INDEX "wbs_nodes_organization_id_project_id_idx"
  ON "wbs_nodes"("organization_id", "project_id");

-- Parent must share the same owner. Application also validates; this trigger
-- is the last line of defence against a Project node parenting an Event node.
CREATE OR REPLACE FUNCTION wbs_nodes_parent_same_owner()
RETURNS trigger AS $$
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM wbs_nodes p
    WHERE p.id = NEW.parent_id
      AND p.organization_id = NEW.organization_id
      AND p.event_id IS NOT DISTINCT FROM NEW.event_id
      AND p.project_id IS NOT DISTINCT FROM NEW.project_id
  ) THEN
    RAISE EXCEPTION 'WBS parent must belong to the same owner (event or project) and organisation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS wbs_nodes_parent_same_owner_trg ON wbs_nodes;
CREATE TRIGGER wbs_nodes_parent_same_owner_trg
BEFORE INSERT OR UPDATE OF parent_id, event_id, project_id, organization_id
ON wbs_nodes
FOR EACH ROW EXECUTE FUNCTION wbs_nodes_parent_same_owner();

-- 5. Workpack → WBS association (optional). Not Activity.project_id.
ALTER TABLE "Workpack" ADD COLUMN "wbs_node_id" UUID;
CREATE INDEX "Workpack_wbs_node_id_idx" ON "Workpack"("wbs_node_id");
ALTER TABLE "Workpack"
  ADD CONSTRAINT "Workpack_wbs_node_id_fkey"
  FOREIGN KEY ("wbs_node_id") REFERENCES "wbs_nodes"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
