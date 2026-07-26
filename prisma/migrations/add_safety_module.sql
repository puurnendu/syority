-- Drop existing safety tables if they exist (e.g. old project-scoped SafetyLog with different schema)
DROP TABLE IF EXISTS "SafetyPhoto";
DROP TABLE IF EXISTS "SafetyIncident";
DROP TABLE IF EXISTS "SafetyLog";

-- Daily safety log (one per day per event, multiple contributors)
CREATE TABLE "SafetyLog" (
  "id"                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_id"              UUID NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "project_id"            UUID,
  "log_date"              DATE NOT NULL,
  "shift"                 TEXT DEFAULT 'day',
  "manpower_planned"      INTEGER DEFAULT 0,
  "manpower_actual"       INTEGER DEFAULT 0,
  "lti"                   INTEGER DEFAULT 0,
  "lti_days_lost"         INTEGER DEFAULT 0,
  "near_miss"             INTEGER DEFAULT 0,
  "first_aid"             INTEGER DEFAULT 0,
  "medical_treatment"     INTEGER DEFAULT 0,
  "dangerous_occurrence"  INTEGER DEFAULT 0,
  "ptw_issued"            INTEGER DEFAULT 0,
  "ptw_closed"            INTEGER DEFAULT 0,
  "ptw_suspended"         INTEGER DEFAULT 0,
  "toolbox_talks"         INTEGER DEFAULT 0,
  "manhours_worked"       NUMERIC DEFAULT 0,
  "manhours_planned"      NUMERIC DEFAULT 0,
  "cumulative_manhours"   NUMERIC DEFAULT 0,
  "cumulative_lti"        INTEGER DEFAULT 0,
  "lti_frequency_rate"    NUMERIC DEFAULT 0,
  "safety_notes"          TEXT,
  "submitted_by"          TEXT,
  "submitted_by_name"     TEXT,
  "last_updated_by"       TEXT,
  "last_updated_by_name"  TEXT,
  "created_at"            TIMESTAMPTZ DEFAULT now(),
  "updated_at"            TIMESTAMPTZ DEFAULT now(),
  UNIQUE("event_id", "log_date")
);

CREATE TABLE "SafetyIncident" (
  "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "safety_log_id"     UUID NOT NULL REFERENCES "SafetyLog"("id") ON DELETE CASCADE,
  "event_id"          UUID NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "incident_date"     TIMESTAMPTZ NOT NULL,
  "incident_time"     TEXT,
  "incident_type"     TEXT NOT NULL,
  "severity"          TEXT DEFAULT 'Low',
  "title"             TEXT NOT NULL,
  "description"       TEXT NOT NULL,
  "location"          TEXT,
  "unit_area"         TEXT,
  "contractor"        TEXT,
  "persons_involved"  TEXT,
  "immediate_action"  TEXT,
  "root_cause"        TEXT,
  "root_cause_category" TEXT,
  "contributing_factors" TEXT,
  "corrective_actions"   TEXT,
  "preventive_actions"   TEXT,
  "action_owner"         TEXT,
  "action_due_date"      DATE,
  "action_completed_date" DATE,
  "status"               TEXT DEFAULT 'Open',
  "investigation_by"     TEXT,
  "closed_by"            TEXT,
  "closed_at"            TIMESTAMPTZ,
  "remarks"              TEXT,
  "reported_by"          TEXT,
  "created_at"           TIMESTAMPTZ DEFAULT now(),
  "updated_at"           TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE "SafetyPhoto" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "safety_log_id"   UUID REFERENCES "SafetyLog"("id") ON DELETE CASCADE,
  "incident_id"     UUID REFERENCES "SafetyIncident"("id") ON DELETE CASCADE,
  "event_id"        UUID NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "photo_type"      TEXT DEFAULT 'general',
  "caption"         TEXT,
  "storage_path"    TEXT NOT NULL,
  "public_url"      TEXT NOT NULL,
  "file_size"       INTEGER,
  "mime_type"       TEXT,
  "uploaded_by"     TEXT,
  "uploaded_by_name" TEXT,
  "taken_at"        TIMESTAMPTZ DEFAULT now(),
  "created_at"      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "SafetyLog_event_date_idx" ON "SafetyLog"("event_id", "log_date");
CREATE INDEX IF NOT EXISTS "SafetyIncident_log_idx"   ON "SafetyIncident"("safety_log_id");
CREATE INDEX IF NOT EXISTS "SafetyPhoto_log_idx"       ON "SafetyPhoto"("safety_log_id");
CREATE INDEX IF NOT EXISTS "SafetyPhoto_incident_idx"  ON "SafetyPhoto"("incident_id");
