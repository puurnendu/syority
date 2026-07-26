SELECT id, code, name, type, is_mandatory
FROM "ActivityUdfDefinition"
WHERE code = 'discipline'
AND deleted_at IS NULL;
