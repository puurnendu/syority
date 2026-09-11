-- OD9.1 / Phases 8 and 9 — make Activity.event_id a real foreign key, and index the
-- Event-scoped Workpack read path.
--
-- Activity.event_id has existed physically since R0.1 and is the column every
-- Event-scoped schedule query filters on, but no foreign key was ever created: the
-- 20260226000000_baseline migration declares Activity_event_id_fkey and that migration
-- has never executed (it aborts on an unrelated TEXT/UUID type conflict). R0.4 requires
-- Activity.event_id to agree with Workpack.event_id, and nothing was enforcing it.
--
-- Verified against live data before writing this migration:
--   73 activities; 69 with event_id, 4 NULL (nullable semantics preserved)
--    0 rows reference a non-existent event
--    0 rows reference an event in a different organization
--    0 rows reference a soft-deleted event
--   59 workpack-attached activities agree with their Workpack.event_id, 0 disagree
--
-- ON DELETE SET NULL ON UPDATE CASCADE mirrors the existing Workpack_event_id_fkey
-- exactly, so an Activity and its Workpack behave identically if an Event is ever hard
-- deleted. Events are retired by setting deleted_at, so this path is not the normal
-- lifecycle; matching Workpack is what keeps the two in agreement.
ALTER TABLE "Activity"
  ADD CONSTRAINT "Activity_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "events"("id")
  ON UPDATE CASCADE ON DELETE SET NULL;

-- Phase 9 — Workpack.event_id carries no index despite being the Event-scoped entry
-- point for every workpack read (and the FK above makes Activity/Workpack event
-- agreement checks routine). Additive only.
CREATE INDEX IF NOT EXISTS "Workpack_event_id_idx" ON "Workpack"("event_id");
