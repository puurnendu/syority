-- M12-R0.1: Add shift column to ProgressLog for execution shift context
-- Root cause: FieldExecutionService writes shift to ProgressLog but column was missing from schema
ALTER TABLE "ProgressLog" ADD COLUMN IF NOT EXISTS "shift" TEXT DEFAULT 'day';
