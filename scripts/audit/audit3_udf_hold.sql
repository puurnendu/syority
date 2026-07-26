SELECT code, name, type
FROM "ActivityUdfDefinition"
WHERE code ILIKE '%hold%'
AND deleted_at IS NULL;
