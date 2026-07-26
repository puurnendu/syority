SELECT
  ud.code        AS udf_code,
  ud.name        AS udf_label,
  ud.type        AS udf_type,
  c.column_name  AS matching_column,
  c.table_name   AS on_table
FROM "ActivityUdfDefinition" ud
JOIN information_schema.columns c
  ON c.table_schema = 'public'
  AND ( LOWER(c.column_name) = LOWER(ud.code)
     OR LOWER(c.column_name) LIKE '%' || LOWER(ud.code) || '%' )
  AND LOWER(c.table_name) IN ('activity', 'workpack', 'jointintegrityitem', 'blind')
WHERE ud.deleted_at IS NULL
ORDER BY ud.code;
