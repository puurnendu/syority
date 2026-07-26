SELECT
  a.hold_point_type     AS native_hold_point,
  uv.value_string       AS udf_hold_point,
  COUNT(*) AS cnt
FROM "Activity" a
LEFT JOIN "ActivityUdfValue" uv ON uv.activity_id = a.id
LEFT JOIN "ActivityUdfDefinition" ud ON ud.id = uv.udf_definition_id AND ud.code ILIKE '%hold%'
WHERE a.deleted_at IS NULL
GROUP BY 1, 2
ORDER BY cnt DESC
LIMIT 20;
