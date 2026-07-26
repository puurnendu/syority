SELECT u.email, o.name AS org, r.slug
FROM "User" u
JOIN "Organization" o ON o.id = u.organization_id
LEFT JOIN "UserRole" ur ON ur.user_id = u.id
LEFT JOIN "Role" r ON r.id = ur.role_id
WHERE u.deleted_at IS NULL
ORDER BY u.email;
