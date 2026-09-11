-- AlterTable
ALTER TABLE "BaselineActivity" ALTER COLUMN "organization_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "schedule_change_requests" ADD COLUMN     "source_scenario_id" UUID,
ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "schedule_scenarios" ADD COLUMN     "base_baseline_id" UUID,
ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "ScenarioActivityOverride" (
    "id" UUID NOT NULL,
    "scenario_id" UUID NOT NULL,
    "activity_id" UUID NOT NULL,
    "duration_hours" DECIMAL(8,2),
    "planned_start" DATE,
    "planned_end" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "early_start_constraint" TIMESTAMP(3),

    CONSTRAINT "ScenarioActivityOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScenarioActivityOverride_scenario_id_activity_id_key" ON "ScenarioActivityOverride"("scenario_id", "activity_id");

-- AddForeignKey
ALTER TABLE "schedule_scenarios" ADD CONSTRAINT "schedule_scenarios_base_baseline_id_fkey" FOREIGN KEY ("base_baseline_id") REFERENCES "ScheduleBaseline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioActivityOverride" ADD CONSTRAINT "ScenarioActivityOverride_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "schedule_scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioActivityOverride" ADD CONSTRAINT "ScenarioActivityOverride_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "Activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_change_requests" ADD CONSTRAINT "schedule_change_requests_source_scenario_id_fkey" FOREIGN KEY ("source_scenario_id") REFERENCES "schedule_scenarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create unique partial index for current baseline  
CREATE UNIQUE INDEX "unique_current_baseline" ON "ScheduleBaseline" ("event_id") WHERE "is_current" = true; 
