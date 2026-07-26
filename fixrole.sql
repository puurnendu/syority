-- Check current roles for info@syority.com
SELECT r.name, r.slug 
FROM "User" u 
JOIN "UserRole" ur ON u.id = ur.user_id 
JOIN "Role" r ON ur.role_id = r.id 
WHERE u.email = 'info@syority.com';

-- Show all roles in DB
SELECT id, name, slug FROM "Role" ORDER BY created_at;

-- Fix the slug: rename any platform/super admin role to the expected slug
UPDATE "Role" 
SET slug = 'platform_super_admin' 
WHERE (slug ILIKE '%platform%' OR slug ILIKE '%syority%' OR name ILIKE '%platform%super%' OR name ILIKE '%super%admin%')
  AND slug != 'platform_super_admin';

-- Confirm fix
SELECT r.name, r.slug 
FROM "User" u 
JOIN "UserRole" ur ON u.id = ur.user_id 
JOIN "Role" r ON ur.role_id = r.id 
WHERE u.email = 'info@syority.com';
