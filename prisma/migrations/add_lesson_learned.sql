-- Add lesson_learned and safety_id to SafetyIncident
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SafetyIncident' AND column_name = 'lesson_learned') THEN
    ALTER TABLE "SafetyIncident" ADD COLUMN "lesson_learned" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'SafetyIncident' AND column_name = 'safety_id') THEN
    ALTER TABLE "SafetyIncident" ADD COLUMN "safety_id" TEXT;
  END IF;
END $$;
