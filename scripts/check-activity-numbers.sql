SELECT
  a.id,
  a.description,
  a.activity_number,
  w.title as workpack_title
FROM "Activity" a
JOIN "Workpack" w ON w.id = a.workpack_id
WHERE a.deleted_at IS NULL
ORDER BY w.title, a.sequence_number
LIMIT 20;
