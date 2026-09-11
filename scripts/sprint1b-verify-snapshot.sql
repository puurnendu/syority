SELECT
  COUNT(*) FILTER (WHERE planned_start IS NOT NULL) AS planned_start_n,
  COUNT(*) FILTER (WHERE planned_end   IS NOT NULL) AS planned_end_n,
  COUNT(*) FILTER (WHERE planned_start_override IS NOT NULL) AS start_override_n,
  COUNT(*) FILTER (WHERE planned_end_override   IS NOT NULL) AS end_override_n,
  COUNT(*) FILTER (WHERE planned_override_reason IS NOT NULL) AS reason_n,
  COUNT(*) FILTER (WHERE planned_start IS NOT NULL AND planned_start_override IS DISTINCT FROM planned_start) AS start_mismatch,
  COUNT(*) FILTER (WHERE planned_end   IS NOT NULL AND planned_end_override   IS DISTINCT FROM planned_end)   AS end_mismatch
FROM "Activity";
