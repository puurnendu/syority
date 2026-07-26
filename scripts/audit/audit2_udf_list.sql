SELECT code, name, type, is_mandatory, is_active
FROM "ActivityUdfDefinition"
WHERE deleted_at IS NULL
ORDER BY code;
