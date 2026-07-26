SELECT
  a."discipline_id"     AS activity_discipline_id,
  uv.value_string       AS udf_discipline_value,
  COUNT(*)              AS cnt
FROM "Activity" a
LEFT JOIN "ActivityUdfValue" uv ON uv.activity_id = a.id
LEFT JOIN "ActivityUdfDefinition" ud ON ud.id = uv.udf_definition_id AND ud.code = 'discipline'
WHERE a.deleted_at IS NULL
GROUP BY 1, 2
ORDER BY cnt DESC
LIMIT 20;
